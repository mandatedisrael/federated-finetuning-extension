#!/usr/bin/env python3
"""
FFE Aggregator — LoRA fine-tuning bridge.
Reads JSONL training data and fine-tunes via the 0G fine-tuning service.

TEE mode: when USE_REAL_0G_TRAINING is not set the script runs a simulation
that mimics the real flow (data loading → training config → epoch loop →
adapter export) and emits a mock TEE attestation quote. Suitable for demos.
"""

import argparse
import json
import os
import sys
import time
import hashlib
from datetime import datetime, timezone
from pathlib import Path


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def load_jsonl(path: str) -> list:
    records = []
    try:
        with open(path, "r") as f:
            for line in f:
                line = line.strip()
                if line:
                    records.append(json.loads(line))
        return records
    except Exception as e:
        print(f"[Error] Failed to load JSONL: {e}", file=sys.stderr)
        sys.exit(1)


# ---------------------------------------------------------------------------
# TEE attestation (mock for dev / demo)
# ---------------------------------------------------------------------------

def mock_tee_attestation(session_id: str, adapter_hash: str) -> dict:
    """
    Produce a mock TEE attestation report.

    In production this would call into the Tapp runtime to generate a real
    Intel TDX / SGX quote that commits to the enclave measurement, the
    session ID, and the adapter hash.  For the demo we produce a
    deterministic stand-in with the same JSON shape so downstream verifiers
    can be wired up without code changes.
    """
    nonce = hashlib.sha256(f"{session_id}:{adapter_hash}".encode()).hexdigest()
    return {
        "tee_type": "Intel TDX (mock)",
        "enclave_measurement": "mrenclave:" + hashlib.sha256(b"ffe-aggregator-v0.1").hexdigest(),
        "session_id": session_id,
        "adapter_hash": adapter_hash,
        "nonce": nonce,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "note": "mock attestation — swap for real Tapp quote before mainnet",
    }


# ---------------------------------------------------------------------------
# Training — real path (0G fine-tuning service)
# ---------------------------------------------------------------------------

def fine_tune_with_0g_service(jsonl_path: str, base_model: str, session_id: str) -> dict:
    """Call the 0G fine-tuning service REST API."""
    try:
        import requests  # type: ignore
    except ImportError:
        print("[Error] `requests` not installed — required for real 0G training", file=sys.stderr)
        sys.exit(1)

    endpoint = os.environ.get("ZG_FINETUNE_URL", "https://api-fine-tuning-testnet.0g.ai")
    api_key  = os.environ.get("ZG_FINETUNE_API_KEY", "")

    records = load_jsonl(jsonl_path)
    print(f"[Train] Submitting {len(records)} samples to 0G fine-tuning service", file=sys.stderr)
    print(f"[Train] Endpoint: {endpoint}", file=sys.stderr)

    payload = {
        "base_model": base_model,
        "session_id": session_id,
        "training_data": records,
        "config": {
            "rank": int(os.environ.get("LORA_RANK", "8")),
            "lora_alpha": int(os.environ.get("LORA_ALPHA", "16")),
            "epochs": int(os.environ.get("LORA_EPOCHS", "1")),
            "batch_size": min(len(records), 2),
            "learning_rate": float(os.environ.get("LORA_LR", "0.0001")),
        },
    }

    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    resp = requests.post(f"{endpoint}/jobs", json=payload, headers=headers, timeout=30)
    resp.raise_for_status()
    job_id = resp.json()["job_id"]
    print(f"[Train] Job submitted: {job_id}", file=sys.stderr)

    # Poll until done
    while True:
        time.sleep(10)
        status_resp = requests.get(f"{endpoint}/jobs/{job_id}", headers=headers, timeout=10)
        status_resp.raise_for_status()
        status = status_resp.json()
        print(f"[Train] Job status: {status.get('status')}", file=sys.stderr)
        if status.get("status") == "completed":
            return status.get("adapter", {})
        if status.get("status") == "failed":
            raise RuntimeError(f"0G fine-tuning job failed: {status.get('error')}")


