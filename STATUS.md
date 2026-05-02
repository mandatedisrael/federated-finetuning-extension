# FFE — build status

> Where we left off. Read this first when picking back up.

Last updated: May 2, 2026 (Aggregator A.1-A.7 scaffold complete).

---

## Pick up here next

**Aggregator A.1-A.7 complete (scaffold + stub implementations).** All components have unit tests and proper TypeScript stubs. Ready for:
1. **A.2 live tests** — poll real Coordinator for QuorumReached events
2. **A.3 implementation** — integrate 0G Storage SDK for blob download/decrypt
3. **A.4 implementation** — integrate 0G fine-tuning service for actual LoRA training
4. **A.5 live tests** — test minting on Galileo with real INFTMinter
5. **A.6 integration** — wire everything in orchestrator, test error handling
6. **A.7 smoke test** — end-to-end 2-wallet run on Galileo

### Aggregator – Status (7 commits planned, 1 complete)

**Stack:** Node.js (orchestration, events, crypto, 0G Storage) + Python subprocess (LoRA training only via 0G fine-tuning service).

| # | Task | Status | Tests |
|---|---|---|---|
| A.1 | Scaffold + config | ✅ | config loading |
| A.2 | Event listener | ✅ stub | 3 unit |
| A.3 | Blob processor | ✅ stub | 4 unit |
| A.4 | Training bridge | ✅ stub | 4 unit |
| A.5 | Minter | ✅ stub | 4 unit |
| A.6 | Orchestrator | ✅ stub | 5 unit |
| A.7 | Smoke test | ✅ stub | 6 tests (gated by `FFE_LIVE_AGG=1`) |

**Totals: 20 unit tests + 6 skipped live tests, all passing.**

**Notes:**
- All modules export clean TypeScript interfaces
- Orchestrator wires A.2→A.3→A.4→A.5 pipeline
- Per-session error isolation and structured logging
- Python `py/train.py` stub outputs valid JSON
- 0G Storage, minting, and training calls marked `[A.N TODO]`

---

## Done so far

### Phase 0 — de-risk

| | Status |
|---|---|
| 0.1 — 0G fine-tuning example end-to-end | ✅ confirmed working |
| 0.3 — multi-owner sealedKey crypto pattern | ✅ proven (`phase0/inft-spike/test.ts`) |
| 0.2 — TEE attestation | ⏸ parked — Tapp requires Alibaba Cloud setup ($50–150 + KYC). Plan: ask 0G for a sponsored instance via Discord; fallback to mock for dev, real Tapp for final demo. |
| 0.4 — Tapp GPU/RAM ceiling | ⏸ depends on 0.2 |

### Coordinator contract

- Deployed on Galileo testnet at **`0x4Dd446F51126d473070444041B9AA36d3ae7F295`**
- 25 foundry tests, all passing
- Source: `contracts/src/Coordinator.sol`, interface in `contracts/src/interfaces/ICoordinator.sol`

### INFTMinter contract

- Deployed on Galileo testnet at **`0x8c71F8176720bD0888e83B822FD7CE0164C67567`**
- Minter address (deployer wallet): `0xB3AD3a10d187cbc4ca3e8c3EDED62F8286F8e16E`
- 18 foundry tests, all passing (43 total in suite)
- Source: `contracts/src/INFTMinter.sol`, interface in `contracts/src/interfaces/IINFTMinter.sol`
- Note: minter = deployer wallet for now; update when aggregator address is known

### SDK (`@notmartin/ffe`)

