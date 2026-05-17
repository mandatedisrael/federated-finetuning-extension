# FFE — Federated Fine-tuning Extension

> From N=1 to N>1. Privately.

FFE extends 0G fine-tuning from a single user training on one private dataset
into a multi-contributor workflow: several parties encrypt datasets to an
aggregator, the aggregator trains one shared LoRA, and the result is minted as
an INFT with a sealed decryption key for each contributor.

The current repo runs the real aggregator as a backend service. The frontend
creates sessions, sends contributor invites, and collects Privy wallet
submissions; the aggregator watches for quorum, trains through 0G fine-tuning,
and mints the encrypted INFT result.

---

## Compare LoRA Files

You can compare two trained LoRA files to inspect training metadata, estimated
dataset sizes, and weight differences:

```bash
node sdk/compare-loras.js <loraPath1> <loraPath2> [label1] [label2]
```

Example:

```bash
node sdk/compare-loras.js ./single-trained-lora ./ffe-trained-lora Single FFE
```

The script supports ZIP (HuggingFace adapter), SafeTensors, and JSON formats.
It extracts:

- Training parameters (rank, alpha, dropout, batch size, epochs)
- Estimated dataset size (computed from steps/epochs ratio)
- Loss progression side by side
- Weight hash comparison to confirm models are different

---

## TL;DR

- Contributors encrypt JSONL datasets to the aggregator X25519 public key.
- The Coordinator contract tracks sessions, participants, submissions, and quorum.
- When quorum is reached, the aggregator fetches and decrypts blobs, combines the
  data, and trains one shared LoRA through real 0G fine-tuning.
- The trained LoRA is encrypted once with AES-256-GCM.
- The LoRA key is sealed separately for each contributor and stored in the INFT.
- Each contributor can independently download and decrypt the same shared model.

---

## Current Status

Implemented:

- TypeScript SDK surface: `openSession`, `submit`, `download`
- Coordinator contract for session lifecycle and quorum
- INFT minter contract with per-contributor sealed keys
- Aggregator pipeline: listen for quorum, fetch/decrypt blobs, train, encrypt, mint
- Local storage fallback for dev/live runs when 0G Storage is unavailable
- Frontend-backed aggregator service in `aggregator/src/start.ts`

Not yet implemented:

- Real 0G Tapp enclave attestation enforcement
- Staking and slashing
- Quality Gate and post-training backstop
- CLI package for non-developer users

---

## Architecture

### v1 — Joint Training Mode

FFE v1 deliberately uses joint training: the aggregator combines accepted
datasets and trains one LoRA. Multi-round federated LoRA delta aggregation is a
future mode.

```text
Contributor A  -> encrypt JSONL_A to aggregator pubkey -> 0G Storage
Contributor B  -> encrypt JSONL_B to aggregator pubkey -> 0G Storage
Contributor C  -> encrypt JSONL_C to aggregator pubkey -> 0G Storage
                                                               |
                                                               v
                         Aggregator
                         1. observe QuorumReached
                         2. fetch encrypted blobs
                         3. decrypt with aggregator X25519 key
                         4. concatenate JSONL
                         5. train one shared LoRA through real 0G fine-tuning
                         6. encrypt LoRA
                         7. seal LoRA key for each contributor
                         8. mint INFT
                                                               |
                                                               v
                         ERC-7857-style INFT
                         modelBlobHash + sealedKey per contributor
                                                               |
                         +-------------+-------------+
                         v             v             v
                    Contributor A Contributor B Contributor C
                    Base + LoRA   Base + LoRA   Base + LoRA
```

### Components

| Path | Purpose |
|---|---|
| `sdk/` | `@notmartin/ffe` SDK: crypto, storage, coordinator, INFT, `FFE` client |
| `contracts/` | Solidity Coordinator and INFT minter contracts |
| `aggregator/` | Event listener, blob processor, training bridge, minter, service runner |
| `docs/diagrams/` | Before/after architecture images |

---

## How To Run

### 1. Install dependencies

From the repo root:

```bash
pnpm install
```

### 2. Configure secrets locally

Create a local env file:

```bash
cd aggregator
cp .env.example .env
```

Fill in `aggregator/.env`:

```bash
AGG_EVM_KEY=0x...
AGG_X25519_KEY=...

COORDINATOR_ADDRESS=0x840C3E83A5f3430079Aff7247CD957c994076015
INFT_ADDRESS=0x04D804912881B692b585604fb0dA1CE0D403487E

RPC_URL=https://evmrpc.0g.ai
FT_RPC_URL=https://evmrpc.0g.ai
STORAGE_INDEXER_URL=https://indexer-storage-turbo.0g.ai
FT_PROVIDER_ADDRESS=0x940b4a101CaBa9be04b16A7363cafa29C1660B0d

BASE_MODEL=Qwen2.5-0.5B-Instruct
USE_REAL_0G_TRAINING=true
```

