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

**Mocked for now.** All data comes from in-memory fixtures / mock API
routes. Will swap to the real `aggregator/` + `sdk/` packages later.
Designed with a clean data layer so the swap is isolated.

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
- [ ] 5. `feat(theme): add geist sans, geist mono, and instrument serif via next/font`
- [ ] 6. `feat(theme): define color tokens for friendly and technical surfaces`
- [ ] 7. `feat(theme): add spacing, radius, and motion tokens`
- [ ] 8. `feat(theme): wire dark mode with css variables`

### Phase 2 — Primitive components
- [ ] 9. `feat(ui): add button, input, textarea, and label primitives`
- [ ] 10. `feat(ui): add card, separator, and badge primitives`
- [ ] 11. `feat(ui): add dialog, sheet, and drawer primitives`
- [ ] 12. `feat(ui): add tabs, toggle, and tooltip primitives`
- [ ] 13. `chore(ui): add /_kitchen route to preview all primitives`

### Phase 3 — Domain components
- [ ] 14. `feat(components): add trust badge with encryption pulse animation`
- [ ] 15. `feat(components): add four-stage progress bar with liquid fill`
- [ ] 16. `feat(components): add status chip with fixed color palette`
- [ ] 17. `feat(components): add co-owner avatar stack with overflow`
- [ ] 18. `feat(components): add data concierge finding row`
- [ ] 19. `feat(components): add plain-english metric card`
- [ ] 20. `feat(components): add side-by-side chat panel shell`

### Phase 4 — Auth & landing
- [ ] 21. `feat(auth): add privy provider and embedded wallet shell`
- [ ] 22. `feat(landing): build 01 landing page with headline and dual CTAs`
- [ ] 23. `feat(landing): add email and google sign-in flow`
- [ ] 24. `feat(landing): add invite link redemption route`

### Phase 5 — Owner: project creation
- [ ] 25. `feat(templates): build 02 template picker grid`
- [ ] 26. `feat(templates): seed customer support, code review, medical notes templates`
- [ ] 27. `feat(wizard): build 03 step 1 — goal input with typeform transitions`
- [ ] 28. `feat(wizard): build 03 step 2 — invite list with role assignment`
- [ ] 29. `feat(wizard): build 03 step 3 — deadline picker`
- [ ] 30. `feat(wizard): build 03 step 4 — stake disclosure with advanced toggle`
- [ ] 31. `feat(wizard): add shareable invite link generation on completion`

### Phase 6 — Project dashboard
- [ ] 32. `feat(dashboard): build 04 shell with role-aware layout`
- [ ] 33. `feat(dashboard): add progress bar and current stage highlight`
- [ ] 34. `feat(dashboard): add contributor list with status chips`
- [ ] 35. `feat(dashboard): add "you" row highlight and next-action prompt`
- [ ] 36. `feat(dashboard): add readiness checklist`
- [ ] 37. `feat(dashboard): add owner-only controls`
- [ ] 38. `feat(dashboard): add "you're up" in-app banner`

### Phase 7 — Private contribution room
- [ ] 39. `feat(contribute): build 05 shell with sidebar and tab switcher`
- [ ] 40. `feat(contribute): build 05a drag-and-drop upload zone`
- [ ] 41. `feat(contribute): wire data concierge report under upload zone`
- [ ] 42. `feat(contribute): add preview table with column confirmation`
- [ ] 43. `feat(contribute): add encrypt → upload → submitted state machine animation`
- [ ] 44. `feat(contribute): build 05b rewrite studio card layout`
- [ ] 45. `feat(contribute): add rewrite progress counter`
- [ ] 46. `feat(contribute): add encrypt-and-submit-all flow for rewrites`

### Phase 8 — Rejection handling
- [ ] 47. `feat(rejection): build 06 plain-language rejection screen`
- [ ] 48. `feat(rejection): add deposit-held messaging and resubmit path`
- [ ] 49. `feat(rejection): add "switch to rewrite studio" inline fix`

### Phase 9 — Must-Pass Scenarios
- [ ] 50. `feat(must-pass): build 07 owner-only scenarios screen`
- [ ] 51. `feat(must-pass): add minimum-3 validation and pass/fail chips`

### Phase 10 — Result Playground
- [ ] 52. `feat(result): build 08 side-by-side chat panel with shared input`
- [ ] 53. `feat(result): add streaming responses via vercel ai sdk`
- [ ] 54. `feat(result): add left/right/neither voting buttons`
- [ ] 55. `feat(result): add structured feedback tag chips`
- [ ] 56. `feat(result): add plain-english metrics card`
- [ ] 57. `feat(result): add must-pass scenario result strip`
- [ ] 58. `feat(result): add co-owner avatar row`

### Phase 11 — Publish & versions
- [ ] 59. `feat(publish): build 09 publish-or-rerun screen`
- [ ] 60. `feat(publish): gate publish on must-pass with explicit override`
- [ ] 61. `feat(publish): add personal-receipt success state per contributor`
- [ ] 62. `feat(versions): build 10 vertical version timeline`
- [ ] 63. `feat(versions): add expandable row with try / rollback actions`

### Phase 12 — Advanced drawer
- [ ] 64. `feat(advanced): build 11 slide-out drawer shell`
- [ ] 65. `feat(advanced): wire tee attestation and code hash section`
- [ ] 66. `feat(advanced): add storage root hashes and inft record section`
- [ ] 67. `feat(advanced): add conversion manifest viewer`

### Phase 13 — Notifications & deep links
- [ ] 68. `feat(notify): add resumable deep-link routes per stage`
- [ ] 69. `feat(notify): add email transition templates`

### Phase 14 — Responsive & polish
- [ ] 70. `feat(mobile): make dashboard, playground, and notifications responsive`
- [ ] 71. `feat(motion): polish wizard transitions and stage advance`
- [ ] 72. `feat(motion): add confetti-once on publish success`
- [ ] 73. `chore: lighthouse and a11y pass`

---

## Check-in cadence

Pause and sync with the user after **commit 22** (~30% mark, end of
Phase 4 — auth + landing live). Update the plan before continuing.

## Notes

- No `Co-Authored-By` trailers on any commit.
- Each commit pushes to `origin/main` once green locally.
- Mock data lives in `frontend/src/lib/mock/`. All mock access goes
  through a single `dataClient` so the swap to real APIs is one file.
