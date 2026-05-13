"use client";

import * as React from "react";
import { motion } from "motion/react";
import { UploadCloud, FileText } from "lucide-react";
import { cn } from "@/lib/cn";

interface UploadZoneProps {
  onFiles: (files: File[]) => void;
  accept?: string;
  disabled?: boolean;
  className?: string;
}

const HUMAN_FORMATS = "CSV · JSONL · PDF · TXT · chat exports";
const DEFAULT_ACCEPT =
  ".csv,.jsonl,.json,.pdf,.txt,.md,.docx,.html,.zip,application/zip,text/csv,application/pdf,text/plain";

export function UploadZone({
  onFiles,
  accept = DEFAULT_ACCEPT,
  disabled,
  className,
}: UploadZoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [hovering, setHovering] = React.useState(false);

  function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    onFiles(Array.from(list));
  }

  return (
    <div
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setHovering(true);
      }}
      onDragLeave={() => setHovering(false)}
      onDrop={(e) => {
        if (disabled) return;
        e.preventDefault();
        setHovering(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      aria-disabled={disabled}
      className={cn(
        "relative flex w-full flex-col items-center justify-center gap-3",
        "rounded-[var(--radius-lg)] border-2 border-dashed p-10 text-center",
        "transition-colors duration-200",
        "cursor-pointer select-none",
        "focus-visible:ring-accent/40 focus-visible:ring-2 focus-visible:outline-none",
        hovering
          ? "border-accent bg-accent-soft/60"
          : "border-border bg-surface hover:border-border-strong",
        disabled && "pointer-events-none opacity-60",
        className,
      )}
    >
      <motion.div
        animate={{ y: hovering ? -2 : 0, scale: hovering ? 1.04 : 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
        className="bg-accent-soft text-accent inline-flex h-12 w-12 items-center justify-center rounded-full"
      >
        <UploadCloud className="h-6 w-6" />
      </motion.div>

      <div className="space-y-1">
        <p className="text-foreground text-base font-medium tracking-tight">
          {hovering ? "Drop to add" : "Drag and drop your files"}
        </p>
        <p className="text-foreground-muted text-xs">
          or <span className="text-accent underline-offset-2 hover:underline">browse</span> your
          computer
        </p>
      </div>

      <p className="text-foreground-subtle inline-flex items-center gap-1.5 text-[11px]">
        <FileText className="h-3 w-3" />
        {HUMAN_FORMATS}
      </p>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
