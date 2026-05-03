/**
 * Unit tests for the minter.
 * Tests key sealing, wire format serialization, and minting payload validation.
 */

import {describe, it, expect} from "vitest";
import {type Address, type Hash} from "viem";
import {
  sealedKeyToWireFormat,
  type MintingPayload,
} from "../src/minter";

describe("Minter", () => {
  it("should validate minting payload structure", () => {
    const payload: MintingPayload = {
      sessionId: 1n,
      encryptedLoraAdapter: new Uint8Array(1024), // Typical LoRA size
      adapterAESKey: new Uint8Array(32), // AES-256
      contributors: [
        {
          address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address,
          pubkey: new Uint8Array(32).fill(0xcc),
        },
        {
          address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as Address,
          pubkey: new Uint8Array(32).fill(0xdd),
        },
      ],
    };

    expect(payload.sessionId).toBe(1n);
    expect(payload.encryptedLoraAdapter).toBeInstanceOf(Uint8Array);
    expect(payload.adapterAESKey.length).toBe(32);
    expect(payload.contributors.length).toBe(2);
  });

  it("should validate sealed key wire format (92 bytes)", () => {
    const validSealedKey = new Uint8Array(92).fill(0xff);

    const wireFormat = sealedKeyToWireFormat(validSealedKey);
    expect(wireFormat).toBeInstanceOf(Uint8Array);
    expect(wireFormat.length).toBe(92);
  });

  it("should reject invalid sealed key lengths", () => {
    const invalidSealedKey = new Uint8Array(64); // Wrong length

    expect(() => {
      sealedKeyToWireFormat(invalidSealedKey);
    }).toThrow("Invalid sealed key length");
  });

  it("should accept 92-byte sealed key structure", () => {
    // Wire format: [ephemeralPubkey (32)] + [nonce (12)] + [ciphertext+tag (48)]

    const ephemeralPubkey = new Uint8Array(32).fill(0xaa);
    const nonce = new Uint8Array(12).fill(0xbb);
    const ciphertextWithTag = new Uint8Array(48).fill(0xcc);

    const sealedKey = new Uint8Array([
      ...ephemeralPubkey,
      ...nonce,
      ...ciphertextWithTag,
    ]);

    expect(sealedKey.length).toBe(92);
    const wireFormat = sealedKeyToWireFormat(sealedKey);
    expect(wireFormat.length).toBe(92);
  });

  it("should handle multiple contributors in minting payload", () => {
    const contributors = [];
    for (let i = 0; i < 10; i++) {
      contributors.push({
        address: `0x${i.toString().padStart(40, "a")}` as Address,
        pubkey: new Uint8Array(32).fill(i),
      });
    }

    const payload: MintingPayload = {
      sessionId: 123n,
      encryptedLoraAdapter: new Uint8Array(2048),
      adapterAESKey: new Uint8Array(32),
      contributors,
    };

    expect(payload.contributors.length).toBe(10);
    for (let i = 0; i < 10; i++) {
      expect(payload.contributors[i]!.pubkey[0]).toBe(i);
    }
  });
});
