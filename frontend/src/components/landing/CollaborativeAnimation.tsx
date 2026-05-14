"use client";

import * as React from "react";
import { motion } from "motion/react";

/**
 * Animated diagram of contributors sending encrypted data to a shared model.
 *
 * - Six contributor nodes orbit a central "shared AI" core
 * - Particles travel inward along dotted lines (encrypted contributions)
 * - The core pulses softly, with periodic "round complete" rings expanding out
 * - Pure SVG + motion; no canvas, no rAF loops
 */

const VIEW = 600;
const CENTER = VIEW / 2;
const ORBIT_RADIUS = 220;
const NODE_COUNT = 6;

interface NodePos {
  x: number;
  y: number;
  angle: number;
}

function computeNodes(): NodePos[] {
  return Array.from({ length: NODE_COUNT }, (_, i) => {
    const angle = (i / NODE_COUNT) * Math.PI * 2 - Math.PI / 2;
    return {
      x: CENTER + Math.cos(angle) * ORBIT_RADIUS,
      y: CENTER + Math.sin(angle) * ORBIT_RADIUS,
      angle,
    };
  });
}

const NODES = computeNodes();
const LABELS = ["You", "Sam", "Aiko", "Marie", "Lin", "Theo"];

export function CollaborativeAnimation({ className }: { className?: string }) {
  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className="h-full w-full"
        aria-hidden
        role="img"
      >
        <defs>
          <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
            <stop offset="60%" stopColor="var(--accent)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--trust)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--trust)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Core glow */}
        <circle cx={CENTER} cy={CENTER} r={140} fill="url(#coreGlow)" />

        {/* Round-complete rings */}
        {[0, 1].map((i) => (
          <motion.circle
            key={`ring-${i}`}
            cx={CENTER}
            cy={CENTER}
            r={60}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={1}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: [0.6, 3.4], opacity: [0.5, 0] }}
            transition={{
              duration: 4,
              delay: i * 2,
              repeat: Infinity,
              ease: "easeOut",
            }}
            style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
          />
        ))}

        {/* Lines from each contributor to the core */}
        {NODES.map((node, i) => (
          <line
            key={`line-${i}`}
            x1={node.x}
            y1={node.y}
            x2={CENTER}
            y2={CENTER}
            stroke="var(--border-strong)"
            strokeWidth={1}
            strokeDasharray="3 5"
            opacity={0.55}
          />
        ))}

        {/* Travelling particles along each line */}
        {NODES.map((node, i) => {
          const delay = (i * 0.9) % 4;
          return (
            <motion.circle
              key={`particle-${i}`}
              r={5}
              fill="var(--accent)"
              initial={{ cx: node.x, cy: node.y, opacity: 0 }}
              animate={{
                cx: [node.x, CENTER],
                cy: [node.y, CENTER],
                opacity: [0, 1, 1, 0],
              }}
              transition={{
                duration: 2.4,
                delay,
                repeat: Infinity,
                repeatDelay: 2.2,
                ease: "easeIn",
                times: [0, 0.15, 0.85, 1],
              }}
            />
          );
        })}

        {/* Contributor nodes */}
        {NODES.map((node, i) => (
          <g key={`node-${i}`}>
            <circle cx={node.x} cy={node.y} r={36} fill="url(#nodeGlow)" />
            <motion.circle
              cx={node.x}
              cy={node.y}
              r={18}
              fill="var(--surface)"
              stroke="var(--trust)"
              strokeWidth={1.5}
              initial={{ scale: 0.95 }}
              animate={{ scale: [0.95, 1.05, 0.95] }}
              transition={{
                duration: 3.2,
                delay: i * 0.4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              style={{ transformOrigin: `${node.x}px ${node.y}px` }}
            />
            <text
              x={node.x}
              y={node.y + 4}
              textAnchor="middle"
              fontSize={11}
              fill="var(--foreground)"
              fontFamily="var(--font-geist-sans)"
              fontWeight={500}
            >
              {LABELS[i]}
            </text>
          </g>
        ))}

        {/* Core */}
        <motion.circle
          cx={CENTER}
          cy={CENTER}
          r={56}
          fill="var(--accent)"
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
        />
        <text
          x={CENTER}
          y={CENTER - 4}
          textAnchor="middle"
          fontSize={13}
          fill="var(--accent-foreground)"
          fontFamily="var(--font-geist-sans)"
          fontWeight={600}
          letterSpacing="0.04em"
        >
          SHARED
        </text>
        <text
          x={CENTER}
          y={CENTER + 14}
          textAnchor="middle"
          fontSize={13}
          fill="var(--accent-foreground)"
          fontFamily="var(--font-geist-sans)"
          fontWeight={600}
          letterSpacing="0.04em"
        >
          MODEL
        </text>
      </svg>
    </div>
  );
}
