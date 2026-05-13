import * as React from "react";
import { cn } from "@/lib/cn";

export interface AvatarPerson {
  id: string;
  name: string;
  imageUrl?: string;
}

interface AvatarStackProps extends React.HTMLAttributes<HTMLDivElement> {
  people: AvatarPerson[];
  max?: number;
  size?: "sm" | "md" | "lg";
}

const SIZE: Record<NonNullable<AvatarStackProps["size"]>, string> = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
};

const OVERLAP: Record<NonNullable<AvatarStackProps["size"]>, string> = {
  sm: "-ml-1.5",
  md: "-ml-2",
  lg: "-ml-2.5",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function hashHue(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

export function AvatarStack({
  people,
  max = 5,
  size = "md",
  className,
  ...props
}: AvatarStackProps) {
  const visible = people.slice(0, max);
  const overflow = people.length - visible.length;

  return (
    <div className={cn("flex items-center", className)} {...props}>
      {visible.map((person, i) => (
        <span
          key={person.id}
          title={person.name}
          className={cn(
            "border-surface ring-border inline-flex items-center justify-center",
            "rounded-full border-2 ring-1",
            "font-medium tracking-tight",
            SIZE[size],
            i > 0 && OVERLAP[size],
          )}
          style={{
            background: person.imageUrl ? undefined : `hsl(${hashHue(person.id)} 45% 88%)`,
            color: person.imageUrl ? undefined : `hsl(${hashHue(person.id)} 50% 25%)`,
            backgroundImage: person.imageUrl ? `url(${person.imageUrl})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
          aria-label={person.name}
        >
          {!person.imageUrl && initials(person.name)}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            "border-surface bg-surface-muted text-foreground-muted inline-flex items-center justify-center",
            "rounded-full border-2 font-medium",
            SIZE[size],
            OVERLAP[size],
          )}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
