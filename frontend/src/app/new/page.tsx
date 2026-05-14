"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { TemplateCard } from "@/components/templates/TemplateCard";
import { Button } from "@/components/ui/Button";
import { TrustBadge } from "@/components/domain/TrustBadge";
import { UserPill } from "@/components/auth/UserPill";
import { TEMPLATES } from "@/lib/mock/templates";

export default function NewProjectPage() {
  const router = useRouter();

  function handleSelect(templateId: string) {
    router.push(`/new/setup?template=${templateId}`);
  }

  return (
    <main className="relative flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 pt-6">
        <Link href="/" className="font-serif text-xl tracking-tight">
          FFE<span className="text-foreground-subtle">.</span>
        </Link>
        <div className="flex items-center gap-3"><TrustBadge /><UserPill /></div>      </header>

      <section className="mx-auto w-full max-w-5xl px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          className="mb-10"
        >
          <Link
            href="/"
            className="text-foreground-subtle hover:text-foreground mb-4 inline-flex items-center gap-1 text-xs"
          >
            <ArrowLeft className="h-3 w-3" /> Back
          </Link>
          <p className="text-foreground-subtle mb-3 text-xs tracking-[0.18em] uppercase">
            New project
          </p>
          <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">Start from a template.</h1>
          <p className="text-foreground-muted mt-3 max-w-prose text-base leading-relaxed">
            Pick a starting point. Each template comes with the right base model, an example data
            schema, and a few sample contributions to get you going.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.06 } },
          }}
          className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
        >
          {TEMPLATES.map((t, i) => (
            <motion.div
              key={t.id}
              variants={{
                hidden: { opacity: 0, y: 8 },
                show: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            >
              <TemplateCard template={t} recommended={i === 0} onSelect={handleSelect} />
            </motion.div>
          ))}
        </motion.div>

        <div className="border-border mt-10 flex items-center justify-between border-t pt-6">
          <p className="text-foreground-muted text-sm">
            None of these fit? Start from a blank project.
          </p>
          <Button variant="ghost" onClick={() => router.push("/new/setup?template=blank")}>
            Start from scratch
          </Button>
        </div>
      </section>
    </main>
  );
}
