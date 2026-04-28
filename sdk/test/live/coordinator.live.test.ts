/**
 * Live integration tests for the Coordinator client.
 *
 * Hit the real deployed Coordinator at 0x4Dd446F51126d473070444041B9AA36d3ae7F295
 * on 0G Galileo testnet. Read-only — no funded wallet required.
 *
 * Skipped by default. Run with:
 *
 *   FFE_LIVE=1 npm run test:live
 *
 * If this suite ever breaks while unit tests still pass, the most likely
 * causes are: (1) testnet RPC down, (2) the contract was redeployed at a
 * new address, (3) someone changed the ABI without re-syncing it.
 */
import {describe, expect, it} from "vitest";
import {getAddress, type Address} from "viem";
import {
    CoordinatorError,
    createCoordinatorClient,
    galileo,
    GALILEO_COORDINATOR_ADDRESS,
} from "../../src/coordinator/index.js";

const LIVE = process.env.FFE_LIVE === "1";
const ZERO: Address = getAddress("0x0000000000000000000000000000000000000000");
const STRANGER: Address = getAddress("0x000000000000000000000000000000000000dEaD");

describe.runIf(LIVE)("coordinator client — live (Galileo)", () => {
    const client = createCoordinatorClient();

    it("connects to Galileo and reports the right chain", () => {
        expect(client.chain.id).toBe(galileo.id);
        expect(client.address).toBe(GALILEO_COORDINATOR_ADDRESS);
    }, 5_000);

    it(
        "reads nextSessionId without reverting",
        async () => {
            const id = await client.nextSessionId();
            expect(id).toBeGreaterThanOrEqual(1n);
        },
        15_000,
    );

    it(
        "getSession(0) reverts with SessionNotFound (sessions start at 1)",
        async () => {
            try {
                await client.getSession(0n);
                throw new Error("expected revert, got success");
            } catch (e) {
                expect(e).toBeInstanceOf(CoordinatorError);
                expect((e as CoordinatorError).contractCode).toBe("SessionNotFound");
            }
        },
        15_000,
    );

    it(
        "isParticipant(0, anyone) returns false without reverting",
        async () => {
            await expect(client.isParticipant(0n, STRANGER)).resolves.toBe(false);
            await expect(client.isParticipant(0n, ZERO)).resolves.toBe(false);
        },
        15_000,
    );

    it(
        "getSubmission(0, anyone) returns the zero hash without reverting",
        async () => {
            const h = await client.getSubmission(0n, STRANGER);
            expect(h).toBe("0x0000000000000000000000000000000000000000000000000000000000000000");
        },
        15_000,
    );

    it(
        "very large sessionId also reverts with SessionNotFound",
        async () => {
            try {
                await client.getSession(2n ** 64n);
                throw new Error("expected revert");
            } catch (e) {
                expect(e).toBeInstanceOf(CoordinatorError);
                expect((e as CoordinatorError).contractCode).toBe("SessionNotFound");
            }
        },
        15_000,
    );
});

describe.skipIf(LIVE)("coordinator live tests — skipped (set FFE_LIVE=1 to run)", () => {
    it("placeholder so this file always reports something", () => {
        expect(LIVE).toBe(false);
    });
});
