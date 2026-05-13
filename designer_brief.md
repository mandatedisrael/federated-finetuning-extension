# FFE — Designer Brief

For the designer (AI agent). Companion to `proposed_ux_ui.md` — read that
for rationale, this for the spec.

---

## Product in one line

A web app where multiple people privately contribute training data to
teach a shared AI assistant, then jointly approve the result.

## Users / roles

- **Owner** — creates the project, invites people, picks the goal, sets
  Must-Pass Scenarios, publishes the result.
- **Contributor** — joins by invite, uploads private data, votes on the
  result.

Most contributors never see Owner-only screens.

## Vocabulary

- Use: **project, contribution, result, teach, improve, encrypted,
  shared, co-owned.**
- Do not use in the main UI: **fine-tune, LoRA, quorum, aggregator,
  sealed key, epoch, loss, JSONL.** These belong in an Advanced drawer
  only.

## Auth model

Email or Google sign-in (embedded wallet handled in the background).
Never show a wallet-connect prompt as the first step.

---

## Screen list

Number = stable ID for the designer's file structure.

### 01. Landing / Sign-in
- Headline: "Teach a shared AI, privately, with other people."
- Two CTAs: **Create a project**, **I have an invite link**.
- Email / Google sign-in. No wallet UI.

### 02. Template Picker (Owner, new project)
- Grid of templates. Each card: name, one-sentence goal, example data
  format, "recommended for X people."
- Templates: **Customer Support Assistant** (default), Code Review
  Style, Medical Notes Summarizer.
- CTA: **Start from this template**. Secondary: **Start from scratch**.

### 03. New Project Wizard (Owner)
Typeform-style, 4 steps:
1. **Goal** — text field: "What should this AI get better at?"
2. **Invite people** — list of email addresses or wallet addresses;
   each row has a role (Contributor by default).
3. **Deadline** — date picker.
4. **Stake** — "Each contributor will deposit $5, refundable when they
   submit valid data." Editable amount, hidden behind "Advanced."

End state: shareable invite link + "Project created."

### 04. Project Dashboard (Owner + Contributor, role-aware)
Single page. Top to bottom:

- Project title + goal in plain English.
- **Progress bar** with 4 stages: *Waiting for contributors → Checking
  data quality → Training → Ready.* Highlight current stage.
- **Contributor list.** Each row: avatar, name, status chip
  (*Not started / Uploaded / Validated / Included / Rejected*),
  number of examples submitted. No raw data, no previews.
- **"You" row** highlighted. Shows the Contributor's own next action.
- **Readiness checklist** below the bar: "3 of 5 contributors uploaded,"
  "Must-Pass Scenarios set," "Deadline in 2 days."
- Owner-only: edit goal, edit deadline, manage invites, set Must-Pass
  Scenarios.
