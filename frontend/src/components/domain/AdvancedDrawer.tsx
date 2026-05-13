"use client";

import * as React from "react";
import {
  ShieldCheck,
  Database,
  Coins,
  FileText,
  Copy,
  Check,
  Info,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerBody,
  DrawerClose,
  DrawerFooter,
} from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { snapshotFor, type AdvancedSnapshot, type ProviderLog } from "@/lib/mock/mockAdvanced";

function truncate(value: string, head = 10, tail = 6) {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function CopyableHash({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard may be unavailable in some sandboxes; silently ignore
    }
  }

  return (
    <div className="border-border bg-surface-muted/40 flex items-center gap-2 rounded-[var(--radius-md)] border px-2 py-1.5">
      {label && (
        <span className="text-foreground-subtle shrink-0 text-[10px] tracking-wider uppercase">
          {label}
        </span>
      )}
      <code className="text-foreground-muted flex-1 truncate font-mono text-[11px]">
        {truncate(value, 14, 8)}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy"
        className="text-foreground-subtle hover:text-foreground inline-flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] transition-colors"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function Section({
  title,
  icon,
  badge,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border bg-surface space-y-3 rounded-[var(--radius-lg)] border p-4">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-foreground-muted">{icon}</span>
          <h3 className="text-sm font-medium tracking-tight">{title}</h3>
        </div>
        {badge}
      </header>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-foreground-subtle text-[10px] tracking-wider uppercase">
        {label}
      </span>
      <span className="text-foreground text-right text-xs">{value}</span>
    </div>
  );
}

function LogLine({ log }: { log: ProviderLog }) {
  const Icon =
    log.level === "error"
      ? AlertCircle
      : log.level === "warn"
        ? AlertTriangle
        : Info;
  const toneClass =
    log.level === "error"
      ? "text-status-danger"
      : log.level === "warn"
        ? "text-status-warning"
        : "text-foreground-subtle";

  const t = new Date(log.ts);
  const time = `${t.getHours().toString().padStart(2, "0")}:${t.getMinutes().toString().padStart(2, "0")}`;

  return (
    <li className="flex items-start gap-2 text-xs leading-relaxed">
      <Icon className={`${toneClass} mt-0.5 h-3 w-3 shrink-0`} />
      <span className="text-foreground-subtle shrink-0 font-mono">{time}</span>
      <span className="text-foreground-muted">{log.message}</span>
    </li>
  );
}

interface AdvancedDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  userId?: string;
}

export function AdvancedDrawer({
  open,
  onOpenChange,
  projectId,
  userId,
}: AdvancedDrawerProps) {
  const snapshot: AdvancedSnapshot | null = React.useMemo(
    () => (projectId ? snapshotFor(projectId, userId) : null),
    [projectId, userId],
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Trust details</DrawerTitle>
          <DrawerDescription>
            Verifiable provenance for this project. Power-user surface — never
            required for the main flow.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="space-y-4">
          {!snapshot ? (
            <div className="text-foreground-muted rounded-[var(--radius-md)] border border-dashed p-6 text-center text-sm">
              Open the drawer from a project page to see provenance for that
              project.
            </div>
          ) : (
            <>
              <Section
                title="TEE attestation"
                icon={<ShieldCheck className="h-4 w-4" />}
                badge={
                  <Badge tone="trust" className="text-[10px]">
                    <Check className="h-3 w-3" />
                    Verified
                  </Badge>
                }
              >
                <p className="text-foreground-muted text-xs leading-relaxed">
                  Training ran inside a hardware-attested enclave. The quote
                  binds the running code hash to the measurement below.
                </p>
                <div className="space-y-1.5 pt-1">
                  <Field label="Provider" value={snapshot.tee.provider} />
                  <Field
                    label="Measured"
                    value={new Date(snapshot.tee.measuredAt).toLocaleString()}
                  />
                </div>
                <CopyableHash value={snapshot.tee.quote} label="Quote" />
                <CopyableHash value={snapshot.tee.codeHash} label="Code hash" />
              </Section>

              <Section
                title="Storage roots"
                icon={<Database className="h-4 w-4" />}
                badge={
                  <Badge outline className="text-[10px]">
                    {snapshot.storage.storageProvider}
                  </Badge>
                }
              >
                <p className="text-foreground-muted text-xs leading-relaxed">
                  Merkle roots committed at sealing time. Any change to the
                  underlying data would change these hashes.
                </p>
                <CopyableHash
                  value={snapshot.storage.contributionsRoot}
                  label="Contributions"
                />
                <CopyableHash
                  value={snapshot.storage.manifestRoot}
                  label="Manifest"
                />
                <CopyableHash value={snapshot.storage.modelRoot} label="Model" />
              </Section>

              <Section
                title="INFT & sealed key"
                icon={<Coins className="h-4 w-4" />}
                badge={
                  <Badge outline className="text-[10px]">
                    {snapshot.inft.chain}
                  </Badge>
                }
              >
                <p className="text-foreground-muted text-xs leading-relaxed">
                  Co-ownership is recorded on-chain as an INFT. The sealed key
                  unwraps the model artifact for permitted owners.
                </p>
                <div className="space-y-1.5 pt-1">
                  <Field label="Token" value={snapshot.inft.tokenId} />
                  <Field
                    label="Owners"
                    value={`${snapshot.inft.ownersCount} co-owners`}
                  />
                  <Field
                    label="Sealed key"
                    value={
                      <code className="font-mono text-[11px]">
                        {snapshot.inft.sealedKeyId}
                      </code>
                    }
                  />
                </div>
                <CopyableHash value={snapshot.inft.txHash} label="Tx hash" />
              </Section>

              <Section
                title="Your conversion manifest"
                icon={<FileText className="h-4 w-4" />}
                badge={
                  <Badge outline className="text-[10px]">
                    {snapshot.manifest.rowsKept} kept · {snapshot.manifest.rowsDropped} dropped
                  </Badge>
                }
              >
                <p className="text-foreground-muted text-xs leading-relaxed">
                  How your raw file became training rows. Each transformation
                  is hashed so you can verify nothing else was added.
                </p>
                <CopyableHash
                  value={snapshot.manifest.rawFileHash}
                  label="Raw file"
                />
                <CopyableHash
                  value={snapshot.manifest.convertedJsonlHash}
                  label="JSONL"
                />
                <div className="pt-1">
                  <p className="text-foreground-subtle mb-1.5 text-[10px] tracking-wider uppercase">
                    Sample row hashes
                  </p>
                  <ul className="space-y-1">
                    {snapshot.manifest.sampleRowHashes.map((h, i) => (
                      <li
                        key={i}
                        className="text-foreground-muted bg-surface-muted/40 border-border rounded-[var(--radius-sm)] border px-2 py-1 font-mono text-[11px]"
                      >
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              </Section>

              <Section title="Provider logs" icon={<FileText className="h-4 w-4" />}>
                <ul className="space-y-2">
                  {snapshot.logs.map((log, i) => (
                    <LogLine key={i} log={log} />
                  ))}
                </ul>
              </Section>

              <p className="text-foreground-subtle px-1 pt-1 text-[11px] leading-relaxed">
                These values are deterministic per project for the demo. Real
                values arrive from the aggregator&apos;s attestation feed.
              </p>
            </>
          )}
        </DrawerBody>

        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary" size="sm">
              Close
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
