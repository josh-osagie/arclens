import crypto from "node:crypto";
import type { APIRoute } from "astro";

// ============================================================================
// Paddle Billing
// ============================================================================
//
// WHAT THIS DOES (STEP-BY-STEP FULFILMENT)
// ----------------------------------------
// After a customer pays on Paddle, Paddle POSTs an event to this URL:
//     POST https://your-site.com/api/paddle-webhook
//
// Step-by-step what this endpoint does on every incoming request:
//
//   1. READS THE RAW BODY + Paddle-Signature HEADER
//      The header looks like:  ts=1712345678;h1=abc123def456…
//      We split on ";" then "=" to get the unix timestamp (`ts`) and the
//      HMAC-SHA256 hex digest (`h1`).
//
//   2. VERIFIES THE SIGNATURE (prevents fake "I paid!" requests from randos)
//      Paddle signs `${ts}:${raw_body_string}` using HMAC-SHA256 with your
//      per-destination notification secret (PADDLE_NOTIFICATION_SECRET).
//      Important: the signed payload is NOT just the raw body.  The `ts:`
//      prefix is mandatory — miss it and every signature fails.
//
//   3. REPLAY PROTECTION (5-second tolerance, matches Paddle SDK default)
//      We compare `ts` to `Date.now()/1000`.  If the webhook is older than
//      5s we log it and drop it — someone could be replaying a captured
//      legit request.
//
//   4. DISPATCHES BY payload.event_type
//      transaction.completed / transaction.paid
//        → someone just paid — log txn id, customer email, grand total $
//      subscription.created / subscription.activated
//        → a recurring Pro sub was set up — log email, billing cycle, renewal
//      anything else
//        → log ℹ️ "no handler wired yet" (add more cases as you need them)
//
//   5. ALWAYS RETURNS 200 OK { ok: true }
//      Even on bad signatures!  Paddle retries non-2xx responses for 48
//      hours — you do NOT want 48h of retries because of a misconfigured
//      secret.  Log the error server-side and ack the webhook.
//
// ============================================================================
// 6-CLICK DASHBOARD CHECKLIST — WIRE THIS INTO PADDLE
// ============================================================================
// 1. Open  https://vendors.paddle.com/developer-tools/notifications
//              (Paddle → Developer Tools → Notifications)
// 2. Click "+ New destination"
// 3. Choose "Webhook" destination type
// 4. Paste the exact URL:  https://<YOUR-PROD-DOMAIN>/api/paddle-webhook
// 5. Tick the events you want delivered (at minimum):
//      • Transaction completed    → transaction.completed
//      • Transaction paid         → transaction.paid
//      • Subscription created     → subscription.created
//      • Subscription activated   → subscription.activated
//    (Add cancellation / renewal events later as you need them.)
// 6. Click "Save destination".  On the destination detail page you'll see
//    a "Notification secret" field — it usually starts with `pdl_ntfset_`.
//    Copy it and paste into your prod env as PADDLE_NOTIFICATION_SECRET.
//
//    (In Vercel: Project → Settings → Environment Variables → + New Variable.)
//
// ============================================================================
// PADDLE CLASSIC vs PADDLE BILLING — KNOW THE DIFFERENCE
// ============================================================================
// Paddle has TWO APIs and their webhook signatures are COMPLETELY DIFFERENT.
// If you copy old Classic code into this file, nothing will verify.
//
//   • Paddle Classic (OLD) — signature lives in the JSON BODY:
//        payload.p_signature  → serialized PHP array, openssl_verify, RSA
//
//   • Paddle Billing (THIS FILE) — signature lives in the HTTP HEADER:
//        Header: Paddle-Signature:  ts=<secs>;h1=<hex_sha256>
//        Algorithm: HMAC-SHA256
//        Signed string: `${ts}:${raw_body}`   (← ts colon prefix NON-NEGOTIABLE)
//
// You are on Paddle Billing.  If your dashboard links say
// "Paddle Billing" at the top-left, you're in the right place.
//
// Reference docs:
//   • Webhooks overview:  https://developer.paddle.com/webhooks/about/overview
//   • Signature verify:   https://developer.paddle.com/webhooks/about/signature-verification
//   • Events catalog:     https://developer.paddle.com/webhooks/events
//
// ============================================================================
// WHERE TO FIND THE ENV VARS IN THE PADDLE DASHBOARD
// ============================================================================
//   • PADDLE_NOTIFICATION_SECRET  ← per-destination, Developer Tools →
//                                    Notifications → (your webhook) →
//                                    "Notification secret" (pdl_ntfset_…)
//
//   • Paddle API keys (if you need the client/server SDK) are under
//     Developer Tools → Authentication.  Not needed for *this* file
//     (we only need the notification secret), but you'll want them for
//     creating one-off charges, listing transactions, etc.
//
// ============================================================================
// HOW TO TEST LOCALLY WITH CURL (no real Paddle account needed)
// ============================================================================
// In dev mode with NO PADDLE_NOTIFICATION_SECRET set, the endpoint accepts
// unsigned payloads.  Create a test fixture:
//
//   $ cat > /tmp/txn.json <<'EOF'
//   {
//     "event_type": "transaction.completed",
//     "event_id": "txnevt_01fake",
//     "data": {
//       "id": "txn_01fake",
//       "status": "completed",
//       "customer_id": "ctm_01fake",
//       "currency_code": "USD",
//       "customer": {
//         "email": "jane@example.com"
//       },
//       "details": {
//         "totals": {
//           "grand_total": "4900"
//         }
//       }
//     }
//   }
//   EOF
//
// Then POST it:
//
//   $ curl -X POST http://localhost:4321/api/paddle-webhook \
//          -H "Content-Type: application/json" \
//          --data-binary @/tmp/txn.json
//
// You should see the ✅ log line in your Astro dev server console and get
// back  {"ok":true}.
//
// To test SIGNATURE VERIFICATION locally, set PADDLE_NOTIFICATION_SECRET in
// www/.env, compute the HMAC in Node, then pass it via -H:
//
//   const ts = Math.floor(Date.now()/1000);
//   const body = require('fs').readFileSync('/tmp/txn.json','utf8');
//   const sig = require('crypto').createHmac('sha256','YOUR_SECRET')
//               .update(`${ts}:${body}`).digest('hex');
//   console.log(`Paddle-Signature: ts=${ts};h1=${sig}`);
//
// ============================================================================
// TODO: REAL FULFILMENT — replace the console.logs below with actual work
// ============================================================================
// When an event clears signature verification you probably want to:
//
//   a) SAVE TO YOUR DB
//        - Upsert customer row by email / paddle customer_id
//        - Insert transaction row (txn id, amount, currency, status)
//        - Upsert subscription row if it's a sub event
//
//   b) WELCOME EMAIL
//        - Resend / Postmark / SES — "Thanks for buying Arclens Pro!
//          Your license key is on the way…" (Paddle emails the receipt
//          automatically, but your own welcome email builds trust.)
//
//   c) SLACK / DISCORD NOTIFIER  (optional but motivating!)
//        - POST #payments channel:  🎉 Jane just bought Pro ($49.00)!
//
//   d) PROVISION ACCESS
//        - If you use license keys, generate & store one, then either:
//            i)  Email it to the customer in your welcome email, OR
//            ii) Tell them to fetch it from your dashboard at /account
//
// Paddle delivers subscription renewal / cancellation events too — add
// case blocks for `subscription.updated`, `subscription.canceled`,
// `transaction.updated` etc as you grow the fulfilment logic.
// ============================================================================