`aggregator/.env` is ignored by git. Do not pass private keys directly in the
CLI command and do not commit `.env`.

### 3. Fund the live accounts

The frontend-backed flow uses wallet signing in two places:

- project owners and contributors connect with Privy in the frontend
- the aggregator wallet pays for fine-tuning, minting, and related backend transactions

The aggregator wallet in `AGG_EVM_KEY` needs OG on the target 0G network.
Frontend users need OG in their connected wallets when they submit on-chain.

### 4. Start the app for testing

Use two terminals.

In the first terminal, start the frontend:

```bash
cd frontend
pnpm start
```

In the second terminal, start the aggregator service:

```bash
cd aggregator
pnpm start
```

The aggregator service:

1. Loads `aggregator/.env`
2. Starts the aggregator event listener
3. Watches Coordinator sessions for quorum
4. Downloads and decrypts submitted blobs from 0G Storage
5. Runs real 0G fine-tuning
6. Uploads the encrypted LoRA artifact
7. Mints an INFT with one sealed key per contributor

By default, the service ignores sessions that already existed when it started,
so it waits for new frontend-created work. Set
`FFE_REPLAY_EXISTING_SESSIONS=true` if you intentionally want it to replay old
quorum sessions.

### Useful Commands

```bash
# Typecheck aggregator
pnpm --filter @notmartin/ffe-aggregator typecheck

# Run aggregator tests
pnpm --filter @notmartin/ffe-aggregator test

# Generate a fresh aggregator X25519 keypair
cd aggregator
pnpm keygen
```

---

## Aggregator Service Details

`aggregator/src/start.ts` is the canonical backend service entrypoint and is
invoked by `pnpm start` or `pnpm service`.

The frontend registers contributor wallets and FFE public keys when users join
with Privy. The owner starts the Coordinator session from the dashboard, and
contributors submit with their connected wallets.

The aggregator X25519 key is long-lived and comes from `AGG_X25519_KEY`. Its
derived public key is published in the session so contributors can encrypt their
datasets before upload.

During `pnpm start`, the service polls for quorum sessions. When quorum is
reached, it decrypts submitted blobs with `AGG_X25519_KEY`, combines the JSONL,
and uses the real 0G fine-tuning path in `trainingBridge.ts`, signing the
fine-tuning request with `AGG_EVM_KEY`.

---

## Cryptographic Flow

### Contributor -> Aggregator

- Aggregator derives an X25519 public key from `AGG_X25519_KEY`.
- Contributors encrypt JSONL bytes to that public key.
- Encrypted blobs are uploaded to 0G Storage or the local fallback store.
- The Coordinator stores only the blob hash commitment.
- The aggregator decrypts only after quorum is reached.

### Aggregator -> Contributors

- Aggregator trains one LoRA from the combined dataset.
- Aggregator generates a fresh AES-256 key `K`.
- The LoRA is encrypted as `nonce || ciphertext-with-auth-tag`.
- `K` is sealed to each contributor's X25519 public key.
- The INFT minter stores the encrypted LoRA blob hash and parallel sealed keys.
- Each contributor unseals their copy of `K` and decrypts the same LoRA.

---

## Contract Deployments

Current service defaults:

| Contract | Network | Address |
|---|---|---|
| Coordinator | 0G Mainnet | `0x840C3E83A5f3430079Aff7247CD957c994076015` |
| INFTMinter | 0G Mainnet | `0x04D804912881B692b585604fb0dA1CE0D403487E` |

Older Galileo testnet deployments may still exist in `contracts/README.md`, but
the root live flow currently targets the addresses above.

The INFTMinter contract is immutable. If you experience any errors with the
deployed address (e.g. it has been replaced), you can deploy your own copy:

```bash
cd contracts
MINTER_ADDRESS=0x... \
  forge script script/DeployINFTMinter.s.sol \
    --rpc-url $RPC_URL \
    --private-key $DEPLOYER_PRIVATE_KEY \
    --broadcast
```

Then set `INFT_ADDRESS` in your `aggregator/.env` to the newly deployed address.

---

## Repo Layout

```text
FFE/
├── aggregator/
│   ├── src/
│   │   ├── start.ts            # aggregator service entrypoint
│   │   ├── blobProcessor.ts    # fetch/decrypt contributor blobs
│   │   ├── eventListener.ts    # poll Coordinator for quorum sessions
│   │   ├── trainingBridge.ts   # TEE simulation or real 0G fine-tuning
│   │   ├── minter.ts           # upload encrypted LoRA and mint INFT
│   │   └── orchestrator.ts     # wires the pipeline together
│   └── test/
├── contracts/
│   └── src/
│       ├── Coordinator.sol
│       └── INFTMinter.sol
├── sdk/
│   └── src/
│       ├── ffe.ts
│       ├── crypto/
│       ├── coordinator/
│       ├── inft/
│       └── storage/
└── docs/
```

---

Working name: **FFE** — Federated Fine-tuning Extension.
