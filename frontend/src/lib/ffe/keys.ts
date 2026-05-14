import { x25519 } from "@noble/curves/ed25519";

export interface BrowserFfeKeyPair {
  publicKey: string;
  privateKey: string;
}

export function bytesToHex(bytes: Uint8Array): `0x${string}` {
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function createBrowserFfeKeyPair(): BrowserFfeKeyPair {
  const privateKey = new Uint8Array(32);
  globalThis.crypto.getRandomValues(privateKey);
  const publicKey = x25519.getPublicKey(privateKey);
  return {
    publicKey: bytesToHex(publicKey),
    privateKey: bytesToHex(privateKey),
  };
}
