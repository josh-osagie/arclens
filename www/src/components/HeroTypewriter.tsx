import { useEffect, useRef } from 'react';

const FULL_TEXT = 'See your React architecture as a map';
const CHAR_DELAY = 42;

export default function HeroTypewriter() {
  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const el = textRef.current;
    if (!el) return;

    if (reduce) {
      el.textContent = FULL_TEXT;
      return;
    }

    el.textContent = '';
    let index = 0;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      index += 1;
      el.textContent = FULL_TEXT.slice(0, index);
      if (index < FULL_TEXT.length) {
        timer = setTimeout(tick, CHAR_DELAY);
      }
    };

    timer = setTimeout(tick, CHAR_DELAY);

    return () => clearTimeout(timer);
  }, []);

  return (
    <span className="hero-typewriter">
      <span ref={textRef} aria-hidden="true" />
      <span className="sr-only">{FULL_TEXT}</span>
      <span className="hero-typewriter-cursor" aria-hidden="true" />
    </span>
  );
}
