# FFE Frontend — Build Plan & Progress

Living doc tracking the frontend build. Companion to `proposed_ux_ui.md`
(rationale) and `designer_brief.md` (spec).

Update this file as commits land. Check off items as they ship.

---

## Stack

- **Next.js 15** (App Router) + **TypeScript** strict
- **Tailwind v4** + custom design tokens
- **shadcn/ui** primitives (Radix under the hood)
- **Framer Motion** for animation
- **Privy** for embedded wallets (email / Google first)
- **Zustand** (UI state) + **TanStack Query** (server state, polling)
- **Vercel AI SDK** for the Result Playground side-by-side streaming
- **Lucide** icons + custom SVGs for trust moments
- Fonts: **Geist Sans**, **Geist Mono**, **Instrument Serif** (display)

## Backend status

**Live bridge started.** The app now has server-side Next API routes that call
the real `@notmartin/ffe` SDK for `openSession()` and `submit()`. Project state
still uses the local browser cache as the UI store, but new projects carry a
real Coordinator `sessionId`, transaction hashes, and contribution receipts.

Current integration mode prefers `wallet-owner`: new projects created with a
connected Privy Ethereum wallet register that wallet as the Coordinator
participant, the server prepares encrypted 0G Storage payloads, and the browser
wallet signs `Coordinator.submit()`. If no wallet is available, the app falls
back to the earlier `server-proxy` mode. The next milestone is registering all
contributors with their own wallet/pubkey pair and adding a real project
indexer/API.

## Location

`frontend/` — added as a pnpm workspace package alongside `sdk`,
`aggregator`, `contracts`.

## Routes (planned)

```
/                         01 Landing
/new                      02 → 03 Template picker + wizard
/p/[id]                   04 Project dashboard (role-aware)
/p/[id]/contribute        05 Private Room (upload | rewrite)
/p/[id]/rejection         06 Rejection (modal over dashboard)
/p/[id]/must-pass         07 Owner-only
/p/[id]/result            08 Playground
/p/[id]/publish           09
/p/[id]/versions          10 Timeline
+ global <AdvancedDrawer/> 11
+ /_kitchen               component playground (dev only)
```

---

## Commit plan & progress

Legend: `[ ]` planned · `[x]` shipped · `[~]` in progress

### Phase 0 — Scaffold

- [x] 1. `chore: scaffold next.js 15 app with typescript, tailwind, and app router`
- [x] 2. `chore: clean tailwind globals, metadata, and remove boilerplate`
- [x] 3. `chore: add prettier, tailwind plugin, and editorconfig`
- [~] 4. `chore: tighten tsconfig and scaffold src directories`

### Phase 1 — Design tokens & typography

- [x] 5. `feat(theme): add instrument serif display font alongside geist`
- [x] 6. `feat(theme): define color tokens for friendly and technical surfaces`
- [x] 7. `feat(theme): add radius, shadow, motion, and width tokens`
- [x] 8. `feat(theme): wire dark mode and surface toggle via theme provider`

### Phase 2 — Primitive components

- [x] 9. `feat(ui): add button, input, textarea, and label primitives`
- [x] 10. `feat(ui): add card, separator, and badge primitives`
- [x] 11. `feat(ui): add dialog, sheet, and drawer primitives with motion`
- [x] 12. `feat(ui): add tabs, toggle, and tooltip primitives`
- [x] 13. `chore(ui): add /kitchen route to preview all primitives`

### Phase 3 — Domain components

- [x] 14. `feat(components): add trust badge with encryption pulse animation`
- [x] 15. `feat(components): add four-stage progress bar with liquid fill`
- [x] 16. `feat(components): add status chip with fixed color palette`
- [x] 17. `feat(components): add co-owner avatar stack with overflow`
- [x] 18. `feat(components): add data concierge finding row`
- [x] 19. `feat(components): add plain-english metric card`
- [x] 20. `feat(components): add side-by-side chat panel shell`

### Phase 4 — Auth & landing

- [x] 21. `feat(auth): add mock auth provider matching privy embedded-wallet shape`
- [x] 22. `feat(landing): build 01 landing page with headline and dual CTAs`
- [x] 23. `feat(auth): add sign-in dialog and AuthGate for landing CTAs`
- [x] 24. `feat(join): add /join invite redemption page`

### Phase 5 — Owner: project creation

- [x] 25. `feat(templates): seed template fixtures and types`
- [x] 26. `feat(templates): build 02 template picker grid`
- [x] 27. `feat(wizard): scaffold wizard shell and step 1 — goal input`
- [x] 28. `feat(wizard): add step 2 — invite list with role assignment`
- [x] 29. `feat(wizard): add step 3 — deadline picker with quick-pick presets`
- [x] 30. `feat(wizard): add step 4 — refundable deposit with advanced toggle`
- [x] 31. `feat(wizard): persist project, generate invite link, build /new/done`

