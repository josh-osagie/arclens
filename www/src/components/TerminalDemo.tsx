import React, { useEffect, useState } from "react";
import { ANALYZE_CMD, INSTALL_CMD } from "../data/tiers";

export default function TerminalDemo() {
  // Step state:
  // 0: typing cmd 1
  // 1: cmd 1 complete, showing output 1
  // 2: typing cmd 2
  // 3: cmd 2 complete, showing analysis output
  const [step, setStep] = useState<number>(0);
  const [typedCmd1, setTypedCmd1] = useState<string>("");
  const [typedCmd2, setTypedCmd2] = useState<string>("");
  const [showCursor, setShowCursor] = useState<boolean>(true);

  // Blinking cursor interval
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 500);
    return () => clearInterval(cursorInterval);
  }, []);

  // Main animation flow
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (step === 0) {
      // Type out INSTALL_CMD
      if (typedCmd1.length < INSTALL_CMD.length) {
        timeoutId = setTimeout(() => {
          setTypedCmd1(INSTALL_CMD.slice(0, typedCmd1.length + 1));
        }, 55);
      } else {
        // Pause then move to step 1
        timeoutId = setTimeout(() => {
          setStep(1);
        }, 400);
      }
    } else if (step === 1) {
      // Pause after step 1 output before starting step 2
      timeoutId = setTimeout(() => {
        setStep(2);
      }, 700);
    } else if (step === 2) {
      // Type out ANALYZE_CMD
      if (typedCmd2.length < ANALYZE_CMD.length) {
        timeoutId = setTimeout(() => {
          setTypedCmd2(ANALYZE_CMD.slice(0, typedCmd2.length + 1));
        }, 45);
      } else {
        // Pause then show analysis output
        timeoutId = setTimeout(() => {
          setStep(3);
        }, 500);
      }
    } else if (step === 3) {
      // Loop back to start after delay
      timeoutId = setTimeout(() => {
        setTypedCmd1("");
        setTypedCmd2("");
        setStep(0);
      }, 10000);
    }

    return () => clearTimeout(timeoutId);
  }, [step, typedCmd1, typedCmd2]);

  return (
    <div className="overflow-hidden border border-line-strong bg-[#050810] shadow-[0_0_0_1px_rgba(255,255,255,0.04)] font-mono text-base">
      {/* Window Title Bar */}
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]"></span>
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]"></span>
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]"></span>
        <span className="ml-2 font-mono text-[0.6875rem] text-text-muted">
          arclens — zsh
        </span>
      </div>

      {/* Terminal Content */}
      <div className="h-[320px] sm:h-[290px] space-y-3 p-5 leading-relaxed sm:p-6 overflow-hidden">
        {/* Command 1 */}
        <p className="flex items-center">
          <span className="mr-2 text-text-muted">$</span>
          <span className="text-accent-strong">{typedCmd1}</span>
          {step === 0 && (
            <span
              className={`ml-0.5 inline-block h-4 w-2 bg-accent transition-opacity ${
                showCursor ? "opacity-100" : "opacity-0"
              }`}
            ></span>
          )}
        </p>

        {/* Output 1 */}
        {step >= 1 && (
          <p className="text-text-muted animate-fade-in">
            added 1 package in 2s
          </p>
        )}

        {/* Command 2 */}
        {step >= 2 && (
          <p className="flex items-center">
            <span className="mr-2 text-text-muted">$</span>
            <span className="text-accent-strong">{typedCmd2}</span>
            {step === 2 && (
              <span
                className={`ml-0.5 inline-block h-4 w-2 bg-accent transition-opacity ${
                  showCursor ? "opacity-100" : "opacity-0"
                }`}
              ></span>
            )}
          </p>
        )}

        {/* Analysis Output */}
        {step >= 3 && (
          <div className="border-l-2 border-accent pl-3 text-text-body space-y-1 animate-fade-in">
            <p className="text-ok">✓ 847 files analyzed</p>
            <p>→ 312 components · 89 hooks · 24 contexts</p>
            <p>
              → Graph ready at{" "}
              <span className="text-accent">.arclens/graph.json</span>
            </p>
            <p className="text-text-muted">
              Run <span className="text-text font-semibold">arclens view</span>{" "}
              to explore
            </p>
          </div>
        )}

        {/* Final Active Prompt Line */}
        {step >= 3 && (
          <p className="flex items-center pt-1">
            <span className="mr-2 text-text-muted">$</span>
            <span
              className={`inline-block h-4 w-2 bg-accent transition-opacity ${
                showCursor ? "opacity-100" : "opacity-0"
              }`}
            ></span>
          </p>
        )}
      </div>
    </div>
  );
}
