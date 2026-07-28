# Accessibility & Responsive Design Audit

Audit performed for issue #65. Scope: automated + manual accessibility review
and a 360px-width responsive pass across the client's audited routes
(`/`, `/analytics`, `/dev/components`) and the two components that make up
the campaign funding flow (`CreateCampaignPage`, `CampaignDetailPage` +
`FundCampaignModal`), which are built but not yet wired into the router.

## Methodology

Four complementary checks were used, since no single tool covers every
acceptance criterion in this sandboxed environment:

1. **Static analysis** — `eslint-plugin-jsx-a11y` (already configured in
   `eslint.config.js`) was run across the whole `src/` tree. Baseline and
   post-fix runs both reported **0 jsx-a11y violations**. (The lint run also
   reports ~8000 unrelated `prettier/prettier` "Delete `␍`" errors across
   the entire pre-existing codebase — this is a Windows `core.autocrlf`
   checkout artifact affecting files this PR didn't touch, not something
   introduced or fixed here; re-normalizing repo-wide line endings is out of
   scope for an accessibility pass and would bury this diff in noise.)
2. **Automated DOM/ARIA scan** — added `jest-axe` (`axe-core`) as a Vitest
   suite (`src/__tests__/accessibility.test.tsx`) covering `DesignFoundationsPage`,
   `AnalyticsDashboardPage`, `CreateCampaignPage`, and `FundCampaignModal`.
   axe's `color-contrast` rule is explicitly disabled in that suite: the test
   environment is `happy-dom`, which has no real layout/paint engine, so it
   cannot compute actually-rendered colors and the rule is unreliable there.
   Contrast was instead verified with a standalone script implementing the
   WCAG relative-luminance/contrast formula directly against the hex/HSL
   values in `tailwind.config.ts` and each component's CSS, which is more
   precise than a browser-only tool would be for this pass since it can
   check every token pairing (including alpha-composited badge fills)
   in isolation.
3. **Keyboard navigation** — verified by code review of every interactive
   element in the funding flow, plus four automated tests asserting: the
   funding dialog has an accessible name and receives initial focus, Tab/
   Shift+Tab wrap correctly inside it instead of escaping to the page,
   Escape closes it, and a validation error is announced via `role="alert"`
   — all without simulating a mouse.
4. **Responsive review** — manual review of every "primary page" at a
   360px viewport width, looking specifically for fixed-width content wider
   than the viewport and any layout that doesn't reflow.

## Findings & fixes

### 1. Color contrast (status badges + primary text)

| Location | Before | After | Ratio before → after |
|---|---|---|---|
| `components/ui/Badge/Badge.css` — 9 status variants + 5 generic variants | text colors as light as `hsl(x, y%, 30-45%)` over a 10%-alpha fill | darkened lightness per-hue (see inline comment in the file) | as low as **2.75:1** → all ≥ **4.6:1** against both white and `soil-50` page backgrounds |
| `text-soil-400` / `text-soil-500` used as real copy (captions, labels, hints, dt/dd pairs) across `Header`, `StatTile`, `ChartCard`, `ComingSoonCard`, `LifecycleStepper`, `CreateCampaignPage`, `DesignFoundationsPage`, `AppLayout` | `soil-400` **2.98:1**, `soil-500` **4.10:1** on white | bumped to `soil-600` | **≥ 5.96:1** |
| `FundCampaignModal` / `CampaignDetailPage` / `InvestorDashboardPage` / `InvestmentCard` / `InvestorSummaryStats` — a second, independent Tailwind-default (slate/emerald/amber) design system used only in these files | `text-slate-400` **2.56:1**; primary CTA buttons `bg-emerald-600` white text **3.77:1**; `bg-amber-600` white text **3.19:1** | `slate-400`→`slate-600`; buttons →`emerald-700`/`amber-700` (hover `-800`) | **≥ 4.66:1** (text), **≥ 5.02:1** (buttons) |

`dark:` variants in the slate/emerald files were **not** changed — they
already passed (6.9–17.8:1) since Tailwind's default dark-mode palette
happens to have good contrast here; only the light-mode (default) classes
needed darkening.

Two large (`text-2xl font-bold`, 24px) stat values using `amber-600`/
`emerald-600` were deliberately left as-is: at that size/weight they qualify
as WCAG "large text," where the threshold is 3:1, and they measure 3.19:1
and 3.77:1 respectively — already compliant.

**Note:** `FundCampaignModal.tsx` and `CampaignDetailPage.tsx` use a
Tailwind slate/emerald palette instead of the earth-tone `soil`/`leaf`/
`status-*` tokens used everywhere else in the app — this is exactly the
"independently-built pages regress accessibility" failure mode issue #65
describes. `CampaignDetailPage`'s status pill was also hardcoded to green
regardless of actual campaign status; it now uses the shared, contrast-
verified `<StatusBadge>` component instead. Fully unifying the two design
systems is a larger change than an a11y/contrast fix and is called out as a
follow-up below rather than attempted here.

### 2. Keyboard navigation — campaign funding flow

