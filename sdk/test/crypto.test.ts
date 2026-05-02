import {describe, expect, it} from "vitest";
import {
    aeadDecrypt,
    aeadEncrypt,
    AES_KEY_BYTES,
    AES_NONCE_BYTES,
    BLOB_VERSION,
    blobHash,
    decryptForRecipient,
    encryptToRecipient,
    generateAesKey,
    generateKeyPair,
    publicKeyFromPrivate,
    seal,
    sealedKeyFromBytes,
    SEALED_KEY_BYTES,
    sealedKeyToBytes,
    unseal,
    X25519_PUBLIC_KEY_BYTES,
} from "../src/crypto/index.js";
import {DecryptionFailedError, InvalidInputError} from "../src/index.js";

const TEXT = new TextEncoder();

describe("keys", () => {
    it("generateKeyPair produces 32-byte pub and priv", () => {
        const kp = generateKeyPair();
        expect(kp.publicKey).toHaveLength(X25519_PUBLIC_KEY_BYTES);
        expect(kp.privateKey).toHaveLength(32);
    });

    it("publicKeyFromPrivate is deterministic", () => {
        const {privateKey, publicKey} = generateKeyPair();
        expect(publicKeyFromPrivate(privateKey)).toEqual(publicKey);
    });

    it("publicKeyFromPrivate rejects wrong-length input", () => {
        expect(() => publicKeyFromPrivate(new Uint8Array(31))).toThrow(InvalidInputError);
    });

    it("two keypairs are distinct", () => {
        const a = generateKeyPair();
        const b = generateKeyPair();
        expect(a.privateKey).not.toEqual(b.privateKey);
    });
});

describe("AEAD (AES-256-GCM)", () => {
    it("round-trips arbitrary bytes", () => {
        const k = generateAesKey();
        const pt = TEXT.encode("hello world");
        const ct = aeadEncrypt(k, pt);
        expect(ct.nonce).toHaveLength(AES_NONCE_BYTES);
        expect(aeadDecrypt(k, ct)).toEqual(pt);
    });

    it("nonce differs across encryptions of the same plaintext", () => {
        const k = generateAesKey();
        const pt = TEXT.encode("same");
        const a = aeadEncrypt(k, pt);
        const b = aeadEncrypt(k, pt);
        expect(a.nonce).not.toEqual(b.nonce);
        expect(a.ciphertext).not.toEqual(b.ciphertext);
    });

    it("rejects wrong key length", () => {
        expect(() => aeadEncrypt(new Uint8Array(16), TEXT.encode("x"))).toThrow(InvalidInputError);
    });

    it("decryption fails with wrong key", () => {
        const ct = aeadEncrypt(generateAesKey(), TEXT.encode("x"));
        expect(() => aeadDecrypt(generateAesKey(), ct)).toThrow(DecryptionFailedError);
    });

    it("decryption fails on tampered ciphertext", () => {
        const k = generateAesKey();
        const ct = aeadEncrypt(k, TEXT.encode("hello"));
        ct.ciphertext[0] = (ct.ciphertext[0] ?? 0) ^ 0xff;
        expect(() => aeadDecrypt(k, ct)).toThrow(DecryptionFailedError);
    });

    it("decryption fails on tampered nonce", () => {
        const k = generateAesKey();
        const ct = aeadEncrypt(k, TEXT.encode("hello"));
        ct.nonce[0] = (ct.nonce[0] ?? 0) ^ 0xff;
        expect(() => aeadDecrypt(k, ct)).toThrow(DecryptionFailedError);
    });
});

describe("seal / unseal", () => {
    it("recipient can unseal with their private key", () => {
        const recipient = generateKeyPair();
        const k = generateAesKey();
        const sealed = seal(k, recipient.publicKey);
        expect(unseal(sealed, recipient.privateKey)).toEqual(k);
    });

    it("ephemeral pubkey is fresh per seal", () => {
        const recipient = generateKeyPair();
        const k = generateAesKey();
        const a = seal(k, recipient.publicKey);
        const b = seal(k, recipient.publicKey);
        expect(a.ephemeralPublicKey).not.toEqual(b.ephemeralPublicKey);
    });

    it("non-recipient cannot unseal", () => {
        const alice = generateKeyPair();
        const bob = generateKeyPair();
        const k = generateAesKey();
        const sealed = seal(k, alice.publicKey);
        expect(() => unseal(sealed, bob.privateKey)).toThrow(DecryptionFailedError);
    });

    it("multiple owners independently recover the same key", () => {
        // The exact pattern that phase 0.3 proved — confirmed again at the
        // SDK boundary so we know the public API behaves the same.
        const alice = generateKeyPair();
        const bob = generateKeyPair();
        const carol = generateKeyPair();
        const K = generateAesKey();

        const sA = seal(K, alice.publicKey);
        const sB = seal(K, bob.publicKey);
        const sC = seal(K, carol.publicKey);

        expect(unseal(sA, alice.privateKey)).toEqual(K);
        expect(unseal(sB, bob.privateKey)).toEqual(K);
        expect(unseal(sC, carol.privateKey)).toEqual(K);

        // Cross-decrypt rejected:
        expect(() => unseal(sA, bob.privateKey)).toThrow(DecryptionFailedError);
        expect(() => unseal(sB, carol.privateKey)).toThrow(DecryptionFailedError);
    });

    it("seal rejects malformed inputs", () => {
        expect(() => seal(new Uint8Array(16), generateKeyPair().publicKey)).toThrow(InvalidInputError);
        expect(() => seal(generateAesKey(), new Uint8Array(31))).toThrow(InvalidInputError);
    });
});

