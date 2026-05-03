# FFE — build status

> Where we left off. Read this first when picking back up.

Last updated: May 3, 2026 — mainnet redeploy, aggregator hardening, A.4 real TS training, local storage fallback.

---

## Pick up here next

**Run the E2E smoke test** to confirm the full pipeline works end-to-end:

```bash
cd aggregator && \
  FFE_LIVE_AGG=1 \
  AGG_EVM_KEY=0x5c5f5927d9a0c7dca4575fe235da49cb91fc689495554ddd458dfa9d410b8b8a \
  AGG_X25519_KEY=9a7fd19ff9ac9eefc6b0ec60b27cc31db75291fb91ea5563db2e3cd8d0bca602 \
  COORDINATOR_ADDRESS=0x840C3E83A5f3430079Aff7247CD957c994076015 \
  INFT_ADDRESS=0xEcEd8069b33Ce4F397e4Df1cbb4cDD2fAA038471 \
  FFE_LIVE_WALLET_1=0xc5509a5827e17a1cd286d85d5084bb8fdb37112cee4f7683508bd2ed422916fe \
  FFE_LIVE_WALLET_2=0x2fe8c13fcebc3c4702a29238323540bdabccf2ef29976fedbcb828e4f4bd5167 \
  FFE_LOCAL_STORAGE_DIR=/tmp/ffe-storage \
  pnpm test:live
```

After that passes, the critical path is:
1. **Quality Gate** — per-contributor eval, `score ≥ median − 1·MAD`, rejection certs, `slashWithProof`. Zero code exists.
2. **CLI** — `ffe session create / submit / download` wrappers over the SDK.
3. **Demo app** — Next.js UI: 3 contributor cards, session timeline, before/after metrics.
4. **Demo video** — <3 min walkthrough. Needs CLI or demo app first.

---

## Aggregator — current state

**Stack:** TypeScript strict, ESM+CJS, viem, `@notmartin/ffe`, `@0gfoundation/0g-compute-ts-sdk`. No Python subprocess.

| # | Component | Status | Tests |
|---|---|---|---|
| A.1 | Scaffold + config | ✅ | config validation |
| A.2 | Event listener | ✅ live-tested | 3 unit + 5 live (gated) |
| A.3 | Blob processor | ✅ live-tested | 7 unit + 2 live (gated) |
| A.4 | Training bridge | ✅ real TS | 4 unit — 0G compute SDK or TEE simulation |
| A.5 | Minter | ✅ live-tested | 5 unit |
| A.6 | Orchestrator | ✅ wired | 5 unit |
| A.7 | Smoke test | ✅ rewritten | 6 live (gated by `FFE_LIVE_AGG=1`) |

**Totals: 24 deterministic + 13 skipped live tests, all passing.**

### Hardening done (May 2–3)

- **A.4 real**: `trainingBridge.ts` rewritten to use `@0gfoundation/0g-compute-ts-sdk` directly — no Python subprocess. `USE_REAL_0G_TRAINING=true` calls the real service; default runs TEE simulation with deterministic fingerprints + mock TDX attestation.
- **Local storage fallback**: `ZeroGStorage` tries 0G mainnet first; falls back to local file store (`localFallbackDir`) on any upload/download failure. Hash = `keccak256(content)` — content-addressed, same format as 0G Merkle root. Needed because 0G mainnet storage has zero connected peers.
- **Retry**: blob downloads retry with exponential backoff (1s → 2s → 4s, 3 attempts).
- **Timeout**: training capped at `TRAINING_TIMEOUT_MS` (default 1h), killed with SIGTERM.
- **Concurrency**: orchestrator caps at `MAX_CONCURRENT_SESSIONS` (default 3).
- **Pubkey validation**: 32-byte X25519 check before passing to crypto.
- **Dedup**: event listener `seen` Set capped at 10,000 entries.
- **Keygen script**: `pnpm keygen` generates a fresh X25519 keypair for the aggregator.
- **Smoke test**: rewritten with proper messages-format JSONL, aggregator pubkey set inline, polls `hasMinted()`, verifies both contributors decrypt to identical bytes.

---

## Done so far

### Phase 0 — de-risk

| | Status |
|---|---|
| 0.1 — 0G fine-tuning confirmed working | ✅ `fine_tuning_example.py` ran; `lora_*.bin` downloaded |
| 0.3 — multi-owner sealedKey crypto | ✅ proven (`phase0/inft-spike/test.ts`) |
| 0.2 — TEE attestation | ⏸ parked — Tapp needs Alibaba Cloud KYC. Mock TEE acceptable for dev. |
| 0.4 — Tapp GPU/RAM ceiling | ⏸ depends on 0.2 |

### Coordinator contract — 0G mainnet

- **Address:** `0x840C3E83A5f3430079Aff7247CD957c994076015`
- Chain: 0G mainnet (16661), RPC: `https://evmrpc.0g.ai`
- 25 Foundry tests, all passing

### INFTMinter contract — 0G mainnet

- **Address:** `0xEcEd8069b33Ce4F397e4Df1cbb4cDD2fAA038471`
- Minter (deployer): `0xE74096f8EF2b08AA7257Ac98459c624E1BF9a548`
- 18 Foundry tests, all passing (43 total)

### SDK (`@notmartin/ffe`)

| Part | Status | Tests |
|---|---|---|
| 1 — Crypto module | ✅ | 23 unit |
| 2.1–2.3 — Coordinator client + live tests | ✅ | 25 unit + 6 live |
| 3.1–3.4 — ZeroGStorage + FFE.openSession | ✅ | 18 unit + 4 live |
| 4.1–4.2 — FFE.submit + live test | ✅ | 15 unit + 2 live |
| 5.1–5.5 — INFTMinter + FFE.download + live test | ✅ | 24 unit + 2 live |

