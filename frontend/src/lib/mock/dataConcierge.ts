import type { FindingKind } from "@/components/domain/DataConciergeRow";

export interface ConciergeFinding {
  id: string;
  kind: FindingKind;
  count: number;
  description: string;
  actions: Array<"redact" | "drop" | "keep">;
}

export interface ConciergeReport {
  usableCount: number;
  findings: ConciergeFinding[];
  previewRows: Array<{ question: string; answer: string }>;
  detectedSchema: { question: string; answer: string };
}

/**
 * Mock concierge. Given a list of files, returns a believable
 * report after a short delay. Production swaps this for the
 * real client-side scanner.
 */
export async function scanFiles(files: File[]): Promise<ConciergeReport> {
  await new Promise((r) => setTimeout(r, 900));
  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
  // Heuristic: more bytes → more examples. Floor for tiny files.
  const usable = Math.max(40, Math.min(420, Math.round(totalBytes / 800)));
  const duplicates = Math.max(2, Math.round(usable * 0.06));
  const pii = Math.max(1, Math.round(usable * 0.04));

  return {
    usableCount: usable,
    detectedSchema: { question: "customer_message", answer: "agent_reply" },
    findings: [
      {
        id: "usable",
        kind: "usable",
        count: usable,
        description: "usable Q&A pairs detected after parsing your files.",
        actions: [],
      },
      {
        id: "duplicates",
        kind: "duplicate",
        count: duplicates,
        description: "near-duplicate examples — we recommend dropping these.",
        actions: ["drop", "keep"],
      },
      {
        id: "pii",
        kind: "pii",
        count: pii,
        description: "examples may contain private info (emails, phone numbers, account IDs).",
        actions: ["redact", "drop", "keep"],
      },
    ],
    previewRows: [
      {
        question: "Hi, my package hasn't arrived and tracking is stuck — what's going on?",
        answer:
          "Sorry about the delay — let me pull up your order. Most carrier holds clear within 24 hours; if it doesn't, we'll send a replacement on us.",
      },
      {
        question: "How do I cancel an order I placed 10 minutes ago?",
        answer:
          "If we haven't shipped yet, I can cancel from my side — give me one second. You'll see the refund hit your card within 3 business days.",
      },
      {
        question: "Is the navy hoodie back in stock?",
        answer:
          "Not quite yet — we're restocking it Friday. Want me to flag your email so you're notified the moment it's live?",
      },
    ],
  };
}
