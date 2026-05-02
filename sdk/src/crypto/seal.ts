import {hkdf} from "@noble/hashes/hkdf";
import {sha256} from "@noble/hashes/sha2";
import {AES_KEY_BYTES, AES_NONCE_BYTES, aeadDecrypt, aeadEncrypt, type AeadCiphertext} from "./aead.js";
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

/* ─────── SealedKey byte serialization ─────── */

/**
 * Wire format for a SealedKey stored on-chain in the INFTMinter:
 *
 *   ephemeralPublicKey   32 bytes  X25519 ephemeral pubkey
 *   nonce                12 bytes  AES-GCM nonce
 *   ciphertext           48 bytes  AES-GCM-wrapped data key (32B) + tag (16B)
 *
 * Total: 92 bytes. Fixed size — no length prefix needed.
 */
export const SEALED_KEY_BYTES =
    X25519_PUBLIC_KEY_BYTES + AES_NONCE_BYTES + (AES_KEY_BYTES + 16); // 32 + 12 + 48

/** Serialize a SealedKey to its 92-byte wire format for on-chain storage. */
export function sealedKeyToBytes(sealed: SealedKey): Uint8Array {
    if (sealed.ephemeralPublicKey.length !== X25519_PUBLIC_KEY_BYTES) {
        throw new InvalidInputError(
            `ephemeralPublicKey must be ${X25519_PUBLIC_KEY_BYTES} bytes`,
        );
    }
    if (sealed.nonce.length !== AES_NONCE_BYTES) {
        throw new InvalidInputError(`nonce must be ${AES_NONCE_BYTES} bytes`);
    }
    const expectedCt = AES_KEY_BYTES + 16;
    if (sealed.ciphertext.length !== expectedCt) {
        throw new InvalidInputError(`ciphertext must be ${expectedCt} bytes`);
    }

    const out = new Uint8Array(SEALED_KEY_BYTES);
    let off = 0;
    out.set(sealed.ephemeralPublicKey, off);
    off += X25519_PUBLIC_KEY_BYTES;
    out.set(sealed.nonce, off);
    off += AES_NONCE_BYTES;
    out.set(sealed.ciphertext, off);
    return out;
}

/** Deserialize a 92-byte wire-format SealedKey from on-chain bytes. */
export function sealedKeyFromBytes(bytes: Uint8Array): SealedKey {
    if (bytes.length !== SEALED_KEY_BYTES) {
        throw new InvalidInputError(
            `sealedKey bytes must be ${SEALED_KEY_BYTES}, got ${bytes.length}`,
        );
    }
    let off = 0;
    const ephemeralPublicKey = bytes.slice(off, off + X25519_PUBLIC_KEY_BYTES);
    off += X25519_PUBLIC_KEY_BYTES;
    const nonce = bytes.slice(off, off + AES_NONCE_BYTES);
    off += AES_NONCE_BYTES;
    const ciphertext = bytes.slice(off);
    return {ephemeralPublicKey, nonce, ciphertext};
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