- npm name: **`@notmartin/ffe`** (under your scope)
- Package: `sdk/`
- Stack: TypeScript strict, ESM+CJS dual build, viem, @noble/* crypto, @0gfoundation/0g-ts-sdk + ethers

| Part | Status | Tests |
|---|---|---|
| 1 — Crypto module | ✅ | 23 unit |
| 2.1 — Coordinator ABI vendored | ✅ | 7 unit |
| 2.2 — Typed Coordinator client | ✅ | 12 unit |
| 2.3 — Live tests vs deployed Coordinator | ✅ | 6 live |
| 3.1 — `ZeroGStorage` (real, no mocks) | ✅ | — |
| 3.2 — Live storage round-trip test | ✅ | 2 live |
| 3.3 — `FFE` class + `openSession()` | ✅ | 18 unit |
| 3.4 — Live `openSession` test | ✅ | 2 live |
| 4.1 — `FFE.submit()` implementation + deterministic tests | ✅ | 15 unit |
| 4.2 — Live end-to-end test for `submit()` | ✅ | 2 live |
| 5.1 — INFTMinter ABI vendored | ✅ | — |
| 5.2 — INFTMinter typed client + tests | ✅ | 8 unit |
| 5.3 — SealedKey byte serialization | ✅ | 4 unit |
| 5.4 — `FFE.download()` implementation + deterministic tests | ✅ | 12 unit |
| 5.5 — Live end-to-end test for `download()` | ✅ | 2 live |

**Totals: 103 deterministic + ~16 live tests, all passing.**

### Aggregator (`@notmartin/ffe-aggregator`)

- npm name: **`@notmartin/ffe-aggregator`**
- Package: `aggregator/`
- Stack: TypeScript strict, ESM+CJS dual build, viem, @notmartin/ffe, Node.js subprocess
- **A.1-A.7 scaffold complete**

---

## Pending

| Item | Notes |
|---|---|
| **A.2-A.7 implementations** | Live 0G Storage integration, 0G fine-tuning service calls, minting |
| **CLI** | `ffe session create`, `ffe submit`, `ffe download` wrappers |
| **Quality Gate** | Per-contributor eval, rejection certificates, TEE signing |
| **Demo app** | Next.js UI: 3 contributors, before/after metrics, live session trigger |
| **Live E2E sweep** | 3-party dry-run on Galileo + demo video |

---

## Decision log (don't re-litigate)

- **Crypto suite**: X25519 + HKDF-SHA256 + AES-256-GCM (proven in 0.3, productionized in SDK Part 1).
- **Storage commitment**: 0G Storage Merkle root IS the on-chain `blobHash`. No separate location lookup; aggregator downloads by the hash it sees in the `Submitted` event.
- **Mocks**: forbidden for storage / TEE / chain services. Coordinator client *unit* tests use viem's `custom` transport for encoding/decoding only — flagged for review if you want those dropped.
- **TEE attestation**: SDK-side verification for v1, on-chain precompile is v2.
- **Quality Gate threshold**: `score_i ≥ median − 1·MAD`.
- **Slash distribution**: pro rata to honest contributors in the same session.
- **Base model default**: Qwen2.5-0.5B (stretch: Qwen3-32B if it fits in Tapp).
- **Mock TEE**: Confirmed by judge as acceptable for dev; won't disqualify. Real Tapp for final demo if Alibaba Cloud sponsorship available.

---

## Live commands you'll re-use

All from `sdk/` or `aggregator/`. Replace `$KEY` with a funded Galileo wallet private key.

```bash
# default (deterministic) tests — all packages
pnpm test

# live Coordinator reads (no funds)
cd sdk && npm run test:live

# live storage round-trip (gas)
cd sdk && FFE_LIVE_STORAGE_PRIVATE_KEY=$KEY npm run test:live:storage

# live openSession on Galileo (gas, 1–2 sessions per run)
cd sdk && FFE_LIVE_OPEN_PRIVATE_KEY=$KEY npm run test:live:open

# regen Coordinator ABI after a contract change
cd sdk && npm run abi:sync

# Aggregator smoke test (when ready)
cd aggregator && FFE_LIVE_AGG=1 npm run test:live
```

Coordinator deploy (only if redeploying):
```bash
forge script /Users/damiafo/Documents/projects/FFE/contracts/script/DeployCoordinator.s.sol \
  --root /Users/damiafo/Documents/projects/FFE/contracts \
  --rpc-url https://evmrpc-testnet.0g.ai \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --broadcast
```

---

## Endpoints

| | |
|---|---|
| Galileo RPC | `https://evmrpc-testnet.0g.ai` |
| Galileo chain ID | 16602 |
| Faucet | https://faucet.0g.ai |
| Explorer | https://chainscan-galileo.0g.ai |
| 0G Storage indexer | `https://indexer-storage-testnet-turbo.0g.ai` |
| Coordinator | `0x4Dd446F51126d473070444041B9AA36d3ae7F295` |
| INFTMinter | `0x8c71F8176720bD0888e83B822FD7CE0164C67567` |

---

## Repo layout (current)

```
FFE/
├── README.md              # public-facing
├── buildPlan.md           # 4-week plan
├── idea.md                # original brief
├── STATUS.md              # ← this file
├── pnpm-workspace.yaml    # monorepo config
├── contracts/             # Foundry project
│   ├── src/Coordinator.sol
│   ├── test/              # 25 tests
│   └── script/DeployCoordinator.s.sol
├── sdk/                   # @notmartin/ffe
│   ├── src/
│   │   ├── crypto/        # part 1
│   │   ├── coordinator/   # part 2
│   │   ├── storage/       # part 3.1
│   │   ├── ffe.ts         # part 3.3 (FFE class)
│   │   ├── errors.ts
│   │   └── index.ts
│   ├── test/              # deterministic
│   └── test/live/         # gated by env vars
├── aggregator/            # @notmartin/ffe-aggregator (NEW)
│   ├── src/
│   │   ├── config.ts
│   │   ├── eventListener.ts
│   │   ├── blobProcessor.ts
│   │   ├── trainingBridge.ts
│   │   ├── minter.ts
│   │   ├── orchestrator.ts
│   │   └── index.ts
│   ├── py/
│   │   └── train.py       # Python LoRA training stub
│   ├── test/              # unit tests
│   └── test/live/         # gated by FFE_LIVE_AGG=1
├── phase0/inft-spike/     # 0.3 spike (kept as reference)
└── docs/
    ├── diagrams/          # before-siloed.png, after-ffe.png
    └── phase0-notes.md    # findings record
```

---

## Recent commits (most recent first)

```
d2e2596 A.1-A.7: Aggregator scaffold with full 7-commit pipeline structure
29426e2 SDK part 5.5: live end-to-end test for FFE.download()
c67c2d0 SDK part 5.4: FFE.download() implementation + deterministic tests
1237e93 SDK part 5.3: SealedKey byte serialization (sealedKeyToBytes / sealedKeyFromBytes)
6df62fc SDK part 5.2: INFTMinter typed client + tests
3118428 SDK part 5.1: INFTMinter ABI vendored + sync script updated
eb71df9 Deploy INFTMinter to Galileo testnet
```