### Phase 6 — Project dashboard

- [x] 32. `feat(dashboard): build 04 shell with role detection and demo seed`
- [x] 33. `feat(dashboard): wire progress bar with owner-only stage advance`
- [x] 34. `feat(dashboard): add contributor list with status chips and you tag`
- [x] 35. `feat(dashboard): add prominent "your next action" callout block`
- [x] 36. `feat(dashboard): add readiness checklist below progress bar`
- [x] 37. `feat(dashboard): add owner-only settings sheet with goal/deadline/stake/invite-link`
- [x] 38. `feat(dashboard): add sticky "you're up" banner when current user blocks progress`

### Phase 7 — Private contribution room

- [x] 39. `feat(contribute): build 05 private room shell with sidebar and tab switcher`
- [x] 40. `feat(contribute): add drag-and-drop upload zone with file-ready handoff`
- [x] 41. `feat(contribute): wire mock data concierge scan with findings list`
- [x] 42. `feat(contribute): add preview table with column-mapping confirmation`
- [x] 43. `feat(contribute): add encrypt → upload → submitted state machine`
- [x] 44. `feat(contribute): build 05b rewrite studio cards`
- [x] 45. `feat(contribute): add rewrite progress counter and target`
- [x] 46. `feat(contribute): wire rewrite studio with encrypt-and-submit-all`

### Phase 8 — Rejection handling

- [x] 47. `feat(rejection): build 06 plain-language rejection screen`
- [x] 48. `feat(rejection): add deposit-held messaging and resubmit path`
- [x] 49. `feat(rejection): add "switch to rewrite studio" inline fix`

### Phase 9 — Must-Pass Scenarios

- [x] 50. `feat(must-pass): build 07 owner-only scenarios screen`
- [x] 51. `feat(must-pass): add minimum-3 validation and pass/fail chips`

### Phase 10 — Result Playground

- [x] 52. `feat(result): build 08 side-by-side chat panel with shared input`
- [x] 53. `feat(result): add streaming responses via vercel ai sdk`
- [x] 54. `feat(result): add left/right/neither voting buttons`
- [x] 55. `feat(result): add structured feedback tag chips`
- [x] 56. `feat(result): add plain-english metrics card`
- [x] 57. `feat(result): add must-pass scenario result strip`
- [x] 58. `feat(result): add co-owner avatar row`

### Phase 11 — Publish & versions

- [x] 59. `feat(publish): build 09 publish-or-rerun screen`
- [x] 60. `feat(publish): gate publish on must-pass with explicit override`
- [x] 61. `feat(publish): add personal-receipt success state per contributor`
- [x] 62. `feat(versions): build 10 vertical version timeline`
- [x] 63. `feat(versions): add expandable row with try / rollback actions`

### Phase 12 — Advanced drawer

- [x] 64. `feat(advanced): build 11 slide-out drawer shell`
- [x] 65. `feat(advanced): wire tee attestation and code hash section`
- [x] 66. `feat(advanced): add storage root hashes and inft record section`
- [x] 67. `feat(advanced): add conversion manifest viewer`

### Phase 13 — Notifications & deep links

- [x] 68. `feat(notify): add resumable deep-link routes per stage`
- [x] 69. `feat(notify): add email transition templates`

### Phase 14 — Responsive & polish

- [x] 70. `feat(mobile): make dashboard, playground, and notifications responsive`
- [x] 71. `feat(motion): polish wizard transitions and stage advance`
- [x] 72. `feat(motion): add confetti-once on publish success`
- [x] 73. `chore: lighthouse and a11y pass`

### Phase 15 — Real FFE integration

- [x] 74. `feat(ffe): add server-side sdk bridge config and api contracts`
- [x] 75. `feat(ffe): create Coordinator sessions from the setup wizard`
- [x] 76. `feat(ffe): submit upload data through FFE.submit and store receipts`
- [x] 77. `feat(ffe): poll Coordinator/INFT state instead of relying on local cache`
- [x] 78. `feat(ffe): submit Coordinator transactions with connected wallet`
- [ ] 79. `feat(ffe): add download/playground flow for minted INFT artifacts`
- [ ] 80. `feat(ffe): register invited contributors with wallet/pubkey pairs`

---

## Check-in cadence

**First check-in: after commit 22 (~30%).** Reached. ✅
Next planned pause: after commit 46 (Private Room complete).

## Notes

- No `Co-Authored-By` trailers on any commit.
- Each commit pushes to `origin/main` once green locally.
- Mock data lives in `frontend/src/lib/mock/`. All mock access goes
  through a single `dataClient` so the swap to real APIs is one file.
