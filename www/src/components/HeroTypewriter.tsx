import { useState } from "react";
import TextType from "./TextType";

const WORDS = [
  "a map",
  "architecture",
  "a blueprint",
  "a graph",
  "a guide",
  "a story",
];

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export default function HeroTypewriter() {
  const [words] = useState(() => shuffle(WORDS));

  return (
    <h1>
      See your codebase as{" "}
      <span className="inline-block min-w-[70%]">
        <TextType
          text={words}
          typingSpeed={75}
          pauseDuration={1800}
          deletingSpeed={40}
          loop
          className="text-primary"
        />
      </span>
    </h1>
  );
}
