/**
 * Phase 0.3 spike — multi-owner sealedKey pattern.
 *
 * Question: can N parties each independently decrypt the same payload
 * via N separate sealedKeys (one per pubkey)?
 *
 * This is the crypto pattern that ERC-7857 / AgentNFT relies on. The
 * contract is just a storage layer for sealedKey bytes; the real
 * question is whether the crypto pattern is sound.
 *
 * If this prints "OK", the multi-owner INFT design works. Throwaway
 * file — delete after Phase 0 is signed off.
 *
 * Run:  npx ts-node test.ts   (no install needed; uses Node built-ins)
 */

import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  generateKeyPairSync,
  diffieHellman,
  createHash,
  KeyObject,
} from "crypto";

// ---------- helpers ----------

function aesGcmEncrypt(key: Buffer, plaintext: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv, ct, tag };
}

function aesGcmDecrypt(
  key: Buffer,
  iv: Buffer,
  ct: Buffer,
  tag: Buffer,
): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

// HKDF-ish: derive a 32-byte key from an X25519 shared secret + ephemeral pubkey.
function deriveKey(sharedSecret: Buffer, ephPub: Buffer): Buffer {
  return createHash("sha256")
    .update(Buffer.concat([sharedSecret, ephPub]))
    .digest();
}

// "Seal" a symmetric key to a recipient's X25519 pubkey.
// This is the same shape as HPKE / libsodium sealed-box.
function sealKey(K: Buffer, recipientPub: KeyObject) {
  const eph = generateKeyPairSync("x25519");
  const shared = diffieHellman({
    privateKey: eph.privateKey,
    publicKey: recipientPub,
  });
  const wrapKey = deriveKey(
    shared,
    eph.publicKey.export({ type: "spki", format: "der" }),
  );
  const { iv, ct, tag } = aesGcmEncrypt(wrapKey, K);
  return {
    ephPub: eph.publicKey.export({ type: "spki", format: "der" }),
    iv,
    ct,
    tag,
  };
}

// "Unseal" — recipient uses their priv key to recover K.
function unsealKey(
  sealed: { ephPub: Buffer; iv: Buffer; ct: Buffer; tag: Buffer },
  recipientPriv: KeyObject,
): Buffer {
  const ephPubObj = require("crypto").createPublicKey({
    key: sealed.ephPub,
    format: "der",
    type: "spki",
  });
  const shared = diffieHellman({
    privateKey: recipientPriv,
    publicKey: ephPubObj,
  });
  const wrapKey = deriveKey(shared, sealed.ephPub);
  return aesGcmDecrypt(wrapKey, sealed.iv, sealed.ct, sealed.tag);
}

// ---------- the test ----------

function main() {
  // 1. Two contributors, each with their own X25519 wallet/keypair.
  const alice = generateKeyPairSync("x25519");
  const bob = generateKeyPairSync("x25519");

  // 2. The TEE generates a fresh symmetric key K and encrypts the joint LoRA.
  const K = randomBytes(32);
  const fakeLoRA = Buffer.from(
    "pretend this is a 200MB safetensors file with the trained joint LoRA",
  );
  const blob = aesGcmEncrypt(K, fakeLoRA);

  // 3. The TEE seals K once per contributor.
  const sealedForAlice = sealKey(K, alice.publicKey);
  const sealedForBob = sealKey(K, bob.publicKey);

  // 4. Alice independently recovers K and decrypts the LoRA.
  const aliceK = unsealKey(sealedForAlice, alice.privateKey);
  const aliceLoRA = aesGcmDecrypt(aliceK, blob.iv, blob.ct, blob.tag);

  // 5. Bob independently does the same — using only his own private key.
  const bobK = unsealKey(sealedForBob, bob.privateKey);
  const bobLoRA = aesGcmDecrypt(bobK, blob.iv, blob.ct, blob.tag);

  // 6. Cross-check: Alice's sealedKey must NOT decrypt with Bob's privkey.
  let crossFails = false;
  try {
    unsealKey(sealedForAlice, bob.privateKey);
  } catch {
    crossFails = true;
  }

  // 7. Verdict.
  const aliceOK = aliceLoRA.equals(fakeLoRA);
  const bobOK = bobLoRA.equals(fakeLoRA);
  const isolated = crossFails;

  console.log("Alice decrypts joint LoRA: ", aliceOK ? "yes" : "no");
  console.log("Bob   decrypts joint LoRA: ", bobOK ? "yes" : "no");
  console.log("Cross-decrypt is rejected: ", isolated ? "yes" : "no");

  if (aliceOK && bobOK && isolated) {
    console.log(
      "\nOK — multi-owner sealedKey pattern works. Phase 0.3 answered.",
    );
    process.exit(0);
  } else {
    console.log("\nFAIL — pattern is broken; investigate before proceeding.");
    process.exit(1);
  }
}

main();
