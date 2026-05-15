import Link from "next/link";
import {
  Lock,
  ShieldCheck,
  Sparkles,
  Users,
  GitBranch,
  Cpu,
  ArrowRight,
} from "lucide-react";
import { TrustBadge } from "@/components/domain/TrustBadge";
import { AuthLinkButton } from "@/components/auth/AuthLinkButton";
import { UserPill } from "@/components/auth/UserPill";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ResumeProjectsButton } from "@/components/home/ResumeProjectsButton";
import { CollaborativeAnimation } from "@/components/landing/CollaborativeAnimation";
import { Reveal } from "@/components/landing/Reveal";

const STEP_CARDS = [
  {
    n: "01",
    title: "Project",
    copy: "A shared effort with a name, a goal, and invited collaborators.",
  },
  {
    n: "02",
    title: "Contribution",
    copy: "Private examples each person uploads. Encrypted before they leave the browser.",
  },
  {
    n: "03",
    title: "Result",
    copy: "An improved assistant everyone can try. Before-and-after, side by side.",
  },
];

const FLOW_STEPS = [
  {
    step: "Step 1",
    title: "Set a goal",
    copy: "Define what the assistant should get better at — in plain words.",
    icon: Sparkles,
  },
  {
    step: "Step 2",
    title: "Invite people",
    copy: "Each contributor gets a private room. Nobody sees anyone else's data.",
    icon: Users,
  },
  {
    step: "Step 3",
    title: "Contribute privately",
    copy: "Drop in examples. They're encrypted in your browser before upload.",
    icon: Lock,
  },
  {
    step: "Step 4",
    title: "Train & publish",
    copy: "Fine-tune in a secure enclave. Compare versions side-by-side. Ship it.",
    icon: GitBranch,
  },
];

const PRIVACY_PILLARS = [
  {
    icon: Lock,
    title: "Encrypted in your browser",
    copy: "Examples are encrypted client-side before they leave your machine. We never see plaintext.",
  },
  {
    icon: ShieldCheck,
    title: "TEE attestation",
    copy: "Training runs inside a trusted execution environment with a verifiable attestation. Code only sees ciphertext until it's inside the enclave.",
  },
  {
    icon: GitBranch,
    title: "On-chain co-ownership",
    copy: "Every contributor gets a receipt: their data was part of this version. The trained model is co-owned by everyone who helped.",
  },
];

const USE_CASES = [
  {
    title: "Support teams",
    copy: "Pool great replies from senior agents to teach the assistant your tone and edge cases — without exposing customer threads to each other.",
  },
  {
    title: "Sales orgs",
    copy: "Top reps contribute deal-winning emails and discovery notes. The shared assistant drafts for the rest of the team in the same voice.",
  },
  {
    title: "Internal docs",
    copy: "Each team contributes its own runbooks privately. The merged model answers cross-team questions without anyone leaking their internals.",
  },
  {
    title: "Research collectives",
    copy: "Labs contribute domain examples without sharing datasets. Train a shared model that everyone can use, governed on-chain.",
  },
  {
    title: "Open-source maintainers",
    copy: "Maintainers across repos pool triage and review examples — the bot acts the way the actual reviewers would.",
  },
  {
    title: "Healthcare / Legal",
    copy: "Regulated industries where examples are valuable but raw data can't be shared. The enclave handles the trust boundary.",
  },
];

const UNDER_HOOD = [
  {
    k: "Client-side encryption",
    v: "Examples encrypted with per-contributor keys before upload. The server only stores ciphertext.",
  },
  {
    k: "TEE-based training",
    v: "Decryption + LoRA fine-tuning happens inside an attested enclave. Outside the enclave: ciphertext only.",
  },
  {
    k: "0G Storage + Chain",
    v: "Encrypted shards land on 0G Storage. Training rounds, version metadata, and co-ownership records are anchored on 0G Chain.",
  },
  {
    k: "Aggregation, not pooling",
    v: "Contributions are aggregated, not concatenated. No contributor sees another contributor's raw data, ever.",
  },
];

