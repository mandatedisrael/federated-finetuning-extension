/**
 * Seed examples for the Rewrite Studio. Each entry is a user prompt
 * + the current model's (bad-ish) reply. The contributor's job is
 * to rewrite a better reply.
 */
export interface RewritePrompt {
  id: string;
  userMessage: string;
  currentReply: string;
}

export const REWRITE_PROMPTS: RewritePrompt[] = [
  {
    id: "rp-01",
    userMessage:
      "I ordered a sweater 5 days ago and the tracking still says 'label created'. Is it actually going to ship?",
    currentReply:
      "Please allow up to 14 business days for shipping. If you have further concerns, contact support.",
  },
  {
    id: "rp-02",
    userMessage: "I'd like to cancel my order — it just shipped a few minutes ago.",
    currentReply:
      "We are unable to cancel orders once they have shipped. Refunds may be issued after the item is returned.",
  },
  {
    id: "rp-03",
    userMessage: "Do you have the navy hoodie in size M?",
    currentReply: "I am unable to check inventory. Please check the website.",
  },
  {
    id: "rp-04",
    userMessage: "The discount code I was emailed doesn't work at checkout. It says 'invalid'.",
    currentReply:
      "Discount codes must be entered exactly as shown. If the issue persists, contact support.",
  },
  {
    id: "rp-05",
    userMessage: "Will my package arrive before Friday?",
    currentReply: "Delivery dates are estimates and not guaranteed.",
  },
];
