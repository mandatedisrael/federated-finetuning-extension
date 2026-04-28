# FFE Contracts

Solidity contracts for the FFE coordinator on 0G Chain.

## Layout

```
src/
├── Coordinator.sol            # session lifecycle (v0.1)
└── interfaces/
    └── ICoordinator.sol
test/
└── Coordinator.t.sol          # 25 tests, foundry
script/
└── DeployCoordinator.s.sol
```

## Develop

```bash
forge build
forge test -vv
```

## Deploy to Galileo testnet

```bash
export GALILEO_RPC_URL=...        # 0G Galileo RPC
export DEPLOYER_PRIVATE_KEY=0x...  # funded with test OG

forge script script/DeployCoordinator.s.sol \
  --rpc-url $GALILEO_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast
```

## Scope of v0.1

Pure storage + events. No staking, slashing, or finalization yet — those land with the TEE plumbing in later phases.

| Function | Purpose |
|---|---|
| `createSession(baseModel, participants, pubkeys, quorum)` | Open a session with a fixed whitelist and per-participant pubkey |
| `setAggregatorPubkey(id, pubkey, attestation)` | Creator publishes the TEE pubkey contributors encrypt to |
| `submit(id, blobHash)` | Participant commits the hash of their encrypted dataset blob |

When the submission count reaches `quorum`, status flips to `QuorumReached` and a single event carries everything an aggregator needs (submitters, blob hashes, owner pubkeys, all parallel).

## Deployments

| Network | Chain ID | Address | Tx |
|---|---|---|---|
| Galileo testnet | 16602 | [`0x4Dd446F51126d473070444041B9AA36d3ae7F295`](https://chainscan-galileo.0g.ai/address/0x4Dd446F51126d473070444041B9AA36d3ae7F295) | [`0xb957ee…11832`](https://chainscan-galileo.0g.ai/tx/0xb957ee7edd7629d7d4743e40b09a3fa4983fca6251ce67a25333fd08c4511832) |
