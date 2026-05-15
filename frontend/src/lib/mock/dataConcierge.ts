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

interface ExampleCandidate {
  left: string;
  right: string;
  leftKey: string;
  rightKey: string;
  previewOnly?: boolean;
}

const QUESTION_KEYS = [
  "question",
  "prompt",
  "input",
  "instruction",
  "customer_message",
  "user_message",
  "query",
  "title",
];

const ANSWER_KEYS = [
  "answer",
  "response",
  "output",
  "completion",
  "agent_reply",
  "assistant_reply",
  "assistant_response",
  "summary",
];

const TEXT_KEYS = ["content", "text", "body", "message", "note", "notes", "value"];
const SOURCE_KEYS = ["source", "file", "filename", "name", "title", "id"];

function normalizeKey(key: string) {
  return key
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function textValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function truncate(value: string, max = 220) {
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

function looksLikeJsonl(name: string) {
  return name.toLowerCase().endsWith(".jsonl");
}

function looksLikeJson(name: string) {
  return name.toLowerCase().endsWith(".json");
}

function splitTextIntoChunks(text: string) {
  return text
    .split(/\n\s*\n|\r\n\s*\r\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .slice(0, 50);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function extractRecords(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  const record = asRecord(parsed);
  if (!record) return [parsed];
  for (const value of Object.values(record)) {
    if (Array.isArray(value)) return value;
  }
  return [parsed];
}

function inferQuestionAnswerKeys(record: Record<string, unknown>) {
  const entries = Object.keys(record).map((key) => ({ raw: key, normalized: normalizeKey(key) }));
  const question = entries.find((entry) => QUESTION_KEYS.includes(entry.normalized));
  const answer = entries.find((entry) => ANSWER_KEYS.includes(entry.normalized));
  if (question && answer) {
    return { question: question.raw, answer: answer.raw };
  }
  return null;
}

function inferTextKey(record: Record<string, unknown>) {
  const entries = Object.keys(record).map((key) => ({ raw: key, normalized: normalizeKey(key) }));
  const text = entries.find((entry) => TEXT_KEYS.includes(entry.normalized));
  if (!text) return null;
  const source = entries.find((entry) => SOURCE_KEYS.includes(entry.normalized));
  return { source: source?.raw, text: text.raw };
}

function exampleFromRecord(
  record: Record<string, unknown>,
  fileName: string,
  index: number,
): ExampleCandidate {
  const pair = inferQuestionAnswerKeys(record);
  if (pair) {
    return {
      left: truncate(textValue(record[pair.question])),
      right: truncate(textValue(record[pair.answer])),
      leftKey: pair.question,
      rightKey: pair.answer,
    };
  }

  const textFields = inferTextKey(record);
  if (textFields) {
    return {
      left: truncate(
        textFields.source
          ? textValue(record[textFields.source]) || `${fileName} row ${index + 1}`
          : `${fileName} row ${index + 1}`,
      ),
      right: truncate(textValue(record[textFields.text])),
      leftKey: textFields.source ? textFields.source : "source",
      rightKey: textFields.text,
    };
  }

  return {
    left: truncate(fileName),
    right: truncate(JSON.stringify(record)),
    leftKey: "source",
    rightKey: "content",
    previewOnly: true,
  };
}

function examplesFromText(fileName: string, text: string): ExampleCandidate[] {
  return splitTextIntoChunks(text).map((chunk, index) => ({
    left: `${fileName} · chunk ${index + 1}`,
    right: truncate(chunk),
    leftKey: "source",
    rightKey: "content",
  }));
}

function detectPiiCount(examples: ExampleCandidate[]) {
  const piiPattern =
    /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})|(\+?\d[\d\s().-]{7,}\d)|(\b(?:acct|account|patient|member|policy|order)[\s:#-]*[A-Z0-9-]{4,}\b)/i;
  return examples.filter((example) => piiPattern.test(`${example.left}\n${example.right}`)).length;
}

function detectDuplicateCount(examples: ExampleCandidate[]) {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const example of examples) {
    const key = `${example.left}|${example.right}`.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) {
      duplicates += 1;
    } else {
      seen.add(key);
    }
  }
  return duplicates;
}

function mostCommonSchema(examples: ExampleCandidate[]): { question: string; answer: string } {
  const counts = new Map<string, number>();
  for (const example of examples) {
    const key = `${example.leftKey}:::${example.rightKey}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!best) return { question: "source", answer: "content" };
  const [question, answer] = best.split(":::");
  return { question: question ?? "source", answer: answer ?? "content" };
}

/**
 * Lightweight client-side scan that reflects the uploaded files instead of
 * canned examples. It supports jsonl, json arrays/records, and plain text.
 */
export async function scanFiles(files: File[]): Promise<ConciergeReport> {
  await new Promise((r) => setTimeout(r, 300));

  const texts = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      text: (await file.text()).trim(),
    })),
  );

  const allExamples: ExampleCandidate[] = [];

  for (const file of texts) {
    if (!file.text) continue;

    if (looksLikeJsonl(file.name)) {
      const lines = file.text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      for (const [index, line] of lines.entries()) {
        try {
          const parsed = JSON.parse(line) as unknown;
          const record = asRecord(parsed);
          allExamples.push(
            record
              ? exampleFromRecord(record, file.name, index)
              : {
                  left: `${file.name} line ${index + 1}`,
                  right: truncate(line),
                  leftKey: "source",
                  rightKey: "content",
                },
          );
        } catch {
          allExamples.push({
            left: `${file.name} line ${index + 1}`,
            right: truncate(line),
            leftKey: "source",
            rightKey: "content",
          });
        }
      }
      continue;
    }

    if (looksLikeJson(file.name)) {
      try {
        const parsed = JSON.parse(file.text) as unknown;
        const rows = extractRecords(parsed);
        rows.forEach((row, index) => {
          const record = asRecord(row);
          if (record) {
            allExamples.push(exampleFromRecord(record, file.name, index));
          } else {
            allExamples.push({
              left: `${file.name} row ${index + 1}`,
              right: truncate(textValue(row) || JSON.stringify(row)),
              leftKey: "source",
              rightKey: "content",
              previewOnly: true,
            });
          }
        });
        continue;
      } catch {
        // Fall through to plain-text handling.
      }
    }

    allExamples.push(...examplesFromText(file.name, file.text));
  }

  const previewRows: Array<{ question: string; answer: string }> = allExamples
    .slice(0, 3)
    .map((example) => ({
      question: example.left,
      answer: example.right,
    }));
  const trainableExamples = allExamples.filter(
    (example) => !example.previewOnly && example.right.trim().length > 0,
  );
  const formatOnlyCount = allExamples.length - trainableExamples.length;
  const duplicates = detectDuplicateCount(trainableExamples);
  const pii = detectPiiCount(trainableExamples);
  const detectedSchema =
    trainableExamples.length > 0
      ? mostCommonSchema(trainableExamples)
      : { question: "source", answer: "content" };

  const findings: ConciergeFinding[] = [
    {
      id: "usable",
      kind: trainableExamples.length > 0 ? "usable" : "format",
      count: trainableExamples.length,
      description:
        trainableExamples.length > 0
          ? "usable examples detected after parsing your files."
          : "trainable examples detected — this upload looks more like config or reference data.",
      actions: [],
    },
  ];

  if (duplicates > 0) {
    findings.push({
      id: "duplicates",
      kind: "duplicate",
      count: duplicates,
      description: "near-duplicate examples — we recommend dropping these.",
      actions: ["drop", "keep"],
    });
  }

  if (pii > 0) {
    findings.push({
      id: "pii",
      kind: "pii",
      count: pii,
      description: "examples may contain private info (emails, phone numbers, account IDs).",
      actions: ["redact", "drop", "keep"],
    });
  }

  if (formatOnlyCount > 0) {
    findings.push({
      id: "format",
      kind: "format",
      count: formatOnlyCount,
      description: "rows were previewed but do not look like direct training examples yet.",
      actions: [],
    });
  }

  return {
    usableCount: trainableExamples.length,
    findings,
    previewRows:
      previewRows.length > 0
        ? previewRows
        : [
            {
              question: "No readable examples found",
              answer:
                "Try uploading JSONL, JSON arrays, or text snippets that contain the examples you want to train on.",
            },
          ],
    detectedSchema,
  };
}
