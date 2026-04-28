import {gcm} from "@noble/ciphers/aes";
import {randomBytes} from "@noble/hashes/utils";
import {DecryptionFailedError, InvalidInputError} from "../errors.js";

/**
 * AES-256-GCM AEAD wrappers.
 *
 * Encryption produces `nonce || ciphertext-with-auth-tag`. The 16-byte tag is
 * appended by `@noble/ciphers` and verified on decrypt; tampered ciphertext or
 * a wrong key throws.
 *
 * The 12-byte nonce MUST never repeat under the same key. We always generate
 * it freshly via CSPRNG.
 */

export const AES_KEY_BYTES = 32;
export const AES_NONCE_BYTES = 12;
export const AES_TAG_BYTES = 16;

export interface AeadCiphertext {
    nonce: Uint8Array;
    /** Includes the 16-byte auth tag at the end (noble convention). */
    ciphertext: Uint8Array;
}

/** Generate a fresh 256-bit symmetric key. */
export function generateAesKey(): Uint8Array {
    return randomBytes(AES_KEY_BYTES);
}

/** AES-256-GCM encrypt. Nonce is freshly random and returned alongside. */
export function aeadEncrypt(key: Uint8Array, plaintext: Uint8Array): AeadCiphertext {
    if (key.length !== AES_KEY_BYTES) {
        throw new InvalidInputError(`AES key must be ${AES_KEY_BYTES} bytes, got ${key.length}`);
    }
    const nonce = randomBytes(AES_NONCE_BYTES);
    const ciphertext = gcm(key, nonce).encrypt(plaintext);
    return {nonce, ciphertext};
}

/** AES-256-GCM decrypt. Throws DecryptionFailedError on auth-tag mismatch. */
export function aeadDecrypt(key: Uint8Array, payload: AeadCiphertext): Uint8Array {
    if (key.length !== AES_KEY_BYTES) {
        throw new InvalidInputError(`AES key must be ${AES_KEY_BYTES} bytes, got ${key.length}`);
    }
    if (payload.nonce.length !== AES_NONCE_BYTES) {
        throw new InvalidInputError(`nonce must be ${AES_NONCE_BYTES} bytes`);
    }
    try {
        return gcm(key, payload.nonce).decrypt(payload.ciphertext);
    } catch (cause) {
        throw new DecryptionFailedError("AES-GCM authentication failed", {cause});
    }
}
