# @notmartin/ffe

TypeScript SDK for Federated Fine-tuning Extension on 0G.

## Status — v0.1

Crypto primitives only. The full `openSession`/`submit`/`download` surface lands in subsequent releases:

- **v0.1 (this)** — crypto primitives: X25519 keypairs, AES-256-GCM AEAD, sealed keys, self-describing encrypted blobs
- **v0.2** — typed Coordinator client (live on Galileo testnet)
- **v0.3** — storage interface + `openSession()`
- **v0.4** — `submit()` with full encrypt → upload → on-chain commit pipeline
- **v0.5** — `download()` (after the INFT minter ships)

## Install

Not yet published. Build from source:

```bash
cd sdk
npm install
npm run build
```

## Crypto API

```ts
import {crypto} from "@notmartin/ffe";

// X25519 keypairs (e.g. wallet keys for sealedKey targeting)
const recipient = crypto.generateKeyPair();

// Symmetric AEAD
const k = crypto.generateAesKey();
const enc = crypto.aeadEncrypt(k, plaintextBytes);
const dec = crypto.aeadDecrypt(k, enc);

// Sealed key — wrap a 32-byte K so only `recipient` can recover it.
const sealed = crypto.seal(k, recipient.publicKey);
const recovered = crypto.unseal(sealed, recipient.privateKey);

// Self-describing encrypted blob (used for contributor → TEE submissions
// and TEE → INFT model artifacts)
const blob = crypto.encryptToRecipient(jsonlBytes, recipient.publicKey);
// blob.bytes  — upload to 0G Storage as-is
// blob.hash   — keccak256, commit on-chain
// blob.dataKey — discard for contributor uploads; keep for TEE re-wrapping
const decrypted = crypto.decryptForRecipient(blob.bytes, recipient.privateKey);
```

## Crypto suite (matches `buildPlan.md` decisions)

- **X25519** for asymmetric (key agreement)
- **HKDF-SHA256** to derive the wrap key from the X25519 shared secret
- **AES-256-GCM** for both data payloads and sealedKey wrapping

All primitives provided by [@noble/curves](https://github.com/paulmillr/noble-curves) and [@noble/ciphers](https://github.com/paulmillr/noble-ciphers) — audited, browser- and Node-compatible.

## Blob format

```
version          1 byte    = 0x01
ephPubkey       32 bytes   X25519 ephemeral public key
nonce           12 bytes   AES-GCM nonce (payload)
sealedNonce     12 bytes   AES-GCM nonce (sealed key)
sealedKeyLen     2 bytes   big-endian length of sealedKeyCt
sealedKeyCt      N bytes   AES-GCM-wrapped data key (incl. 16B tag)
ciphertext       M bytes   AES-GCM-encrypted payload (incl. 16B tag)
```

The on-chain `blobHash` is `keccak256(blob bytes)`.

## Storage API

Real client — uploads and downloads hit 0G Storage on Galileo.

```ts
import {storage} from "@notmartin/ffe";

const s = new storage.ZeroGStorage({privateKey: process.env.OG_KEY});

// Upload encrypted bytes; rootHash is what we put on-chain.
const {rootHash, txHash} = await s.upload(blob.bytes);

// Download by rootHash (no signer required).
const back = await new storage.ZeroGStorage().download(rootHash);
```

## Develop

```bash
npm test                                     # 44 unit tests (deterministic)
npm run test:live                            # +6 live Coordinator tests
FFE_LIVE_STORAGE_PRIVATE_KEY=0x... \
  npm run test:live:storage                  # upload+download round-trip (gas)
FFE_LIVE_OPEN_PRIVATE_KEY=0x... \
  npm run test:live:open                     # FFE.openSession() on Galileo (gas)
npm run typecheck
npm run build
npm run abi:sync                             # regenerate Coordinator ABI
```
