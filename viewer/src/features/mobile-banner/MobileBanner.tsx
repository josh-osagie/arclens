import { MonitorSmartphone } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  dismissMobileBanner,
  loadMobileBannerPrefs,
  shouldShowMobileBanner,
} from "./mobileBannerPrefs";
import { useNarrowViewport } from "./useNarrowViewport";

export function MobileBanner() {
  const isNarrow = useNarrowViewport();
  const [prefs, setPrefs] = useState(loadMobileBannerPrefs);

  const visible = shouldShowMobileBanner(prefs, isNarrow);

  const onDismiss = useCallback(() => {
    setPrefs(dismissMobileBanner(false));
  }, []);

  const onDontShowAgain = useCallback(() => {
    setPrefs(dismissMobileBanner(true));
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[60] border-b border-border bg-card/95 px-4 py-3 shadow-md backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <MonitorSmartphone
            className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Arclens works best on desktop
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Graph navigation is limited on small screens. You can keep
              exploring, but panning, zooming, and panel layout are easier on a
              larger display.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onDontShowAgain}
          >
            Don&apos;t show again
          </Button>
        </div>
      </div>
    </div>
  );
}
