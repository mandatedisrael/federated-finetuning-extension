import {x25519} from "@noble/curves/ed25519";
import {randomBytes} from "@noble/hashes/utils";
import {InvalidInputError} from "../errors.js";

/**
 * X25519 keypair used to encrypt/decrypt sealed keys.
 *
 * - `publicKey` is shared (e.g. published on chain as the contributor's
 *   `ownerPubkey` or as the aggregator's enclave pubkey).
 * - `privateKey` MUST stay on the holder's machine and is what wallet
 *   software (or an enclave) holds.
 */
export interface X25519KeyPair {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
}

export const X25519_PUBLIC_KEY_BYTES = 32;
export const X25519_PRIVATE_KEY_BYTES = 32;

/** Generate a fresh X25519 keypair. */
export function generateKeyPair(): X25519KeyPair {
    const privateKey = randomBytes(X25519_PRIVATE_KEY_BYTES);
    const publicKey = x25519.getPublicKey(privateKey);
    return {publicKey, privateKey};
}

/** Derive the public key for a known private key. */
export function publicKeyFromPrivate(privateKey: Uint8Array): Uint8Array {
    if (privateKey.length !== X25519_PRIVATE_KEY_BYTES) {
        throw new InvalidInputError(
            `private key must be ${X25519_PRIVATE_KEY_BYTES} bytes, got ${privateKey.length}`,
        );
    }
    return x25519.getPublicKey(privateKey);
}

/** Compute the X25519 shared secret. Internal — callers should use `seal`/`unseal`. */
export function sharedSecret(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
    if (privateKey.length !== X25519_PRIVATE_KEY_BYTES) {
        throw new InvalidInputError(`private key must be ${X25519_PRIVATE_KEY_BYTES} bytes`);
    }
    if (publicKey.length !== X25519_PUBLIC_KEY_BYTES) {
        throw new InvalidInputError(`public key must be ${X25519_PUBLIC_KEY_BYTES} bytes`);
    }
    return x25519.getSharedSecret(privateKey, publicKey);
}
