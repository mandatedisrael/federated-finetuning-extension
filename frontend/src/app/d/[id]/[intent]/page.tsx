"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SignInDialog } from "@/components/auth/SignInDialog";
import { useAuth } from "@/lib/auth/AuthProvider";
import { projectStore } from "@/lib/mock/projectStore";
import { isNotifyIntent, type NotifyIntent } from "@/lib/notify/deepLinks";

function targetFor(
  intent: NotifyIntent,
  projectId: string,
  stage: string,
  isOwner: boolean,
): string {
  switch (intent) {
    case "invite":
      return `/p/${projectId}`;
    case "youre-up":
      // Training-stage emails point to the dashboard; otherwise the
      // contributor needs the upload screen.
      return stage === "training" || stage === "ready"
        ? `/p/${projectId}`
        : `/p/${projectId}/contribute`;
    case "training-started":
      return `/p/${projectId}`;
    case "result-ready":
      return `/p/${projectId}/result`;
    case "version-published":
      // Owner lands on the publish receipt; contributors on versions.
      return isOwner ? `/p/${projectId}/publish` : `/p/${projectId}/versions`;
  }
}

export default function NotifyDeepLinkPage() {
  const params = useParams<{ id: string; intent: string }>();
  const router = useRouter();
  const { user, status } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = React.useState(false);

  const rawIntent = params?.intent ? decodeURIComponent(params.intent) : "";
  const deepLink =
    params?.id && rawIntent ? `/d/${params.id}/${rawIntent}` : "/";

  React.useEffect(() => {
    if (!params?.id || !rawIntent) return;
    if (status === "loading") return;

    if (!isNotifyIntent(rawIntent)) {
      setError("This link isn't recognized. It may be from an older email.");
      return;
    }

    if (status === "anonymous") {
      setNeedsSignIn(true);
      return;
    }

    const project = projectStore.get(params.id);
    if (!project) {
      setError("That project couldn't be found.");
      return;
    }

    const isOwner = user?.id === project.ownerId;
    const target = targetFor(rawIntent, project.id, project.stage, isOwner);
    router.replace(target);
  }, [params?.id, rawIntent, status, user?.id, router]);

  return (
    <main className="flex flex-1 items-center justify-center">
      <div className="mx-auto max-w-md px-6 text-center">
        {error ? (
          <>
            <p className="font-serif text-2xl tracking-tight">Link didn&apos;t open</p>
            <p className="text-foreground-muted mt-3 text-sm">{error}</p>
            <Button asChild variant="secondary" className="mt-6">
              <Link href="/">Back to home</Link>
            </Button>
          </>
        ) : needsSignIn ? (
          <>
            <p className="font-serif text-2xl tracking-tight">Sign in to continue</p>
            <p className="text-foreground-muted mt-3 text-sm">
              We&apos;ll drop you back into the right place after sign-in.
            </p>
          </>
        ) : (
          <p className="text-foreground-muted inline-flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Opening your project…
          </p>
        )}
      </div>
      {needsSignIn && (
        <SignInDialog
          open={needsSignIn}
          onOpenChange={setNeedsSignIn}
          redirectTo={deepLink}
        />
      )}
    </main>
  );
}
