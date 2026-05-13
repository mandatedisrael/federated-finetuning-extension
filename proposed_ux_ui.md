# FFE — Proposed UX/UI Direction

How to make collaborative fine-tuning feel approachable for non-technical
users. The core challenge: "fine-tuning" is jargon, and "collaborative"
adds coordination overhead. Hide both.

---

## The core product bet

People are not trying to *"fine-tune a model collaboratively."*
They are trying to **teach a shared assistant, with other people, safely.**

Frame the product as a **teaching workspace**, not a fine-tuning
dashboard. Most non-technical users do not want to think in datasets,
epochs, or JSONL. They want to say: *"This answer is good," "this one
is wrong," "answer more like this," "use our tone."* The frontend should
let them do exactly that, and quietly turn it into training data behind
the scenes.

The mechanism (multi-party fine-tuning, TEE, INFT) stays load-bearing —
we hide the *word* "fine-tune," not the actual machinery, because the
on-chain trust model depends on it.

> **Guiding rule: Do not hide trust. Hide jargon.**
> The main UI says *"Your data is encrypted before upload,"*
> *"Other contributors cannot see your files,"* *"The shared result is
> co-owned by contributors."* The advanced drawer holds TEE attestation
> quotes, storage root hashes, INFT record, sealed keys, provider logs,
> and LoRA details — present, never primary.

---

## Three nouns, not five

Collapse the user's mental model from the technical stack
(`session / quorum / aggregator / LoRA / sealed key`) to three plain
nouns:

1. **Project** — a shared effort with a name, goal, and invited
   collaborators.
2. **Contribution** — a private upload from each person, with a clear
   status: *uploaded → validated → included*.
3. **Result** — the improved assistant everyone can use, with a
   "before / after" comparison.

Words to keep out of the main flow: `LoRA`, `quorum`, `sealed key`,
`aggregator`, `epoch`, `loss`, and probably even `fine-tune` for the
community / consumer surface. Keep them available for the enterprise
and research surfaces — those users *want* the technical vocabulary as a
signal of competence (see "Two vocabularies" below).

Every screen should answer one plain-language question:
*What is this? What do I do next? Is my data safe? Who is waiting on me?*

---

## Roles (v1: two, not three)

- **Owner** — creates the project, invites people, decides when to
  publish the result.
- **Contributor** — uploads private examples and tracks status.

A `Reviewer` role (separate person who approves the result) is
tempting but premature for v1: it doesn't map to anything in the
contract, there's no on-chain reviewer concept, and it adds a gate the
demo doesn't need. Revisit in v2 alongside versioned runs.

Most contributors should never see project creation, stake
configuration, or the model card editor. Surface only the actions
relevant to the active role.

---

## Mental model to steal: Google Docs, not Colab

- A **Project** is a shared document with a link. The owner picks a goal
  in plain English ("a model that writes support replies in our voice"),
  invites others by email / wallet, sets a deadline.
- Invited contributors land on a single screen: *"Drop your files here."*
- Status is one progress bar with human stages:
  *Waiting for contributors → Checking data quality → Training → Ready.*
  No epoch counters, no loss curves on the main view — those live in an
  "Advanced" drawer for the users who ask for them.

---

## Onboarding non-technical contributors

Two input paths, depending on how the contributor's data exists today:

**Path A — bulk upload.** Drag-and-drop CSV / JSONL / PDF /
chat-export. Auto-detect the format, show a 3-row preview, let the
user confirm *"this column is the question, this is the answer."*
Most people have data in the wrong shape — the UI should fix it for
them, not reject it.

**Path B — Rewrite Studio.** For users who don't have a pre-formed
dataset, give them a screen that shows:

> *User asked:* X
> *Assistant replied:* Y
> *Ideal answer should be:* Z _(editable)_

This is the most intuitive way for non-technical users to produce
training data: they're just correcting bad answers into good ones,
which is something they already do mentally. The app silently turns
each accepted rewrite into a training example.

Both paths feed the same private contribution — Rewrite Studio entries
are still encrypted to the aggregator and never visible to other
contributors.

### Data Concierge
Non-technical users rarely arrive with clean JSONL. The system has to
do the cleanup work *for* them, in plain language, before encryption:

> *"Looks like these are customer questions and ideal replies.*
> *We found **143 usable examples**, **18 duplicates**, and*
> ***7 examples that may contain private info** (emails, phone*
> *numbers, what look like account IDs).*
> *Want me to redact those, drop them, or include them as-is?"*

Pre-submit checks the Concierge should run, all client-side before
encryption:

- Format / schema detection and conversion.
- Duplicate detection.
- Minimum-coverage check ("you have 12 examples; this template
  recommends at least 50").
- PII / privacy-leak detection — emails, phone numbers, anything that
  looks like a credential or account ID — with one-click redact.
- Template-specific quality checks (e.g., for "support tone": flag
  examples where the reply is shorter than the question).

The Concierge protects the user from two bad outcomes at once: being
silently rejected by the Quality Gate later, *and* accidentally
uploading sensitive data they didn't notice.

### Where the conversion runs

The aggregator only trains on JSONL, but contributors can upload any
file type. The format conversion (PDF → text → Q&A pairs, CSV → JSONL,
chat export → turns, paste-blob → examples) has to happen *somewhere* —
and *where* is a privacy-critical design decision, not a detail.

**Chosen approach: conversion runs inside the aggregator TEE**, in the
same enclave that decrypts and trains. The contributor encrypts the
raw file to the TEE pubkey; the TEE decrypts, normalises to JSONL,
runs the Quality Gate, and trains. Deterministic parsers (PDF text
extraction, CSV column mapping, chat-export turn-splitting) handle
most files; an in-enclave LLM is the fallback for genuinely
unstructured input like pasted notes.

**Why this fits FFE specifically**

- Trust boundary unchanged. Plaintext only ever exists inside the
  attested enclave — the property everything else depends on.
- The conversion logic is attested *in the same code hash* as the
  training logic. Contributors verify both at once, with one
  attestation check.
- No BYOK friction, no in-browser model weights, no third-party API
  keys to manage.
- The TEE emits a signed conversion manifest
  (`raw_file_hash → converted_jsonl_hash`, sample row hashes) so the
  on-chain chain of custody stays intact.

**Two design notes that drop out of this choice**

- **Preview vs. receipt.** A contributor who uploads a PDF never sees
  the 143 Q&A pairs the TEE extracted. Default to a *one-phase + signed
  manifest receipt* ("we extracted N pairs, here's a sample of 5") for
  deterministic conversions where the result is predictable. Offer
  *two-phase preview* (TEE converts → returns an encrypted-to-contributor
  preview → contributor confirms → TEE trains) for templates where an
  in-enclave LLM is doing most of the conversion work.
- **Quality Gate becomes the safety net.** A bad conversion produces
  bad Q&A pairs, which the Layer-2 mini-LoRA check filters out
  automatically. The rejection-handling UX has to distinguish *"your
  data was low quality"* from *"the conversion of your data was poor —
  try uploading a cleaner source file or switching to bulk upload."*

**Rejected alternatives** (kept here so they don't get re-introduced):

- *Server-side conversion via a third-party LLM API.* Ships raw private
  data to a third party before encryption to the aggregator. Breaks
  the trust model entirely. Not acceptable.
- *Browser-side LLM (WebGPU / Transformers.js).* Privacy story stays
  clean, but quality ceiling is low and the install footprint is
  heavy. Possible v3 surface, not v1.
- *BYOK to OpenAI / Anthropic from the browser.* Honest about the
  trust boundary ("your data goes to OpenAI, you chose this") but adds
  friction for the exact users this product is for.

**One small commit-format change this implies.** Today the on-chain
hash commit binds the contributor to a specific JSONL hash. With
TEE-side conversion, the contributor commits to the raw-file hash, and
the TEE attests `raw_file_hash → converted_jsonl_hash` as part of the
training attestation. The contract and SDK need to accept the new
commit type. Worth flagging on the build plan.

### TEE platform: 0G Tapp

**Pick: [0G Tapp](https://github.com/0gfoundation/0g-tapp).** It's the
only off-the-shelf option that fits FFE without major workarounds, and
it's already wired into the rest of the 0G stack (Storage, Chain,
INFT) that the design depends on.

**Why it fits**

- **Confidential GPU support.** Tapp ships a confidential GPU image
  (`0g-tapp-confidential-gpu.qcow2`) running on Alibaba
  `ecs.gn8v-tee.4xlarge` — Intel TDX + NVIDIA Confidential Computing.
  Most TEEs (SGX especially) don't support GPU, which makes them
  unusable for LoRA training. Without GPU-in-TEE, FFE doesn't ship.
- **Docker-compose deploy.** The aggregator (decrypt → Quality Gate →
  convert → train → encrypt) ships as a normal containerised service.
  No raw enclave SDK plumbing.
- **Built-in attestation primitives.** Runtime measurement +
  EVM-compatible signature auth maps directly to FFE's flow:
  contributors verify the published code hash before encrypting to the
  aggregator pubkey.
- **Reproducible builds** directory in the repo — contributors can
  verify the running enclave matches the published source.

**Cost-effectiveness**

`gn8v-tee.4xlarge` runs roughly $5–10/hr on-demand. A demo session is
~30–60 min training, so a single run sits in the $3–10 range. Quality
Gate + TEE-side conversion adds maybe 10–15% overhead vs. plain
training — negligible. At production scale, per-session cost can
plausibly be funded by contributors' stakes; for the hackathon it's
trivial.

**Rejected alternatives**

- Roll your own on raw Intel TDX + NVIDIA CC bare metal — more work,
  no 0G integration, no nearby INFT primitives.
- Azure Confidential GPU VMs or GCP Confidential GKE — comparable
  underlying tech, but the attestation → on-chain bridge would need to
  be built from scratch.
- Phala / Marlin / Oasis — generally CPU-only or weaker GPU support.

### Private Contribution Rooms
Architectural framing that makes the privacy story legible:

- Each contributor has their own **Private Room** — upload, preview,
  Rewrite Studio, Data Concierge, fix-and-resubmit. Only they see it.
- The **shared Project page** only shows safe metadata:
  *"Alice submitted 48 examples — passed checks — included in*
  *training."* No raw examples, no rewrites, no previews leak across
  contributors.
- This is the screen-level analogue of the cryptographic story: private
  data lives in a private room; only aggregates and outcomes are
  shared.


- **Wallet friction is the real killer.** Use embedded wallets
  (Privy / Dynamic) so contributors sign in with email or Google and
  staking + signing happen behind a single "Join project" button.
- Show stake as **"$5 refundable deposit"**, not `MIN_STAKE` wei.
- Invite by **link, email, or wallet** — never require a contributor to
  understand wallets before they can participate.

---

## Make privacy legible

- Visible indicator: *"Your data never leaves your browser unencrypted."*
  Click expands to the TEE attestation proof. Most users won't click —
  but the badge being there is the trust signal.
- Show what others see, explicitly:
  > Alice and Bob can see: **nothing.**
  > They can use: **the final model.**
- Clear lifecycle states per contribution: *uploaded → encrypted →
  waiting for others → training → included in result.*
- After training, every contributor gets a personal receipt:
  > **"Your data was included in this shared improvement."**
- Technical proofs (attestation quotes, code hashes, signed certificates)
  live behind a *"View details"* layer for power users — present but
  never in the main path.

---

## Designing the scary moments

These are the UX moments where non-technical users will bounce. Both are
under-designed in most ML tooling and need first-class screens.

### Rejection by the Quality Gate
When a contributor's data is filtered out, this is the scariest moment
in the flow — their stake is at risk and they don't know why. Treat the
first rejection as **coaching, not punishment**:

- Plain-language reason: *"Your examples were too similar to each
  other,"* or *"Format didn't match — we expected Q&A pairs."*
- Concrete fix-it path: re-upload before slashing kicks in.
- Status of their stake, visibly: *"Held — will be refunded if you
  resubmit by 4pm,"* not silently slashed.
- Slashing-on-first-offense will lose every non-technical user
  permanently. Reserve real slashing for repeat or malicious behavior.

### The asynchronous wait
Training takes 30+ minutes (per the `idea.md` timeline). Most
contributors will close the tab. The notification design matters as
much as the in-app screens:

- Email + (optional) wallet push when the project transitions stages.
- A "you're up" notification when the project is blocked on this
  specific contributor.
- Resumable deep links — clicking the email lands them exactly where
  they left off, no re-navigation.

---

## The "after" moment

The wow moment has to live inside the app, not in *"now run this
Python."*

- **Side-by-side playground.** Same prompt, old model on the left,
  trained model on the right. Contributors vote *"Left better / Right
  better / Neither."* Makes evaluation collaborative without making it
  technical, and the votes are useful signal for the next run.
- **Plain-English metrics**, not loss curves:
  > *"Won 78% of comparisons against the previous version."*
  > *"Improved refund-policy answers."*
  > *"Regressed on cancellation questions — needs review before launch."*
- Co-ownership shown as faces / avatars on the result card, like a
  shared Figma file. Social proof *is* the product.
- Structured feedback after the run: *"More accurate," "Too generic,"
  "Missed our tone," "Needs more examples from the support team."*
  Feeds into the next run.

### Golden Test Set ("Must-Pass Scenarios")
Give projects a section for prompts the assistant *must* always handle
well — set once by the owner, run automatically before any result is
published. This is the UX surface for the post-training validation
backstop already specced in `idea.md` (Layer 3). If a new version
regresses on Must-Pass Scenarios, the publish button is blocked and the
regressions are shown in plain language.

### Version Timeline
Every published result is a version, and every change is reversible:

> *Version 12 — Improved refund-policy answers*
> *Version 13 — Adjusted tone for enterprise users*
> *Version 14 — Added objection-handling examples*

With rollback, comments, who approved it, and Must-Pass Scenario
results attached. Designed-for in v1 even though only v2 ships the
multi-round flow.

---

## Templates over blank slate

Non-technical users should start by *cloning*, not configuring.
Pre-built project templates, each with the right base model, an example
data schema, and a sample dataset preloaded:

- *"Customer support tone"* ← **recommended v1 default**
- *"Code review style"*
- *"Medical notes summarizer"*

Picking a template skips three quarters of the setup wizard.

**Why Customer Support Assistant is the right first template.** The
mental model is obvious to anyone — *"make the AI answer like our best
support people."* It maps naturally onto the data formats users
actually have (CSV exports, chat logs, ticket dumps), produces an
intuitive good/bad distinction for the Rewrite Studio, and gives a
clean before/after demo in the Result Playground (tone, accuracy,
policy adherence). Best fit for the hackathon demo video.

---

## Two vocabularies, one product

The use cases in `idea.md` span very different audiences — trading
desks, hospitals, pharma consortia on one end; community data co-ops and
hackathon demos on the other. The technical surface should flex:

- **Friendly surface** (community templates, demo flow): *"Improve the
  AI together," "shared project," "contribution."*
- **Technical surface** (enterprise / regulated): *"Federated
  fine-tuning session," "joint LoRA," "attested aggregator."* These
  users *want* the technical vocabulary as a competence signal.

Same product, different copy. Toggle by template / org context, not by
a user setting.

---

## Recommended frontend shape

Combine two patterns:

- **Typeform-style guided flow** for the *first* project creation and
  *first* contributor onboarding. Great for getting one project launched
  with zero friction. Don't use it for repeat actions — wizards get
  painful by the third project.
- **Notion-like shared workspace** for the ongoing dashboard: who's
  joined, who's uploaded, what stage the run is in, what's blocking
  progress. Familiar, collaborative, low-fear.

A `Linear-like operational dashboard` is the right shape *eventually*
(many runs, many stakeholders, ongoing pipeline) but it's intimidating
for first-time users. Defer until there's repeat usage to optimise for.

---

## Concrete screens that matter most

1. **New Project** — *"What do you want the AI to get better at?"*
2. **Invite People** — link / email / wallet, with role pre-set.
3. **Contribution Guide** — simple examples of good training data, with
   a downloadable sample.
4. **Upload** — drag-and-drop with auto-detect and preview.
5. **Project Status** — readiness checklist (*"3 of 5 contributors
   uploaded, evaluation set missing"*), per-contributor state.
6. **Rejection Handling** — plain-language reason, fix-it path, stake
   status.
7. **Result** — before / after samples, "Try the model" chat, co-owner
   avatars.
8. **Publish or Re-run** — decide whether to accept this version or
   iterate.

---

## What to avoid

- A raw training-job dashboard as the home screen.
- Exposing model / config parameters in the default flow.
- Making users think they need to understand crypto to participate.
- Dense metrics tables before showing outcome quality.
- One giant "upload data and pray" flow with no collaboration
  visibility.
- Treating the first failed contribution as a slashable offence.

### Patterns from generic teaching-workspace products that *don't* fit FFE

Worth naming explicitly so they don't get re-introduced later:

- **Shared review inbox of contributed examples.** Standard pattern in
  single-team AI tools, but in FFE it's a privacy violation —
  contributors never see each other's data. Apply the queue / voting
  pattern to *outputs* (side-by-side playground), not inputs.
- **Collaborative rewrites of the same example.** Same reason — no
  shared input pool exists across contributors.
- **System letting the AI silently choose prompt-tuning or RAG instead
  of fine-tuning.** Good general-product advice, wrong product for us.
  FFE's value lives in the on-chain fine-tuning mechanism (stake,
  attestation, INFT, sealed keys). If the system picks a different
  lever, none of that fires.
- **Tone / behavior sliders as a primary surface.** That's a
  system-prompt UX, not a fine-tuning UX. Different lever. Possible v3
  surface, not v1.

---

## Two big tradeoffs to decide early

### 1. Embedded wallet vs. real wallet
Embedded ≈ 10× adoption, but weakens the *"you own the model"* story
since key custody is softer. Probably worth it for v1, with an "export
to real wallet" upgrade path.

### 2. In-browser upload vs. desktop helper
Browser is friction-free but limits dataset size and slows client-side
encryption. A small desktop helper (or a CLI fallback shown only when
files are big) gets both, at the cost of a second install target.

---

## Open questions

- How do we surface stake / refund / slashing without scaring off
  first-time users? Probably hide entirely until they hit "Join."
- Mobile contributor flow — submit-only, no project creation? Likely
  yes for v1.
- Minimum viable identity for an invited contributor who doesn't have a
  wallet yet? Email magic link → embedded wallet on first contribution
  is probably cleanest.
- Versioned runs (Run 1 vs Run 2 comparison) — design the data model
  for it in v1 even though only v2 ships the second-run flow.