`FundCampaignModal` (the campaign-funding dialog) was a hand-rolled overlay
`<div>` with **no focus trap, no initial focus, no Escape-to-close, and no
`role="dialog"`/`aria-modal`** — a keyboard-only user tabbing through the
page could tab straight out of the "open" dialog into the page behind it,
and had no keyboard way to dismiss it. The project already has a fully
accessible `Modal` component (`components/ui/Modal/Modal.tsx`, focus trap +
Escape + focus restore + `aria-modal`/`aria-labelledby`) that nothing was
using for this flow. `FundCampaignModal` now renders through `<Modal>`
instead of duplicating dialog chrome, which fixes all of the above for
free and is verified by the four keyboard tests described above.

Additional fixes in the same flow:
- `CampaignDetailPage`'s progress bar had no accessible role/value; added
  `role="progressbar"` with `aria-valuenow`/`aria-valuemin`/`aria-valuemax`/
  `aria-label`.
- `CreateCampaignPage`'s per-field validation errors (`errors.title`,
  `.description`, `.harvestMetadata`, `.targetAmount`, `.tokenAddress`,
  `.deadline`) rendered visually but weren't associated with their inputs
  or announced to assistive tech. Each now has a stable `id`, is wired via
  `aria-describedby`/`aria-invalid` on the corresponding input, and is
  marked `role="alert"`. The final review step's success/error messages got
  `role="status"`/`role="alert"` respectively.
- The step indicator's text labels are intentionally hidden below the `sm`
  breakpoint (a deliberate, reasonable responsive choice), but that left
  screen-reader users with no context below 640px — just a bare number. Each
  step circle now carries a full `aria-label` ("Step 2 of 4: Funding
  (current)") regardless of viewport width.
- `InvestorDashboardPage`'s claim-refund/claim-return result banner had no
  live region — added `role="alert"`/`role="status"` depending on outcome,
  so keyboard/screen-reader users are notified of a claim's result the same
  way sighted mouse users can already see it.
- Decorative icons/emoji (✓, 📂, the pulsing "connected" dot) that had no
  semantic meaning of their own were marked `aria-hidden="true"` so they
  aren't announced redundantly alongside the real text next to them.

### 3. Responsive layout at 360px

| Location | Problem | Fix |
|---|---|---|
| `DesignFoundationsPage` palette swatch rows | 11 fixed 32px swatches + gaps = ~392px in a non-wrapping flex row, inside a 312px-wide content area at 360px viewport → horizontal overflow | added `flex-wrap` |
| `Header`'s wallet-connection error panel | `absolute right-6 ... max-w-sm` (384px) could exceed a 360px viewport | now `inset-x-4` (fluid, clamped to viewport minus margin) below the `sm` breakpoint, restoring the original floating position at `sm:` and up |
| `Header` nav row | no wrap fallback if the logo + connected-wallet chip + disconnect button ever exceeded available width | added `flex-wrap` as a safety margin |

Other primary pages (`AnalyticsDashboardPage`, `CreateCampaignPage`,
`CampaignDetailPage`, `InvestorDashboardPage`, `InvestmentCard`) were
reviewed and already reflow correctly at 360px (responsive `max-w-*` +
`flex-col`/`grid-cols-1` defaults, Recharts `ResponsiveContainer`) — no
changes were needed there.

### 4. Automated regression test

`src/__tests__/accessibility.test.tsx` adds:
- 4 `jest-axe` scans (DOM/ARIA structural checks) across the audited routes
  and the funding modal.
- 4 keyboard-navigation tests for the funding flow (dialog focus, Tab trap,
  Escape-to-close, error announcement).

Run with `npm test` (Vitest). This gives the "no critical/serious
violations" acceptance criterion a repeatable, CI-checkable guarantee for
these routes going forward, rather than a one-time manual claim.

## Explicit follow-up (not blocking this issue)

**Dispute resolution has no UI yet.** A repo-wide search turned up
`open_dispute`/`resolve_dispute` contract calls and an unused
`useOpenDispute` hook, but no page or component renders a dispute-resolution
flow anywhere in the client. There is nothing to keyboard-test because it
doesn't exist yet — this acceptance criterion can only be verified once
that flow is built (tracked separately; per issue #65's own guidance to
"document any [issues] that need a follow-up rather than blocking this
issue indefinitely").

Two smaller items are noted but intentionally not fixed here, to keep this
PR scoped to accessibility/responsive behavior rather than expanding into
unrelated feature or architecture work:
- `CreateCampaignPage`/`CampaignDetailPage`/`FundCampaignModal` aren't wired
  into `App.tsx`'s router yet (a pre-existing gap, not introduced by this
  PR) — their accessibility was verified by rendering them directly in
  tests/code review.
- `FundCampaignModal`/`CampaignDetailPage`/`InvestorDashboardPage` use a
  different Tailwind palette (slate/emerald) than the rest of the app
  (soil/leaf/status tokens); contrast was fixed in place, but unifying the
  two design systems is a larger refactor than this audit's scope.
