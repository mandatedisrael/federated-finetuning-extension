"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/**
 * Side-by-side chat panel shell. Two columns share one input
 * (left = current model, right = new model). Streaming responses
 * are wired in later via the Vercel AI SDK; for now the shell
 * accepts pre-rendered messages and a controlled prompt input.
 */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface SideBySideChatProps {
  leftLabel?: string;
  rightLabel?: string;
  leftMessages: ChatMessage[];
  rightMessages: ChatMessage[];
  onSubmit?: (prompt: string) => void;
  busy?: boolean;
  footer?: React.ReactNode;
  className?: string;
}

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed",
          "rounded-[var(--radius-lg)]",
          isUser
            ? "bg-accent text-accent-foreground rounded-br-[var(--radius-xs)]"
            : "bg-surface-muted text-foreground rounded-bl-[var(--radius-xs)]",
        )}
      >
        {message.content}
      </div>
    </motion.div>
  );
}

function Column({
  label,
  messages,
  badge,
}: {
  label: string;
  messages: ChatMessage[];
  badge?: React.ReactNode;
}) {
  return (
    <div className="border-border bg-surface flex min-h-[24rem] flex-col rounded-[var(--radius-lg)] border">
      <header className="border-border flex items-center justify-between border-b px-4 py-2.5">
        <span className="text-foreground-muted text-xs font-medium tracking-widest uppercase">
          {label}
        </span>
        {badge}
      </header>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <Bubble key={m.id} message={m} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function SideBySideChat({
  leftLabel = "Current model",
  rightLabel = "New version",
  leftMessages,
  rightMessages,
  onSubmit,
  busy,
  footer,
  className,
}: SideBySideChatProps) {
  const [prompt, setPrompt] = React.useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || busy) return;
    onSubmit?.(trimmed);
    setPrompt("");
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Column label={leftLabel} messages={leftMessages} />
        <Column
          label={rightLabel}
          messages={rightMessages}
          badge={
            <span className="bg-accent-soft text-accent rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-medium">
              new
            </span>
          }
        />
      </div>

      <form
        onSubmit={handleSubmit}
        className={cn(
          "border-border bg-surface flex items-center gap-2 rounded-[var(--radius-lg)] border p-2",
          "shadow-[var(--shadow-sm)]",
        )}
      >
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask both versions the same question…"
          className="placeholder:text-foreground-subtle flex-1 bg-transparent px-2 py-2 text-sm outline-none"
          disabled={busy}
        />
        <Button type="submit" disabled={busy || prompt.trim().length === 0}>
          <Send className="h-4 w-4" />
          {busy ? "Sending…" : "Send"}
        </Button>
      </form>

      {footer}
    </div>
  );
}
