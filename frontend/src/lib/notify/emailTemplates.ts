/**
 * Email transition templates. Pure functions — no side effects.
 * Render HTML and a plain-text fallback for each stage transition.
 * Provider integration (Resend, Postmark, etc.) reads from these
 * templates; the preview route renders them in the browser for
 * design review.
 */

import { buildDeepLinkUrl, type NotifyIntent } from "./deepLinks";

export interface EmailTemplateInput {
  projectId: string;
  projectName: string;
  recipientName: string;
  ownerName: string;
  origin: string;
  inviteCode?: string;
  deadline?: string; // ISO date (yyyy-mm-dd)
  versionLabel?: string;
}

export interface RenderedEmail {
  subject: string;
  preheader: string;
  html: string;
  text: string;
}

function firstName(name: string) {
  return name.split(" ")[0] ?? name;
}

function daysUntil(deadline?: string): number | null {
  if (!deadline) return null;
  const end = new Date(deadline + "T23:59:59").getTime();
  const diff = end - Date.now();
  if (Number.isNaN(diff)) return null;
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
}

interface BlockInput {
  preheader: string;
  heading: string;
  body: string;
  cta: { label: string; href: string };
  footnote?: string;
}

function htmlShell({ preheader, heading, body, cta, footnote }: BlockInput) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f4f0;color:#1c1b18;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
    <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escapeHtml(preheader)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f0;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e7e4dd;">
            <tr>
              <td style="padding:28px 32px 8px;font-family:'Instrument Serif',Georgia,serif;font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:#6e6c64;">FFE</td>
            </tr>
            <tr>
              <td style="padding:8px 32px 4px;font-family:'Instrument Serif',Georgia,serif;font-size:28px;line-height:1.2;color:#1c1b18;">${escapeHtml(heading)}</td>
            </tr>
            <tr>
              <td style="padding:12px 32px 24px;font-size:15px;line-height:1.6;color:#3a3833;">${body}</td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px;">
                <a href="${escapeAttr(cta.href)}" style="display:inline-block;background:#1c1b18;color:#f5f4f0;text-decoration:none;font-weight:500;padding:12px 20px;border-radius:10px;font-size:14px;letter-spacing:-0.01em;">${escapeHtml(cta.label)}</a>
              </td>
            </tr>
            ${
              footnote
                ? `<tr><td style="padding:0 32px 28px;font-size:12px;line-height:1.5;color:#6e6c64;">${footnote}</td></tr>`
                : ""
            }
          </table>
          <p style="max-width:520px;font-size:11px;line-height:1.6;color:#a8a59c;margin:16px auto 0;text-align:left;padding:0 4px;">You&rsquo;re receiving this because you&rsquo;re part of an FFE project. The link above takes you back exactly where the project expects you.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string) {
  return escapeHtml(s);
}

function textShell({ heading, body, cta }: BlockInput) {
  return `${heading}

${stripHtml(body)}

${cta.label}: ${cta.href}

— FFE`;
}

function stripHtml(s: string) {
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function render(input: EmailTemplateInput, intent: NotifyIntent): RenderedEmail {
  const href = buildDeepLinkUrl(input.origin, intent, input.projectId, input.inviteCode);
  const name = firstName(input.recipientName);
  const days = daysUntil(input.deadline);

  switch (intent) {
    case "invite": {
      const block: BlockInput = {
        preheader: `${firstName(input.ownerName)} invited you to ${input.projectName} on FFE.`,
        heading: `You're invited to ${input.projectName}`,
        body: `<p>${escapeHtml(firstName(input.ownerName))} is teaching a shared AI assistant and wants your help. Your examples stay encrypted on your device and only contribute to a co-owned model — never to anyone else's product.</p>`,
        cta: { label: "Accept invite", href },
        footnote: input.inviteCode
          ? `Invite code: <code>${escapeHtml(input.inviteCode)}</code>`
          : undefined,
      };
      return {
        subject: `${firstName(input.ownerName)} invited you to ${input.projectName}`,
        preheader: block.preheader,
        html: htmlShell(block),
        text: textShell(block),
      };
    }
    case "youre-up": {
      const tail =
        days === 0
          ? "The deadline is today."
          : days === 1
            ? "Just 1 day left."
            : days !== null
              ? `${days} days left.`
              : "";
      const block: BlockInput = {
        preheader: `Add your training examples to ${input.projectName}.`,
        heading: `You're up, ${name}.`,
        body: `<p>${escapeHtml(input.projectName)} is waiting on your contribution. Drop in your examples — or rewrite a few prompts together in Studio. ${escapeHtml(tail)}</p>`,
        cta: { label: "Contribute now", href },
      };
      return {
        subject: `You're up on ${input.projectName}`,
        preheader: block.preheader,
        html: htmlShell(block),
        text: textShell(block),
      };
    }
    case "training-started": {
      const block: BlockInput = {
        preheader: `Training has started for ${input.projectName}.`,
        heading: `Training started`,
        body: `<p>All contributions are sealed and the model is training inside the enclave. We&rsquo;ll email again when the new version is ready to try.</p>`,
        cta: { label: "View project", href },
      };
      return {
        subject: `${input.projectName} — training started`,
        preheader: block.preheader,
        html: htmlShell(block),
        text: textShell(block),
      };
    }
    case "result-ready": {
      const block: BlockInput = {
        preheader: `Try the new version of ${input.projectName} side-by-side.`,
        heading: `The new version is ready`,
        body: `<p>Ask the new model the same questions as the previous version and tell us which felt better. Voting and feedback shape the next round.</p>`,
        cta: { label: "Try the new version", href },
      };
      return {
        subject: `${input.projectName} — new version ready to try`,
        preheader: block.preheader,
        html: htmlShell(block),
        text: textShell(block),
      };
    }
    case "version-published": {
      const label = input.versionLabel ?? "A new version";
      const block: BlockInput = {
        preheader: `${label} of ${input.projectName} is live.`,
        heading: `${label} is live`,
        body: `<p>${escapeHtml(firstName(input.ownerName))} published a new version of ${escapeHtml(input.projectName)}. Your data was included in this shared improvement.</p>`,
        cta: { label: "See the timeline", href },
      };
      return {
        subject: `${label} of ${input.projectName} is live`,
        preheader: block.preheader,
        html: htmlShell(block),
        text: textShell(block),
      };
    }
  }
}

export function renderEmail(intent: NotifyIntent, input: EmailTemplateInput) {
  return render(input, intent);
}