export const prerender = false;

const SIGNATURE_HEADER = "paddle-signature";
const REPLAY_TOLERANCE_SECONDS = 5;
const SECRET_ENV_NAME = "PADDLE_NOTIFICATION_SECRET";

type PaddleEventType =
  | "transaction.completed"
  | "transaction.paid"
  | "subscription.created"
  | "subscription.activated"
  | string;

type PaddleWebhookPayload = {
  event_type: PaddleEventType;
  event_id?: string;
  notification_id?: string;
  data?: {
    id?: string;
    status?: string;
    customer_id?: string | null;
    customer?: {
      email?: string;
    } | null;
    email?: string;
    currency_code?: string;
    details?: {
      totals?: {
        grand_total?: string | number;
      };
    };
    billing_cycle?: unknown;
    next_billed_at?: string;
    scheduled_change?: unknown;
  };
};

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

function extractPaddleSignature(
  headerValue: string | undefined | null
): { ts: string; h1: string } | null {
  if (!headerValue) return null;
  const parts = headerValue.split(";").map((p) => p.trim());
  let ts = "";
  let h1 = "";
  for (const part of parts) {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (key === "ts") ts = val;
    else if (key === "h1") h1 = val;
  }
  if (!ts || !h1) return null;
  return { ts, h1 };
}

