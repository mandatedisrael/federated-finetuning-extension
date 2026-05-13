"use client";

import * as React from "react";
import { motion } from "motion/react";
import { ArrowRight, Headset, Code2, ClipboardList } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Template } from "@/lib/mock/types";

const ICONS: Record<string, React.ElementType> = {
  headset: Headset,
  code: Code2,
  clipboard: ClipboardList,
};

interface TemplateCardProps {
  template: Template;
  recommended?: boolean;
  onSelect?: (id: string) => void;
}

export function TemplateCard({ template, recommended, onSelect }: TemplateCardProps) {
  const Icon = ICONS[template.icon] ?? Headset;

  return (
    <motion.button
      type="button"
      onClick={() => onSelect?.(template.id)}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className={cn(
        "group relative flex h-full flex-col gap-4 p-6 text-left",
        "border-border bg-surface rounded-[var(--radius-lg)] border",
        "shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)]",
        "transition-colors duration-200",
        "hover:border-accent/50",
        "focus-visible:ring-accent/40 focus-visible:ring-2 focus-visible:outline-none",
      )}
    >
      {recommended && (
        <span className="bg-accent-soft text-accent absolute top-4 right-4 rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase">
          Recommended
        </span>
      )}

      <span className="bg-accent-soft text-accent inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)]">
        <Icon className="h-5 w-5" />
      </span>

      <div className="space-y-1.5">
        <h3 className="font-serif text-2xl leading-tight tracking-tight">{template.name}</h3>
        <p className="text-foreground-muted text-sm leading-relaxed">{template.description}</p>
      </div>

      <div className="text-foreground-subtle mt-auto space-y-1.5 text-xs">
        <p>{template.recommendedContributors}</p>
        <p>
          Example formats:{" "}
          <span className="text-foreground-muted">
            {template.exampleFormats.slice(0, 3).join(", ")}
          </span>
        </p>
      </div>

      <span className="text-accent inline-flex items-center gap-1 text-sm font-medium opacity-0 transition-opacity group-hover:opacity-100">
        Start from this template <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </motion.button>
  );
}
