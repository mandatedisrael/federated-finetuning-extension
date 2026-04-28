# FFE — Federated Fine-tuning Extension

A drop-in extension to 0G's existing fine-tuning network that takes it from
single-tenant (one user, one dataset, one private model out) to multi-tenant
joint training, where N parties co-train one shared LoRA without any of them
ever exposing raw data to each other or to 0G.

Targeting the **Best Agent Framework, Tooling & Core Extensions** track of the
Open-Agent hackathon ($7,500 pool).

---

## The problem

0G's fine-tuning today is single-tenant: one wallet uploads encrypted data to
a TEE provider, gets one encrypted LoRA back. Clean primitive — but it locks
out every situation where the most valuable training data is split across
multiple parties who legally, competitively, or operationally cannot share
raw data with each other.

That gap is the entire reason federated learning exists in the literature.
Nobody has shipped a clean, productized version of it on 0G.

## The solution in one paragraph

With FFE, multiple parties jointly fine-tune the same model without ever
showing their data to each other or to 0G. Each party encrypts their JSONL
to a Tapp aggregator's pubkey, the aggregator decrypts inside an attested
TEE, trains a single LoRA on the joint dataset, and ships it out as an
ERC-7857 INFT with one sealed key per contributor. Everyone walks away with
the same model, jointly owned, trained on all the data — and nobody ever
saw anyone else's raw data.

---

## Architecture (v1 — Joint Training mode)

We deliberately picked the simpler architecture for v1. Federated rounds
(iterative LoRA-delta aggregation) are v2.

```
Contributor A  ──► encrypt JSONL_A to AggTEE pubkey ──► 0G Storage
Contributor B  ──► encrypt JSONL_B to AggTEE pubkey ──► 0G Storage
Contributor C  ──► encrypt JSONL_C to AggTEE pubkey ──► 0G Storage
                                                              │
                                                              ▼
                          ┌──────────────────────────────────────┐
                          │     Aggregator TEE (0G Tapp)         │
                          │  1. fetch encrypted blobs            │
                          │  2. decrypt inside enclave           │
                          │  3. Quality Gate per contributor     │
                          │  4. concat → train ONE LoRA          │
                          │  5. encrypt LoRA, seal keys per      │
                          │     contributor                      │
                          │  6. attest + sign                    │
                          └──────────────┬───────────────────────┘
                                         │
                                         ▼
                          ERC-7857 INFT minted on 0G Chain
                          owners: [A, B, C]
                          sealedKey per owner
                                         │
                ┌────────────────────────┼────────────────────────┐
                ▼                        ▼                        ▼
        Contributor A            Contributor B            Contributor C
        Base + LoRA_ABC          Base + LoRA_ABC          Base + LoRA_ABC
        (run locally,            (run locally,            (run locally,
         via 0G Sealed            via 0G Sealed            via 0G Sealed
         Inference, or            Inference, or            Inference, or
         self-host)               self-host)               self-host)
```

---

## What gets shipped

| Layer | What it is | Approx size |
|---|---|---|
| **SDK** (`@notmartin/ffe`) | TS/Python library — three calls: `openSession`, `submit`, `download` | ~150 LoC |
| **CLI** | `npx ffe ...` wrapper for non-developers | ~100 LoC |
| **Coordinator contract** | Solidity on 0G Chain — session lifecycle, hash commits, slashing | ~300 LoC |
| **INFT minter** | Wraps `0g-agent-nft` (ERC-7857) for multi-owner joint output | ~100 LoC |
| **Aggregator service** | Rust/Python in 0G Tapp enclave — fetch, decrypt, Quality Gate, train, encrypt | ~600 LoC |
| **Demo app** | 3 mock contributors, synthetic dataset, before/after metrics | ~300 LoC |

Total: ~1,550 LoC. Doable in 4 weeks for a small team.

### Headline form factor

**The SDK is the visible deliverable** — what other devs `npm install` to
plug FFE into their own apps. The contracts and aggregator are deployed
once and shared. The CLI and demo app exist to prove the SDK works.

---

## End-to-end flow (3 traders example)

| Time | Event |
|---|---|
| T+0 | Trader A opens session: `npx ffe session create --base Qwen3-32B --participants 0xA,0xB,0xC --quorum 3` |
| T+5 | Trader A encrypts data to aggregator pubkey, uploads to 0G Storage, commits hash on chain |
| T+8 | Trader B does the same |
| T+15 | Trader C submits → quorum hit → contract emits `QuorumReached` |
| T+15 | Aggregator service triggers; pulls blobs, decrypts in TEE |
| T+18 | Quality Gate runs — per-contributor mini-LoRA trained, scored against held-out eval set; bad contributors filtered/slashed |
| T+20 | Joint LoRA trained on union of accepted data |
| T+45 | Post-training validation; LoRA encrypted, sealed keys generated per owner |
| T+46 | INFT minted; all 3 contributors notified |
| T+50 | Each contributor decrypts with their wallet key, loads `Base + LoRA_ABC` |

