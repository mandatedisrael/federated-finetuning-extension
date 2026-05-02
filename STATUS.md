# FFE — build status

> Where we left off. Read this first when picking back up.

Last updated: May 2, 2026 (SDK Part 5.5 complete).

---

## Pick up here next

**Judge confirmed: mock TEE is fine, won't disqualify.** Removes biggest risk (no Alibaba Cloud / real Tapp needed).

### Aggregator – Final Plan (7 commits)

**Stack:** Node.js (orchestration, events, crypto, 0G Storage) + Python subprocess (LoRA training only via 0G fine-tuning service).

| # | Task | Scope | DoD |
|---|---|---|---|
| A.1 | Scaffold + config | `aggregator/` package, env vars (AGG_EVM_KEY, AGG_X25519_KEY, COORDINATOR_ADDRESS, INFT_ADDRESS) | tsconfig, package.json, .env.example |
| A.2 | Event listener | Polls `QuorumReached` every 5s, deduplicates, yields typed session payloads | unit tests |
| A.3 | Blob processor | Downloads N blobs from 0G Storage, decrypts each with SDK `decryptForRecipient`, concatenates to temp JSONL | unit tests |
| A.4 | Training bridge | `py/train.py` reads JSONL, fine-tunes Qwen2.5-0.5B via 0G service (1 epoch, rank 8), generates fresh AES key, encrypts adapter, writes nonciphertext bytes to stdout | subprocess integration test |
| A.5 | Minter | Reads encrypted LoRA, uploads to 0G Storage, seals data key to each contributor's X25519 pubkey via SDK `seal()`, serializes to 92-byte wire format, calls `INFTMinter.mint()` | unit + live tests |
| A.6 | Main orchestrator | Wires A.2 → A.3 → A.4 → A.5 in loop, per-session error isolation, structured logging, handles Coordinator state checks | integration test |
| A.7 | Integration smoke test | Two wallets submit fake JSONL, aggregator runs locally, waits for `Minted` event, both call `FFE.download()`, verify decrypted bytes non-empty | live test gated by `FFE_LIVE_AGG=1` |

### CLI (estimated: 1 commit after Aggregator)
- `ffe session create --base <model> --participants <addrs> --quorum <n>` → returns sessionId
- `ffe submit --session <id> --data <path>` → returns blobHash, txHash
- `ffe download --session <id> --out <path>` → returns loraPath
- Wraps SDK, pretty-prints JSON

### Demo app (estimated: 1 commit after CLI)
- Next.js: 3 contributor cards, before/after metrics, session timeline
- Synthetic dataset where pooling visibly beats solo (≥15% gain)
- Trigger live session from UI

### Final live sweep (1 commit)
- 3-contributor end-to-end on Galileo testnet + demo video

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

---

## Pending

| Item | Notes |
|---|---|
| **CLI** | `ffe session create`, `ffe submit`, `ffe download` wrappers |
| **Aggregator service** | Listens for `QuorumReached`, fetches + decrypts blobs, trains joint LoRA, runs Quality Gate, mints INFT |
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

---

## Live commands you'll re-use

All from `sdk/`. Replace `$KEY` with a funded Galileo wallet private key.

```bash
# default (deterministic) tests — 62 pass
npm test

# live Coordinator reads (no funds)
npm run test:live

# live storage round-trip (gas)
FFE_LIVE_STORAGE_PRIVATE_KEY=$KEY npm run test:live:storage

# live openSession on Galileo (gas, 1–2 sessions per run)
FFE_LIVE_OPEN_PRIVATE_KEY=$KEY npm run test:live:open

# regen Coordinator ABI after a contract change
npm run abi:sync
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
├── phase0/inft-spike/     # 0.3 spike (kept as reference)
└── docs/
    ├── diagrams/          # before-siloed.png, after-ffe.png
    └── phase0-notes.md    # findings record
```

---

## Recent commits (most recent first)

```
29426e2 SDK part 5.5: live end-to-end test for FFE.download()
c67c2d0 SDK part 5.4: FFE.download() implementation + deterministic tests
1237e93 SDK part 5.3: SealedKey byte serialization (sealedKeyToBytes / sealedKeyFromBytes)
6df62fc SDK part 5.2: INFTMinter typed client + tests
3118428 SDK part 5.1: INFTMinter ABI vendored + sync script updated
eb71df9 Deploy INFTMinter to Galileo testnet
293389e INFT minter: deploy script for Galileo testnet
53d542f INFT minter: Foundry tests (18 tests, all passing)
1345da3 INFT minter: INFTMinter implementation
d77fce4 INFT minter: IINFTMinter interface
d4cf8cc SDK part 4.2: live end-to-end test for FFE.submit()
6fad909 SDK part 4.1: FFE.submit() implementation + deterministic tests
23afced Add STATUS.md — checkpoint before pausing for the day
d3feb9b SDK part 3.4: live test for FFE.openSession() on Galileo
4dba1ad SDK part 3.3: FFE class with openSession()
3afb91c SDK part 3.2: live round-trip test for ZeroGStorage
b4a4a5a SDK part 3.1: ZeroGStorage client (real, no mocks)
```
