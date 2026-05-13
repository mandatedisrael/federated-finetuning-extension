import * as React from "react";
import { cn } from "@/lib/cn";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, rows = 4, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          "w-full px-3 py-2.5 text-sm leading-relaxed",
          "bg-surface text-foreground placeholder:text-foreground-subtle",
          "border-border rounded-[var(--radius-md)] border",
          "resize-y transition-colors duration-150",
          "hover:border-border-strong",
          "focus:border-accent focus:ring-accent/15 focus:ring-2 focus:outline-none",
          "disabled:bg-surface-muted disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";
