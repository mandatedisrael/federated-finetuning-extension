/**
 * Generate a fresh X25519 keypair for the aggregator.
 * Prints AGG_X25519_KEY (private) and the corresponding public key.
 *
 * Usage:
 *   cd aggregator && npx tsx scripts/keygen.ts
 */

import {crypto} from "@notmartin/ffe";

const {publicKey, privateKey} = crypto.generateKeyPair();

const privHex = Buffer.from(privateKey).toString("hex");
const pubHex  = Buffer.from(publicKey).toString("hex");

console.log("─────────────────────────────────────────────");
console.log("FFE Aggregator — X25519 keypair");
console.log("─────────────────────────────────────────────");
console.log();
console.log("Add this to your environment:");
console.log();
console.log(`  AGG_X25519_KEY=${privHex}`);
console.log();
console.log("Corresponding public key (stored on-chain in sessions):");
console.log(`  ${pubHex}`);
console.log();
console.log("Keep AGG_X25519_KEY secret — it decrypts all contributor data.");
console.log("─────────────────────────────────────────────");
