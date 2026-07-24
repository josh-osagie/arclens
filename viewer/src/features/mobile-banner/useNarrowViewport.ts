import { useEffect, useState } from "react";

import { MOBILE_BANNER_MAX_WIDTH_PX } from "./mobileBannerPrefs";

export function useNarrowViewport(maxWidth = MOBILE_BANNER_MAX_WIDTH_PX): boolean {
  const query = `(max-width: ${maxWidth}px)`;
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