export const POST: APIRoute = async ({ request }) => {
  const signingSecret = import.meta.env[SECRET_ENV_NAME] as string | undefined;

  let rawBody = "";
  try {
    rawBody = await request.text();
  } catch {
    rawBody = "";
  }

  // ---- Step 1: Signature verification + replay check -------------------
  const sigParts = extractPaddleSignature(
    request.headers.get(SIGNATURE_HEADER)
  );

  let signatureValid = false;
  let rejectionReason: string | null = null;

  if (!signingSecret) {
    // No secret configured.
    if (import.meta.env.PROD) {
      rejectionReason = `PROD MODE: ${SECRET_ENV_NAME} is not set. Refusing payload.`;
      console.error(`[paddle-webhook] ❌ ${rejectionReason}`);
      signatureValid = false;
    } else {
      signatureValid = true;
      console.warn(
        `[paddle-webhook] ⚠️  DEV MODE: accepting request WITHOUT signature verification because ${SECRET_ENV_NAME} is unset. Set it in www/.env to enable real checks.`
      );
    }
  } else {
    if (!sigParts) {
      rejectionReason =
        "Missing or malformed Paddle-Signature header (expected: ts=<secs>;h1=<hex64>)";
    } else {
      const { ts, h1: receivedHex } = sigParts;

      // Replay protection
      const tsNum = Number(ts);
      const now = Date.now() / 1000;
      if (
        !Number.isFinite(tsNum) ||
        Math.abs(now - tsNum) > REPLAY_TOLERANCE_SECONDS
      ) {
        rejectionReason = `Replay check failed: ts=${ts} now=${Math.floor(
          now
        )} tolerance=${REPLAY_TOLERANCE_SECONDS}s — payload too old or clock skewed.`;
      } else {
        // Build signed payload: `${ts}:${rawBody}`  (ts colon prefix MANDATORY)
        const signedPayload = `${ts}:${rawBody}`;
        const mac = crypto.createHmac("sha256", signingSecret);
        mac.update(signedPayload, "utf8");
        const expectedHex = mac.digest("hex");
        signatureValid = constantTimeEqual(
          Buffer.from(receivedHex, "hex"),
          Buffer.from(expectedHex, "hex")
        );
        if (!signatureValid) {
          rejectionReason = `HMAC mismatch. ts=${ts} received_h1=${receivedHex
            .slice(0, 12)}… expected_h1=${expectedHex.slice(0, 12)}…`;
        }
      }
    }
  }

  // ---- Step 2: Parse JSON ------------------------------------------------
  let payload: PaddleWebhookPayload | null = null;
  try {
    payload = rawBody ? (JSON.parse(rawBody) as PaddleWebhookPayload) : null;
  } catch {
    payload = null;
  }

  const eventType: PaddleEventType =
    payload?.event_type ?? "(unknown event_type)";
  const eventId =
    payload?.event_id ?? payload?.notification_id ?? "(no event_id)";

  if (!signatureValid) {
    if (rejectionReason) {
      console.error(
        `[paddle-webhook] ❌ INVALID signature. event=${eventType} id=${eventId} reason=${rejectionReason}. Dropping.`
      );
    } else {
      console.error(
        `[paddle-webhook] ❌ INVALID signature. event=${eventType} id=${eventId}. Dropping.`
      );
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ---- Step 3: Dispatch events ------------------------------------------
  const data = (payload?.data ?? {}) as NonNullable<PaddleWebhookPayload["data"]>;

  switch (eventType) {
    case "transaction.completed":
    case "transaction.paid": {
      const txnId = data.id ?? "?";
      const customerEmail =
        (data.customer && data.customer.email) ||
        (data as any).email ||
        "?";
      const grandTotalCents =
        data.details?.totals?.grand_total != null
          ? Number(data.details.totals.grand_total)
          : NaN;
      const grandTotalDollars = Number.isFinite(grandTotalCents)
        ? `$${(grandTotalCents / 100).toFixed(2)}`
        : "?";
      const currency = data.currency_code ?? "";
      console.log(
        `[paddle-webhook] ✅ ${eventType}   txn=${txnId}  email=${customerEmail}  total=${grandTotalDollars}${
          currency ? ` (${currency})` : ""
        }  id=${eventId}`
      );
      break;
    }

    case "subscription.created":
    case "subscription.activated": {
      const subId = data.id ?? "?";
      const customerEmail =
        (data.customer && data.customer.email) ||
        (data as any).email ||
        "?";
      const billingCycle = data.billing_cycle ?? "?";
      const nextBilled = data.next_billed_at ?? "?";
      const scheduledChange = data.scheduled_change ? "has scheduled_change" : "";
      const status = data.status ?? "?";
      console.log(
        `[paddle-webhook] ✅ ${eventType}   sub=${subId}  status=${status}  email=${customerEmail}  billing_cycle=${
          typeof billingCycle === "string" ? billingCycle : JSON.stringify(billingCycle)
        }  next_billed_at=${nextBilled}${scheduledChange ? ` (${scheduledChange})` : ""}  id=${eventId}`
      );
      break;
    }

    default:
      console.log(
        `[paddle-webhook] ℹ️  event ${eventType} id=${eventId}  — no handler wired yet (add a case block above).`
      );
      break;
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({ ok: true, hint: "POST a Paddle Billing webhook here." }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
