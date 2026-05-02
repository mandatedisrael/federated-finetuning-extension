/**
 * Event listener for the Aggregator.
 * Polls the Coordinator for QuorumReached events, deduplicates, and yields typed payloads.
 */

import {
  type Address,
  type Hash,
} from "viem";
import {
  coordinator,
} from "@notmartin/ffe";

/** Typed payload for a QuorumReached session event */
export interface QuorumReachedPayload {
  sessionId: bigint;
  submitters: Address[];
  blobHashes: Hash[];
  ownerPubkeys: Uint8Array[];
}

/**
 * Polls for QuorumReached events on the Coordinator.
 * Deduplicates by session ID and yields typed payloads.
 *
 * @param coordinatorAddress Coordinator contract address
 * @param rpcUrl RPC endpoint for Galileo
 * @param pollIntervalMs Poll interval in milliseconds
 * @param onEvent Callback invoked each time a new QuorumReached event is discovered
 * @returns AbortController to stop polling
 */
export function startEventListener(
  coordinatorAddress: Address,
  rpcUrl: string,
  pollIntervalMs: number,
  onEvent: (payload: QuorumReachedPayload) => Promise<void>
): AbortController {
  const seen = new Set<bigint>();
  const controller = new AbortController();

  const coordinatorClient = coordinator.createCoordinatorClient({
    address: coordinatorAddress,
    rpcUrl,
  });

  async function poll() {
    if (controller.signal.aborted) return;

    try {
      // Poll nextSessionId to discover new sessions
      let nextSessionId = await coordinatorClient.nextSessionId();

      // Check all sessions from 0 to nextSessionId-1
      for (let sessionId = 0n; sessionId < nextSessionId; sessionId++) {
        if (seen.has(sessionId)) continue;

        const sessionInfo = await coordinatorClient.getSession(sessionId);

        // Only process sessions that have reached quorum
        if (sessionInfo.status !== 1) continue; // 1 = SessionStatus.QuorumReached

        seen.add(sessionId);

        // Fetch the full data for this quorum-reached session
        const submitters = await coordinatorClient.getSubmitters(sessionId);
        const submissionsPromises = submitters.map((submitter) =>
          coordinatorClient.getSubmission(sessionId, submitter)
        );
        const submissions = await Promise.all(submissionsPromises);

        // Submissions are blobHashes
        const blobHashes = submissions as Hash[];

        // Fetch owner pubkeys
        const pubkeyPromises = submitters.map((submitter) =>
          coordinatorClient.getOwnerPubkey(sessionId, submitter)
        );
        const pubkeyHexes = await Promise.all(pubkeyPromises);

        // Decode pubkeys from hex to Uint8Array
        const ownerPubkeys = pubkeyHexes.map((hex) =>
          new Uint8Array(Buffer.from(hex.slice(2), "hex"))
        );

        const payload: QuorumReachedPayload = {
          sessionId,
          submitters: [...submitters],
          blobHashes,
          ownerPubkeys,
        };

        await onEvent(payload);
      }
    } catch (err) {
      console.error("[EventListener] Poll error:", err);
    }

    if (!controller.signal.aborted) {
      setTimeout(poll, pollIntervalMs);
    }
  }

  poll();
  return controller;
}
