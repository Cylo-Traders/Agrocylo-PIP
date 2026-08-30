# Discovered Issues

Issues surfaced while implementing #145 (dispute open/resolve UI). Each is scoped
to be independently pickup-able by a contributor. Copy each section into its own
GitHub issue.

---

## 1. Restore client CI: fix repo-wide prettier/lint failures

**Area:** `client/` — CI (`.github/workflows/client-ci.yml`)

### Description

`npm run lint` and `npm run format:check` currently fail on a clean `master`
checkout with ~90 prettier errors across 5 TS/TSX files (plus 2 CSS files
flagged by `format:check`). Confirmed via `git stash` while working on #145 —
this is not something a recent PR broke in isolation, it's the current state
of `master`, meaning `client-ci.yml`'s lint/format steps are already red.

### Problem

Unformatted code merged into `master` without anyone noticing, because CI
either wasn't catching it or was ignored. Every subsequent PR now either has
to fix unrelated files to get a clean lint run, or contributors get used to
ignoring lint failures — both bad outcomes. See also #7 below (the
pre-commit hook that should have caught this was never actually installed).

### Suggested Implementation

Run `npm run lint -- --fix` and `npm run format` in `client/`, review the
diff (it should be purely mechanical — quote style, line wrapping, trailing
commas), and commit. Do **not** bundle any behavioral changes into this PR;
if `--fix` changes semantics anywhere, split that file out for manual review.

### Files Affected

- `client/src/components/campaign/ActivityFeed/ActivityFeed.tsx`
- `client/src/components/campaign/ActivityFeed/ActivityFeedItem.tsx`
- `client/src/components/campaign/ActivityFeed/ActivityFeed.css`
- `client/src/lib/activity/activityLabels.ts`
- `client/src/lib/contracts/__tests__/registry.test.ts`
- `client/src/pages/ActivityFeedPage.tsx`
- `client/src/components/ui/Skeleton/Skeleton.css`

### Acceptance Criteria

- [ ] `npm run lint` exits 0 in `client/`
- [ ] `npm run format:check` exits 0 in `client/`
- [ ] No behavioral/logic changes — diff is formatting-only (verified by
      reading the diff, not just by tests passing)

### Tests That Must Pass

- `client/`: `npm run lint`
- `client/`: `npm run format:check`
- `client/`: `npm test` (full suite — should be unaffected, confirming no
  logic changed)
- `.github/workflows/client-ci.yml` passes end-to-end

---

## 2. Husky pre-commit hook is configured but never installed

**Area:** `client/package.json`, repo tooling

### Description

`client/package.json` has a `lint-staged` config (`eslint --fix` +
`prettier --write` on staged `.ts`/`.tsx`/`.css`/`.json`/`.md` files) and
`husky` as a devDependency, but there is no `client/.husky/` directory and no
`"prepare"` script wiring `husky` into `npm install`. The hook has never
actually been runnable for any contributor — which is almost certainly how
issue #1's ~90 unformatted-file errors landed on `master` unnoticed.

### Problem

A safety net that looks configured but isn't is worse than no safety net —
it gives false confidence that formatting is enforced pre-commit when it
isn't enforced anywhere until CI (and CI's lint/format steps were already
broken, see #1).

### Suggested Implementation

- Add `"prepare": "husky"` to `client/package.json` scripts (husky v9+ style).
- Run `npx husky init` (or manually create `client/.husky/pre-commit`) with
  `npx lint-staged` as its body.
- Confirm hooks install correctly on a clean clone (`git clone` + `npm ci`)
  and that a deliberately unformatted staged file gets blocked/auto-fixed on
  `git commit`.
- Document the requirement to run `npm ci` (not just `npm install
  --ignore-scripts`) in `README.md` if not already covered.

### Files Affected

- `client/package.json`
- `client/.husky/` (new)
- `README.md` (if it documents setup steps)

### Acceptance Criteria

- [ ] `.husky/pre-commit` exists and runs `lint-staged`
- [ ] A fresh `npm ci` in `client/` installs the git hook automatically
- [ ] Committing a deliberately-unformatted staged file either gets
      auto-fixed or blocks the commit with a clear message

### Tests That Must Pass

- Manual verification: fresh clone → `npm ci` → stage an unformatted file →
  `git commit` behaves as expected
- `client/`: `npm run lint` / `npm run format:check` continue to pass

---

## 3. CampaignDetailPage ignores its route param and always renders mock data

**Area:** `client/src/pages/CampaignDetailPage.tsx`, `client/src/App.tsx`

### Description

