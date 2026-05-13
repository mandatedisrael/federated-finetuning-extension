import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { TrustBadge } from "@/components/domain/TrustBadge";

export default function LandingPage() {
  return (
    <main className="relative flex flex-1 flex-col">
      {/* nav */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 pt-6">
        <Link href="/" className="font-serif text-xl tracking-tight">
          FFE<span className="text-foreground-subtle">.</span>
        </Link>
        <nav className="text-foreground-muted hidden items-center gap-6 text-sm sm:flex">
          <Link href="/kitchen" className="hover:text-foreground transition-colors">
            Components
          </Link>
          <a
            href="https://github.com/mandatedisrael/federated-finetuning-extension"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground transition-colors"
          >
            GitHub
          </a>
        </nav>
        <TrustBadge />
      </header>

      {/* hero */}
      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <p className="text-foreground-subtle mb-5 text-xs tracking-[0.2em] uppercase">
          Collaborative fine-tuning, without the jargon
        </p>
        <h1 className="font-serif text-5xl leading-[1.02] tracking-tight sm:text-7xl">
          Teach a shared AI,
          <br />
          <span className="italic">privately,</span> with other people.
        </h1>
        <p className="text-foreground-muted mt-6 max-w-xl text-base leading-relaxed sm:text-lg">
          Drop in examples of what good looks like. Your data is encrypted before it leaves your
          browser. The improved assistant is co-owned by everyone who helped train it.
        </p>

        <div className="mt-10 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
          <Button size="lg" asChild>
            <Link href="/new">Create a project</Link>
          </Button>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/join">I have an invite</Link>
          </Button>
        </div>

        <p className="text-foreground-subtle mt-6 text-xs">
          Email or Google sign-in. No wallet setup required.
        </p>
      </section>

      {/* three plain nouns */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-24">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[
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
          ].map((step) => (
            <div
              key={step.n}
              className="border-border bg-surface flex flex-col gap-3 rounded-[var(--radius-lg)] border p-6"
            >
              <span className="text-foreground-subtle font-mono text-xs tracking-widest">
                {step.n}
              </span>
              <h3 className="font-serif text-2xl tracking-tight">{step.title}</h3>
              <p className="text-foreground-muted text-sm leading-relaxed">{step.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-border mx-auto w-full max-w-6xl border-t px-6 py-6">
        <p className="text-foreground-subtle text-xs">
          FFE — federated fine-tuning extension. Hidden machinery: TEE attestation, encrypted
          aggregation, on-chain co-ownership.
        </p>
      </footer>
    </main>
  );
}