---

## Defense against bad data ("Skin in the Game" + Quality Gate)

Three layers, all required for v1:

### Layer 1 — Staked permissioned access
Every contributor locks a stake before joining a session. Bad behavior loses
the stake. Slashing is triggered by a TEE-signed rejection certificate
posted on-chain.

```solidity
function joinSession(uint256 sessionId) payable {
    require(msg.value >= MIN_STAKE);
    require(whitelist[sessionId][msg.sender]);
    stakes[sessionId][msg.sender] = msg.value;
}

function slashWithProof(
    address contributor,
    bytes calldata rejectionCert,
    bytes calldata teeAttestation
) external {
    require(verifyTEESignature(rejectionCert, teeAttestation));
    uint256 amount = stakes[sessionId][contributor];
    stakes[sessionId][contributor] = 0;
    // distribute slashed stake to honest contributors
}
```

### Layer 2 — Quality Gate (pre-training filter, inside TEE)
Inside the enclave, before any data touches the joint training:

```python
for contributor_i in contributors:
    mini_lora_i = train_lora(base, data_i, epochs=1)
    score_i    = evaluate(mini_lora_i, public_eval_set)

filtered = [i for i in contributors
            if score_i >= median(scores) - threshold]

# Slash filtered-out contributors via TEE-signed rejection cert
# Train joint LoRA only on `filtered` contributors' data
```

### Layer 3 — Post-training backstop
After joint training, the LoRA is benchmarked. If it fails to improve over
the solo baselines, the session aborts: contributors get partial refunds,
the last submitter loses extra stake. Catches sophisticated poisoning that
slipped through Layer 2.

---

## Cryptographic flow (key handling)

**Encryption to aggregator on submit:**
- Aggregator publishes its enclave pubkey + attestation quote on chain
- Each contributor verifies the attestation, then encrypts JSONL with X25519
  to that pubkey
- Only this specific enclave (running this specific code) can decrypt

**Encryption of output to all contributors:**
- TEE generates a fresh symmetric key K, encrypts LoRA with K
- For each contributor i: `sealedKey_i = encrypt(K, contributor_pubkey_i)`
- INFT mints with `[sealedKey_A, sealedKey_B, sealedKey_C]`
- Each contributor decrypts their `sealedKey_i` with their wallet key,
  recovers K, decrypts the LoRA

This is exactly what ERC-7857's `sealedKey` mechanism is designed for —
we're using the standard for the use case it was specced around.

---

## Use cases

### 1. Cross-trading-desk slippage / market-impact model
Multiple prop trading desks contribute their fill-slippage and execution
data. Each desk's strategies stay private; everyone gets a better
slippage predictor with cross-venue, cross-asset breadth. **Strong fit
for 0G's crypto-native audience.**

### 2. Enterprise — internal cross-department LLM
A company's marketing, sales, product, and support teams each have rich
data they can't pool centrally because of compliance, IP, or org politics.
FFE lets each department contribute privately; everyone uses the joint
model.

### 3. DeFi — cross-protocol exploit / risk model
Protocols pool transaction patterns from confirmed exploits without
doxxing user behavior. One shared "watchdog" model the ecosystem co-owns.

### 4. Pharma / research consortia
Labs running parallel trials on related molecule classes pool outcomes
without revealing strategy or IP. Faster discovery, no leak.

### 5. Community-trained models (trustless Outlier / Scale)
Instead of a centralized data-labeling company owning the resulting model,
contributors collectively own it via the INFT. Data co-ops where the
people providing data also share in the upside.

### 6. Rare-disease diagnostic models (regulated industry pitch)
Multiple regional hospital systems pool clinical notes for a rare
condition without violating HIPAA. Best demo pick for a 3-minute video —
universally understood stakes, regulatory backdrop everyone gets.

---

## Why this fits the framework track

