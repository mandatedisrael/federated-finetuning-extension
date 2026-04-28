# FFE — Build Plan

4 weeks. 5 components. Built in dependency order so every phase ships a demoable artifact.

---

## Components

| # | Name | Runtime | Path | LoC |
|---|---|---|---|---|
| 1 | SDK (`@notmartin/ffe`) | Node (contributor) | `sdk/` | ~150 |
| 2 | CLI | Node (contributor) | `cli/` | ~100 |
| 3 | Coordinator | Solidity, 0G Chain | `contracts/Coordinator.sol` | ~300 |
| 4 | INFT minter | Solidity, 0G Chain | `contracts/INFTMinter.sol` | ~100 |
| 5 | Aggregator | Rust + Python, 0G Tapp | `aggregator/` | ~600 |
| 6 | Demo app | Next.js | `demo/` | ~300 |

Total ≈ 1,550 LoC.

---

## Day-1 decisions (pick once, don't re-litigate)

These are choices the whole team needs to agree on before writing code. If two people make different assumptions, their code won't fit together and we waste a week. Write the answer down once, move on.

- **Base model** *(which AI model are we fine-tuning?)*
  Default: Qwen2.5-0.5B (small, definitely fits). Stretch: Qwen3-32B (bigger, only if it fits in the TEE — measured in Phase 0.4).

