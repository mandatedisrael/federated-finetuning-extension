/**
 * Resumable deep links for email transitions. Every email lands on
 * one of these intents; the /d/[id]/[intent] route reads the project
 * stage and forwards to the right screen so the user picks up
 * exactly where the flow expects them.
 */

export const NOTIFY_INTENTS = [
  "invite",
  "youre-up",
  "training-started",
  "result-ready",
  "version-published",
] as const;

export type NotifyIntent = (typeof NOTIFY_INTENTS)[number];

export function isNotifyIntent(value: string): value is NotifyIntent {
  return (NOTIFY_INTENTS as readonly string[]).includes(value);
}

export function deepLinkPath(intent: NotifyIntent, projectId: string, inviteCode?: string) {
  switch (intent) {
    case "invite":
      return inviteCode ? `/join?code=${encodeURIComponent(inviteCode)}` : `/join`;
    case "youre-up":
      return `/d/${projectId}/youre-up`;
    case "training-started":
      return `/d/${projectId}/training-started`;
    case "result-ready":
      return `/d/${projectId}/result-ready`;
    case "version-published":
      return `/d/${projectId}/version-published`;
  }
}

export function buildDeepLinkUrl(
  origin: string,
  intent: NotifyIntent,
  projectId: string,
  inviteCode?: string,
) {
  return `${origin}${deepLinkPath(intent, projectId, inviteCode)}`;
}
