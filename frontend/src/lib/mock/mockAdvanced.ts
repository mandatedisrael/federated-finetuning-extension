/**
 * Mock provenance data for the Advanced Drawer. Replace with
 * real values from the aggregator / SDK once the trust pipeline
 * is wired up — the drawer reads these fields by shape, not by
 * source.
 */

export interface TeeAttestation {
  quote: string; // base64-ish blob preview
  codeHash: string; // sha-256 of the enclave binary
  measuredAt: string; // ISO
  provider: "Intel TDX" | "AMD SEV-SNP" | "AWS Nitro";
}

export interface StorageRoots {
  contributionsRoot: string;
  manifestRoot: string;
  modelRoot: string;
  storageProvider: "Filecoin" | "Arweave" | "Walrus" | "0G Storage";
}

export interface InftRecord {
  tokenId: string;
  chain: "Base" | "Optimism" | "0G Chain";
  sealedKeyId: string;
  ownersCount: number;
  txHash: string;
}

export interface ManifestRow {
  rawFileHash: string;
  convertedJsonlHash: string;
  rowsKept: number;
  rowsDropped: number;
  sampleRowHashes: string[];
}

export interface ProviderLog {
  ts: string;
  level: "info" | "warn" | "error";
  message: string;
}

export interface AdvancedSnapshot {
  tee: TeeAttestation;
  storage: StorageRoots;
  inft: InftRecord;
  manifest: ManifestRow;
  logs: ProviderLog[];
}

function hex(seed: string, length: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 33 + seed.charCodeAt(i)) >>> 0;
  let out = "";
  for (let i = 0; out.length < length; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    out += h.toString(16).padStart(8, "0");
  }
  return out.slice(0, length);
}

export function snapshotFor(projectId: string, userId?: string): AdvancedSnapshot {
  const seed = `${projectId}:${userId ?? "viewer"}`;
  const now = new Date();
  const sample = (n: number) =>
    Array.from({ length: n }, (_, i) => `0x${hex(`${seed}:row:${i}`, 12)}…`);

  return {
    tee: {
      quote: `0x${hex(`${seed}:quote`, 64)}`,
      codeHash: `sha256:${hex(`${seed}:code`, 64)}`,
      measuredAt: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
      provider: "Intel TDX",
    },
    storage: {
      contributionsRoot: `0x${hex(`${seed}:ctr`, 64)}`,
      manifestRoot: `0x${hex(`${seed}:mfr`, 64)}`,
      modelRoot: `0x${hex(`${seed}:mdr`, 64)}`,
      storageProvider: "0G Storage",
    },
    inft: {
      tokenId: `INFT-${hex(`${seed}:tok`, 6).toUpperCase()}`,
      chain: "0G Chain",
      sealedKeyId: `sk_${hex(`${seed}:sk`, 10)}`,
      ownersCount: 4,
      txHash: `0x${hex(`${seed}:tx`, 64)}`,
    },
    manifest: {
      rawFileHash: `0x${hex(`${seed}:raw`, 64)}`,
      convertedJsonlHash: `0x${hex(`${seed}:jsonl`, 64)}`,
      rowsKept: 142,
      rowsDropped: 6,
      sampleRowHashes: sample(4),
    },
    logs: [
      {
        ts: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
        level: "info",
        message: "Enclave measurement verified against expected codeHash.",
      },
      {
        ts: new Date(now.getTime() - 40 * 60 * 1000).toISOString(),
        level: "info",
        message: "Contributions root sealed; manifest committed to storage.",
      },
      {
        ts: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
        level: "warn",
        message: "6 rows dropped during JSONL conversion (PII redaction).",
      },
      {
        ts: new Date(now.getTime() - 8 * 60 * 1000).toISOString(),
        level: "info",
        message: "INFT minted to project owners; sealed-key distributed.",
      },
    ],
  };
}
