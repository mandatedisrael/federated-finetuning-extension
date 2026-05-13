import type { Template } from "./types";

export const TEMPLATES: Template[] = [
  {
    id: "customer-support",
    name: "Customer Support Assistant",
    goal: "Answer customer questions in our voice, with our policies.",
    description:
      "Teach the AI to reply like your best support people. Drop in ticket exports, chat logs, or saved responses.",
    recommendedContributors: "3–8 contributors",
    exampleFormats: ["CSV exports", "Chat logs", "Ticket dumps", "Saved replies"],
    minExamples: 50,
    surface: "friendly",
    icon: "headset",
  },
  {
    id: "code-review",
    name: "Code Review Style",
    goal: "Review pull requests with the team's tone and standards.",
    description:
      "Help the AI review code the way your team does — same nits, same priorities, same depth.",
    recommendedContributors: "2–6 contributors",
    exampleFormats: ["PR comments", "Review threads", "Style guides"],
    minExamples: 40,
    surface: "technical",
    icon: "code",
  },
  {
    id: "medical-notes",
    name: "Medical Notes Summarizer",
    goal: "Summarize patient notes into structured, compliant briefs.",
    description:
      "Train the AI on the summarization patterns your clinicians actually use. Privacy-preserving by design.",
    recommendedContributors: "5–15 contributors",
    exampleFormats: ["De-identified notes", "Discharge summaries", "Care plans"],
    minExamples: 80,
    surface: "technical",
    icon: "clipboard",
  },
];

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
