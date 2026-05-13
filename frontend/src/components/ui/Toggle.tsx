"use client";

import * as React from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const toggle = cva(
  [
    "inline-flex items-center justify-center gap-1.5 font-medium",
    "rounded-[var(--radius-md)] transition-colors duration-150",
    "hover:bg-surface-muted hover:text-foreground",
    "data-[state=on]:bg-accent-soft data-[state=on]:text-accent",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
    "disabled:pointer-events-none disabled:opacity-50",
  ],
  {
    variants: {
      size: {
        sm: "h-8 px-2.5 text-xs",
        md: "h-9 px-3 text-sm",
        lg: "h-10 px-4 text-sm",
      },
    },
    defaultVariants: { size: "md" },
  },
);

export interface ToggleProps
  extends
    React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root>,
    VariantProps<typeof toggle> {}

export const Toggle = React.forwardRef<React.ElementRef<typeof TogglePrimitive.Root>, ToggleProps>(
  ({ className, size, ...props }, ref) => (
    <TogglePrimitive.Root ref={ref} className={cn(toggle({ size, className }))} {...props} />
  ),
);
Toggle.displayName = "Toggle";
