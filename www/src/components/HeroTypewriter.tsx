import { useEffect, useRef } from "react";
import TextType from "./TextType";

const WORDS = ["a map", "a blueprint", "a guide", "a graph", "a story"];

export default function HeroTypewriter() {
  return (
    <h1>
      See your codebase as{" "}
      <span className="inline-block min-w-[70%]">
        <TextType
          text={WORDS}
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
