import * as React from "react";
import { cn } from "@/lib/cn";

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          "text-foreground/80 text-sm font-medium select-none",
          "peer-disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);
Label.displayName = "Label";
