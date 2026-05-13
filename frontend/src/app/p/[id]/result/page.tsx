"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "motion/react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { TrustBadge } from "@/components/domain/TrustBadge";
import {
  SideBySideChat,
  type ChatMessage,
} from "@/components/domain/SideBySideChat";
import { useAuth } from "@/lib/auth/AuthProvider";
import { projectStore } from "@/lib/mock/projectStore";
import { ensureDemoProject } from "@/lib/mock/seedDemo";
import { streamMockReply, type MockStream } from "@/lib/mock/mockChat";
import type { Project } from "@/lib/mock/types";

function msgId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function ResultPlaygroundPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [project, setProject] = React.useState<Project | null>(null);
  const [leftMessages, setLeftMessages] = React.useState<ChatMessage[]>([]);
  const [rightMessages, setRightMessages] = React.useState<ChatMessage[]>([]);
  const [busy, setBusy] = React.useState(false);
  const streamsRef = React.useRef<MockStream[]>([]);

  React.useEffect(() => {
    if (!params?.id) return;
    setProject(projectStore.get(params.id) ?? ensureDemoProject(params.id));
  }, [params?.id]);

  React.useEffect(() => {
    return () => {
      streamsRef.current.forEach((s) => s.cancel());
    };
  }, []);

  if (!project) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-foreground-muted text-sm">Loading…</p>
      </main>
    );
  }

  function appendAssistantPlaceholder(
    setter: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  ): string {
    const id = msgId("a");
    setter((prev) => [...prev, { id, role: "assistant", content: "" }]);
    return id;
  }

  function updateMessage(
    setter: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
    id: string,
    content: string,
  ) {
    setter((prev) => prev.map((m) => (m.id === id ? { ...m, content } : m)));
  }

  async function handleSubmit(prompt: string) {
    const userId = msgId("u");
    const userMsg: ChatMessage = { id: userId, role: "user", content: prompt };
    setLeftMessages((prev) => [...prev, userMsg]);
    setRightMessages((prev) => [...prev, { ...userMsg, id: msgId("u") }]);

    const leftId = appendAssistantPlaceholder(setLeftMessages);
    const rightId = appendAssistantPlaceholder(setRightMessages);

    setBusy(true);
    const leftStream = streamMockReply(prompt, "left", (text) =>
      updateMessage(setLeftMessages, leftId, text),
    );
    const rightStream = streamMockReply(prompt, "right", (text) =>
      updateMessage(setRightMessages, rightId, text),
    );
    streamsRef.current.push(leftStream, rightStream);

    await Promise.all([leftStream.done, rightStream.done]);
    setBusy(false);
  }

  return (
    <main className="relative flex flex-1 flex-col">
      <header className="border-border mx-auto flex w-full max-w-6xl items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-serif text-lg tracking-tight">
            FFE<span className="text-foreground-subtle">.</span>
          </Link>
          <span className="text-foreground-subtle text-xs">/</span>
          <Link
            href={`/p/${project.id}`}
            className="text-foreground-muted hover:text-foreground truncate text-sm"
          >
            {project.name}
          </Link>
          <span className="text-foreground-subtle text-xs">/</span>
          <span className="text-foreground-muted truncate text-sm">Playground</span>
        </div>
        <TrustBadge />
      </header>

      <section className="mx-auto w-full max-w-6xl px-6 py-10">
        <Link
          href={`/p/${project.id}`}
          className="text-foreground-subtle hover:text-foreground mb-6 inline-flex items-center gap-1 text-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to project
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8"
        >
          <p className="text-foreground-subtle mb-3 inline-flex items-center gap-2 text-xs tracking-[0.18em] uppercase">
            <Sparkles className="h-3.5 w-3.5" />
            New version ready
          </p>
          <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">
            Try the new version
          </h1>
          <p className="text-foreground-muted mt-3 max-w-2xl text-base leading-relaxed">
            Ask both versions the same question and compare. The right column is
            the new model trained on this round&apos;s contributions.
            {user?.displayName ? ` Welcome, ${user.displayName.split(" ")[0]}.` : ""}
          </p>
        </motion.div>

        <SideBySideChat
          leftMessages={leftMessages}
          rightMessages={rightMessages}
          onSubmit={handleSubmit}
          busy={busy}
        />
      </section>
    </main>
  );
}