# ---------------------------------------------------------------------------
# Training — simulated path (TEE demo mode)
# ---------------------------------------------------------------------------

def simulate_training(jsonl_path: str, base_model: str, session_id: str) -> dict:
    """
    Simulate LoRA training inside the TEE for demo purposes.
    Emits realistic progress to stderr so observers can follow along.
    """
    records = load_jsonl(jsonl_path)
    n = len(records)

    if n == 0:
        print("[Error] Empty JSONL file", file=sys.stderr)
        sys.exit(1)

    rank        = int(os.environ.get("LORA_RANK", "8"))
    lora_alpha  = int(os.environ.get("LORA_ALPHA", "16"))
    epochs      = int(os.environ.get("LORA_EPOCHS", "1"))
    batch_size  = min(n, 2)
    lr          = float(os.environ.get("LORA_LR", "0.0001"))

    print(f"[TEE] Aggregator running inside Trusted Execution Environment", file=sys.stderr)
    print(f"[TEE] Base model : {base_model}", file=sys.stderr)
    print(f"[TEE] Session    : {session_id}", file=sys.stderr)
    print(f"[TEE] Samples    : {n}", file=sys.stderr)
    print(f"[TEE] LoRA rank  : {rank}  alpha: {lora_alpha}", file=sys.stderr)
    print(f"[TEE] Epochs     : {epochs}  batch: {batch_size}  lr: {lr}", file=sys.stderr)

    # Simulate epoch loop
    steps = max(1, n // batch_size)
    for epoch in range(1, epochs + 1):
        for step in range(1, steps + 1):
            loss = round(2.3 * (0.85 ** ((epoch - 1) * steps + step)), 4)
            print(f"[TEE] Epoch {epoch}/{epochs}  step {step}/{steps}  loss={loss}", file=sys.stderr)

    # Deterministic "weights" fingerprint (session + data hash)
    data_hash = hashlib.sha256(
        "\n".join(json.dumps(r, sort_keys=True) for r in records).encode()
    ).hexdigest()

    adapter = {
        "base_model": base_model,
        "session_id": int(session_id),
        "rank": rank,
        "lora_alpha": lora_alpha,
        "epochs": epochs,
        "batch_size": batch_size,
        "learning_rate": lr,
        "training_samples": n,
        "data_fingerprint": data_hash,
        "adapter_fingerprint": hashlib.sha256(f"{session_id}:{data_hash}".encode()).hexdigest(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "mode": "tee_simulation",
    }

    attestation = mock_tee_attestation(session_id, adapter["adapter_fingerprint"])
    adapter["tee_attestation"] = attestation

    print(f"[TEE] Attestation nonce : {attestation['nonce'][:16]}…", file=sys.stderr)
    print(f"[TEE] Training complete", file=sys.stderr)

    return adapter


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="FFE LoRA training bridge")
    parser.add_argument("--jsonl-path",  required=True, help="Path to input JSONL")
    parser.add_argument("--base-model",  required=True, help="Base model identifier")
    parser.add_argument("--session-id",  required=True, help="Session ID")
    args = parser.parse_args()

    if not Path(args.jsonl_path).exists():
        print(f"[Error] JSONL file not found: {args.jsonl_path}", file=sys.stderr)
        sys.exit(1)

    use_real = os.environ.get("USE_REAL_0G_TRAINING", "false").lower() == "true"

    if use_real:
        print("[Train] USE_REAL_0G_TRAINING=true — calling 0G fine-tuning service", file=sys.stderr)
        adapter = fine_tune_with_0g_service(args.jsonl_path, args.base_model, args.session_id)
    else:
        print("[Train] USE_REAL_0G_TRAINING not set — running TEE simulation", file=sys.stderr)
        adapter = simulate_training(args.jsonl_path, args.base_model, args.session_id)

    # Output adapter JSON as a single line on stdout (required by trainingBridge.ts)
    print(json.dumps(adapter))
    sys.stdout.flush()


if __name__ == "__main__":
    main()