- **How contributors encrypt data going IN to the TEE** *(so only the enclave can read it)*
  X25519 + ChaCha20-Poly1305 *(a standard, fast, well-trusted scheme — libsodium's "sealed box")*.

- **How each contributor's personal unlock key is wrapped in the INFT** *(so only that wallet can recover it)*
  HPKE *(a modern standard for "encrypt to a public key" — used by TLS 1.3, MLS, etc.)*.

- **How the trained model file itself is encrypted** *(one shared key, used by everyone after they unwrap it)*
  AES-256-GCM *(industry standard symmetric encryption with built-in tamper detection)*.

- **Who verifies the TEE is real and running our code** *(the "is this enclave legit?" check)*
  The SDK does it on the contributor's machine for v1. Moving it on-chain is a v2 nice-to-have.

- **Quality Gate rule** *(how do we decide a contributor's data is bad?)*
  If your score is more than 1 MAD below the median, you're out. *MAD = "median absolute deviation," a robust version of standard deviation that isn't fooled by outliers.*

- **What happens to a slashed contributor's stake** *(where does the bad actor's money go?)*
  Split equally among the honest contributors in the same session.

- **Encrypted blob byte layout** *(so SDK and aggregator agree on how to read each other's files)*
  `version(1B) ‖ ephemeralPubkey(32B) ‖ nonce(12B) ‖ ciphertext ‖ authTag(16B)`. *(Just the order of bytes in the file.)*

---

## Critical interfaces (write these first)

```solidity
// Coordinator
event SessionCreated(uint256 id, address creator, bytes32 baseModel, uint8 quorum);
event Joined(uint256 id, address contributor, uint256 stake);
event Submitted(uint256 id, address contributor, bytes32 blobHash);
event QuorumReached(uint256 id, bytes32[] blobHashes, address[] owners, bytes[] ownerPubkeys);
event Slashed(uint256 id, address contributor, uint256 amount);
event Minted(uint256 id, uint256 tokenId);

function createSession(bytes32 baseModel, address[] participants, uint8 quorum) external returns (uint256);
function joinSession(uint256 id) external payable;
function submit(uint256 id, bytes32 blobHash) external;
function slashWithProof(RejectionCert cert, bytes teeSig, bytes attestationQuote) external;
function finalize(MintAuth auth, bytes teeSig) external;
```

```ts
// SDK
openSession(opts: {base: string; participants: string[]; quorum: number}): Promise<{sessionId: bigint}>;
submit(opts: {sessionId: bigint; jsonlPath: string}): Promise<{blobHash: string; tx: string}>;
download(opts: {sessionId: bigint; outPath: string}): Promise<{loraPath: string}>;
```

---

## Phase 0 — De-risk (Days 1–4)

**Goal:** kill the three unknowns that could invalidate the whole design.

| Task | Owner | Done when |
|---|---|---|
| 0.1 Run 0G `fine-tuning-example` on testnet with Qwen2.5-0.5B | one dev | trained LoRA produced locally |
| 0.2 Deploy hello-world Tapp; export attestation quote | one dev | external script verifies quote |
| 0.3 Mint vanilla ERC-7857 INFT with two `sealedKey` entries | one dev | both dummy owners decrypt independently |
| 0.4 Measure max LoRA size that fits in one Tapp instance | one dev | base model picked, written into README |

**Gate:** if 0.3 or 0.4 fails, scope drops to smallest viable model and document it. **Do not proceed without these answers.**

---

## Phase 1 — Walking skeleton, single contributor (Days 5–9)

**Goal:** end-to-end happy path with N=1. Proves the wiring works.

| # | Task | Path | DoD |
|---|---|---|---|
| 1.1 | Coordinator: `createSession`, `submit`, `QuorumReached`. No staking, no slashing | `contracts/Coordinator.sol` | foundry tests green |
| 1.2 | SDK `openSession` + `submit` (X25519 encrypt, upload to 0G Storage, commit hash) | `sdk/src/session.ts`, `sdk/src/submit.ts` | unit tests for crypto + integration test against testnet |
| 1.3 | Aggregator: subscribe to `QuorumReached`, fetch blob, decrypt, train LoRA, AES-GCM encrypt output, upload | `aggregator/src/main.rs`, `aggregator/py/train.py` | trained encrypted LoRA in 0G Storage |
| 1.4 | INFT minter (single owner, single sealedKey) | `contracts/INFTMinter.sol` | INFT minted with one owner |
| 1.5 | SDK `download`: read INFT, recover K, decrypt LoRA | `sdk/src/download.ts` | bytes-equal to TEE-side LoRA |
| 1.6 | E2E test: 1 contributor → encrypted submit → trained LoRA back | `demo/scripts/e2e-1party.ts` | passes on Galileo testnet |

**Demoable at end of phase:** "I uploaded encrypted data, a TEE trained on it, I downloaded the result." Single-tenant version of 0G fine-tuning, but with the FFE plumbing in place.

---

## Phase 2 — Multi-tenant joint training (Days 10–14)

**Goal:** N=3. Core thesis is now demoable.

| # | Task | Path | DoD |
|---|---|---|---|
| 2.1 | Coordinator: participant whitelist, quorum logic, per-contributor `submittedHash` | `contracts/Coordinator.sol` | tests for partial / full quorum |
| 2.2 | Aggregator: fetch N blobs, concat datasets, train one LoRA on union | `aggregator/py/train.py` | joint LoRA produced from 3 disjoint inputs |
| 2.3 | INFT minter: N owners, N sealedKeys (parallel arrays) | `contracts/INFTMinter.sol` | each of 3 owners decrypts independently |
| 2.4 | SDK + CLI: `--participants`, `--quorum` flags | `sdk/`, `cli/` | `npx ffe session create …` works |
| 2.5 | E2E with 3 mock contributors | `demo/scripts/e2e-3party.ts` | all 3 wallets decrypt the same LoRA |

**Demoable at end of phase:** the headline pitch. Three parties, one shared LoRA, nobody saw anyone else's data.

---

## Phase 3 — Skin in the game (Days 15–19)

**Goal:** make bad-data resistance real.

| # | Task | Path | DoD |
|---|---|---|---|
| 3.1 | Coordinator: `joinSession() payable`, stake bookkeeping | `contracts/Coordinator.sol` | stakes locked on join |
| 3.2 | Rejection certificate format + TEE signing | `aggregator/src/cert.rs` | spec doc + signed test cert |
| 3.3 | Coordinator: `slashWithProof` verifying TEE sig + attestation | `contracts/Coordinator.sol` | malicious contributor slashed in test |
| 3.4 | Aggregator: Quality Gate (mini-LoRA per contributor, eval, filter, sign rejection certs) | `aggregator/py/quality_gate.py` | bad contributor in synthetic test is slashed |
| 3.5 | Post-training validation backstop + abort path | `aggregator/py/validate.py` | session aborts cleanly when joint < solo |

**Demoable at end of phase:** demo includes a "bad actor" contributor whose stake gets slashed on-chain.

---

## Phase 4 — Demo + polish (Days 20–28)

**Goal:** judge-ready submission.

| # | Task | DoD |
|---|---|---|
| 4.1 | Demo app UI: 3 contributor cards, session timeline, before/after metrics | runs locally |
| 4.2 | Synthetic dataset where pooling **visibly** beats solo (3 disjoint slices of one task) | metrics show ≥ 15% gain |
| 4.3 | Architecture diagrams in README (siloed-before / FFE-after / usage-after) | rendered in repo |
| 4.4 | Deploy Coordinator + INFT minter on Galileo testnet | addresses in README |
| 4.5 | Live demo URL (small web UI to trigger a session) | accessible publicly |
| 4.6 | <3-min demo video | uploaded |
| 4.7 | Submission checklist sweep | all boxes ticked |

---

## Cuts if behind (in order)

Drop in this order. Stop at the first level that buys back the time you need.

1. Layer 3 post-training backstop → mention as v1.1
2. Automatic on-chain slashing → keep stake-locking, slash manually for demo
3. Quality Gate → degrade to per-contributor data-size sanity checks
4. N=3 → drop to N=2 contributors
5. CLI → SDK + demo only

**Never cut:** multi-owner INFT, encrypted-to-enclave submit, end-to-end demo. Those *are* the pitch.

---

## Repo layout

```
ffe/
├── sdk/                 # @notmartin/ffe TS library
│   ├── src/
│   │   ├── session.ts
│   │   ├── submit.ts
│   │   ├── download.ts
│   │   ├── crypto.ts    # X25519 + HPKE + AES-GCM helpers
│   │   └── attestation.ts
│   └── test/
├── cli/                 # npx ffe wrapper
├── contracts/
│   ├── Coordinator.sol
│   ├── INFTMinter.sol
│   └── interfaces/
├── aggregator/          # runs in 0G Tapp
│   ├── src/             # Rust: enclave entrypoint, attestation, networking
│   └── py/              # Python: training, Quality Gate, validation
├── demo/                # Next.js + scripts
└── docs/
    └── diagrams/
```

---

## Submission checklist

- [ ] Public GitHub repo with README + setup
- [ ] Architecture diagrams (before / after / usage)
- [ ] Coordinator + INFT minter deployed on Galileo testnet (addresses in README)
- [ ] Demo video < 3 minutes
- [ ] Live demo link
- [ ] Working example agent built using FFE
- [ ] Team contacts (Telegram / X)
- [ ] List of 0G protocol features / SDKs used