`CampaignDetailPage` is routed at `/campaigns/:id` in `App.tsx`, but the
component never calls `useParams()` — it always renders the same hardcoded
mock campaign (`camp-101`) via a `setTimeout`-simulated fetch, regardless of
which `:id` was navigated to. `CreateCampaignPage` exists
(`client/src/pages/CreateCampaignPage.tsx`, exported from `pages/index.tsx`,
covered by an accessibility test) but has no `<Route>` in `App.tsx` at all —
it's unreachable from the app.

This is the same gap #145's suggested implementation called "Issue 1" — the
new `OpenDisputeForm` (added in #145) was built prop-driven specifically so
it can be dropped into the real page unchanged once this lands.

### Problem

The detail page and dispute UI can't be manually or E2E tested against real
contract state, and every consumer (`OpenDisputeForm`, `ActivityFeed`,
`FundCampaignModal`) is fed synthetic data instead of a real
`campaign_id`. `CreateCampaignPage` is fully built and tested but has no way
for a user to reach it.

### Suggested Implementation

- In `CampaignDetailPage.tsx`, replace the `useState`/`setTimeout` mock with
  `useParams<{ id: string }>()` + the existing `useCampaign(campaignId)` read
  hook from `client/src/hooks/contract/useEscrowQueries.ts`.
- Reconcile the page's local `CampaignData['status']` union
  (`'Active' | 'Funding' | 'Resolved' | 'Failed' | 'Settled'`) with the
  contract's real `CampaignStatusTag`
  (`client/src/lib/soroban/types.ts` — includes `Funded`, `InProduction`,
  `Harvested`, `Disputed`, but no `Resolved`) so `StatusBadge` and
  `LifecycleStepper` render correctly for every real status.
  `useOpenDispute`'s `opener`/`farmerAddress` wiring (from #145) already
  expects a real `campaign.farmer`.
- Add a `<Route path="/campaigns/new" element={<CreateCampaignPage />} />`
  (or appropriate path) to `App.tsx`, and a way to reach it (nav link/button).
- Update `FundCampaignModal` usage on the page to pass the real campaign's
  `totalTarget`/`currentRaised` once sourced from contract data instead of
  local mock state.

### Files Affected

- `client/src/pages/CampaignDetailPage.tsx`
- `client/src/App.tsx`
- `client/src/components/campaign/OpenDisputeForm.tsx` (consumer — should
  need no changes if kept prop-driven)
- `client/src/lib/soroban/types.ts` (reference only, for the status enum)

### Acceptance Criteria

- [ ] Navigating to `/campaigns/<real-id>` renders that campaign's real
      on-chain data, not the hardcoded mock
- [ ] `CampaignDetailPage`'s status type matches `CampaignStatusTag` and
      `StatusBadge`/`LifecycleStepper` render correctly for every contract
      status
- [ ] `CreateCampaignPage` is reachable via a route in `App.tsx`
- [ ] `OpenDisputeForm` (from #145) continues to work unchanged, now fed real
      `campaignId`/`farmerAddress` props

### Tests That Must Pass

- `client/`: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`
- Existing `OpenDisputeForm.test.tsx` and `CampaignAdminPanel.test.tsx`
  continue to pass unmodified (both are prop-driven, shouldn't need changes)
- New test: `CampaignDetailPage` renders the campaign matching the route's
  `:id` param (mocking `useCampaign`)

---

## 4. ResolveDisputeForm doesn't show the open dispute's reason or opener

**Area:** `client/src/components/admin/CampaignAdminPanel.tsx`

### Description

#145's suggested implementation asked for the admin resolve-dispute form to
show "the open dispute's reason/opener" alongside the resolution picker.
The current `ResolveDisputeForm` (already present in `CampaignAdminPanel.tsx`
before #145) only renders the resolution `<select>` and the conditional
payout-amount field — it never calls `useDispute()` to fetch or display the
dispute's `reason`, `opener`, or `timestamp`.

### Problem

An admin resolving a dispute currently has no in-app way to see *why* it was
opened or *who* opened it — they'd have to look it up separately (block
explorer, contract call, or ask the opener directly) before making a
FullRefund/FullPayout/PartialSettlement decision. That's exactly the
UX gap the client is supposed to close.

### Suggested Implementation

- In `ResolveDisputeForm`, call `useDispute(campaignId)` (already exported
  from `client/src/hooks/contract/useEscrowQueries.ts`) and render the
  dispute's `opener` (address, styled like `farmerAddress` elsewhere in the
  panel) and `reason` above the resolution form.
- Handle the loading state (skeleton or simple "Loading dispute…" text) and
  the case where `useDispute` errors or returns no open dispute gracefully.

### Files Affected

- `client/src/components/admin/CampaignAdminPanel.tsx`
- `client/src/components/admin/__tests__/CampaignAdminPanel.test.tsx`

### Acceptance Criteria

- [ ] When a campaign is `Disputed`, the admin panel shows the dispute's
      opener address and reason text before the resolution form
- [ ] Loading and error states for the dispute fetch are handled, not left
      blank or throwing

### Tests That Must Pass

- `client/`: `npm run lint`, `npm test`
- New/updated tests in `CampaignAdminPanel.test.tsx` asserting the opener and
  reason render for a mocked open dispute

---

## 5. No guard against opening a duplicate dispute on the same campaign

**Area:** `client/src/components/campaign/OpenDisputeForm.tsx`

### Description

`OpenDisputeForm` (added in #145) shows the open-dispute form to any
eligible wallet (farmer, contributor, or admin) regardless of whether the
campaign already has an open dispute. It doesn't call `useDispute()` or
check `campaign.status` before rendering the form.

### Problem

If the contract rejects a second `open_dispute` call on an already-disputed
campaign, the user only finds out after submitting and signing in their
wallet — a wasted signature and a confusing contract error, instead of the
UI simply not offering the action.

### Suggested Implementation

- Pass the campaign's current status (once #3 wires real data) or call
  `useDispute(campaignId, { enabled: ... })` from within `OpenDisputeForm`
  to check for an existing open dispute (`status.tag === 'Open'`).
- When one exists, replace the form with a short status message (e.g.
  "A dispute is already open on this campaign — an admin needs to resolve it
  before a new one can be opened.") instead of rendering the reason field and
  submit button.

### Files Affected

- `client/src/components/campaign/OpenDisputeForm.tsx`
- `client/src/components/campaign/__tests__/OpenDisputeForm.test.tsx`

### Acceptance Criteria

- [ ] `OpenDisputeForm` does not render the open-dispute form when the
      campaign already has an open dispute
- [ ] A clear, non-technical message explains why the action isn't available

### Tests That Must Pass

- `client/`: `npm run lint`, `npm test`
- New test in `OpenDisputeForm.test.tsx`: given a mocked open dispute, the
  form doesn't render and the explanatory message does

---

## 6. Accessibility pass and audit sign-off for the dispute-resolution UI

**Area:** `client/src/components/campaign/OpenDisputeForm.tsx`,
`client/src/components/admin/CampaignAdminPanel.tsx`,
`client/docs/accessibility-audit.md`

### Description

`client/docs/accessibility-audit.md` (lines 137–146) explicitly deferred
accessibility verification of the dispute-resolution flow because it didn't
exist yet: *"There is nothing to keyboard-test because it doesn't exist
yet — this acceptance criterion can only be verified once that flow is
built."* #145 built `OpenDisputeForm` and confirmed `ResolveDisputeForm`
already existed, but neither had a dedicated accessibility pass — the work
in #145 focused on functional coverage (mutation wiring, eligibility logic,
validation) using the same visual patterns as the rest of the admin panel,
not a keyboard/screen-reader audit.

### Problem

The audit's explicit follow-up item is still open. Forms handling
high-stakes actions (opening/resolving a financial dispute) should meet the
same bar the rest of the app was already audited to (see the jest-axe +
keyboard-navigation pattern used for the funding flow, referenced around
`docs/accessibility-audit.md:130`).

### Suggested Implementation

- Add `jest-axe` "no critical/serious violations" checks for
  `OpenDisputeForm` and the `Disputed`-status `CampaignAdminPanel` render,
  following the existing pattern used for the funding flow.
- Manually keyboard-test both forms: Tab order through reason
  textarea/resolution select/payout field/submit button, Enter-to-submit,
  and that the success/error messages are announced (e.g. via `aria-live` or
  equivalent — check whether `ActionError`'s current markup already
  qualifies as a live region and fix if not).
- Update `docs/accessibility-audit.md` to close out the "Dispute resolution
  has no UI yet" follow-up note with the audit results (pass, or a list of
  fixed/remaining issues).

### Files Affected

- `client/src/components/campaign/OpenDisputeForm.tsx`
- `client/src/components/admin/CampaignAdminPanel.tsx`
- `client/docs/accessibility-audit.md`
- `client/src/__tests__/accessibility.test.tsx` (or wherever the existing
  jest-axe suite lives)

### Acceptance Criteria

- [ ] `jest-axe` reports no critical/serious violations for
      `OpenDisputeForm` and `ResolveDisputeForm`
- [ ] Both forms are fully keyboard-operable (Tab order, Enter-to-submit,
      focus visible)
- [ ] Success/error messages are announced to assistive tech, not just
      visually shown
- [ ] `docs/accessibility-audit.md`'s dispute-resolution follow-up note is
      updated to reflect the completed audit

### Tests That Must Pass

- `client/`: `npm run lint`, `npm test` (including new jest-axe assertions)

---

## 7. Add end-to-end test coverage for the full open → resolve dispute lifecycle

**Area:** `client/` tests (cross-component)

### Description

#145 added unit tests for `OpenDisputeForm` (mocking `useOpenDispute`,
`useContribution`, `useEscrowAdmin`, `useWallet`) and
`CampaignAdminPanel.test.tsx` already covers `ResolveDisputeForm`'s
validation. Both are tested in isolation with fully mocked hooks — there's
no test exercising the full lifecycle (a dispute opened via one component
becoming visible and resolvable via the other) the way `contracts/`'s own
integration/e2e tests do for the contract layer.

### Problem

A regression that breaks the handoff between opening and resolving a
dispute — e.g. a query-key mismatch between `useOpenDispute`'s
`invalidateQueries` and what `useDispute`/`CampaignAdminPanel` reads — would
not be caught by either component's isolated unit tests.

### Suggested Implementation

- Add an integration-style test (real `QueryClientProvider`, mocked
  `contractClient`/`invokeContractWrite` at the lowest level rather than
  mocking the hooks) that: opens a dispute via `OpenDisputeForm`, then
  renders `CampaignAdminPanel` for the same campaign and asserts the
  resolve-dispute form appears with the right status.
- If a lower-level Soroban RPC mock already exists for other flows (check
  `client/src/lib/soroban/__tests__/` or similar), reuse that pattern rather
  than inventing a new one.

### Files Affected

- New test file, e.g.
  `client/src/__tests__/disputeLifecycle.test.tsx`
- Possibly `client/src/lib/soroban/contractClient.ts` (if a shared mock
  helper needs exporting for tests)

### Acceptance Criteria

- [ ] A single test simulates opening a dispute and then resolving it,
      asserting both components reflect the shared underlying state
      correctly at each step

### Tests That Must Pass

- `client/`: `npm run lint`, `npm test`

---

## 8. Unify the two divergent Tailwind design systems

**Area:** `client/src/pages/CampaignDetailPage.tsx`,
`client/src/components/campaign/FundCampaignModal.tsx`,
`client/src/pages/InvestorDashboardPage.tsx`, `client/tailwind.config.*`

### Description

`client/docs/accessibility-audit.md` (lines 155–158) notes that
`FundCampaignModal`/`CampaignDetailPage`/`InvestorDashboardPage` use a
slate/emerald Tailwind palette while the rest of the app (including the new
`OpenDisputeForm` and `CampaignAdminPanel`, both built with the soil/leaf/
status design tokens) uses a different one. The audit fixed contrast issues
in place but explicitly scoped out unifying the two systems as "a larger
refactor than this audit's scope."

### Problem

`OpenDisputeForm` (from #145) was deliberately styled with the soil/leaf/
status tokens to match `CampaignAdminPanel`, but it now renders directly
inside `CampaignDetailPage`, which is still slate/emerald — so the dispute
form visually clashes with the page it lives on. This will only get more
visible as more of `CampaignDetailPage` gets wired to real functionality
(see #3).

### Suggested Implementation

- Decide on one token system (soil/leaf/status appears to be the newer,
  more consistently-used one across `CampaignAdminPanel`, `StatusBadge`,
  `LifecycleStepper`) and migrate `CampaignDetailPage.tsx`,
  `FundCampaignModal.tsx`, and `InvestorDashboardPage.tsx` to it.
- Re-run the contrast checks from the accessibility audit after migration
  (the audit already validated soil/leaf/status tokens elsewhere, but
  confirm the specific slate/emerald → soil/leaf swaps don't reintroduce
  contrast failures).

### Files Affected

- `client/src/pages/CampaignDetailPage.tsx`
- `client/src/components/campaign/FundCampaignModal.tsx`
- `client/src/pages/InvestorDashboardPage.tsx`
- `client/tailwind.config.*` (if palette tokens need adjusting)

### Acceptance Criteria

- [ ] All three pages/components use the same design-token system as the
      rest of the app
- [ ] `OpenDisputeForm` no longer visually clashes with `CampaignDetailPage`
- [ ] No new contrast/accessibility regressions introduced

### Tests That Must Pass

- `client/`: `npm run lint`, `npm run format:check`, `npm test` (including
  jest-axe contrast checks), `npm run build`
