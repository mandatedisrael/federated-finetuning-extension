# Phase 0.3 spike — multi-owner sealedKey

Throwaway. One question, one answer.

## What we're proving

ERC-7857 / AgentNFT lets each token store a `sealedKey` (a symmetric key encrypted to a single recipient). For FFE we need N contributors to each independently decrypt the same joint LoRA. The contract supports calling `iCloneFrom` N times — that part is mechanical. The real question is whether the **crypto pattern** is sound: can one symmetric key `K` be sealed to N different pubkeys and recovered by each holder independently?

## How to run

```bash
npx -y tsx test.ts
```

Crypto uses Node built-ins only. `tsx` is just a TS runner — no project install needed.

## Pass criteria

```
Alice decrypts joint LoRA:  yes
Bob   decrypts joint LoRA:  yes
Cross-decrypt is rejected:  yes

OK — multi-owner sealedKey pattern works. Phase 0.3 answered.
```

If pass: pattern is sound. Move on. The contract integration is just calling `AgentNFT.mint` once + `iCloneFrom` once per contributor, with a TEE-signed `OwnershipProof` carrying the sealedKey we just generated.

If fail: stop. Re-read this file. Do not proceed.

## What this does NOT prove

- That `AgentNFT` deploys cleanly on Galileo testnet (separate, easier check)
- That the TEE attestation flow works (Phase 0.2)
- That GPU/RAM in a Tapp fits a real LoRA (Phase 0.4)

Those are different spikes.

## After it passes

Delete this folder, write one paragraph in `docs/phase0-notes.md`:
> Multi-owner sealedKey works using `<scheme>`. Pattern: TEE generates fresh K per session, AES-GCM-encrypts LoRA with K, then for each contributor i seals K to `pubkey_i` via X25519+HKDF+AES-GCM. Each contributor recovers K with their own privkey. Cross-decrypt is mathematically impossible. Maps directly onto AgentNFT's `iCloneFrom` flow — one clone per contributor, one `PublishedSealedKey` event per contributor.