- Footer: small **Trust badge** ("Your data is encrypted before
  upload — view details") that opens the Advanced drawer.

### 05. Private Contribution Room (Contributor)
Only the contributor sees this. Two tabs:

- **Upload files** (default)
- **Rewrite examples**

Persistent sidebar shows: contribution status, deposit status, deadline,
"return to project."

### 05a. Upload Files tab
- Drag-and-drop zone. Accepts any file (CSV, JSONL, PDF, TXT, chat
  exports, .docx, .zip of any of the above).
- After drop: **Data Concierge** report appears below the zone:
  > "We found **143 usable examples**, **18 duplicates**, and
  > **7 examples that may contain private info** (emails, phone
  > numbers, account IDs)."
- Each finding has an inline action: **Redact**, **Drop**, **Keep**.
- Below: **Preview table** (first 5 rows after conversion) with
  "this is the question / this is the answer" column confirmation.
- CTA: **Encrypt and submit**. State during submission: "Encrypting
  locally → Uploading → Submitted."

### 05b. Rewrite Examples tab
- Three-row card layout, one card per example:
  - "**User asked:**" (read-only)
  - "**Assistant replied:**" (read-only, current model output)
  - "**Ideal answer:**" (editable text area)
- Buttons per card: **Save**, **Skip**, **Flag as unsafe**.
- Counter at top: "12 of recommended 50 examples." Progress bar.
- CTA at bottom: **Encrypt and submit all**.

### 06. Rejection Handling (Contributor)
Triggered when Quality Gate filters the contributor's data.

- Title: "Some of your examples need attention."
- Plain-language reason per issue: "Examples were too similar,"
  "Format didn't match expected Q&A," "Conversion from your PDF
  produced low-quality pairs — try uploading a cleaner source."
- Deposit status: "Held — fully refundable if you resubmit by
  [deadline]." Never "slashed" on first rejection.
- Inline fix: **Resubmit with changes**, **Switch to Rewrite Studio**.

### 07. Must-Pass Scenarios (Owner)
- List of prompts the assistant must always handle well.
- Each row: prompt text, expected behavior (free text), pass/fail
  result after training.
- Add / edit / remove. Minimum 3 to publish.
- Helper copy: "These are the test cases your trained model must
  pass. If it fails any, you'll have to review before publishing."

### 08. Result Playground (everyone, when training completes)
- Headline: "Try the new version."
- **Side-by-side chat panel**: left = current model, right = new model.
  Same prompt input box drives both.
- After each comparison, three buttons: **Left better**, **Right
  better**, **Neither**.
- Optional feedback tags after voting: *more accurate, too generic,
  wrong tone, missed policy, better tone, more concise.*
- Plain-English metrics card next to the chat:
  > "Won 78% of comparisons against the previous version."
  > "Improved refund-policy answers."
  > "Regressed on cancellation questions — needs review."
- **Must-Pass Scenarios result strip**: each scenario as a chip,
  green tick or red cross.
- Co-owner avatar row at the top: "Trained by Alice, Bob, Carol."

### 09. Publish or Re-run (Owner)
- Two large CTAs: **Publish this version**, **Run another round**.
- Publish disabled until all Must-Pass Scenarios pass (or Owner
  explicitly overrides with a checkbox).
- After publish: success state with personal receipt for every
  contributor:
  > "Your data was included in this shared improvement."

### 10. Version Timeline (everyone)
- Vertical list of versions, newest at top:
  > **Version 3** — "Improved refund-policy answers" — published
  > by Alice — 2 days ago — Must-Pass: 5/5 pass.
- Each row expandable: contributors, vote results, "Try this
  version," "Roll back to this version" (Owner-only).

### 11. Advanced Drawer (everyone, opt-in)
Slide-out panel, opened from any Trust badge or footer.
Contents:
- TEE attestation quote + code hash.
- Storage root hashes.
- INFT record + sealed-key info.
- Conversion manifest for the user's own contribution
  (`raw_file_hash → converted_jsonl_hash`, sample rows hashed).
- Provider logs.

Never required for the main flow. Power-user surface.

### 12. Notification surfaces
- **In-app banner** at the top of the dashboard when the current user
  is blocking progress: "You're up — 2 days left to contribute."
- **Email** for stage transitions: invite, "you're up," training
  started, result ready, version published.
- Each email contains a resumable deep link that lands directly on
  the relevant screen.

---

## Global UI elements

- **Trust badge.** Small lock icon + text "Your data is encrypted
  before upload." Always visible, always opens the Advanced Drawer.
- **Progress bar** uses the same 4-stage labels everywhere.
- **Status chips** use a fixed colour palette: grey (not started),
  blue (in progress), green (success), amber (needs attention),
  red (rejected — only after appeal window).
- **Co-owner avatars** render as a stack with up to 5 visible, "+N"
  overflow.

## States to design for every screen

- Empty state (no data yet).
- Loading state.
- Error state (network, encryption, upload failure).
- Success state.
- Role-restricted state (Contributor sees Owner-only screen).

## Responsive

- Desktop-first. Mobile must support: viewing dashboard, voting in
  Result Playground, receiving notifications. Mobile contributors
  **cannot** create projects or upload large files in v1.

## Out of scope for v1

- Reviewer role.
- Comment threads.
- Tone / behavior sliders.
- Shared editing of contributions.
- Multi-language UI.

---

## Deliverables expected from the designer

1. Hi-fi mockups for screens **01–12** above, desktop.
2. Mobile mockups for screens **04, 08, 12**.
3. All five states (empty, loading, error, success, role-restricted)
   for screens **04, 05a, 05b, 06, 08**.
4. Component library: Trust badge, progress bar, status chip,
   co-owner avatar stack, Data Concierge finding row, side-by-side
   chat panel, plain-English metric card.
5. One end-to-end happy-path flow as a clickable prototype:
   Owner creates project → Contributor uploads → training completes
   → everyone votes → Owner publishes.
6. Two visual styles to choose from, tested against the **friendly
   surface** copy (community templates). Enterprise / technical
   surface skinning can come later.
