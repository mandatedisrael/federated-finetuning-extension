"use client";

import * as React from "react";
import { motion } from "motion/react";

/**
 * Tiny one-shot confetti. Renders a layer of falling chips with
 * randomized colors, horizontal drift, and rotation. Mounts once
 * — no replay, no library. Respects prefers-reduced-motion.
 */

const PALETTE = [
  "var(--accent)",
  "var(--status-success)",
  "var(--status-warning)",
  "var(--status-progress)",
  "var(--trust)",
];

interface Piece {
  id: number;
  left: number; // %
  delay: number;
  duration: number;
  drift: number; // px
  rotate: number; // deg
  color: string;
  size: number;
}

function makePieces(count: number, seed = Date.now()): Piece[] {
  const pieces: Piece[] = [];
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  for (let i = 0; i < count; i++) {
    pieces.push({
      id: i,
      left: rand() * 100,
      delay: rand() * 0.25,
      duration: 1.6 + rand() * 1.2,
      drift: (rand() - 0.5) * 200,
      rotate: (rand() - 0.5) * 540,
      color: PALETTE[Math.floor(rand() * PALETTE.length)] ?? PALETTE[0]!,
      size: 6 + Math.floor(rand() * 6),
    });
  }
  return pieces;
}

export function Confetti({ count = 80 }: { count?: number }) {
  const [reduced, setReduced] = React.useState(false);
  const pieces = React.useMemo(() => makePieces(count), [count]);

  React.useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mql.matches);
  }, []);

  if (reduced) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ y: "-10vh", x: 0, opacity: 1, rotate: 0 }}
          animate={{
            y: "110vh",
            x: p.drift,
            rotate: p.rotate,
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: [0.16, 0.6, 0.4, 1],
            times: [0, 0.85, 1],
          }}
          style={{
            position: "absolute",
            top: 0,
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 1.6,
            background: p.color,
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
}
