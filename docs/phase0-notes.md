# Phase 0 — de-risk findings

## 0.1 — 0G fine-tuning example
**Status:** ✅ works.
The official `fine-tuning-example` runs end-to-end on Galileo testnet. Wallet, RPC, storage, and the fine-tuning service all work.

## 0.3 — multi-owner sealedKey pattern
**Status:** ✅ works.

**Pattern:** TEE generates a fresh symmetric key `K` per session, AES-256-GCM encrypts the LoRA blob with `K`. For each contributor `i`, `K` is sealed to `pubkey_i` using X25519 → HKDF-SHA256 → AES-256-GCM. Each contributor recovers `K` with their own privkey and decrypts the LoRA. Cross-decrypt is mathematically rejected (other contributors' sealedKeys are useless without the matching privkey).

**Maps onto AgentNFT how:** call `mint` once for the original token (owner = aggregator), then `iCloneFrom` once per contributor. The TEE-signed `OwnershipProof.sealedKey` carries the per-contributor sealed `K` we just generated. Each clone fires `PublishedSealedKey(contributor_i, newTokenId, [sealedKey_i])`. Standards-compliant, no fork required.

**Spike code:** `phase0/inft-spike/test.ts` — runs in <1s, no deps beyond Node built-ins + `tsx`.

## 0.2 — TEE attestation
**Status:** TODO.

## 0.4 — GPU/RAM ceiling in Tapp
**Status:** TODO.
