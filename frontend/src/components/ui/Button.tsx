"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const button = cva(
  [
    "inline-flex items-center justify-center gap-2",
    "font-medium tracking-tight whitespace-nowrap",
    "transition-[transform,background-color,color,border-color,box-shadow]",
    "duration-150 ease-[var(--ease-out-expo)]",
    "active:scale-[0.98]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
    "disabled:opacity-50 disabled:pointer-events-none",
  ],
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-foreground hover:bg-accent-hover shadow-[var(--shadow-sm)]",
        secondary:
          "bg-surface text-foreground border border-border hover:bg-surface-muted hover:border-border-strong",
        ghost: "text-foreground hover:bg-surface-muted",
        link: "text-accent underline-offset-4 hover:underline px-0",
        danger: "bg-status-danger text-white hover:opacity-90 shadow-[var(--shadow-sm)]",
      },
      size: {
        sm: "h-8 px-3 text-sm rounded-[var(--radius-md)]",
        md: "h-10 px-4 text-sm rounded-[var(--radius-md)]",
        lg: "h-12 px-6 text-base rounded-[var(--radius-lg)]",
        icon: "h-9 w-9 rounded-[var(--radius-md)]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn(button({ variant, size, className }))} {...props} />;
  },
);
Button.displayName = "Button";
