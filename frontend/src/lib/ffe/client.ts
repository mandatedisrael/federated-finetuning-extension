import type {
  CreateFfeProjectSessionInput,
  CreateFfeProjectSessionResult,
  FfeApiErrorBody,
  FfeSessionStatusResult,
  SubmitFfeContributionFile,
  SubmitFfeContributionInput,
  SubmitFfeContributionResult,
} from "./types";

const MAX_TEXT_BYTES_PER_FILE = 1_500_000;

export class FfeApiError extends Error {
  constructor(
    message: string,
    readonly details?: string,
  ) {
    super(message);
    this.name = "FfeApiError";
  }
}

async function parseApiResponse<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as T | FfeApiErrorBody | null;
  if (!res.ok) {
    const errorBody = body as FfeApiErrorBody | null;
    throw new FfeApiError(
      errorBody?.error ?? `FFE request failed (${res.status})`,
      errorBody?.details,
    );
  }
  return body as T;
}

export async function createFfeProjectSession(
  input: CreateFfeProjectSessionInput,
): Promise<CreateFfeProjectSessionResult> {
  const res = await fetch("/api/ffe/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseApiResponse<CreateFfeProjectSessionResult>(res);
}

export async function filesToFfePayload(files: File[]): Promise<SubmitFfeContributionFile[]> {
  return Promise.all(
    files.map(async (file) => {
      if (file.size > MAX_TEXT_BYTES_PER_FILE) {
        throw new FfeApiError(
          `${file.name} is too large for the current browser upload path.`,
          "Use a text/JSONL export under 1.5 MB for this first real integration slice.",
        );
      }
      return {
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        text: await file.text(),
      };
    }),
  );
}

export async function submitFfeContribution(
  input: SubmitFfeContributionInput,
): Promise<SubmitFfeContributionResult> {
  const res = await fetch("/api/ffe/contributions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseApiResponse<SubmitFfeContributionResult>(res);
}

export async function getFfeSessionStatus(sessionId: string): Promise<FfeSessionStatusResult> {
  const res = await fetch(`/api/ffe/sessions/${encodeURIComponent(sessionId)}`, {
    cache: "no-store",
  });
  return parseApiResponse<FfeSessionStatusResult>(res);
}
