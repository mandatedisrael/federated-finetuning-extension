"use client";

import { Heart, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Label } from "@/components/ui/Label";
import { Badge } from "@/components/ui/Badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/Card";
import { Separator } from "@/components/ui/Separator";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/Dialog";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
} from "@/components/ui/Sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Toggle } from "@/components/ui/Toggle";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/Tooltip";
import { useTheme } from "@/lib/theme/ThemeProvider";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="font-serif text-2xl tracking-tight">{title}</h2>
      <div className="border-border bg-surface flex flex-wrap items-start gap-4 rounded-[var(--radius-lg)] border p-6">
        {children}
      </div>
    </section>
  );
}

export default function KitchenPage() {
  const { theme, surface, setTheme, setSurface } = useTheme();

  return (
    <TooltipProvider delayDuration={150}>
      <main className="mx-auto w-full max-w-5xl px-6 py-16">
        <header className="mb-12">
          <p className="text-foreground-subtle mb-3 text-xs tracking-[0.18em] uppercase">
            Component playground
          </p>
          <h1 className="font-serif text-5xl tracking-tight">Kitchen</h1>
          <p className="text-foreground-muted mt-3 max-w-prose">
            Every primitive in one place. Toggle theme + surface to see how tokens flex.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Label className="text-foreground-subtle text-xs tracking-widest uppercase">
              Theme
            </Label>
            <div className="flex items-center gap-1">
              {(["light", "dark", "system"] as const).map((t) => (
                <Toggle key={t} size="sm" pressed={theme === t} onPressedChange={() => setTheme(t)}>
                  {t}
                </Toggle>
              ))}
            </div>
            <Separator orientation="vertical" className="mx-2 h-5" />
            <Label className="text-foreground-subtle text-xs tracking-widest uppercase">
              Surface
            </Label>
            <div className="flex items-center gap-1">
              {(["friendly", "technical"] as const).map((s) => (
                <Toggle
                  key={s}
                  size="sm"
                  pressed={surface === s}
                  onPressedChange={() => setSurface(s)}
                >
                  {s}
                </Toggle>
              ))}
            </div>
          </div>
        </header>

        <div className="space-y-10">
          <Section title="Buttons">
            <Button>Create project</Button>
            <Button variant="secondary">I have an invite</Button>
            <Button variant="ghost">Skip for now</Button>
            <Button variant="link">Learn more</Button>
            <Button variant="danger">Reject contribution</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">
              <Sparkles className="h-4 w-4" />
              Try the new version
            </Button>
            <Button disabled>Disabled</Button>
          </Section>

          <Section title="Inputs">
            <div className="w-full max-w-sm space-y-3">
              <Label htmlFor="goal">What should the AI get better at?</Label>
              <Input id="goal" placeholder="e.g. write support replies in our voice" />
            </div>
            <div className="w-full max-w-sm space-y-3">
              <Label htmlFor="ideal">Ideal answer</Label>
              <Textarea
                id="ideal"
                placeholder="Write the response you wish the assistant had given…"
              />
            </div>
          </Section>

          <Section title="Badges">
            <Badge>Not started</Badge>
            <Badge tone="info">Uploaded</Badge>
            <Badge tone="success">Included</Badge>
            <Badge tone="warning">Needs attention</Badge>
            <Badge tone="danger">Rejected</Badge>
            <Badge tone="trust">
              <Lock className="h-3 w-3" />
              Encrypted
            </Badge>
            <Badge tone="accent" outline>
              Owner
            </Badge>
          </Section>

          <Section title="Card">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Customer Support Assistant</CardTitle>
                <CardDescription>
                  Teach the AI to answer like your best support people. Recommended for 3–8
                  contributors.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-foreground-muted text-sm">
                  Example formats: CSV exports, chat logs, ticket dumps.
                </p>
              </CardContent>
              <CardFooter>
                <Button>Start from this template</Button>
                <Button variant="ghost">Preview data</Button>
              </CardFooter>
            </Card>
          </Section>

          <Section title="Dialog & Sheet">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">Open dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Some examples need attention</DialogTitle>
                  <DialogDescription>
                    Deposits are planned for later. For now, contributors can just fix and resubmit.
                  </DialogDescription>
                </DialogHeader>
                <p className="text-foreground-muted text-sm">
                  Format didn&apos;t match expected Q&amp;A pairs. Fix the export and resubmit when
                  you&apos;re ready.
                </p>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="ghost">Close</Button>
                  </DialogClose>
                  <Button>Resubmit</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="secondary">
                  <Lock className="h-4 w-4" />
                  View encryption details
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Advanced — encryption details</SheetTitle>
                  <SheetDescription>
                    Attestation, code hash, and conversion manifest.
                  </SheetDescription>
                </SheetHeader>
                <SheetBody>
                  <div className="border-border bg-surface-muted rounded-[var(--radius-md)] border p-3 font-mono text-xs">
                    code_hash:
                    <br />
                    0x9f4a8c12…d7e3
                  </div>
                </SheetBody>
              </SheetContent>
            </Sheet>
          </Section>

          <Section title="Tabs">
            <Tabs defaultValue="upload" className="w-full max-w-md">
              <TabsList>
                <TabsTrigger value="upload">Upload files</TabsTrigger>
                <TabsTrigger value="rewrite">Rewrite examples</TabsTrigger>
              </TabsList>
              <TabsContent value="upload">
                <p className="text-foreground-muted text-sm">
                  Drag-and-drop CSV, JSONL, PDF, or chat exports.
                </p>
              </TabsContent>
              <TabsContent value="rewrite">
                <p className="text-foreground-muted text-sm">
                  Correct bad assistant answers into good ones.
                </p>
              </TabsContent>
            </Tabs>
          </Section>

          <Section title="Tooltip">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Like">
                  <Heart className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>This answer was helpful</TooltipContent>
            </Tooltip>
          </Section>
        </div>
      </main>
    </TooltipProvider>
  );
}
