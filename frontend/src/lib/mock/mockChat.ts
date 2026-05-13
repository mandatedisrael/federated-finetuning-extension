/**
 * Mock streaming chat. Returns a cancelable async iterator over
 * text chunks so the playground can demonstrate the side-by-side
 * UX without a backend. Swap for a real Vercel AI SDK stream
 * later by replacing this file behind the same async-iterator
 * shape.
 */

const BASE_LINES: Record<string, [string, string]> = {
  refund: [
    "You can request a refund within 30 days of purchase. Email support@acme.co with your order number and we'll process it.",
    "Yes — refunds are available within 30 days. I'll need your order number to start it. Per our policy, items must be unused; physical returns are paid by us. Want me to start the request now?",
  ],
  shipping: [
    "Standard shipping takes 5-7 business days. We use UPS and FedEx.",
    "Standard shipping is 5–7 business days via UPS Ground. Expedited (2-day) is available at checkout. Once it ships, you'll get a tracking link by email.",
  ],
  cancel: [
    "To cancel, log in and go to Account → Subscriptions → Cancel.",
    "I can help cancel. Two options: cancel immediately and keep access until your billing date, or schedule it for end-of-cycle. Which would you prefer? You can also pause for a month if you're not sure.",
  ],
  default: [
    "Thanks for reaching out. Let me look into that and get back to you.",
    "Great question. Based on our docs: here's how we'd typically handle this — let me walk through the relevant policy and next steps in plain English so you can decide what works.",
  ],
};

function pickAnswer(prompt: string): [string, string] {
  const lower = prompt.toLowerCase();
  if (lower.includes("refund") || lower.includes("return")) return BASE_LINES.refund!;
  if (lower.includes("ship") || lower.includes("deliver")) return BASE_LINES.shipping!;
  if (lower.includes("cancel") || lower.includes("subscrib")) return BASE_LINES.cancel!;
  return BASE_LINES.default!;
}

export interface MockStream {
  cancel: () => void;
  done: Promise<void>;
}

export function streamMockReply(
  prompt: string,
  side: "left" | "right",
  onChunk: (text: string) => void,
): MockStream {
  const [leftAnswer, rightAnswer] = pickAnswer(prompt);
  const full = side === "left" ? leftAnswer : rightAnswer;
  const words = full.split(/(\s+)/);
  // Right side runs a touch faster to feel "newer."
  const baseDelay = side === "left" ? 55 : 35;
  let i = 0;
  let cancelled = false;
  let acc = "";

  const done = new Promise<void>((resolve) => {
    function tick() {
      if (cancelled) return resolve();
      if (i >= words.length) return resolve();
      acc += words[i]!;
      onChunk(acc);
      i += 1;
      const jitter = Math.random() * 30;
      setTimeout(tick, baseDelay + jitter);
    }
    setTimeout(tick, baseDelay);
  });

  return {
    cancel: () => {
      cancelled = true;
    },
    done,
  };
}
