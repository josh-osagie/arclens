import { useEffect, useRef } from "react";
import gsap from "gsap";

const NODES = [
  { id: "a", cx: 72, cy: 48, r: 4 },
  { id: "b", cx: 168, cy: 32, r: 3.5 },
  { id: "c", cx: 248, cy: 88, r: 4 },
  { id: "d", cx: 120, cy: 128, r: 3 },
  { id: "e", cx: 200, cy: 152, r: 3.5 },
  { id: "f", cx: 56, cy: 168, r: 3 },
];

const EDGES: [string, string][] = [
  ["a", "b"],
  ["b", "c"],
  ["a", "d"],
  ["d", "e"],
  ["c", "e"],
  ["d", "f"],
  ["a", "f"],
];

function edgePath(from: (typeof NODES)[0], to: (typeof NODES)[0]) {
  return `M ${from.cx} ${from.cy} L ${to.cx} ${to.cy}`;
}

export default function ArchGraph() {
  const rootRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const svg = rootRef.current;
    if (!svg || reduce) return;

    const lines = svg.querySelectorAll<SVGPathElement>(".arch-edge");
    const dots = svg.querySelectorAll<SVGCircleElement>(".arch-node");

    lines.forEach((line) => {
      const len = line.getTotalLength();
      line.style.strokeDasharray = `${len}`;
      line.style.strokeDashoffset = `${len}`;
    });

    dots.forEach((dot) => {
      dot.style.opacity = "0";
    });

    const tl = gsap.timeline({ delay: 0.35 });

    tl.to(lines, {
      strokeDashoffset: 0,
      duration: 1.4,
      ease: "power2.inOut",
      stagger: 0.12,
    }).to(
      dots,
      {
        opacity: 1,
        duration: 0.5,
        ease: "power2.out",
        stagger: 0.06,
      },
      "-=1.1"
    );

    gsap.to(dots, {
      opacity: 0.55,
      duration: 2.4,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
      stagger: { each: 0.35, from: "random" },
      delay: 1.8,
    });

    return () => {
      tl.kill();
      gsap.killTweensOf([...lines, ...dots]);
    };
  }, []);

  const nodeMap = Object.fromEntries(NODES.map((n) => [n.id, n]));

  return (
    <svg
      ref={rootRef}
      className="arch-graph"
      viewBox="0 0 300 200"
      fill="none"
      aria-hidden="true"
    >
      <g className="arch-edges">
        {EDGES.map(([fromId, toId]) => {
          const from = nodeMap[fromId];
          const to = nodeMap[toId];
          return (
            <path
              key={`${fromId}-${toId}`}
              className="arch-edge"
              d={edgePath(from, to)}
              stroke="rgba(77, 176, 216, 0.22)"
              strokeWidth="1"
            />
          );
        })}
      </g>
      <g className="arch-nodes">
        {NODES.map((node) => (
          <circle
            key={node.id}
            className="arch-node"
            cx={node.cx}
            cy={node.cy}
            r={node.r}
            fill="rgba(124, 200, 232, 0.45)"
          />
        ))}
      </g>
    </svg>
  );
}
