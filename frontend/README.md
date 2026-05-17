# FFE Frontend

Next.js app for the **Federated Fine-tuning Exchange** — owners spin up an FFE
project, contributors register wallets and upload encrypted training data, and
the aggregator orchestrates fine-tuning + INFT minting on 0G.

> **Heads up:** this repo pins a custom Next.js build. See `AGENTS.md` — read
> the relevant guide under `node_modules/next/dist/docs/` before changing
> framework-level code.

## Repo layout

This package lives inside a pnpm workspace at the repo root:

```
FFE/
├─ aggregator/   ← orchestrator service (must be running for live training)
├─ contracts/    ← Coordinator + INFTMinter Solidity
├─ sdk/          ← @notmartin/ffe TypeScript SDK
└─ frontend/     ← this app
```

Install all workspaces from the repo root once:

```bash
pnpm install
```

---

## 1. Start the frontend

From `frontend/`:

```bash
cp .env.local.example .env.local   # fill in values, see below
pnpm dev                            # or: npm run dev
```

Open <http://localhost:3000>.

### Required env (`.env.local`)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy app ID — wallets, auth, embedded keys. Get one at <https://dashboard.privy.io>. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only service role key. Never expose to the client. |
| `FFE_SERVER_PRIVATE_KEY` | 0x-prefixed EVM key the API routes use to open Coordinator sessions. Can reuse `AGG_EVM_KEY` on a single machine. |
| `COORDINATOR_ADDRESS`, `INFT_ADDRESS` | Deployed contract addresses on 0G. |
| `RPC_URL`, `STORAGE_EVM_RPC`, `STORAGE_INDEXER_URL` | 0G RPC + storage endpoints. |
| `FFE_AGGREGATOR_X25519_PUBLIC_KEY` *or* `AGG_X25519_KEY` | Aggregator's X25519 public key — contributors encrypt to it before upload. |
| `FFE_BASE_MODEL` | Default base model id (e.g. `Qwen/Qwen2.5-0.5B`). |

Optional but useful:

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | Real invite email delivery. Without these, invites render as preview deliveries. |
| `FFE_LOCAL_STORAGE_DIR` | Local fallback when 0G Storage is unavailable in dev. |
| `FFE_AGGREGATOR_STATUS_PATH` | Path to the aggregator's runtime status JSON (default `/tmp/ffe-aggregator-status.json`). The dashboard reads training stage + logs from this file. |
| `FFE_AGGREGATOR_CANCEL_PATH` | Path the cancel endpoint writes to so the aggregator can stop a session (default `/tmp/ffe-aggregator-cancellations.json`). |

### Apply the Supabase migration

From the repo root, push
`supabase/migrations/20260514170000_ffe_project_persistence.sql` to your
Supabase project (Studio → SQL editor, or `supabase db push`). Public tables
have RLS enabled; the frontend writes through Next API routes using the
service-role key.

---

## 2. Start the aggregator

The frontend can render drafts and accept contributions without the aggregator,
but **training only happens when the aggregator is running**. From
`aggregator/`:

```bash
cp .env.example .env                # fill in values
pnpm build && pnpm start            # or: pnpm service (same thing)
```

Minimum env (`aggregator/.env`):

| Variable | Purpose |
|----------|---------|
| `AGG_EVM_KEY` | Funded 0G wallet key the aggregator uses to mint INFTs. |
| `AGG_X25519_KEY` | X25519 private key matching the public key shipped to the frontend. |
| `COORDINATOR_ADDRESS`, `INFT_ADDRESS` | Same contract addresses as the frontend. |
| `USE_REAL_0G_TRAINING=true` | Routes quorum events to the real 0G fine-tuning service. Set to `false` for a dry-run loop. |
| `BASE_MODEL` | Default `Qwen2.5-0.5B-Instruct`. |

The aggregator writes per-session stage updates and training logs to
`FFE_AGGREGATOR_STATUS_PATH` (default `/tmp/ffe-aggregator-status.json`). The
frontend's `GET /api/ffe/sessions/[sessionId]` reads that file to power the
live training dashboard, so **both processes must share the same path**.

Helper scripts:

```bash
pnpm keygen          # generate a fresh X25519 keypair
pnpm check-wallet    # confirm AGG_EVM_KEY balance + nonce on 0G
pnpm mint:resume     # retry a stuck mint
```

---

## End-to-end flow

1. Owner creates a project at `/new` → optional invites.
2. Contributors open `/join?code=…`, connect a wallet via Privy, and register
   an X25519 training key.
3. Owner starts the on-chain session from the dashboard — the registered
   wallets/pubkeys become the Coordinator participants.
4. Each contributor uploads from `/p/<id>/contribute`. The browser hands the
   text to `POST /api/ffe/contributions/prepare`, which encrypts to the
   aggregator key and uploads to 0G Storage. The browser wallet then signs
   `Coordinator.submit()` with the returned root hash (or the server proxies
   it via `POST /api/ffe/contributions` if the project uses server-owned
   participants).
5. When quorum is reached, the aggregator picks up the event, runs the LoRA
   fine-tune, encrypts the artifact, mints an INFT, and updates its status
   file. The dashboard reflects `setup → training → trained → delivering →
   ready` in real time.
6. Owner opens `/p/<id>/result` to fetch the INFT artifact and compare the
   fine-tuned model against the base model in a side-by-side playground.

---

## API surface

All routes live under `src/app/api/`:

**Projects + invites**
- `POST /api/projects`, `GET /api/projects/[id]`, `GET /api/projects/invite/[code]`
- `POST /api/projects/[id]/register` — claim an invite seat, store wallet + FFE pubkey.
- `POST /api/notify/invites` — send (or preview) invite emails via Resend.

**Live FFE bridge**
- `POST /api/ffe/projects` — `FFE.openSession()` against the Coordinator.
- `POST /api/ffe/contributions` — server-proxy `FFE.submit()` path.
- `POST /api/ffe/contributions/prepare` — encrypt + upload to 0G Storage, return
  root hash for the browser wallet to submit.
- `GET /api/ffe/sessions/[sessionId]` — Coordinator status + aggregator runtime
  stage + training logs.
- `POST /api/ffe/sessions/[sessionId]/cancel` — owner cancellation request,
  written to the aggregator's cancel-poll file.
- `POST /api/ffe/sessions/[sessionId]/artifact` — resolve the minted INFT and
  decrypt the LoRA artifact receipt for the playground.

> The artifact endpoint is still a development bridge: it accepts the
> participant's X25519 private key from the browser cache so it can use the
> current Node SDK decrypt path. The production version should move
> decryption client-side and keep the recipient key off the server.

---

## Scripts

```bash
pnpm dev          # next dev
pnpm build        # next build
pnpm start        # next start
pnpm lint         # eslint
```