describe("encryptToRecipient / decryptForRecipient (blob format)", () => {
    it("round-trips through the full self-describing blob", () => {
        const recipient = generateKeyPair();
        const payload = TEXT.encode("pretend this is a JSONL dataset");

        const blob = encryptToRecipient(payload, recipient.publicKey);

        // version byte
        expect(blob.bytes[0]).toBe(BLOB_VERSION);
        // hash is 32 bytes
        expect(blob.hash).toHaveLength(32);
        // dataKey is 32 bytes
        expect(blob.dataKey).toHaveLength(AES_KEY_BYTES);

        const decrypted = decryptForRecipient(blob.bytes, recipient.privateKey);
        expect(decrypted).toEqual(payload);
    });

    it("hash is deterministic for the byte slice", () => {
        const recipient = generateKeyPair();
        const blob = encryptToRecipient(TEXT.encode("x"), recipient.publicKey);
        expect(blobHash(blob.bytes)).toEqual(blob.hash);
    });

    it("hash differs across encryptions due to fresh nonces", () => {
        const recipient = generateKeyPair();
        const a = encryptToRecipient(TEXT.encode("same"), recipient.publicKey);
        const b = encryptToRecipient(TEXT.encode("same"), recipient.publicKey);
        expect(a.hash).not.toEqual(b.hash);
    });

    it("non-recipient decryption fails", () => {
        const recipient = generateKeyPair();
        const stranger = generateKeyPair();
        const blob = encryptToRecipient(TEXT.encode("secret"), recipient.publicKey);
        expect(() => decryptForRecipient(blob.bytes, stranger.privateKey)).toThrow(DecryptionFailedError);
    });

    it("rejects truncated blob", () => {
        const recipient = generateKeyPair();
        const blob = encryptToRecipient(TEXT.encode("x"), recipient.publicKey);
        const truncated = blob.bytes.slice(0, 10);
        expect(() => decryptForRecipient(truncated, recipient.privateKey)).toThrow(InvalidInputError);
    });

    it("rejects unknown version byte", () => {
        const recipient = generateKeyPair();
        const blob = encryptToRecipient(TEXT.encode("x"), recipient.publicKey);
        const tampered = new Uint8Array(blob.bytes);
        tampered[0] = 0xff;
        expect(() => decryptForRecipient(tampered, recipient.privateKey)).toThrow(InvalidInputError);
    });

    it("rejects flipped ciphertext", () => {
        const recipient = generateKeyPair();
        const blob = encryptToRecipient(TEXT.encode("hello"), recipient.publicKey);
        const tampered = new Uint8Array(blob.bytes);
        // flip a byte well inside the payload ciphertext (last byte of blob)
        const last = tampered.length - 1;
        tampered[last] = (tampered[last] ?? 0) ^ 0xff;
        expect(() => decryptForRecipient(tampered, recipient.privateKey)).toThrow(DecryptionFailedError);
    });

    it("encrypt rejects wrong-size recipient pubkey", () => {
        expect(() => encryptToRecipient(TEXT.encode("x"), new Uint8Array(31))).toThrow(InvalidInputError);
    });
});

describe("SealedKey serialization", () => {
    it("sealedKeyToBytes / sealedKeyFromBytes round-trips correctly", () => {
        const recipient = generateKeyPair();
        const dataKey = generateAesKey();
        const sealed = seal(dataKey, recipient.publicKey);

        const bytes = sealedKeyToBytes(sealed);
        expect(bytes).toHaveLength(SEALED_KEY_BYTES);

        const recovered = sealedKeyFromBytes(bytes);
        expect(recovered.ephemeralPublicKey).toEqual(sealed.ephemeralPublicKey);
        expect(recovered.nonce).toEqual(sealed.nonce);
        expect(recovered.ciphertext).toEqual(sealed.ciphertext);
    });

    it("serialized bytes unseal to the original data key", () => {
        const recipient = generateKeyPair();
        const dataKey = generateAesKey();
        const sealed = seal(dataKey, recipient.publicKey);
        const bytes = sealedKeyToBytes(sealed);

        const recoveredSealed = sealedKeyFromBytes(bytes);
        const recoveredKey = unseal(recoveredSealed, recipient.privateKey);
        expect(recoveredKey).toEqual(dataKey);
    });

    it("SEALED_KEY_BYTES is 92", () => {
        expect(SEALED_KEY_BYTES).toBe(92);
    });

    it("sealedKeyFromBytes rejects wrong-length input", () => {
        expect(() => sealedKeyFromBytes(new Uint8Array(91))).toThrow(InvalidInputError);
        expect(() => sealedKeyFromBytes(new Uint8Array(93))).toThrow(InvalidInputError);
    });

    it("sealedKeyToBytes rejects malformed SealedKey", () => {
        expect(() =>
            sealedKeyToBytes({
                ephemeralPublicKey: new Uint8Array(31),
                nonce: new Uint8Array(12),
                ciphertext: new Uint8Array(48),
            }),
        ).toThrow(InvalidInputError);
    });
});