export default function LandingPage() {
  return (
    <main className="relative flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 pt-6">
        <Link href="/" className="font-serif text-xl tracking-tight">
          FFE<span className="text-foreground-subtle">.</span>
        </Link>
        <nav className="text-foreground-muted hidden items-center gap-6 text-sm sm:flex">
          <Link href="#how" className="hover:text-foreground transition-colors">
            How it works
          </Link>
          <Link href="#privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
          <Link href="#use-cases" className="hover:text-foreground transition-colors">
            Use cases
          </Link>
          <ResumeProjectsButton />
          <a
            href="https://github.com/mandatedisrael/federated-finetuning-extension"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground transition-colors"
          >
            GitHub
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <TrustBadge />
          <ThemeToggle />
          <UserPill />
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 items-center gap-10 px-6 py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-24">
        <Reveal once={false} y={32} duration={0.7} className="text-center lg:text-left">
          <p className="text-foreground-subtle mb-5 text-xs tracking-[0.2em] uppercase">
            Collaborative fine-tuning, without the jargon
          </p>
          <h1 className="font-serif text-5xl leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
            Teach a shared AI,
            <br />
            <span className="italic">privately,</span> with other people.
          </h1>
          <p className="text-foreground-muted mt-6 max-w-xl text-base leading-relaxed sm:text-lg lg:mx-0">
            Drop in examples of what good looks like. Your data is encrypted before it leaves your
            browser. The improved assistant is co-owned by everyone who helped train it.
          </p>

          <div className="mt-10 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row lg:items-start lg:justify-start">
            <AuthLinkButton href="/new" redirectTo="/new" size="lg">
              Create a project
            </AuthLinkButton>
            <AuthLinkButton href="/join" redirectTo="/join" size="lg" variant="secondary">
              I have an invite
            </AuthLinkButton>
          </div>

          <p className="text-foreground-subtle mt-6 text-xs">
            Email or Google sign-in. No wallet setup required.
          </p>
        </Reveal>

        <Reveal
          once={false}
          y={32}
          duration={0.7}
          delay={0.15}
          className="relative aspect-square w-full max-w-[560px] justify-self-center lg:justify-self-end"
        >
          <CollaborativeAnimation />
        </Reveal>
      </section>

      {/* How it works (3 cards) */}
      <section id="how" className="mx-auto w-full max-w-7xl px-6 py-20">
        <Reveal className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-foreground-subtle text-xs tracking-[0.2em] uppercase">
            How it works
          </p>
          <h2 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">
            Three moving parts. That&apos;s the whole thing.
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {STEP_CARDS.map((step, i) => (
            <Reveal
              key={step.n}
              delay={i * 0.1}
              className="border-border bg-surface flex flex-col gap-3 rounded-[var(--radius-lg)] border p-6"
            >
              <span className="text-foreground-subtle font-mono text-xs tracking-widest">
                {step.n}
              </span>
              <h3 className="font-serif text-2xl tracking-tight">{step.title}</h3>
              <p className="text-foreground-muted text-sm leading-relaxed">{step.copy}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* The flow — narrative steps */}
      <section className="bg-surface-muted border-border border-y">
        <div className="mx-auto w-full max-w-7xl px-6 py-20">
          <Reveal className="mx-auto mb-12 max-w-2xl text-center">
            <p className="text-foreground-subtle text-xs tracking-[0.2em] uppercase">The flow</p>
            <h2 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">
              From scattered examples to a model your team agrees on.
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {FLOW_STEPS.map(({ step, title, copy, icon: Icon }, i) => (
              <Reveal
                key={step}
                delay={i * 0.08}
                className="border-border bg-surface relative flex flex-col gap-3 rounded-[var(--radius-lg)] border p-5"
              >
                <div className="bg-accent-soft text-accent inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)]">
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-foreground-subtle text-[10px] font-mono tracking-widest uppercase">
                  {step}
                </p>
                <h3 className="font-serif text-xl tracking-tight">{title}</h3>
                <p className="text-foreground-muted text-sm leading-relaxed">{copy}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy by design */}
      <section id="privacy" className="mx-auto w-full max-w-7xl px-6 py-20">
        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[1fr_1.2fr]">
          <Reveal>
            <p className="text-foreground-subtle text-xs tracking-[0.2em] uppercase">
              Privacy by design
            </p>
            <h2 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">
              Your raw data never leaves your browser unencrypted.
            </h2>
            <p className="text-foreground-muted mt-6 max-w-md text-base leading-relaxed">
              The whole point of FFE is that you can pool what you know with other people without
              giving any of you raw access to each other&apos;s files. The cryptography handles
              that. You just contribute.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-1">
            {PRIVACY_PILLARS.map(({ icon: Icon, title, copy }, i) => (
              <Reveal
                key={title}
                delay={i * 0.1}
                className="border-border bg-surface flex gap-4 rounded-[var(--radius-lg)] border p-5"
              >
                <div className="bg-trust-bg text-trust inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)]">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-serif text-xl tracking-tight">{title}</h3>
                  <p className="text-foreground-muted mt-1 text-sm leading-relaxed">{copy}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section id="use-cases" className="bg-surface-muted border-border border-y">
        <div className="mx-auto w-full max-w-7xl px-6 py-20">
          <Reveal className="mx-auto mb-12 max-w-2xl text-center">
            <p className="text-foreground-subtle text-xs tracking-[0.2em] uppercase">
              Use cases
            </p>
            <h2 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">
              Built for teams whose best examples are stuck in people&apos;s heads.
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {USE_CASES.map(({ title, copy }, i) => (
              <Reveal
                key={title}
                delay={(i % 3) * 0.08}
                className="border-border bg-surface flex flex-col gap-2 rounded-[var(--radius-lg)] border p-5"
              >
                <h3 className="font-serif text-xl tracking-tight">{title}</h3>
                <p className="text-foreground-muted text-sm leading-relaxed">{copy}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Under the hood */}
      <section className="mx-auto w-full max-w-7xl px-6 py-20">
        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <Reveal>
              <p className="text-foreground-subtle text-xs tracking-[0.2em] uppercase">
                Under the hood
              </p>
              <h2 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">
                Honest about the machinery.
              </h2>
              <p className="text-foreground-muted mt-6 max-w-lg text-base leading-relaxed">
                You shouldn&apos;t need to understand any of this to use FFE. But if you want to
                know what&apos;s actually running underneath:
              </p>
            </Reveal>

            <div className="mt-8 space-y-4">
              {UNDER_HOOD.map(({ k, v }, i) => (
                <Reveal
                  key={k}
                  delay={i * 0.08}
                  className="border-border flex items-start gap-4 border-b pb-4 last:border-b-0 last:pb-0"
                >
                  <Cpu className="text-foreground-subtle mt-1 h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-foreground text-sm font-medium">{k}</p>
                    <p className="text-foreground-muted mt-1 text-sm leading-relaxed">{v}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          <Reveal
            delay={0.1}
            className="border-border bg-surface rounded-[var(--radius-lg)] border p-6 lg:sticky lg:top-24"
          >
            <p className="text-foreground-subtle text-xs tracking-[0.2em] uppercase">
              Plain English
            </p>
            <p className="mt-3 font-serif text-2xl leading-snug tracking-tight">
              &ldquo;Everyone gets to teach the assistant what good looks like.
              <br />
              <span className="italic">No one</span> gets to see what anyone else taught it.&rdquo;
            </p>
            <p className="text-foreground-muted mt-4 text-sm leading-relaxed">
              That&apos;s the whole product. Everything else — the enclave, the chain, the
              encryption — is just plumbing that makes that sentence true.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-accent text-accent-foreground">
        <div className="mx-auto w-full max-w-7xl px-6 py-20 text-center">
          <Reveal>
            <h2 className="font-serif text-4xl tracking-tight sm:text-5xl">
              Start a project. Invite your team.
            </h2>
            <p className="text-accent-foreground/80 mx-auto mt-4 max-w-xl text-base leading-relaxed">
              You don&apos;t need a wallet, you don&apos;t need to know what a LoRA is, and your
              data stays encrypted the whole way through.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <AuthLinkButton href="/new" redirectTo="/new" size="lg" variant="secondary">
                Create a project
                <ArrowRight className="h-4 w-4" />
              </AuthLinkButton>
              <Link
                href="/join"
                className="text-accent-foreground/80 hover:text-accent-foreground inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
              >
                I have an invite instead
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="border-border mx-auto w-full max-w-7xl border-t px-6 py-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-foreground-subtle text-xs">
            FFE — federated fine-tuning extension. Hidden machinery: TEE attestation, encrypted
            aggregation, on-chain co-ownership.
          </p>
          <div className="text-foreground-subtle flex items-center gap-5 text-xs">
            <Link href="#how" className="hover:text-foreground transition-colors">
              How it works
            </Link>
            <Link href="#privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <a
              href="https://github.com/mandatedisrael/federated-finetuning-extension"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
