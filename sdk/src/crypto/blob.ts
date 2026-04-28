import {keccak_256} from "@noble/hashes/sha3";
import {AES_NONCE_BYTES, aeadDecrypt, aeadEncrypt} from "./aead.js";
import {seal, unseal, type SealedKey} from "./seal.js";
import {AES_KEY_BYTES} from "./aead.js";
import {X25519_PUBLIC_KEY_BYTES} from "./keys.js";
import {generateAesKey} from "./aead.js";
import {InvalidInputError} from "../errors.js";

/**
 * Wire format for an encrypted blob (used both for contributor → TEE
 * datasets and TEE → INFT model artifacts):
 *
 *   version          1 byte    = 0x01
 *   ephPubkey       32 bytes   X25519 ephemeral public key
 *   nonce           12 bytes   AES-GCM nonce
 *   sealedNonce     12 bytes   AES-GCM nonce for the wrapped data key
 *   sealedKeyLen     2 bytes   big-endian length of `sealedKeyCt`
 *   sealedKeyCt     N bytes    AES-GCM-wrapped data key (incl. 16B tag)
 *   ciphertext      M bytes    AES-GCM-encrypted payload (incl. 16B tag)
 *
 * The format is designed to be self-describing so the aggregator can decrypt
 * a contributor's submission with only its enclave private key + the blob
 * bytes. The on-chain `blobHash` we commit is `keccak256(blob_bytes)`.
 */

export const BLOB_VERSION = 0x01;

const HEADER_FIXED =
    1 /*version*/ +
    X25519_PUBLIC_KEY_BYTES /*32*/ +
    AES_NONCE_BYTES /*12 — payload nonce*/ +
    AES_NONCE_BYTES /*12 — sealedKey nonce*/ +
    2; /*sealedKeyLen*/

export interface EncryptedBlob {
    /** Self-describing concatenated bytes ready to upload to storage. */
    bytes: Uint8Array;
    /** keccak256(bytes) — the on-chain commitment. */
    hash: Uint8Array;
    /**
     * The fresh symmetric key used for this blob. Returned for callers that
     * need to mirror it elsewhere (e.g. the TEE wraps it to N owners). For
     * contributor uploads, this is throwaway — discard it.
     */
    dataKey: Uint8Array;
}

/**
 * Encrypt a payload to a recipient X25519 public key. Generates a fresh
 * symmetric key K, encrypts the payload with K, then seals K to the
 * recipient. Output bytes are self-describing.
 */
export function encryptToRecipient(
    plaintext: Uint8Array,
    recipientPublicKey: Uint8Array,
): EncryptedBlob {
    if (recipientPublicKey.length !== X25519_PUBLIC_KEY_BYTES) {
        throw new InvalidInputError(`recipient pubkey must be ${X25519_PUBLIC_KEY_BYTES} bytes`);
    }

    const dataKey = generateAesKey();
    const payload = aeadEncrypt(dataKey, plaintext);
    const sealed = seal(dataKey, recipientPublicKey);

    const sealedKeyCt = sealed.ciphertext;
    if (sealedKeyCt.length > 0xffff) {
        throw new InvalidInputError("sealedKey ciphertext exceeds 65535 bytes");
    }

    const total = HEADER_FIXED + sealedKeyCt.length + payload.ciphertext.length;
    const bytes = new Uint8Array(total);

    let off = 0;
    bytes[off] = BLOB_VERSION;
    off += 1;
    bytes.set(sealed.ephemeralPublicKey, off);
    off += X25519_PUBLIC_KEY_BYTES;
    bytes.set(payload.nonce, off);
    off += AES_NONCE_BYTES;
    bytes.set(sealed.nonce, off);
    off += AES_NONCE_BYTES;
    bytes[off] = (sealedKeyCt.length >> 8) & 0xff;
    bytes[off + 1] = sealedKeyCt.length & 0xff;
    off += 2;
    bytes.set(sealedKeyCt, off);
    off += sealedKeyCt.length;
    bytes.set(payload.ciphertext, off);

    const hash = keccak_256(bytes);
    return {bytes, hash, dataKey};
}

/** Decrypt a blob produced by `encryptToRecipient` using the recipient's private key. */
export function decryptForRecipient(
    bytes: Uint8Array,
    recipientPrivateKey: Uint8Array,
): Uint8Array {
    if (bytes.length < HEADER_FIXED) {
        throw new InvalidInputError("blob too short to contain header");
    }
    if (bytes[0] !== BLOB_VERSION) {
        throw new InvalidInputError(`unsupported blob version: ${bytes[0]}`);
    }

    let off = 1;
    const ephPub = bytes.slice(off, off + X25519_PUBLIC_KEY_BYTES);
    off += X25519_PUBLIC_KEY_BYTES;
    const payloadNonce = bytes.slice(off, off + AES_NONCE_BYTES);
    off += AES_NONCE_BYTES;
    const sealedNonce = bytes.slice(off, off + AES_NONCE_BYTES);
    off += AES_NONCE_BYTES;
    // Two-byte big-endian length. We checked HEADER_FIXED above so these
    // indices are guaranteed in-range.
    const sealedLen = ((bytes[off] as number) << 8) | (bytes[off + 1] as number);
    off += 2;

    if (off + sealedLen > bytes.length) {
        throw new InvalidInputError("blob truncated: sealedKeyLen exceeds remaining bytes");
    }
    const sealedKeyCt = bytes.slice(off, off + sealedLen);
    off += sealedLen;
    const ciphertext = bytes.slice(off);

    const sealed: SealedKey = {ephemeralPublicKey: ephPub, nonce: sealedNonce, ciphertext: sealedKeyCt};
    const dataKey = unseal(sealed, recipientPrivateKey);
    if (dataKey.length !== AES_KEY_BYTES) {
        throw new InvalidInputError("recovered data key has unexpected length");
    }
    return aeadDecrypt(dataKey, {nonce: payloadNonce, ciphertext});
}

/** keccak256 of arbitrary bytes — exposed for callers that already have a blob in hand. */
export function blobHash(bytes: Uint8Array): Uint8Array {
    return keccak_256(bytes);
}
