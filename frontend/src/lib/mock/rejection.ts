/**
 * Mock rejection report. Returned when the Quality Gate filters a
 * contributor's data. Plain-language reasons per issue — no jargon.
 * Real impl will read this from the aggregator after the gate runs.
 */

export type RejectionReasonKind =
  | "duplicates"
  | "format"
  | "low-quality-conversion"
  | "pii-unredacted"
  | "off-topic";

export interface RejectionReason {
  id: string;
  kind: RejectionReasonKind;
  title: string;
  detail: string;
  affectedCount: number;
  fix: "resubmit" | "rewrite";
}

export interface RejectionReport {
  rejectedCount: number;
  submittedCount: number;
  reasons: RejectionReason[];
}

export function mockRejectionReport(): RejectionReport {
  return {
    submittedCount: 124,
    rejectedCount: 38,
    reasons: [
      {
        id: "r_dupes",
        kind: "duplicates",
        title: "Examples were too similar",
        detail:
          "We found 22 near-duplicate Q&A pairs. Models learn faster from variety — try removing repeats or adding rephrased versions.",
        affectedCount: 22,
        fix: "resubmit",
      },
      {
        id: "r_format",
        kind: "format",
        title: "Format didn't match expected Q&A",
        detail:
          "11 rows were missing an answer field, or the question and answer were merged into one cell. We need one column per side.",
        affectedCount: 11,
        fix: "resubmit",
      },
      {
        id: "r_conversion",
        kind: "low-quality-conversion",
        title: "PDF conversion produced low-quality pairs",
        detail:
          "5 examples were extracted from your PDF with broken sentences or missing context. A cleaner source — CSV, Notion export, or a chat log — usually helps.",
        affectedCount: 5,
        fix: "rewrite",
      },
    ],
  };
}