| Requirement | How FFE delivers |
|---|---|
| "Framework-level work" | SDK that other devs `npm install`; the demo agent is the example, not the product |
| "Infrastructure primitives others will use" | Any builder running multi-party fine-tuning becomes a user; FLock-style projects could fork it |
| "Architecture diagram showing OpenClaw + 0G integration" | Clean diagram showing Tapp + Storage + ERC-7857 + Sealed Inference + Chain |
| "Working example agent" | Demo app with 3 mock contributors |
| "Public GitHub repo + setup instructions" | Monorepo: sdk/, cli/, contracts/, aggregator/, demo/ |
| "Demo video <3 min" | Compressed timeline of session open → submit × 3 → training overlay → INFT mint → all 3 download same model |
| "Contract deployment addresses" | Coordinator + INFT minter on Galileo testnet |

### 0G primitives used (basically the whole stack)

- **0G Tapp** — aggregator enclave with attestation
- **0G Compute (fine-tuning)** — the underlying training (extends single-tenant
  to N-tenant)
- **0G Storage** — encrypted dataset blobs, encrypted LoRA output
- **ERC-7857 (INFT)** — co-owned encrypted model artifact, sealedKey per owner
- **Sealed Inference (TeeML / TeeTLS)** — private serving of trained model
- **0G Chain** — coordinator contract, INFT minter, slashing, settlement

---

## Roadmap

### v1 — what we ship for the hackathon
- Joint Training mode (one TEE training job per session)
- Permissioned contributor set + staking
- Quality Gate (mini-LoRA per contributor, benchmark filter)
- Post-training validation backstop
- TEE-signed rejection certificates for on-chain slashing
- ERC-7857 multi-owner INFT minting
- SDK (TS) + CLI + reference aggregator + demo app

### v2 — Federated mode + privacy
- Multi-round LoRA-delta aggregation (true federated learning)
- Differential privacy noise on aggregated weights
- Async / dropout-tolerant rounds (M-of-N quorum)
- Robust aggregation algorithms (median, trimmed-mean, Krum)

### v3 — ecosystem
- Reputation system (compatible with ERC-8004 Reputation Registry)
- Skill marketplace integration (joint LoRAs published as discoverable INFTs)
- OpenClaw extension wrapper (`@notmartin/ffe-openclaw`) so OpenClaw agents can
  contribute to and benefit from joint training sessions
- Cross-base-model support beyond Qwen2.5/Qwen3

---

## Honest risks / open questions to resolve while building

1. **Fine-tuning is testnet-only on 0G today.** Per the `fine-tuning-example`
   README. Hackathon ships on testnet; mainnet is a downstream dependency
   on 0G's roadmap, not on us.

2. **Tapp memory/GPU limits.** Need to confirm a Tapp instance can handle
   training Qwen3-32B's LoRA on a few-thousand-sample joint dataset. If
   not, drop to Qwen2.5-0.5B for the demo and document the path forward.

3. **Aggregator pubkey publishing pattern.** The contributor needs to verify
   the aggregator's TEE attestation matches the published code hash before
   encrypting data. Need a clean, auditable flow for this.

4. **ERC-7857 sealedKey for multi-party output.** The standard is designed
   for transfer between two parties; we're using the same mechanism for
   N-party initial mint. Should work cleanly but worth confirming with
   the 0G team that they support this usage.

5. **Sophisticated data poisoning is an open research problem.** Our
   Quality Gate catches obvious cases; v1 doesn't claim Byzantine
   robustness. Be honest in the README.

---

## Submission checklist

- [ ] Public GitHub repo with README + setup instructions
- [ ] Architecture diagram (siloed before / FFE after / usage after)
- [ ] Coordinator + INFT minter contracts deployed on Galileo testnet
- [ ] Demo video under 3 minutes
- [ ] Live demo link (small web UI to trigger a session)
- [ ] Working example agent built using FFE (the demo app)
- [ ] Team member names + Telegram/X contact
- [ ] List of 0G protocol features / SDKs used

---

## Working name + branding

- **FFE** — Federated Fine-tuning Extension
- Tagline: *"From N=1 to N>1. Privately."*
- Pitch: *"0G's fine-tuning today is for one user. FFE extends it to many,
  without anyone seeing anyone else's data."*

---

## Notes for future self / team

- Keep the joint-training scope tight; do not get pulled into shipping
  federated rounds in v1. They are visibly more complex and not necessary
  for the demo to land.
- The "Skin in the Game" + "Quality Gate" framing is the strongest part
  of the pitch. Lead with it whenever bad-data concerns come up.
- Mirror the visual diagram (siloed before vs. FFE after) on the README,
  the demo video, and the pitch deck — single coherent visual story.
- The core insight 0G hasn't deployed yet: ERC-7857's sealedKey mechanism
  was designed for exactly this multi-party encrypted-artifact use case
  and nobody is using it that way. Lean into it.
