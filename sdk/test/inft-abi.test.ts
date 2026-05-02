/**
 * Structural tests for the vendored INFTMinter ABI.
 *
 * These catch accidental edits or drift between the vendored file and the
 * contract source. They do NOT test on-chain behaviour — that lives in
 * contracts/test/INFTMinter.t.sol.
 */
import {describe, expect, it} from "vitest";
import {inftMinterAbi} from "../src/inft/abi.js";

type AbiEntry = (typeof inftMinterAbi)[number];

function fns(): AbiEntry[] {
    return inftMinterAbi.filter((e) => e.type === "function") as AbiEntry[];
}

function events(): AbiEntry[] {
    return inftMinterAbi.filter((e) => e.type === "event") as AbiEntry[];
}

function errors(): AbiEntry[] {
    return inftMinterAbi.filter((e) => e.type === "error") as AbiEntry[];
}

function names(entries: AbiEntry[]): string[] {
    return entries.map((e) => (e as {name: string}).name);
}

describe("INFTMinter ABI — structural", () => {
    it("exposes all expected functions", () => {
        const fnNames = names(fns());
        expect(fnNames).toContain("mint");
        expect(fnNames).toContain("getMintRecord");
        expect(fnNames).toContain("getSealedKey");
        expect(fnNames).toContain("getTokenBySession");
        expect(fnNames).toContain("hasMinted");
        expect(fnNames).toContain("minter");
        expect(fnNames).toContain("nextTokenId");
    });

    it("exposes the Minted event", () => {
        expect(names(events())).toContain("Minted");
    });

    it("exposes all custom errors", () => {
        const errNames = names(errors());
        expect(errNames).toContain("NotMinter");
        expect(errNames).toContain("AlreadyMinted");
        expect(errNames).toContain("TokenNotFound");
        expect(errNames).toContain("SessionNotMinted");
        expect(errNames).toContain("ZeroHash");
        expect(errNames).toContain("EmptyContributors");
        expect(errNames).toContain("LengthMismatch");
        expect(errNames).toContain("ZeroAddress");
        expect(errNames).toContain("EmptySealedKey");
    });

    it("getMintRecord output is a tuple with the right fields", () => {
        const fn = inftMinterAbi.find(
            (e) => e.type === "function" && (e as {name: string}).name === "getMintRecord",
        ) as {outputs: {components: {name: string}[]}[]};
        const fields = fn.outputs[0]!.components.map((c) => c.name);
        expect(fields).toEqual(["sessionId", "modelBlobHash", "contributors", "mintedAt"]);
    });
});
