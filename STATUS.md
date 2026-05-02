# FFE — build status

> Where we left off. Read this first when picking back up.

Last updated: end of SDK Part 3 (Apr 28, 2026).

---

## Pick up here tomorrow

**Next: Part 4 — `submit()` end-to-end.** Wires everything together. Two commits planned:

- **4.1** `submit({sessionId, jsonlPath | bytes})` implementation + deterministic tests
  Pipeline: read bytes → fetch aggregator pubkey from Coordinator → encrypt → upload to 0G Storage → call `Coordinator.submit(sessionId, rootHash)`. Returns `{rootHash, txHash}`.

- **4.2** Live end-to-end test
  Open a session, set aggregator pubkey, encrypt sample JSONL, upload, submit, verify on-chain via `getSubmission`. Gated `FFE_LIVE_SUBMIT=1`.

After Part 4, **Part 5** is `download()` — but that **needs the INFT minter contract** which doesn't exist yet. So between Part 4 and Part 5 we either build the INFT minter, or pivot to the mock TEE / aggregator service.

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

**Totals: 62 deterministic + ~12 live tests.**

---

## Pending

| Item | Notes |
|---|---|
| **SDK Part 4** — `submit()` | Next thing to build |
| **SDK Part 5** — `download()` | Blocked: needs INFT minter |
| **INFT minter contract** | Wraps `0g-agent-nft` (`mint` once + `iCloneFrom` per contributor). Path validated by phase0 spike. |
| **Mock TEE service** | Decision still parked — need it for Aggregator. |
| **Aggregator service** | Listens for `QuorumReached`, decrypts, trains, encrypts, mints INFT. Rust/Python in TEE. |
| **Demo app** | 3-contributor UI w/ before-after metrics. |

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
d3feb9b SDK part 3.4: live test for FFE.openSession() on Galileo
4dba1ad SDK part 3.3: FFE class with openSession()
3afb91c SDK part 3.2: live round-trip test for ZeroGStorage
b4a4a5a SDK part 3.1: ZeroGStorage client (real, no mocks)
71a305d Rename SDK package to @notmartin/ffe
f7e25a6 SDK part 2.3: live integration tests vs Galileo Coordinator
b8a009b SDK part 2.2: typed Coordinator client with custom-error decoding
603dc24 SDK part 2.1: vendor Coordinator ABI as const for viem
7292e47 SDK part 1: scaffold + crypto module (@0g/ffe v0.1)
fa13b14 Record Coordinator deployment on Galileo testnet
31b020a Add Coordinator contract (v0.1) with full test coverage
ce74cc5 Phase 0.3: prove multi-owner sealedKey pattern works
```
