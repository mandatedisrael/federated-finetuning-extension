import {hkdf} from "@noble/hashes/hkdf";
import {sha256} from "@noble/hashes/sha2";
import {AES_KEY_BYTES, aeadDecrypt, aeadEncrypt, type AeadCiphertext} from "./aead.js";
import {generateKeyPair, sharedSecret, X25519_PUBLIC_KEY_BYTES} from "./keys.js";
import {InvalidInputError} from "../errors.js";

/**
 * "Sealed key" — wraps a 32-byte symmetric key `K` so only the holder of a
 * specific X25519 private key can recover it. Same shape as HPKE / libsodium
 * sealed boxes:
 *
 *   1. Generate ephemeral X25519 keypair (eph)
 *   2. shared = X25519(eph_priv, recipient_pub)
 *   3. wrapKey = HKDF-SHA256(shared, info=eph_pub)
 *   4. sealed = AES-256-GCM(wrapKey, K)
 *
 * The recipient recovers shared from (eph_pub, their_priv), re-derives
 * wrapKey, and decrypts.
 *
 * This is the pattern proven in phase0/inft-spike — productionized here.
 */

export interface SealedKey {
    /** Ephemeral X25519 public key (32 bytes). */
    ephemeralPublicKey: Uint8Array;
    /** AES-GCM nonce (12 bytes). */
    nonce: Uint8Array;
    /** AES-GCM ciphertext including auth tag. */
    ciphertext: Uint8Array;
}

const HKDF_INFO_LABEL = new TextEncoder().encode("ffe/sealedkey/v1");

function deriveWrapKey(secret: Uint8Array, ephPub: Uint8Array): Uint8Array {
    // HKDF-SHA256 with no salt; info binds the wrapKey to (label, ephPub) so
    // the same shared secret used elsewhere can't accidentally collide.
    const info = new Uint8Array(HKDF_INFO_LABEL.length + ephPub.length);
    info.set(HKDF_INFO_LABEL, 0);
    info.set(ephPub, HKDF_INFO_LABEL.length);
    return hkdf(sha256, secret, undefined, info, AES_KEY_BYTES);
}

/** Seal a 32-byte symmetric key to a recipient's X25519 public key. */
export function seal(symmetricKey: Uint8Array, recipientPublicKey: Uint8Array): SealedKey {
    if (symmetricKey.length !== AES_KEY_BYTES) {
        throw new InvalidInputError(`symmetric key must be ${AES_KEY_BYTES} bytes`);
    }
    if (recipientPublicKey.length !== X25519_PUBLIC_KEY_BYTES) {
        throw new InvalidInputError(`recipient pubkey must be ${X25519_PUBLIC_KEY_BYTES} bytes`);
    }

    const eph = generateKeyPair();
    const secret = sharedSecret(eph.privateKey, recipientPublicKey);
    const wrapKey = deriveWrapKey(secret, eph.publicKey);
    const wrapped = aeadEncrypt(wrapKey, symmetricKey);

    return {
        ephemeralPublicKey: eph.publicKey,
        nonce: wrapped.nonce,
        ciphertext: wrapped.ciphertext,
    };
}

/** Unseal a SealedKey using the recipient's X25519 private key. */
export function unseal(sealed: SealedKey, recipientPrivateKey: Uint8Array): Uint8Array {
    if (sealed.ephemeralPublicKey.length !== X25519_PUBLIC_KEY_BYTES) {
        throw new InvalidInputError(`ephemeral pubkey must be ${X25519_PUBLIC_KEY_BYTES} bytes`);
    }
    const secret = sharedSecret(recipientPrivateKey, sealed.ephemeralPublicKey);
    const wrapKey = deriveWrapKey(secret, sealed.ephemeralPublicKey);
    return aeadDecrypt(wrapKey, {nonce: sealed.nonce, ciphertext: sealed.ciphertext});
}
