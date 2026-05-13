import * as React from "react";
import { cn } from "@/lib/cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "h-10 w-full px-3 text-sm",
          "bg-surface text-foreground placeholder:text-foreground-subtle",
          "border-border rounded-[var(--radius-md)] border",
          "transition-colors duration-150",
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
Input.displayName = "Input";