**103 deterministic + ~16 live tests, all passing.**

---

## Pending

| Item | Effort | Notes |
|---|---|---|
| **E2E smoke test** | Ready to run | Needs `USE_REAL_0G_TRAINING=true` for real training, or runs simulation |
| **Quality Gate** | 2–3 days | Per-contributor eval, MAD threshold, rejection certs, slashWithProof. Zero code. |
| **CLI** | 1 day | `cli/` package. `ffe session create / submit / download`. |
| **Demo app** | 2–3 days | Next.js. 3 contributor cards, live session, before/after metrics. |
| **Demo video** | 1 day | <3 min. Needs CLI or demo app. |
| **TEE attestation** | Blocked | Tapp sponsorship needed from 0G Discord. |

---

## Decision log (don't re-litigate)

- **Training runtime**: TypeScript via `@0gfoundation/0g-compute-ts-sdk`. No Python subprocess. `py/train.py` kept as standalone reference only.
- **Single chain**: everything on 0G mainnet (16661). No testnet/mainnet split.
- **Storage fallback**: 0G mainnet storage primary; local file fallback (`keccak256`-keyed) when mainnet storage unavailable (currently has 0 peers).
- **Crypto suite**: X25519 + HKDF-SHA256 + AES-256-GCM.
- **Storage commitment**: Merkle root (or keccak256 for local fallback) IS the on-chain `blobHash`.
- **Quality Gate threshold**: `score_i ≥ median − 1·MAD`.
- **Slash distribution**: pro rata to honest contributors.
- **Base model**: `Qwen2.5-0.5B-Instruct`. Fine-tuning provider: `0x940b4a101CaBa9be04b16A7363cafa29C1660B0d`.
- **Mock TEE**: confirmed acceptable by judge for dev.

---

## Env vars — aggregator

| Var | Required | Default | Notes |
|---|---|---|---|
| `AGG_EVM_KEY` | ✅ | — | Aggregator wallet (0x-prefixed) |
| `AGG_X25519_KEY` | ✅ | — | 32-byte X25519 private key (hex, no 0x). Run `pnpm keygen`. |
| `COORDINATOR_ADDRESS` | ✅ | — | `0x840C3E83A5f3430079Aff7247CD957c994076015` |
| `INFT_ADDRESS` | ✅ | — | `0xEcEd8069b33Ce4F397e4Df1cbb4cDD2fAA038471` |
| `FFE_LOCAL_STORAGE_DIR` | — | `/tmp/ffe-storage` | Local blob fallback directory |
| `USE_REAL_0G_TRAINING` | — | `false` | Set `true` to call 0G fine-tuning service |
| `FT_PROVIDER_ADDRESS` | — | `0x940b4a101CaBa9be04b16A7363cafa29C1660B0d` | Fine-tuning provider |
| `FT_RPC_URL` | — | `https://evmrpc.0g.ai` | RPC for 0G compute network |
| `RPC_URL` | — | `https://evmrpc.0g.ai` | Galileo RPC |
| `STORAGE_INDEXER_URL` | — | `https://indexer-storage-standard.0g.ai` | 0G Storage indexer |
| `TEMP_DIR` | — | `os.tmpdir()` | Scratch space for JSONL + weights |
| `BASE_MODEL` | — | `Qwen2.5-0.5B-Instruct` | LoRA base model |
| `TRAINING_TIMEOUT_MS` | — | `3600000` | Kill training after this ms |
| `MAX_CONCURRENT_SESSIONS` | — | `3` | Max parallel sessions |
| `POLL_INTERVAL_MS` | — | `5000` | QuorumReached poll interval |

---

## Endpoints

| | |
|---|---|
| 0G Mainnet RPC | `https://evmrpc.0g.ai` |
| 0G Mainnet chain ID | 16661 |
| Explorer | `https://chainscan.0g.ai` |
| 0G Storage indexer | `https://indexer-storage-standard.0g.ai` |
| Fine-tuning provider | `0x940b4a101CaBa9be04b16A7363cafa29C1660B0d` |
| Coordinator | `0x840C3E83A5f3430079Aff7247CD957c994076015` |
| INFTMinter | `0xEcEd8069b33Ce4F397e4Df1cbb4cDD2fAA038471` |

---

## Repo layout

```
FFE/
├── STATUS.md
├── buildPlan.md
├── idea.md
├── pnpm-workspace.yaml
├── contracts/             # Foundry — Coordinator + INFTMinter (mainnet)
│   ├── src/
│   ├── test/              # 43 tests
│   └── script/
├── sdk/                   # @notmartin/ffe
│   ├── src/
│   │   ├── crypto/
│   │   ├── coordinator/
│   │   ├── storage/       # ZeroGStorage with local fallback
│   │   ├── inft/
│   │   ├── ffe.ts
│   │   └── index.ts
│   ├── test/
│   └── test/live/
├── aggregator/            # @notmartin/ffe-aggregator
│   ├── scripts/
│   │   └── keygen.ts      # pnpm keygen → X25519 keypair
│   ├── src/
│   │   ├── config.ts
│   │   ├── eventListener.ts
│   │   ├── blobProcessor.ts
│   │   ├── trainingBridge.ts  # 0G compute TS SDK, no Python
│   │   ├── minter.ts
│   │   ├── orchestrator.ts
│   │   └── index.ts
│   ├── py/
│   │   └── train.py       # standalone reference only
│   ├── test/
│   └── test/live/
│       └── smoke.live.test.ts  # full E2E pipeline test
├── cli/                   # NOT STARTED
├── demo/                  # NOT STARTED
├── phase0/inft-spike/
└── docs/
    └── diagrams/
```
