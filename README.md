# Financial Tracker

A local-first personal expense tracker for Windows, built with Electron, React,
TypeScript, and SQLite. The app opens to a collapsible sidebar with Overview,
Transactions, Receipt inbox, Recurring, Reports, Accounts, and Settings pages. On start you
pick or create a profile; each profile has its own SQLite database and data
folder. Financial data stays local. Accounts track opening balances, signed
expense/income transactions, both legs of transfers, and target-based balance
adjustments. Settings includes payee alias/merge management, ordered
categorisation rules, and two-level expense/income category management.

## Requirements

- Windows (x64 installer; development also supports ARM64)
- Node.js 24.x (the development machine runs 24.15.0); see `.nvmrc`
- npm 12.2.0 or newer (upgrade Node's bundled npm with
  `npm install --global npm@12.2.0`)

## Setup

```sh
npm ci
npm run dev
```

Dependencies are pinned exactly. `better-sqlite3` 13 ships Windows binaries using
the stable Node-API 10 ABI, so no Electron-specific rebuild is needed. There is
one dependency installation, and `npm test` verifies SQLite using Electron's Node
runtime (`ELECTRON_RUN_AS_NODE=1`). This avoids the native ABI mismatch of older
`better-sqlite3` versions without separate Node and Electron installations.

Install requires npm 12.2.0 or newer, enforced by `.npmrc`'s `engine-strict`.
npm loses SQLite's `gypfile: false` metadata in lockfiles and incorrectly invokes
node-gyp during clean installation. Previously `ignore-scripts=true` avoided that
bug but also prevented Husky's `prepare` script from installing Git hooks.
Instead, npm 12's `allowScripts` policy in `package.json` explicitly denies
dependency scripts for SQLite, Electron, esbuild, and electron-winstaller, while
allowing the root
`prepare` script to install hooks automatically on `npm install` and `npm ci`.
electron-winstaller is an unused Squirrel packaging dependency of electron-builder;
its 7-Zip selection script is not needed for NSIS. SQLite includes its native binary,
Electron 44 downloads its executable on first
`dev` or `test`, and esbuild uses its platform-specific optional dependency.
`strict-allow-scripts=true` rejects unreviewed dependency scripts; review this
policy whenever dependencies change. Do not restore `ignore-scripts=true` or
install with `--ignore-scripts`: either would skip hook installation. Run
`npm run prepare` to repair hooks after an intentionally script-free install.

## Scripts

| Command                       | Purpose                                                                           |
| ----------------------------- | --------------------------------------------------------------------------------- |
| `npm run dev`                 | Start the desktop app with renderer hot reload.                                   |
| `npm run dist:win`            | Build an unsigned Windows x64 NSIS installer into `release/` without publishing.  |
| `npm run build`               | Typecheck and build main, preload, and renderer into `out/`.                      |
| `npm test`                    | Run SQLite, translation completeness, and formatting tests under Electron's Node. |
| `npm run lint`                | Run ESLint.                                                                       |
| `npm run format`              | Format project files with Prettier.                                               |
| `npm run format:check`        | Check formatting without modifying files.                                         |
| `npm run typecheck`           | Check strict Node and renderer TypeScript configurations.                         |
| `npm run guard -- <files...>` | Check listed files for personal data, invalid JSON, merge markers, and size.      |

## Local quality gates

Husky and lint-staged are exact-pinned development dependencies. After installation
in a Git clone, `git config --get core.hooksPath` should print `.husky/_`.

- **pre-commit** runs on added/copied/modified/renamed staged files. lint-staged
  hides unstaged edits, runs the file guard, ESLint on JavaScript/TypeScript files,
  then Prettier's check on supported files. Failures abort the commit and restore
  the index and unstaged edits. Formatting is not silently changed: use
  `npm run format`, inspect the diff, and stage the fix. Existing Prettier ignore
  rules apply (including the generated lockfile).
- The file guard blocks Windows home-directory paths (backslash, escaped
  backslash, forward slash, and Git Bash forms), GitHub tokens, AWS access key
  identifiers, private-key headers, common secret assignments, and e-mail
  addresses except GitHub noreply addresses. It also rejects images in any
  `fixtures/` directory (common extensions and image signatures), invalid `.json`
  files, merge-conflict markers, and files larger than **1,000,000 bytes**.
  Diagnostics identify the file, line, and rule without echoing matched content.
  The generated root `package-lock.json` has one explicit file exemption for
  upstream maintainers' e-mail addresses in registry metadata; all other guard
  rules still apply to it, and nested lockfiles are not exempt.
- **pre-push** runs `npm run typecheck` and then `npm test` against the working
  tree; either failure aborts the push.

The guard is also usable outside hooks, for example
`npm run guard -- README.md package.json`. Pass filenames as separate arguments
(quote filenames containing spaces), relative to the repository root or absolute.
Deleted files in a diff are skipped. No arguments or an unreadable/malformed
configuration exits with code 2; findings exit with code 1; clean files exit 0.
The guard's rule tests run in-process as part of `npm test`, with separate CLI
smoke tests verifying exit codes and diagnostics without repeated process launches
for every rule.

### Personal-data false positives

Never allow real personal data or credentials. Prefer rewriting a false positive
first. For unavoidable synthetic examples, add a reviewed entry to
`.personal-data-allowlist.json`:

```json
[
  {
    "file": "path/to/synthetic-example.txt",
    "rule": "email",
    "sha256": "<SHA-256 of complete file bytes>",
    "reason": "Why this specific synthetic example must be kept"
  }
]
```

Use an exact repository-relative path with forward slashes, one of
`windows-home`, `secret`, `email`, or `fixture-image`, a lowercase SHA-256 digest,
and a nonempty reason. Compute the digest without copying matched content into
the allowlist:

```sh
node --input-type=module -e "import {createHash} from 'node:crypto'; import {readFileSync} from 'node:fs'; console.log(createHash('sha256').update(readFileSync(process.argv[1])).digest('hex'))" path/to/synthetic-example.txt
```

An entry exempts only that rule for that exact file content. Any file change
revokes it; there are no wildcard or blanket allowlist exemptions. The generated
lockfile e-mail exception documented above is the only rule-level file exemption.
JSON, merge-marker,
and size checks cannot be allowlisted. Stage the reviewed allowlist with the file
so hooks and a later CI diff scan see the same approval. Hooks are a local safety
net, not a substitute for review or CI: Git's `--no-verify` and `HUSKY=0` can bypass
them, and pattern matching cannot detect every possible form of sensitive data.

The renderer has no Node access; a sandboxed, isolated preload exposes only the
typed app, update, profile (including settings), account, category, transaction,
transfer, balance adjustment, payee, tag, categorisation rule,
transaction-template, recurring-transaction, and backup commands/queries. Every
IPC input is validated in the main process, and every handler rejects calls not
sent by the main frame of either the main app window or the quick-add window.
Production CSP permits only same-origin connections; localhost WebSockets are
added only by the development server for hot reload. SQLite foreign-key
enforcement and shared Unicode text functions are enabled when each profile
connection opens. Financial writes use the profile application API, with each command
executed in one SQLite transaction. Drawer and table account references use
balance-free account options, including
archived identities needed by historical transactions; new-transaction pickers
filter to active accounts. The adjustment form records an observed balance and
does not need to fetch a current balance. SQLite is used only in the main
process. Profiles are listed in `profiles.json` under the app's user-data folder; each
profile lives in `profiles/<id>/` (database, data folder, and backups). Registry
writes replace the file atomically and briefly retry transient Windows file locks
(up to five retries with 310 ms total backoff); persistent failures still surface
without replacing the previous registry or leaving `profiles.json.tmp`. Deletion
first renames the profile directory to a tombstone, then updates the registry;
failed renames keep or reopen the profile, and stale tombstones are retried on
startup. Migrations are forward-only and run after a verified backup; a
database with a newer schema is refused.

## Continuous integration

Every pull request (regardless of its base branch) and every push to `main` runs
the `checks` job in `.github/workflows/ci.yml` on `windows-latest`. CI reads Node
from `.nvmrc`, installs npm 12.2.0, and runs `npm ci`, the changed-file guard,
lint, formatting checks, typechecking, tests, and the build. If a diff base is
unavailable (including the first push), the guard scans all tracked files instead.
New PR runs cancel older runs for the same PR. The stable required check name
for the `main` ruleset is `checks`.

## Releases and updates

The application identity is fixed: appId `com.finymark.financial-tracker` and
productName `Financial Tracker`. A runtime check of the existing development app
confirmed that Electron uses `Financial Tracker` as its user-data folder name.
Both development and packaged builds explicitly keep
`%APPDATA%\Financial Tracker` (Electron's `appData` directory plus that name),
so installing a release does not orphan existing development profiles. Do not
rename this folder or change the appId. Uninstalling keeps profile data.

`electron-builder.yml` produces a per-user, one-click **unsigned NSIS x64**
installer. Windows may show an unknown-publisher/SmartScreen warning; code
signing is deliberately not configured. Executable resource editing stays on
(`signAndEditExecutable: true`, `signExecutable: false`), so the executable,
shortcuts, taskbar, installer and uninstaller use the app icon. `build/icon.svg`
is the icon's master; after changing it, run `node scripts/generate-icons.mjs`
to regenerate `build/icon.png` and the multi-size `build/icon.ico` (16–256 px)
and commit all three. Windows does not let an app pin itself to the taskbar;
users right-click the running app's taskbar button and choose **Pin to
taskbar**. Native SQLite and Sharp
image-processing binaries are explicitly unpacked from asar, and native
dependency rebuilding is disabled. `better-sqlite3` 13 already ships the
compatible Node-API binary.

### Validate without publishing

Locally, run:

```sh
npm ci
npm run lint
npm run format:check
npm run typecheck
npm test
npm run dist:win
```

Or, after building the app with `npm run build`, run the builder directly:
`npx electron-builder --win nsis --publish never`. Outputs are under `release/`
and are ignored by Git. Corporate proxies can block electron-builder's Electron,
NSIS, or signing-tool downloads; report the failing URL/error rather than
working around certificate verification or committing downloaded binaries.

Check the packaged native modules from PowerShell. Run the copy outside the
repository, otherwise modules missing from the package can still resolve from
the repository's `node_modules`:

```powershell
$app = Join-Path $env:TEMP 'financial-tracker-win-unpacked'
Copy-Item -Recurse -Force 'release/win-unpacked' $app
$exe = Join-Path $app 'Financial Tracker.exe'
$log = Join-Path $env:TEMP 'financial-tracker-smoke.log'
$process = Start-Process -FilePath $exe -ArgumentList '--smoke-test' -Wait -PassThru -RedirectStandardOutput $log
Get-Content $log
$process.ExitCode
```

It must print `SQLite smoke test OK`, `Image smoke test OK`,
`OCR smoke test OK`, then `QR smoke test OK`, and exit 0.
The flag opens a temporary file-backed database, runs a query, and processes a
tiny in-memory image with Sharp, preprocesses and reads a synthetic receipt in
the OCR worker, then renders a QR code before cleaning up and exiting without
opening a window or reading profiles. For an installed-artifact check, silently
install `Financial-Tracker-Setup-<version>.exe` with `/S /D=<temporary-directory>`
(the directory argument must be last), then run the installed executable with
`--smoke-test`. Uninstall that temporary installation afterwards. Do not use this
check to replace an existing installation.

In GitHub Actions, select **Release → Run workflow** and choose the branch to
validate. GitHub requires the workflow to exist on the default branch before
manual dispatch is available. The `workflow_dispatch` path runs all quality
gates, builds the installer, smoke-tests the unpacked app, and uploads
`financial-tracker-windows-x64` (installer, blockmap, and update metadata) for
14 days. It uses `--publish never` and cannot run the publishing step, even when
dispatched on a tag. It creates neither a tag nor a GitHub Release.

### Publish only on the owners' signal

1. Update `package.json` and `package-lock.json` to the intended version (for
   example, `npm version <version> --no-git-tag-version`), commit the change, and
   merge through the normal green-CI PR process.
2. Validate the build-only workflow and the installed artifact first.
3. **Only when the owners explicitly authorize a release**, tag the approved
   commit `v<version>` and push that tag. Do not push a release tag during testing.
4. `.github/workflows/release.yml` runs on `v*.*.*` tags on `windows-latest`.
   Its read-only build job requires the tag to equal `v` plus `package.json`'s
   version, installs npm 12.2.0, runs `npm ci` and all acceptance gates, builds
   once without publishing, smoke-tests the packaged app, and uploads the
   installer, blockmap, and `latest.yml` as one artifact. A separate tag-only
   publish job has `contents: write`, downloads exactly that verified artifact,
   and creates the GitHub Release with `gh`; it never rebuilds.
   `workflow_dispatch` runs only the build job. Actions are SHA-pinned.
5. Confirm the public Release includes the installer, its `.blockmap`, and
   `latest.yml`; electron-updater needs these assets. Check a previously
   installed version detects and installs the new version on restart.

Packaged builds check the public GitHub Releases feed once on startup and
automatically download available updates. Development builds do neither.
Offline/failed checks do not block startup and retry on the next startup.
After download, a small Hungarian/English/German notice offers **Restart and
update**, using the active profile's language (English before profile selection).
Installation is explicit, not automatic on ordinary quit. Restart waits for
ongoing profile operations and closes SQLite before starting the installer.
Database migrations retain the existing verified-backup protections. End-to-end
update/restart behavior must be checked manually with two authorized releases;
the build-only artifact is not an update feed.

## Backup and restore

Opening a profile takes a consistent SQLite online backup in that profile's
`backups/` folder. The last 10 startup backups are kept, including multiple
opens at the same time. Verified pre-migration backups stay separately in
`backups/pre-migration/` and are not pruned by startup backup retention.

In **Settings → Backups**, choose a backup by date and time, select **Restore
backup**, then confirm. Restoring replaces the current profile database and
loses changes made after that snapshot. Cancel leaves the database unchanged.
The app verifies the selected snapshot, closes the live database, replaces it,
and safely reopens it, applying supported migrations if necessary. A temporary
online recovery snapshot protects the previous database if reopening fails.
Corrupt, foreign-profile, or newer-schema snapshots are refused without changing
the live database. Profile switching is disabled during restore, and quitting
waits for the database operation to finish. Attachment content is included
incrementally: each startup backup copies only content-addressed files not already
present in `backups/attachments/`. Restoring a database copies every referenced
file missing from the live attachment store back from that pool. Startup
retention still applies only to the last 10 SQLite snapshots. The shared
attachment pool and verified `backups/pre-migration/` snapshots are deliberately
not pruned. These are local backups, not off-device copies.

## App shell

- The shell uses Tailwind CSS 4 via its Vite plugin, lucide icons, and the
  [shadcn/ui](https://ui.shadcn.com/) Button, Card, and Native Select components,
  adapted to the shell's needs. Their MIT license is included alongside the
  components in `src/renderer/src/components/ui/LICENSE`.
- Visual tokens live in `src/renderer/src/tokens.css`: calm green/teal accent,
  light and dark surfaces, radius, and density (the Tailwind spacing unit).
- Settings saves language (HU/EN/DE), appearance (light/dark/system), and base
  currency (HUF/CHF) in each profile's SQLite database. New profiles use Hungarian
  for a Hungarian system locale, German for a German locale, and English otherwise;
  the system theme and HUF remain the defaults. Existing profiles upgraded from
  the identity-only schema retain the migration's English default. Saved choices apply immediately and return when the
  profile is opened again; switching profiles switches its language and theme.
  Failed saves show a translated error and leave the previous choices applied.
  Base currency drives exact HUF/CHF conversion with official MNB rates cached
  inside that profile's database.
- There is no application menu bar. Both windows use a hidden title bar with
  Windows' native minimize/maximize/close overlay; the app draws the 36 px top
  strip (icon, **Financial Tracker**, active profile name) and sends only the
  resolved `light`/`dark` theme over IPC so the overlay colors match the
  `--title-bar` tokens. Ctrl+= / Ctrl+- / Ctrl+0 still zoom; the packaged app
  ignores Ctrl+R, Ctrl+Shift+R, Ctrl+Shift+I and F12.
- The system theme follows Windows through `prefers-color-scheme`, using
  Electron's default system `nativeTheme`. Explicit light/dark modes override
  that preference in the renderer, including native form controls.
- Help hints: a small "?" button (`components/ui/help-hint.tsx`) next to every
  page header, section heading and non-obvious field or action explains what it
  is and what to do. Hover or keyboard focus shows the tooltip, click/Enter/Space
  pins it, Esc or blur closes it; its text is the button's accessible
  description. Texts live under `help.*` in the HU/EN/DE catalogs. Obvious
  fields (names, dates) intentionally have no hint.
- A small typed i18n module uses HU/EN/DE catalogs in
  `src/renderer/src/i18n/`, without a runtime library. `createFormatters` uses
  `Intl` with `hu-HU`, `en-GB`, and `de-DE` for dates and numbers. The
  completeness test checks the union of catalog keys, so a missing key in any
  language fails; TypeScript also checks Hungarian and German against English.
- The profile area at the bottom of the sidebar shows the active profile and
  switches profiles. Accounts lists active and archived accounts with balances in
  their own currency. Transactions provides a filterable, virtualised table and a
  right-side create/edit drawer. Reports provides base-currency expense totals by
  main category and subcategory, monthly trends, spending pace, and cash flow.
  Overview shows this month's expenses, income, net, and top five expense
  categories compared with the full last month.

## Recurring transactions

- **Recurring** defines profile-scoped expense or income estimates with an
  account, positive amount, optional payee/category/tags/note, start date,
  optional end date, and a monthly, weekly, or yearly schedule. Monthly and
  yearly dates clamp to the last day of shorter months (including leap years),
  and monthly/weekly intervals are anchored to the start date.
- Due occurrences become separate pending snapshots. They are generated on
  profile open and hourly while the app runs, exactly once per recurring
  transaction and due date. Occurrences before a definition's creation date are
  intentionally not generated. Pending snapshots do not affect balances,
  transaction-list totals, reports, CSV exports, or exchange-rate needs.
- The **Pending** tab lists snapshots oldest first and marks overdue items. The
  Recurring sidebar badge counts pending occurrences due today or earlier.
  Confirming posts the snapshotted payee, account, category, tags, and note as a
  normal transaction; its amount and non-future date can be adjusted first.
  Skipping consumes only that occurrence. Confirm and skip are undoable. If a
  pending snapshot's account is archived, unarchive the account or skip that
  occurrence.
- Editing changes only occurrences not yet created. Pausing stops generation;
  resuming starts from yesterday, so dates passed during the pause are skipped.
  Deleting removes still-pending occurrences. Create, edit, pause, resume and
  delete are undoable. An unsplit expense/income transaction or a transaction
  template can prefill a new monthly recurring definition; the first occurrence
  defaults to the next matching date.

### Manual recurring-transactions check

Run `npm run dev`, create synthetic HUF/CHF accounts, tags, and expense/income
categories, then open **Recurring**. In HU/EN/DE, create monthly (including day
31 and every two months), weekly (including every two weeks), and yearly
(including February 29) definitions. Verify translated schedule text, next due
dates, the amount calculator, nullable category/tags/payee/note, start/end dates,
and narrow-window/light/dark layouts. Edit a definition and check its list row;
pause and resume it; delete it; use the Undo toast after each operation. Close
and reopen the profile and verify definitions persist. In **Pending**, verify
oldest-first ordering, overdue highlighting, the due sidebar badge, one-click
confirm, calculator/date editing before confirm, skip, keyboard navigation, and
Undo for both decisions. Confirmed amounts must appear in the account balance,
Transactions, Overview and Reports; skipped and still-pending amounts must not.
Archive a pending item's account and verify confirmation explains that the
recurring definition needs an active account. Reopen the profile and verify
confirmed/skipped occurrences do not return. From an unsplit expense/income and
from a template, open the prefilled recurring form and verify its monthly date;
the action on a split transaction must be disabled with an explanatory hint.

## Global quick add

- **Ctrl+Alt+N** opens a compact, always-on-top quick-add window on the active
  display. The tray's **Quick add** item uses the same window. The window targets
  the open profile, or opens the last used profile when the main window is still
  showing the profile picker.
- Quick add supports expense/income (Alt+1/Alt+2), the amount calculator, the
  last used active account, payee and alias suggestions, categorisation-rule and
  last-used autofill, category, tags, note, and today's date. Enter saves, Esc
  closes, and Ctrl+Enter saves and starts another transaction. Transfers, splits,
  templates, and the post-save **Create rule** offer stay in the full transaction
  drawer.
- The shortcut is an app-level setting shared by all profiles on the Windows
  account. Change it by pressing a new combination in **Settings**, or reset it to
  Ctrl+Alt+N. If Windows or another program has reserved a combination, the app
  keeps the previous working shortcut and shows a translated conflict message.

### Manual global quick-add check

Run `npm run dev` with synthetic data and complete every item below in HU/EN/DE
and light/dark mode where applicable:

1. Focus another program, press Ctrl+Alt+N, and verify the quick-add window opens
   centered on the display containing the pointer, remains above ordinary
   windows, and focuses the amount field. Open it again via tray **Quick add**;
   an already open quick-add window must be focused rather than duplicated.
2. Reserve Ctrl+Alt+N in another program before starting Financial Tracker.
   Verify the main window reports “The shortcut Ctrl+Alt+N is used by another
   program…” once and Settings shows the translated conflict. Release it and set
   a new shortcut by pressing the combination in Settings. Verify it works from
   another focused program, persists after restart, is shared after switching
   profiles, and **Reset to Ctrl+Alt+N** works. While changing to another reserved
   combination, verify the previous working shortcut remains active.
3. Leave the profile picker open, invoke quick add, and verify the last used
   profile opens before its form appears. With no profiles, verify quick add shows
   a translated instruction to create one in the main window. With no accounts,
   verify the corresponding translated instruction.
4. Verify the default account is the last active account used for a transaction;
   payee aliases appear as their canonical payee suggestions; rules and last-used
   values autofill category/tags without overwriting manually changed values.
   Check expense/income with Alt+1/Alt+2, amount expressions, category, multiple
   tags, note, and today's date. Confirm transfers, splits, and templates are not
   offered.
5. Press Enter to save and verify a brief saved confirmation, window close, main
   Overview/Transactions refresh, and (when the main window is visible) its Undo
   toast reverses the quick-added transaction. Press Ctrl+Enter to save and add
   another while retaining account, kind, and date. Press Esc to close without
   saving.
6. Enable privacy mode in the active profile. Verify an unfocused quick-add amount
   is concealed and becomes editable only while focused. Check the compact window
   at its minimum size and on a second display.
7. Build the packaged artifact with
   `npx electron-builder --win nsis --publish never`, run
   `release/win-unpacked/Financial Tracker.exe`, and repeat shortcut, tray,
   profile-picker, Enter/Esc, privacy, and conflict checks. Then run
   `release/win-unpacked/Financial Tracker.exe --smoke-test`; it must print
   `SQLite smoke test OK`, `Image smoke test OK`, `OCR smoke test OK`, then
   `QR smoke test OK`, and exit 0.

## Exchange rates and base-currency conversion

- Profiles with an account outside their base currency fetch official CHF rates
  from the MNB SOAP service after the profile opens and every hour while the app
  runs. Creating a non-base-currency account, changing an account's currency, or
  writing a transaction/transfer or undoing a change also starts a coalesced
  background refresh when it extends the needed history, restores a missing
  left-edge rate, or the cached coverage ends before yesterday. Requests use
  Electron's system-proxy-aware network stack and never block the renderer. MNB serves this SOAP endpoint only
  over plain HTTP; ADR 0005 records the accepted integrity risk. Failures are
  logged and leave the visible rate status stale or missing.
- Migration 17 stores each quoted decimal string and unit by publication date,
  plus fetched coverage and the last successful refresh, in the profile database.
  Requested past dates are final. Today remains open and is requested again each
  hour until MNB's response includes today's publication; until then coverage
  ends yesterday. A backwards extension starts 14 days before the earliest
  needed date so weekends and holiday closures can use the previous publication.
  Profile backups and restores remain self-contained. Weekends and holidays use
  the latest earlier published rate within fetched coverage; dates after coverage
  use the latest cached rate as provisional. Only a conversion that actually
  uses a rate after coverage is marked provisional. The separate cache status is
  up to date when coverage reaches at least yesterday, stale when it does not,
  and missing when a needed date has no earlier published rate. An amount without
  an earlier rate remains explicitly unconverted, never zero.
- Conversion uses exact BigInt rational arithmetic. CHF converts to HUF with the
  MNB HUF-per-quoted-unit rate; HUF converts to CHF with its exact inverse. Values
  are aggregated exactly and rounded once per displayed total to integer
  hundredths, with ties away from zero. Transfers retain both recorded legs and
  are not converted into expense or income totals.
- The shell shows whether rates are up to date, stale, or missing and includes the
  last refresh date. Filtered transaction totals retain their per-currency values
  and additionally show a base-currency total, provisional state, and any
  unconverted currency bucket.

## Overview dashboard

- **Overview** is the start page: expenses, income, and net (income minus expenses)
  for this month to date, alongside the full previous calendar month and the
  absolute change. Both inclusive date ranges are displayed; last month is not
  cut at today's day-of-month.
- The dashboard reuses the category-breakdown query and report-line selection,
  so expense totals and category amounts agree with **Reports** for the same
  range. Transfers, balance adjustments, and excluded transactions never count.
  Splits use each part's category, including the uncategorized group.
- All totals use the profile's base currency, explicit unconverted buckets, and
  provisional-rate indicators. Net and changes use exact signed converted lines
  and round once, rather than subtracting rounded card amounts.
- The top five main expense categories include uncategorized when it ranks in
  the top five. Ranking and shares use exact converted expenses; shares use all
  categories as the denominator, not just the top five. Missing-rate amounts
  remain separate and do not count in ranking or shares. With no converted
  expenses, shares are zero and the unconverted bucket remains visible.
- Expense/income cards and category names open the matching transaction list
  with the dashboard's date range and excluded transactions hidden. **View
  reports** opens the full category breakdown. Rates refreshing and returning
  focus to the app reload the dashboard.

### Manual Overview and report charts check

Run `npm run dev` with synthetic HUF/CHF accounts and transactions. Repeat in
HU/EN/DE and light/dark themes, including a collapsed sidebar and a narrow
window. Verify Overview opens first, the two explicit date ranges show this
month to date versus the full last month, and expense/income/net cards show
current totals, previous totals, and signed absolute changes. Test no data,
income only, negative net, and year/month rollover.

Create more than five main expense categories, subcategories, split parts, and
uncategorized lines; check the top-five order, amounts, and shares against the
Reports breakdown for the same inclusive dates. Verify excluded expenses and
income, transfers, and balance adjustments never count. Check missing-rate
buckets on current/previous/change totals and category rows, and stale-rate
indicators while offline; after refresh the dashboard should update. Switch
base currency and profiles, return from editing or undoing transactions, and
verify totals and translated category names reload without another profile's
values.

Check the overview bar chart and Reports pie/bar charts use theme-token colors,
readable labels, and locale-formatted money tooltips. Check top-five table links,
expense/income card links, and View reports using keyboard navigation; category
links must preserve the inclusive dates, include subcategories, handle
uncategorized, and hide excluded transactions. In Transactions, the report chip
must describe the applied category and kind, including “without subcategories”
for direct-category lines. Editing the category without Apply must not change
that chip. Apply a category to an uncategorized report filter, then change or
clear an exact category: both must load without validation errors. Choose
**Show all kinds and subcategories** and verify the chip disappears while the
visible period and exclusion filters remain unchanged, including in CSV export.
Chart rendering/tooltips and navigation remain manual checks. Temporary SQLite application-API tests cover
dashboard/breakdown agreement, splits, exclusions, exact net/change rounding,
date-based conversion, missing/stale rates, top-five shares, and calendar
rollover.

## Reports

Use the shared view selector for **Expenses by category**, **Monthly trend**,
**Spending pace**, and **Cash flow**. Breakdown, trend, and cash flow retain the
same applied date range when switching views. Pace uses its fixed month-to-date
comparison and hides the date-range controls.

- **Reports** defaults to this month and also offers last month, this year, the
  rolling last 12 months, and an inclusive custom range. Custom dates cannot be
  before 1900-01-01 or span more than 100 years.
- The category breakdown uses ordinary expense transaction lines only. Income,
  transfers, balance adjustments, and excluded transactions do not count; split
  parts use their own categories and uncategorized lines remain explicit.
- Converted category totals use the profile base currency and exact cached-rate
  conversion, rounding once per displayed total. Missing rates remain in an
  unconverted bucket per currency, and provisional cached rates are marked.
- Switch between pie and bar charts. Choose a main category to see its direct
  lines and subcategories, then open Transactions with that category and the
  inclusive report range applied.
- **Spending pace** is a separate view, independent of the report date-range
  filter. It compares expenses from the first of this month through today with
  the average of the previous three calendar months, each cut at today’s day of
  month and clamped to that month’s length. Empty months still count in the
  three-month average. The query uses the application clock.
- Total and main-category comparisons show this month, the exact three-month
  average, and ahead/behind by amount and percentage. Uncategorized and
  historical-only categories stay visible. The average and difference are
  computed from exact converted amounts and rounded once; percentages use the
  exact average, not its rounded display value. A zero average has no percentage
  baseline. Ahead/behind is determined before rounding, so a tiny difference can
  display as zero while its percentage remains nonzero.
- The pace chart compares current spending with the average using theme tokens.
  Affected months retain explicit unconverted currency buckets and make the
  comparison partial; provisional rates remain flagged. **Refresh pace** reloads
  the comparison, and background exchange-rate updates refresh it automatically.

- **Monthly trend** shows expenses and incomes as bars with a net line and a
  month-by-month table, in base currency, for the same report date range. Empty
  months stay visible as zero. Partial first/last months count only in-range days
  and show their covered dates. Each month's expense, income, and net totals keep
  their own explicit unconverted currency amounts and provisional-rate markers.
  Net is converted and rounded independently from exact income minus expense
  lines, not calculated by subtracting rounded display totals.

- Choose **Cash flow** to draw income main categories (including uncategorized
  income) through **Income** to expense main categories. A **From savings / deficit**
  source or **Saved / surplus** sink balances unequal flows. These are balancing
  amounts for the selected range, not account balances or actual savings transfers.
- Cash-flow data comes from the profile application query. Each category converts
  exactly and rounds once to base-currency hundredths; links reuse that value.
  The central node and balancing amount sum those rounded flows, so they can differ
  slightly from a whole-period aggregate rounded once. Unconverted income and
  expenses remain separate by currency and never enter the diagram.

### Manual Spending pace chart check

Run `npm run dev` with synthetic HUF/CHF expenses across this month and the prior
three months. In Reports, check pie/bar category drill-down and custom ranges,
then switch to **Spending pace**. Verify its current-month dates stay independent
of the category range. Check total and main-category current/average amounts,
ahead/behind amount and percent, split parts, uncategorized lines, categories
used only in earlier months, empty months, and zero baselines. Include expenses
at both window endpoints and just after the same day in earlier months; check
31st-day comparisons include February’s last day and 30-day months’ last day.
Include excluded expenses, income, transfers, and adjustments and verify they
never inflate pace. Test an offline/missing-rate month: its currency bucket must
be visible, the total/category comparison marked partial, and cached provisional
rates flagged. Refresh rates and pace and verify the numbers update. Repeat in
HU/EN/DE, light/dark themes, and with keyboard navigation; check bar labels,
tooltip currency formatting/contrast, and narrow-window table scrolling. Charts
remain manual checks; temporary SQLite profile-application tests cover the pace
query, injected clock, leap/non-leap clamping, grouping/exclusions, and exact
conversion/rounding.

### Manual Monthly trend chart check

Run `npm run dev` with synthetic HUF/CHF expenses and income over several months,
including an empty month, split categories, uncategorized lines, excluded
transactions, transfers with included/excluded fees, and balance adjustments.
In **Reports**, check both category charts and their drill-down, then switch to
**Monthly trend**. Verify expense/income bars, the positive/negative net line,
legend, tooltips, and table agree with the known amounts. Try every preset and a
custom range starting/ending mid-month, a single day, year rollover, and leap
February; only in-range days count and partial labels show the covered dates.
Check zeros in empty months, separate missing-rate amounts in each month's
expense/income/net cells (not plotted as converted values), and provisional-rate
markers when using stale cached rates. Switch base currency and repeat in HU/EN/DE
and light/dark themes; confirm localized month/money labels, themed axes/series/
tooltips, horizontal scrolling for long ranges, keyboard range/tab controls, and
loading/error states. Chart rendering remains a manual check; application-API
SQLite tests cover the aggregation and translation completeness is automated.

### Manual Cash-flow chart check

Run `npm run dev` with synthetic HUF and CHF accounts, income and expense main
categories/subcategories, split parts, uncategorized lines, excluded transactions,
transfers (with and without ordinary fees), and balance adjustments. Repeat in
HU/EN/DE and light/dark themes. Apply every preset and an inclusive custom range;
verify the category pie/bar charts, drill-down and Transactions link still work.
Switch to **Cash flow** and verify the same applied range is retained. Check equal
income/expense, surplus, deficit, income-only, expense-only, empty and missing-rate-only
ranges: categories flow through Income and the balancing source/sink appears only
when needed. Check both kinds of uncategorized group, split parts grouped by their
own main category, archived category history, and exclusions. Only ordinary transfer
fees count, never transfer legs or balance adjustments.

Hover nodes and links and check locale-formatted base-currency tooltips, translated
seeded/balancing labels, preserved custom names, readable theme colors, and the
text table (including full long names). Resize the window and check horizontal
scrolling without clipped chart controls. Change base currency and verify dated
conversion and previous-published-day fallback. With missing or stale cached rates,
verify separate unconverted income/expense amounts and the provisional indicator;
neither bucket enters the diagram. Use small fractional conversions to check links
match rounded category values and central inflow equals outflow; the rounding note
explains differences from whole-period totals. Check loading/error/empty messages,
keyboard navigation of view/range controls, and switching views/languages while a
query is pending. Charts remain manual checks; temporary SQLite application-API
tests cover cash-flow values, balancing, exclusions, splits, cached conversion,
missing buckets, staleness, range validation and empty data.

## Accounts

- Create an account with a name, HUF or CHF currency, an opening balance, and a
  valid calendar opening date. The shared calculator amount field accepts dot or
  comma decimals and thousands grouping, and allows negative or zero opening
  balances. See **Amount calculator** below.
- Money is stored as exact integer hundredths for both currencies. CHF displays
  two decimal places; HUF displays no decimals (rounded for display only).
- Rename accounts or change their currency while they have no transactions.
  Changing currency changes the denomination, not the amount; it is not a
  currency conversion. Account-scoped rule amount bounds keep their numeric
  values and follow the new currency; undo restores both the account and rules.
- Archive an account to hide it from account pickers without deleting it. Archived
  accounts remain visible on Accounts with their balance and opening date and can
  be unarchived.
- Delete an account after confirming in the page. An opening balance alone does
  not prevent deletion: "empty" means no transactions.
- Account create, rename, currency change, archive/unarchive, and delete commands
  offer the shared Undo toast and work with `Ctrl+Z`. Undo and shell navigation
  wait while an account command is running.
- Balances walk the dated account history and include the opening balance, income,
  expenses (including linked transfer fees), both signed transfer legs, and the
  recomputed effects of balance adjustments. Accounts with any of those movements
  cannot be deleted or have their currency changed; archive them instead.

## Categories

- **Settings → Categories** lists expense and income categories separately, with
  main categories followed by their subcategories. New and existing profiles get
  translated defaults through migration 4: Food (Groceries, Restaurants), Housing
  (Rent, Utilities), Transport (Public transport, Car), Health, Entertainment,
  Clothing, Subscriptions, Other expenses, Fees, Salary, and Other income.
  Fees is the default category for optional transfer fees.
- Default names follow the profile language immediately (HU/EN/DE). Renaming
  stores a custom name that always wins over translation. User-created categories
  always have a custom name. UUIDs and immutable default seed keys stay stable;
  reopening never overwrites names, ordering, archive flags, or deleted defaults.
- Add a main category or a subcategory under an active main category of the same
  kind. A third level and cross-kind parents are rejected. Move up/down reorders
  siblings without changing the hierarchy or the other kind's ordering.
- Archive a category to hide it from pickers while keeping it in Settings.
  Archiving a main category also hides its subcategories from pickers, without
  changing the subcategories' own archive flags. Unarchive reverses the category's
  own archive flag.
- Deletion requires confirmation. Delete subcategories before their main category;
  deletion does not cascade. A replacement must be a different active category
  of the same kind, not hidden by an archived parent.
- Categories used by transaction lines require an active same-kind replacement
  when deleted. Reassignment and deletion happen atomically, so transaction
  lines are never orphaned. Replacement also retargets rules and transaction
  templates in the same command; undo restores all original references.
- Category create, rename, reorder, archive/unarchive, and delete commands use
  the shared Undo toast and `Ctrl+Z`; delete undo restores replacement links.
  Undo snapshots only affected categories and references. Reordering captures
  sibling categories only and leaves lines, templates, and rules untouched.

## Transactions

- **Transactions → Record transaction** opens a right-side drawer for an expense,
  income, or transfer. Expenses and income choose one non-archived account, a
  calendar date no later than today, a positive amount, an optional payee and
  category, any number of tags, and a note.
- A transfer is one record containing source and destination accounts and positive
  amounts, date, and note. The accounts must differ. Same-currency amounts must
  match; cross-currency amounts are both authoritative and the list derives and
  displays the actual rate without storing a floating-point rate.
- An optional transfer fee is a linked ordinary expense on the source account,
  defaulting to the seeded Fees category. Creating, editing, deleting, and undoing
  a transfer changes its fee atomically as one command. Transfer fees count in
  expense totals unless marked Excluded in the transfer drawer. Transfers use
  appended migration 9, after the unchanged excluded-transactions migration 8.
- Amount entry uses the same calculator field as Accounts for expenses, income,
  both transfer amounts, and optional fees, with a positive result required.
  Amounts are persisted as exact integer hundredths. HUF is displayed without
  decimals; CHF is displayed with two decimals.
- The payee field queries ranked autocomplete suggestions: more frequently used
  payees come first, with recency breaking equal-frequency ties. Typing a new
  payee creates it in the active profile. An existing payee with the same
  Unicode-normalized name ignoring case is reused. A case- and
  diacritic-insensitive alias resolves to its payee. Category choices are limited to active
  expense or income categories matching the transaction kind and preserve the
  two-level hierarchy.
- Every transaction has one or more lines. Use **Split** in the drawer to add
  parts with their own positive calculator amount, nullable category, note, and
  tags; the remaining-amount indicator must reach zero before saving. Returning
  to one part is supported. Saving validates inside the write transaction that
  at least one line exists and the exact integer-hundredth line sum equals the
  header total. The transaction table marks splits and expands their parts.
  Category and tag filters include a split when one part matches and totals count
  only matching parts. The Excluded flag remains on the transaction header and
  therefore excludes every part from totals. Per-line notes use appended
  migration 13 after unchanged migrations 10–12.
- Saved and new expense/income drawers accept JPEG, PNG, WebP, and PDF
  attachments through **Add** or the drop zone. The main process detects the
  type from file contents and rejects unsupported or larger-than-25-MB sources.
  Images apply EXIF orientation and are downscaled only when their long side is
  over 2,000 pixels; smaller images and PDFs retain their exact bytes.
  Content-addressed immutable files live under
  `profiles/<id>/data/attachments/`, so identical stored content is copied only
  once. **Open** first copies an attachment to a per-run temporary folder; the
  immutable store path is never exposed to another application.
- Attach, remove, create-with-attachments, and transaction deletion are atomic
  row commands and are undoable. Deleting a transaction with attachments offers
  either **Delete transaction and its attachments** or **Save attachment copies
  to a folder…, then delete**; copy names are de-duplicated in the selected
  folder. Content no longer referenced by either SQLite or the in-memory Undo
  history is swept on the next profile open. Transfers and balance adjustments
  do not accept attachments. Attachments use appended migration 21.
- Edit any listed transaction or transfer from the same drawer, or delete it after
  confirmation. Create, edit, delete, category reassignment, and balance updates
  run through the profile application command boundary in one SQLite transaction.
- After a transaction or transfer is created, edited, or deleted, a toast offers **Undo**.
  `Ctrl+Z` also undoes the last change unless focus is in a text
  editing control. Undo restores the transaction header, all of its lines,
  timestamps, identifiers, payee reference, and any payee created by that command
  from before/after aggregate images captured in the original write transaction.
  Tag associations and inline-created tags are included; undo removes only tags
  created by the undone command, not reused tags. Tag rename and delete use the
  same undo extension point and offer the same toast and keyboard action.
  Transfer undo includes both legs and its linked fee.
  History is in memory for the open profile only and is cleared by profile
  switching, restart, restore, or another profile write that has no declared undo
  aggregate. Account and category commands use the same undo history.
- **Settings → Payees** lists each payee and its raw-name aliases. Alias keys are
  unique within the profile ignoring case and diacritics. Add and remove alias
  commands are undoable. Merging moves every transaction and alias to the chosen
  surviving payee, keeps the merged name as an alias, and is undoable as one
  command. Payee aliases use appended migration 12 after the unchanged tag and
  target-based balance-adjustment migrations 10–11.
- **Settings → Categorisation rules** manages profile-scoped, enabled/disabled
  rules in explicit priority order. The first matching rule wins. A rule accepts
  any nonempty combination of canonical payee (aliases resolve to it), text
  contained in the note, account, and inclusive amount bounds. Note matching
  ignores case and diacritics. Amount bounds carry a currency: an account-scoped
  rule uses that account's currency; otherwise the editor defaults to the base
  currency and lets it be chosen. Other-currency transactions do not match.
  The rule list displays bounds with that currency. Rules whose account or
  category was later archived can still be disabled or edited; changing a
  reference requires an active account/category.
  Actions set a payee, set a category, and/or add existing tags.
  Matching is deterministic and entirely local; it uses no AI or network service.
  Create, edit, delete, and reorder are undoable commands. Rules prefill new
  drafts only; applying them retrospectively is out of scope.
- In a new unsplit expense/income drawer, category and tags are prefilled from
  the first matching rule, otherwise from the latest unsplit transaction for the
  canonical payee, otherwise left empty. This is prefill only: a category or tag
  field the user has changed is never overwritten by later asynchronous
  reevaluation. A category or nonempty tag list supplied by a transaction template
  is treated like user-entered values and is also protected; omitted fields may
  still receive rule or last-used prefill. All values remain editable before save.
- A rule's payee action fills only an empty, untouched payee field. A typed,
  cleared, or template-provided payee is never overwritten.
- After saving an unsplit expense/income with category or tags changed by hand,
  a follow-up toast offers **Create rule**, alongside the existing Undo toast.
  It opens the same editor as Settings, prefilled with the saved canonical payee
  condition (including alias resolution), or note-contains if there is no payee,
  and the saved category/tag actions. Rule creation is undoable. Unchanged
  template/duplicate values and autofill alone do not trigger the offer; neither
  do saves with no usable condition or no category/tag action. Split categories
  cannot be represented by a single rule action, so split saves do not offer one.
- Categorisation rules use migration 15 for their original schema. Appended
  migration 16 adds payee actions, currency-aware amount conditions, and the
  broader condition constraint without changing migrations 1–15.

### Manual Attachments check

Run `npm run dev` with synthetic files only. In a new expense/income drawer,
add several JPEG/PNG/WebP/PDF files with the native picker and with drag and
drop, remove one staged file, save, and reopen the transaction. Verify names,
sizes, type icons, ordering, split support, and translated errors for an
unsupported file and a source over 25 MB. Open each attachment and confirm the
temporary copy launches while edits to that copy do not change the stored file.
Attach and remove files on a saved transaction and undo each operation. Delete
a transaction with attachments using both choices: first delete directly and
undo; then save copies to a folder containing a same-named file, verify the
de-duplicated names, delete, and undo. Repeat in HU/EN/DE and with keyboard
navigation and light/dark themes. Close and reopen a profile to check referenced
files remain and removed content is swept. Create two startup backups with a new
attachment between them, remove a live stored file, restore the relevant backup,
and verify the attachment opens again.

Build with `npx electron-builder --win nsis --publish never`, then run
`"release/win-unpacked/Financial Tracker.exe" --smoke-test`. It must print
`SQLite smoke test OK`, `Image smoke test OK`, `OCR smoke test OK`, and
`QR smoke test OK`, then exit
successfully.

## Receipt inbox

- Drop JPEG, PNG, or WebP receipt photos anywhere on the main window to add
  them to the open profile's **Receipt inbox**. PDF and other files are rejected,
  and every photo uses the same 25 MB limit, orientation correction, and
  2,000-pixel image bound as transaction image attachments.
- The sidebar badge counts received and read photos. The inbox lists them oldest
  first with a thumbnail, original name, received date, and intake source.
- Receipt OCR runs only on this PC with bundled Hungarian, German, and English
  Tesseract models selected from the profile language with English fallback. No
  receipt or OCR text is sent to a network service. Before recognition, a
  transient copy is converted to grayscale, contrast-normalised, adaptively
  binarised, deskewed, and enlarged when small; the stored colour photo is not
  changed.
- Open a receipt to view its photo beside an editable transaction form. OCR can
  prefill payee (including aliases, categorisation rules, and last-used values),
  date, amount, and a matching active HUF/CHF account. A detected currency with
  no matching account is shown as a hint. Confirming creates the transaction
  with exactly that photo as its attachment; discarding hides the receipt. Both
  decisions are undoable.
- OCR is a convenience, not an authority: thermal paper, blur, unusual layouts,
  and handwriting can reduce accuracy, so every field must be checked. Line-item
  extraction and split suggestions are intentionally out of scope.
- Inbox intake is a background write and does not replace or clear the existing
  Undo history. Active inbox photos are retained by the attachment sweep and are
  included in the incremental attachment backup pool and restore process.
- Each profile can choose a watched folder in **Settings**. Any local folder
  outside the app's user-data directory, including one synced by Google Drive
  for Desktop or OneDrive, can feed JPEG,
  PNG, and WebP photos into that profile's inbox. The app checks only top-level
  files, ignores hidden and temporary sync files, and retries unavailable folders
  every 30 seconds.
- A photo is accepted only after its size and modification time remain unchanged
  for at least two seconds and Windows allows it to be moved. Accepted files move
  into a `feldolgozott` subfolder and are never deleted. Existing names gain
  ` (2)`, ` (3)`, and so on before the extension. Photos added while the app is
  closed are scanned when the profile next opens.

### Manual receipt-inbox check

Run `npm run dev` with synthetic images only. Drop several JPEG/PNG/WebP photos
onto the main window, verify the drop overlay, oldest-first rows, thumbnails and
sidebar count, then restart and confirm the items persist. Open a photo, complete
the transaction form, verify the reading/low-confidence and OCR-field indicators,
edit every prefilled field, confirm with Enter and Ctrl+Enter, and verify the
created transaction has exactly that photo attached. Test Hungarian, German,
Swiss, and unreadable synthetic receipt images; verify aliases/rules and
currency-matching accounts are suggested, while an unsupported detected
currency keeps the default account and shows a hint. Discard another receipt and use
Undo to return it; also undo a confirmation and verify both the transaction and
inbox state return correctly. Drop a PDF or another non-image file and verify a
translated rejection. With the transaction drawer open, drop an image on its
attachment drop zone and verify it attaches to that transaction instead of
entering the receipt inbox. Restart while an item is waiting and confirm OCR is
retried. Repeat in HU/EN/DE, using only the keyboard where applicable, and check
light/dark and narrow-window layouts. For a packaged build, also run the smoke
test above with networking disabled.

### Phone upload

Choose **Upload from phone** in the **Receipt inbox** to start a temporary HTTP
server on a private IPv4 network connection. The dialog shows the local address
and a QR code, and offers a connection picker when the PC has several eligible
private interfaces. The page accepts JPEG, PNG, and WebP photos directly into
the open profile's receipt inbox. Its random 256-bit URL token remains valid for
the batch, while the server limits each photo to 25 MB, accepts at most two
uploads concurrently and 50 in one session, and stops after 10 minutes, when
the dialog closes, when the profile changes, or when the app quits. No receipt
is sent to a cloud service.
The page, token, and photos travel over plain HTTP on the local network, so
anyone on the same network who sees the URL could upload or read uploads during
that session; use phone upload only on trusted private Wi-Fi.

#### Manual phone-upload check

Run `npm run dev` with synthetic images only and put a phone and the PC on the
same private Wi-Fi. Open **Receipt inbox → Upload from phone**, scan the QR code
with the phone, and if Windows shows a firewall prompt, allow **Financial
Tracker** on **Private networks only**. Take or select several JPEG/PNG/WebP
photos in one batch and verify each result on the phone page, the dialog's
uploaded count, and the inbox list/sidebar counter. Try a non-image file and
verify the phone page reports rejection without adding it. Close the dialog and
verify its URL no longer connects; repeat and leave it open for 10 minutes to
verify automatic shutdown. If the phone cannot connect, confirm both devices
use the same Wi-Fi and Windows marks the network as Private. Repeat in HU/EN/DE
and, where available, choose each listed private network interface.

### Manual watched-folder check

Choose a synthetic Google Drive for Desktop folder as the watched folder and
verify Settings shows **Watching**. Add a photo while the app is running and one
while the profile is closed; both must enter the inbox after the profile opens.
Simulate a half-synced file by continuing to append bytes and verify it is not
moved until its size and modification time stay stable for two seconds. Hold a
photo open so Windows locks it, verify intake waits, then release it and verify a
later scan succeeds. Confirm every accepted photo moves to `feldolgozott`, files
already there are ignored, and a same-named destination produces ` (2)` without
overwriting either file. Temporarily disconnect or rename the folder and verify
the status changes to **Folder unavailable**, then returns to **Watching** when
the folder is available again. Try the app's user-data folder and a folder inside
it, and verify each is rejected with a translated error. Clear the setting and
verify new photos remain in place.

### Manual Categorisation rules check

Run `npm run dev` with synthetic payees, aliases, tags, categorized and
uncategorized transactions. In **Settings → Categorisation rules**, create two
rules that both match and move them up/down; verify only the first one prefills a
new drawer. Check canonical and alias payee input, accented/unaccented text in
the note (and verify payee text alone does not satisfy it), account and inclusive
amount boundaries in both currencies and check the currency beside list bounds.
Archive a referenced account/category, then disable and edit its rule without
changing the archived reference; new archived references must be rejected. Check
disabled rules and payee-only,
category-only, and tag-only actions. With no matching rule, verify the latest
unsplit category and tags for that payee are used; with no payee history, verify
both stay empty. Change category/tags by hand, then alter amount, account, payee,
or note and verify asynchronous reevaluation never overwrites those changes.
Check a note-only rule with a payee action: an empty untouched payee fills;
changing the note/amount/account never replaces a typed payee. Clear it by hand
and verify it stays empty after reevaluation. A template payee also stays intact.

Manually choose a different category, add an inline tag, and save an expense;
verify **Create rule** appears in the follow-up toast while Undo remains available.
Open it, verify the canonical payee condition (also try an alias), category and
newly persisted tag selections, edit the prefill, and save. Verify it is listed in
Settings and prefills a later matching draft; undo rule creation, then undo the
transaction. Repeat with income, tags only, and no payee but a nonempty note
(note-contains prefill). Cancel/Esc from the editor and dismiss the offer. Check
keyboard focus trapping/restoration and a failed rule save that leaves the editor
open with a translated error. Verify no offer after autofill alone, unchanged
category/tags from a template or duplicate, reverting manual category/tag changes,
a split, or a save with neither payee nor note. Change template/duplicate values
by hand and verify the offer does appear. Save and add another, then close the
next drawer to access the offer; the next draft must not inherit manual-edit
tracking. Undo the transaction before accepting an offer and verify it disappears.
Also undo create, edit, reorder, enable/disable, and delete. Repeat in HU/EN/DE
and light/dark themes.

- Mark an expense or income as **Excluded** in the create/edit drawer when it
  should affect its account balance but not spending/income totals (for example,
  an expense awaiting reimbursement). The table shows an Excluded badge. The
  **Excluded transactions** filter offers all transactions (default), only
  excluded, or hide excluded and combines with the other filters. Only-excluded
  hides transfers and balance adjustments; hide-excluded keeps both (neither has an exclusion flag). Filtered-set
  and whole-day totals always ignore excluded amounts, including in the
  only-excluded view, where matching days/currencies show zero totals. Saving a
  flag change uses the same Undo toast and Ctrl+Z as other transaction edits.
  Existing transactions remain included when upgrading via migration 8.
- **Set real balance** opens the drawer for a balance adjustment: an account's
  observed balance on a non-future date, with an optional note. The stored value
  is the observation, never a fixed delta. Its displayed difference is recomputed
  as history changes, so an earlier forgotten movement is absorbed instead of
  counted twice. Adjustments affect balances but never expense/income totals;
  they have a distinct list row and a **No correction needed** flag when their
  current difference is zero. Create, edit, delete, and undo use the same profile
  command boundary. Migration 11 appends the adjustment table after tags, preserving migrations 8–10 unchanged.
- Account history is chronological. On one calendar day the opening balance is
  applied first, ordinary transactions (including linked fee expenses) and transfer legs are applied next, and
  adjustments apply at the end of the day in creation-time/UUID order. Therefore
  a movement entered later for an adjustment's date is included before that
  observation and changes the adjustment's effective difference.
- The dense table is newest first (date, creation timestamp, then UUID), grouped
  by day, with income/expense signs and icons. Transfers have a distinct row and
  icon and show both accounts and amounts. Each day shows totals for that
  whole filtered day, even when it continues onto another page. Only the visible
  rows plus a small overscan are mounted in the fixed-height scrolling viewport.
- Combine period (all dates, this month, last month, this year, or an inclusive
  custom range), account, category, payee, tag, and free-text filters with **Apply
  filters**. Presets use the application's injected clock. A main category
  includes its subcategories; archived accounts/categories remain filterable.
  Free text matches payee name or note, ignoring case and diacritics, and treats
  punctuation literally. Different filters combine with AND.
- Account filters include either transfer leg. Filtered-set and daily
  expense/income totals aggregate transaction lines, never transfer legs, and
  stay separate by currency (HUF and CHF), without conversion, and include all matching transactions, not only
  the current page. Queries return bounded pages (default 100, maximum 500);
  the UI uses 200-row pages. Row and aggregate queries share one read snapshot.
- Offset paging fits the numbered previous/next windows and known filtered
  count. The appended migration 6 indexes newest order, account, payee, and
  category parent lookup; existing transaction-line indexes serve category
  matching. Keyset paging would improve deep sequential scans and stability
  during external writes, but requires cursor state and cannot directly address
  arbitrary windows. At the v0.1 20 000-transaction scale, offset is sufficient;
  local writes reset to the first page to avoid stale offsets. Each list call
  materializes the filtered movement identities once inside its read transaction,
  batches row/line/tag loading, and computes adjustment history once per account.
  The performance test includes transfers and adjustments and times a filtered
  first page plus all aggregates with a generous 500 ms local bound, arranging
  the fixture through application commands in one outer transaction.

### CSV export

**Transactions → Export CSV**, beside **Apply filters**, exports the currently
applied filters (not unsubmitted filter edits) across every page. The small
export dialog defaults to the profile language's decimal separator and offers a
dot/comma override. **Save CSV** opens a native save dialog with a dated default
filename. Cancelling does not write a file; write failures remain visible in the
export dialog. Export is a read-only query and does not change Undo history.

The UTF-8 file includes a BOM for Excel and uses CRLF records with RFC 4180
quoting. HU/DE use comma decimals and semicolon-separated fields; EN uses dot
decimals and comma-separated fields. An override changes both separators but
keeps headers, kinds, yes/no values, and default category names in the profile
language. Amounts use exact signed integer hundredths in both HUF and CHF,
always with two decimals and no thousands grouping; no currency conversion is
performed.

Columns are date (ISO YYYY-MM-DD), account, kind, payee, main category,
subcategory, amount, currency, note, tags, and excluded. Matching expenses and
income produce one row per line, including every part of a matching split;
parts share the transaction date/account/payee. Uncategorized lines have empty
category cells. Notes prefer the line note, falling back to the transaction note;
tags are comma-separated inside one cell. Excluded transactions follow the
applied exclusion filter. Transfers and balance adjustments are never exported,
but their ordinary linked fee expenses are. Text cells beginning with `=`, `+`,
`-`, `@`, tab, or CR receive a leading single quote to prevent spreadsheet formula
injection; signed numeric amount cells never receive that prefix.

### Manual CSV export check

Run `npm run dev` with synthetic data, then repeat in HU/EN/DE and light/dark
appearance. Combine period, account, main/subcategory, payee, tag, search, and
exclusion filters; apply them, change an unapplied filter, and verify export still
uses the applied set across all pages. Include a split with different categories,
notes, and tags, excluded expenses/income, uncategorized lines, transfers with
fees, and balance adjustments. Verify one row per split part and no transfer or
adjustment rows, while ordinary fee expenses remain. Check the dated filename,
export-dialog Tab/Shift+Tab focus trapping, Esc/cancel focus restoration, native
save cancellation (no success message), overwrite confirmation, and a failed
write (translated error, no success message). Export using both decimal choices
and open the files in Excel: verify delimiters, negative expenses, positive
income, two decimals including HUF, `őűäöüß`, multiline/quoted notes, and text
starting with formula characters remaining text. Verify export leaves Ctrl+Z
available for the previous command. Native dialogs and Excel behavior remain
manual checks; temporary SQLite application-API tests cover the CSV contents,
filters, paging bypass, validation, exact money, and unchanged undo history.

### Duplicate and transaction templates

- **Duplicate transaction** in an expense/income row or its edit drawer immediately
  records a copy dated today (using the application's clock). The source stays
  unchanged. The copy has fresh transaction/line identifiers and timestamps,
  while preserving its account, kind, amounts, payee, note, excluded flag, every
  stored line, category, and line-tag association. Duplication and undo run through
  the same profile application command boundary; Undo removes only the copy.
  Transfers and balance adjustments are not duplicated by this action. The copy
  retains the source payee identifier, including any prior payee merge.
- **Transaction templates** opens the drawer's template picker, also available
  from **Record transaction**. Create a template from scratch, or open a saved
  expense/income transaction and choose **Save as template** with a name. This
  uses the saved transaction, not unsaved drawer changes. Templates support only
  unsplit expense/income transactions, not transfers or adjustments. **Save as
  template** is disabled for saved split transactions; use a new unsplit template
  instead. The main process also rejects split sources.
- Only the template name is required (1–100 characters). Kind, account, positive
  amount, payee, category, tags, note, and the Excluded flag are optional. The
  amount uses the shared calculator and exact integer-hundredths storage. Template
  tags reference tag identities: renaming a tag updates the displayed
  template value and deleting it removes it from templates; undo restores the
  association. Saving creates missing tags inline and reuses existing names
  case-insensitively with Unicode NFC normalization, just like transaction tags.
  Undo removes only tags created by that template command, and only if unused
  by transactions, templates, or rules. Cancelling creates no tags. Payee text
  remains a prefill string. Creating or editing a template does not create
  payees, transactions, or balances.
- Select a template and choose **Use template** to replace the drawer draft with
  a new transaction dated today. An omitted kind defaults to its category's kind
  (otherwise expense), and an omitted account uses the first active account.
  Archived references are preserved in the draft, but must be replaced with active
  choices before saving a new transaction. Deleted account/category references
  become empty without blocking account/category deletion (a category replacement
  is retained instead when provided). Verify the draft
  before saving. A template without an amount leaves it blank, focuses the amount
  field, and requires a positive amount before the transaction can be saved.
  Every template use focuses Amount and supports Enter to save and Ctrl+Enter
  to save and add another. Payee text resolves through the same alias-aware
  transaction command as manual entry. Template-provided category/tags are
  protected from rule autofill just like manual choices; omitted fields can still
  be suggested. A template's Excluded flag is also prefilled. Duplicate preserves
  the source category/tags without reapplying
  rules. Deleting a template does not alter categorisation rules or transactions.
- Choose **Edit template**, or **Delete template** and confirm, in the same picker.
  Create, save-as-template, edit, and delete all offer the existing Undo toast and
  Ctrl+Z. Templates persist only in the active profile's database (migration 14);
  migration 16 moves template tags into an identity-based join table and adds the
  Excluded flag (unmatched legacy tag names are dropped);
  undo history remains session-only and clears on switching/reopening/restoring
  a profile or a successful write without an undo aggregate.

### Manual Duplicate and templates check

Run `npm run dev`. Duplicate an included expense, an excluded expense, and an
income from the table and drawer. Verify today's date, all values/tags, balances,
and totals, then use the toast and Ctrl+Z to remove just the copy. In the drawer,
create a name-only template, one with every optional field, and one without an
amount. Save fresh tag names and case variants, check reuse and the translated
hint, then undo create/edit and confirm only newly created unused tags disappear.
Cancel another new template and verify no payees/tags or transactions
were created. Save an existing transaction as a template and check unsaved edits
are not included. Include an excluded source/template and verify the flag is
copied into the draft and saved transaction (balance still changes; totals do not).
Apply a non-excluded template afterward and verify it clears the draft flag.
Saving unchanged template category/tags must not offer Create rule; changing them
by hand must. An unchanged duplicate offers no rule, while manually recategorizing
the copy does. Rename and delete a referenced tag, verify every template
updates, then undo the deletion. Edit and clear individual template fields, confirm/cancel
its deletion, and undo each template operation. With a matching categorisation
rule, use a template with a different category and tags; change payee, note,
account, and amount and verify the template values are not replaced. Verify
omitted template fields can still receive suggestions, and duplicating a source
with different category/tags does not reapply its matching rule. Interleave rule,
template, duplicate, transfer, and adjustment commands and undo in reverse order.
Use a variable-amount template:
verify focus moves to the empty amount field and blank, zero, and invalid amounts
cannot save; enter a calculator expression and save with Enter. Use a fixed-amount
template and save with Ctrl+Enter; verify the next draft has a blank amount and
no template values carried over. Test a payee alias in a template and check it
resolves to the canonical payee. Duplicate a split transaction and check every
part's category, note, tags, and exclusion; verify Save as template is disabled. Check category-only templates,
archived/deleted references, use from an income or transfer draft, and template
creation with no accounts. Switch profiles and restart to verify isolation,
persistence, and cleared undo history. Repeat with keyboard navigation, light/dark
appearance, and HU/EN/DE. These UI checks remain manual; real temporary SQLite
application-API tests cover duplicate fields and line-level tags/totals, injected
clock dates/timestamps, template optional fields, validation/atomicity, all new
command undo, profile isolation, migration preservation, and reopening.

### Manual Split check

Run `npm run dev`, create an expense, choose **Split**, and enter two calculator
amounts whose sum equals the total. Give the parts different categories, notes,
and tags; add and remove another part, then return to one part and split again.
Verify the remaining amount reaches zero, a nonzero remainder is rejected on
save, and reopening preserves every part. In the table, expand the Split
indicator and check each part. Apply each part's category and tag filters in
turn: the transaction remains one list row while filtered and daily totals show
only the matching part. Mark the transaction Excluded and verify every part is
omitted from totals. Edit/delete/undo and repeat in HU/EN/DE.

### Privacy mode

The shell header's **Privacy mode** eye/eye-off button, or **Ctrl+Shift+H**, hides
all monetary values. The shortcut also works while typing and inside dialogs;
plain H, Ctrl+H, text Undo, and other editing keys are unchanged. The translated
keyboard cheat sheet lists it. The choice is saved independently in each
profile (append-only migration 18), survives reopening, and is presentation-only:
toggling it neither creates an Undo entry nor clears existing Undo history.
Other settings changes, including a write mixed with privacy, still clear history.
A failed toggle shows the translated settings error and keeps the saved state.

Read-only values use the shared amount component: CSS blur, no text selection,
and an accessible **Hidden amount** replacement instead of exposing the value
to screen readers. Chart ticks, tooltips, SVG titles and other string-only
previews use **•••**, not SVG blur. Percentages and transfer exchange rates are
hidden too. Amount inputs (including calculator expressions, rule bounds and
template amounts) are readable **only while focused** so editing remains usable;
unfocused inputs are blurred password fields, and result previews stay hidden.
Privacy is a screen-sharing aid, not encryption: underlying data and CSV exports
are unchanged. Text written in notes/names is not scanned for amounts. Category
names, dates and transaction counts outside charts remain visible. Entire chart
areas, including their category labels, are blurred so bar lengths, slice sizes
and Sankey widths cannot be read.

### Manual Privacy mode check

Run `npm run dev` with synthetic HUF and CHF accounts, income/expenses, splits,
transfers, adjustments, templates and amount-bound rules, including cached and
missing exchange rates. Turn privacy on with the button and Ctrl+Shift+H: verify
**no readable amount anywhere** across Overview, Accounts, Transactions, Settings,
and every Reports view (breakdown pie/bar, monthly trend, spending pace and
cash-flow). Verify chart areas are blurred so bar lengths, pie slice sizes and
Sankey widths are unreadable. Check filtered/day/base-currency totals and unconverted parts,
opening/current balances, split parts/remainder, transfer rates, drawer previews,
rule bounds, template fields, CSV-dialog decimal preview, and toasts. Hover chart
points/bars/pie slices/Sankey nodes and check tooltips, axis ticks, SVG titles,
labels and table hover titles. Check keyboard chart navigation as well. Verify
screen readers announce Hidden amount (never a read-only value), selecting or
copying blurred values is blocked, and hovering never reveals them.

Focus an amount field: only that editable value becomes readable; Tab away and
verify it hides immediately while its calculator preview stays hidden. Try the
shortcut in amount/payee/note/search inputs, every drawer/dialog and shortcut
help; it must not alter the draft or steal text Undo. Toggle after a ledger write
and verify the Undo toast and Ctrl+Z still undo that write. Switch profiles,
restart and restore a backup to verify each profile's saved state; toggle off
and check exact original formatting. Repeat **every page/report in HU/EN/DE,
light/dark**. This is a visual/accessibility check, not a data-security guarantee.
Automated API tests cover persistence, isolation, reopen, validation and Undo;
pure tests cover private formatting and shortcut matching.

### Keyboard-first transaction entry

With a profile open and at least one active account, **N** or **Ctrl+N** opens a
new transaction drawer from any shell page and focuses Amount. These shortcuts
and **?** (shortcut help) do not interrupt typing in inputs, notes, selects, or
editable content. A **Keyboard shortcuts** button also opens the translated
HU/EN/DE cheat sheet. Shortcut definitions and pure matching live together in
`src/renderer/src/lib/shortcuts.ts`, including the existing Ctrl+Z command.

Inside the drawer:

- **Alt+1 / Alt+2 / Alt+3** select expense / income / transfer. New transactions
  support all three; existing expenses/income can switch between those two.
  Existing transfers cannot be converted to expenses/income or vice versa.
- **Tab / Shift+Tab** follow the displayed order: amount, date, type, account,
  the remaining type-specific fields, note, exclusion flag, and save/cancel
  actions. The template picker is also inside the drawer's focus trap; its own
  forms and buttons never submit the transaction draft. Focus stays inside the drawer or shortcut-help dialog and returns
  to the previous control on close (or Record transaction after changing pages).
- **Enter** saves from a field, including calculator amounts; in a multiline
  note it inserts a newline. Focused buttons retain their own Enter action, so
  Cancel and Close can still be activated normally. Native validation and the
  existing amount parser run before any write; failures keep the drawer open
  and show the translated error inside it.
- **Esc** cancels/closes without saving. Closing is disabled during a save.
- **Ctrl+Enter** saves and starts another new transaction, also from a note.
  Date, account(s), and type are retained; amounts, payee, category, note, and
  exclusion flags are cleared. A transfer's fee category resets to Fees.
  Amount receives focus again. The same action is available as a button.

Saving and adding another uses the same validated, undoable transaction/transfer
commands as ordinary Save. There is no new database command or migration.

### Manual keyboard-only entry check

Run `npm run dev` with a synthetic profile and active HUF and CHF accounts. Use
only the keyboard for the following, repeating in HU/EN/DE and light/dark themes:

1. From Overview, Accounts, and Settings, press N and Ctrl+N. Verify Transactions
   opens with Amount focused. Type an expression such as `12000/2`; Tab previews
   it. Walk every field and action with Tab/Shift+Tab and verify focus cannot
   escape the drawer. Change date/account, enter a payee/category/note, and save
   with Enter. Verify the transaction and account balance.
2. Open again; use Alt+1/2/3 to select each type. Complete an income, a
   same-currency transfer, and a HUF-to-CHF transfer, including destination amount
   and an optional fee, using only Tab, arrow keys, and typing. Check each save.
3. Enter a multiline note; Enter must add a newline, not save. Press Ctrl+Enter:
   verify exactly one transaction is saved, the drawer stays open on a new blank
   amount, and date/account(s)/type remain. Enter a second amount and repeat;
   verify amounts, payee, category, note, and flags did not carry over. Try a
   transfer batch as well, and then save normally to close.
4. Try `1+`, `1/0`, a missing required amount, tomorrow's date, and mismatched
   same-currency transfer amounts. Enter and Ctrl+Enter must not create records
   or reset the form. Fix the inputs and save once; check the Undo toast and
   Ctrl+Z after closing. Text-field Ctrl+Z must still edit text.
5. Open the drawer and press Esc; verify no write and focus restoration. Tab to
   Cancel and press Enter; it must cancel rather than save. Repeat with Close.
   While typing in payee, note, amount, and filter search, verify N, Ctrl+N, and
   ? do not open another drawer/help or replace the draft.
6. Outside typing controls, press ? and verify the translated cheat sheet opens.
   Cycle Tab/Shift+Tab, then Esc to close and restore focus. Also open help from
   the drawer's Close button with ?; closing help must return to that button,
   leave the draft unchanged, and keep subsequent Tab inside the drawer.
   With no active accounts, N must not open an unusable drawer; show the normal
   no-accounts guidance instead.

Renderer focus and full keyboard flow remain manual checks. Automated tests
cover the pure matcher (scope, modifiers, typing exclusions, multiline notes,
button activation, repeats, composition, and already-handled events) and the
existing profile-application SQLite seam covers persistence and undo.

### Amount calculator

Accounts opening balances, expense/income amounts, both transfer amounts, and
optional fees use one pure parser in
`src/shared/amount-expression.ts`, without `eval` or binary floating-point
arithmetic. Expressions accept `+ - * /`, ordinary precedence, parentheses, and
signed operands, up to 200 characters. Examples: `12000/2` → `6000`, `4490*3` →
`13470`, and `100+250-30` → `320`.

Both currencies have two-place **storage** precision (ADR 0002). Dot or comma
can be a decimal separator; spaces (including non-breaking spaces), dots, and
commas can group thousands. Groups must contain three digits. With both dot and
comma, the last separator is decimal: `1.234,5`, `1,234.5`, and `1 234,50` all
mean `1234.50`. A valid thousands grouping wins when the final group has more
than two digits: `1.234` means `1234` in both currencies; `1,5` means `1.50`.
For a single punctuation separator, a zero-leading input is treated as a
decimal, so `0.005` is a decimal.

Calculation uses exact BigInt rationals, with no intermediate rounding. The
**final** result is rounded once to the nearest hundredth, ties away from zero:
`1/3` → `0.33`, `2/3` → `0.67`, `0.005` → `0.01`, and `1/3*3` → `1.00`.
Division by zero, malformed expressions, unsafe integer-hundredth results, and
non-positive transaction results are rejected. Opening balances may be negative
or zero.

Leaving the field evaluates it and shows a translated result preview before
save. In Accounts, Enter in the amount field evaluates only; it does not save
the form. In the transaction drawer, Enter evaluates and saves the transaction,
matching the keyboard-first entry flow above. The original expression stays
editable. Changing it or the currency
hides the previous preview until reevaluation. Previews use the existing money
formatter: CHF shows two decimals, while HUF rounds to whole units for display
only; the stored result still retains hundredths.

### Manual Amount calculator check

Run `npm run dev`. In Accounts and in the transaction create/edit drawer, enter
`12000/2`, `4490*3`, `100+250-30`, `1,5`, `1.234`, `1 234,50`, `1.234,5`, and
`1,234.5` for HUF and CHF. Blur: verify the preview appears. In Accounts,
Enter also previews without saving; in the transaction drawer, Enter saves a
valid expression (use Tab to preview first). Check `1/3`, `2/3`, and `1/3*3` for
final-only rounding
(CHF previews `0.33`, `0.67`, and `1.00`). Change the expression or currency and
verify the old preview disappears. Try `1+`, `1/0`, and `90071992547409.92`:
check the inline validation and that saving does not create a record. Verify
`100-250` is rejected for transactions but accepted as an opening balance, and
that zero is accepted only for opening balances. Save valid results and reopen
an edited transaction to check the stored amount. Repeat in HU/EN/DE and with
keyboard navigation and light/dark themes. These renderer checks remain manual;
the automated pure-parser tests cover arithmetic, ambiguous inputs, rounding,
invalid expressions, sign constraints, and safe-integer bounds.

## Tags

- Tags use appended migration 10, after unchanged migrations 8 (excluded
  transactions) and 9 (transfers). Transfers and their linked fees do not accept
  tag input; a tag filter hides transfers and balance adjustments because neither has tags.
- In the expense/income drawer, choose an existing tag or type a new name, then
  press Enter or **Add tag**. Add several tags and remove individual tags before
  saving; a name still in the input is also included when saving. Cancelling
  creates nothing. Tag names are trimmed and must have 1–100 characters.
- Tags belong only to the active profile. As with payees, reuse ignores case
  with Unicode NFC normalization, including Hungarian/German accented names;
  accents themselves remain significant. Repeated equivalent names produce one
  association and keep the existing tag's spelling and identifier.
- The table shows tags and the tag filter combines with all other filters using
  AND. Filtered and daily totals cover the entire matching set, not only the
  current page. Multiple tags never multiply a transaction's amount.
- Expand **Transactions → Manage tags** to rename or delete a tag. Renaming
  changes its name everywhere without changing identity. A name already used by
  another tag is rejected (tags are not silently merged). Confirming deletion
  removes the tag and all its associations, not the transactions or balances;
  undo restores its exact identity, spelling, and associations.
- Removing tags from a transaction or deleting a transaction leaves the tags
  available for reuse. Tag rename/delete and transaction tag changes are
  undoable within the current profile session. Restart, profile switching,
  restore, and successful writes without an undo aggregate still clear history.

### Manual Tags check

Run `npm run dev` and open Transactions. Create a transaction with several tags
by typing and by choosing suggestions; save with a name still in the input.
Cancel a second draft with a new tag and verify it was not created. Reuse
`Élelmiszer`/`élelmiszer` and `Ärztin`/`ärztin`, verify each retains one tag with
its original spelling, and remove tags during edit. Combine tag, period,
account, category, payee, and search filters; compare whole-set/day totals and
page through more than 200 matches. Rename a tag, try a conflicting name, then
cancel and confirm tag deletion. Verify affected transactions remain and tags
and totals refresh. Use the toast and Ctrl+Z after create/edit/delete and tag
rename/delete; check tags and associations restore, including an unused reused
tag. Switch profiles and restart to check isolation, persistence, and cleared
undo history. Repeat with keyboard navigation, light/dark appearance, and
HU/EN/DE. UI checks remain manual; real SQLite application-API tests cover tag
reuse, filtering/totals, validation/atomicity, rename/delete, undo, isolation,
upgrade preservation, and reopening.

### Manual Transactions check

Run `npm run dev`, open a profile with active HUF and CHF accounts, and navigate
to Transactions. Record expenses, income, same-currency transfers, and a HUF↔CHF
transfer using calculator expressions and dot and comma decimals, a new
payee, and main/subcategories; verify the list and account balances update and
HUF is shown without decimals. Reuse the payee with different casing and confirm
it appears with its original spelling. Try tomorrow's date and mismatched category
kinds, then edit the date, account, kind, amount, payee, category, and note. Delete
after first cancelling the confirmation. Archive an account and category and
confirm neither appears in its drawer picker. Repeat in Hungarian, English, and
German and check translated validation, keyboard focus, and light/dark themes.
Verify the transfer row shows both accounts and the actual cross-currency rate,
account filters include either leg, transfer legs do not alter expense/income
totals, and an optional fee defaults to Fees. Try the calculator on both transfer
amounts and the optional fee, using Tab to preview before saving with Enter and
leaving the fee blank. Mark a fee Excluded, check balances stay unchanged while
expense totals
omit it, then edit/delete/undo the transfer and verify the fee flag is restored.
Use **Set real balance** for an account showing 51,500 HUF and observe 50,000 HUF
on 10 October. Check the distinct adjustment row shows a −1,500 HUF difference,
the account balance becomes 50,000 HUF, and expense/income totals do not change.
Then enter a forgotten 1,500 HUF expense dated 5 October: the difference must
become zero, the row must show **No correction needed**, and the balance must
stay 50,000 HUF. Try zero and negative observations, reject tomorrow's date,
then create, edit, delete, and undo an adjustment. Check period/account/search
filters include it, category/payee/tag/only-excluded filters do not, and
hide-excluded keeps it.
After create, edit, and delete, use
both the toast action and `Ctrl+Z` and verify
the exact previous transaction returns. While typing in amount, payee, note, or
filter input, verify `Ctrl+Z` edits the field instead of undoing a transaction.
Switch profiles after a change and verify the previous profile's command cannot
be undone. Mark both an expense and income as Excluded in the drawer and verify
that the badge appears, balances remain unchanged by toggling the flag, and both
filtered-set and day totals omit their amounts. Try all three exclusion filter
modes together with period/account/category/payee/search filters and paging;
only-excluded totals must be zero. Save a flag toggle, undo it using the toast
and Ctrl+Z, then delete an excluded transaction and undo the deletion; verify the
flag, balances, and totals return. Restart and check flags persist. Repeat the
badge, filter, and checkbox checks in HU/EN/DE, light/dark themes, and using only
the keyboard.
Combine all filters and compare whole-set totals with known amounts in both
currencies. Check custom endpoints, year/month rollover, main-category versus
subcategory selection, archived-history filters, and case/diacritic-insensitive
payee/note search. With more than 200 matching transactions, scroll to the bottom
and page forward/back; verify the day header totals still cover the whole day,
the browser mounts only a small row window, and edit/delete refreshes the first
page and totals. UI checks remain manual; the application-API tests cover filters,
calendar boundaries, stable paging, exact totals, excluded flags and filters,
undo, upgrade preservation, persistence, and the 20 000-transaction query bound.

### Manual Payees check

Record payees with different usage counts and last-used dates. Open the
transaction drawer, type part of a name, and verify autocomplete puts higher
frequency first and more recent payees first when frequencies match. In
Settings → Payees, add an alias containing accents, then type its unaccented,
different-case form in a new transaction and verify the canonical payee is used.
Remove and undo an alias. Merge two payees and verify their transactions and
aliases appear under the survivor, the merged name works as an alias, and one
Undo restores both payees exactly. Repeat in HU/EN/DE, light/dark themes, and
with keyboard navigation. Application-API tests cover ranking, folded alias
matching and uniqueness, merge, undo, and migration.

### Manual Categories check

Run `npm run dev`, open a profile, and go to Settings → Categories. Change language
among Hungarian, English, and German and check default names change immediately.
Rename a default and create custom main/subcategories; check their names survive
language changes, profile switches, and restart. Move categories up/down; confirm
only siblings move. Archive a main category and verify its subcategories are
marked hidden too. Try deletion, cancel, then confirm with an optional same-kind
replacement. Include a transaction, template, and rule referencing the deleted
category; verify replacement in all three and exact restoration with Undo.
Reorder then undo while these references exist; they must not change.
Delete subcategories before deleting their parent. Restore a backup
and verify the category list refreshes to the restored state. Repeat in light/dark
appearance and with keyboard navigation. UI checks are manual; application-API
SQLite tests cover defaults, language/custom-name precedence, hierarchy, ordering,
replacement validation, isolation, migration, and persistence.

### Manual shell check

Run `npm run dev`, navigate all five pages, and collapse/expand the sidebar.
In Settings, select each language and verify labels and formatting change live.
Select HUF and CHF as the base currency. Create a second profile with a different
language, theme, and base currency; switch between the profiles and restart the
app to verify that each profile restores its own choices.
Select Light and Dark, then Follow Windows; while following Windows, change
Windows' app color mode and verify the shell follows it. Explicit Light/Dark
must stay unchanged when Windows changes. Check keyboard navigation and focus
indicators with both sidebar sizes. UI behavior is checked manually, not by the
automated test suite.

### Manual help-hints check

Run `npm run dev` with synthetic data only (set `APPDATA` to a temporary folder
to keep it apart from real profiles). Repeat in HU/EN/DE, light/dark themes,
narrow and wide windows, and with transaction drawers and dialogs open. Visit
the profile picker, every page and report view, every Settings section and the
Quick Add window; verify each heading and non-obvious field/action has one
uncluttered question-mark hint (including Privacy mode, exchange-rate status,
base currency, formatting preview, and the Quick Add amount and tag fields),
while obvious fields such as names and dates do not. Read every text for
factual accuracy against the feature it explains.

Hover each hint and focus it with Tab: the translated tooltip must appear without
moving focus or shifting the surrounding layout. Click it and activate it with
Enter and Space to pin and toggle it; unpinned pointer leave, blur and Esc must
close it. In a transaction drawer, Enter or Space on the hint must not save, and
Esc on an open hint must close only the hint. With a hint focused, press `?` and
verify the keyboard-shortcut dialog opens exactly once and returns focus correctly.
Open a hint by hover while focus remains on another control, then press Esc:
only the hint must close, not its surrounding drawer or dialog. Move the pointer
away and back to verify the hint reopens. Activate a hint twice with click, Enter
and Space to verify the first activation pins it and the second closes it.

Check hints near every window edge, after scrolling, and in narrow drawers and
dialogs: tooltips must flip or shift inside the window, stay below the themed
title strip without overlapping the native minimize, maximize or close buttons,
remain above modal content, use the light/dark card tokens, and never block
typing or pointer use. With a screen reader, verify each button is announced as
“Help: <topic>” in the active language and its tooltip text is read as the
description. Every dialog, drawer, landmark and labelled region must be named
exactly by its visible heading, without a “Help: …” suffix, and in browse mode
the hidden tooltip texts must not appear as unrelated text at the end of the
document. Confirm focus traps still contain the hint buttons and no tooltip
itself receives focus.

### Manual backup check

Open a profile, go to Settings → Backups, and check that its startup snapshot
appears with a locale-formatted date and time in all three languages. Select a
snapshot, start restore, then cancel; verify no success message appears. Repeat
and confirm; verify the success message and that the profile remains usable,
including after closing and reopening the app. Open the profile repeatedly to
check only 10 startup backups are offered; `backups/pre-migration/` must remain
untouched. Automated application-API tests cover retention, concurrent SQLite
writing, confirmed restore, isolation, invalid snapshots, and migration-failure
recovery; UI behavior is checked manually.

### Manual Accounts check

Run `npm run dev`, open a profile, and navigate to Accounts. Create HUF and CHF
accounts with positive, zero, and negative opening balances; confirm HUF has no
decimals and CHF has two. Enter a comma decimal separator and verify the amount
round-trips after restarting. Rename an account, change its currency while empty,
archive it, and confirm it remains listed as archived. Edit an existing
transaction/transfer on archived accounts and verify the account names/currencies
remain available while new drafts list only active accounts. Create an amount rule
for an empty account, change its currency, verify the rule follows, and undo both.
While an account command is in flight, Ctrl+Z and the Undo button must wait;
after completion Undo should revert only that command. Try deleting an account,
cancel, then confirm deletion. Switch profiles and check that accounts remain
separate. Repeat with Hungarian/German and light/dark themes; check keyboard
navigation, focus indicators, and validation errors. UI checks are manual.

### Tray, close-to-tray and Windows startup

Closing the main window always hides it to the tray; it does **not** quit.
Left-click or double-click the tray icon, or choose **Open**, to restore and focus
it. **Quick add** opens the separate compact quick-add window and opens the last
used profile when necessary. Without a profile or active account, that window
shows the corresponding guidance. An already open main-window drawer/dialog and
its unsaved input are preserved. **Quit** stops the scheduler and closes the
profile through the existing shutdown path. Starting the app again normally
restores/focuses the existing window; a second launch with `--hidden` leaves its
current visibility unchanged. It never opens a second app instance. A standalone
`--hidden` launch creates only the tray icon and keeps the main window hidden
until requested.

The tooltip, menu, and first-close native notice use the active profile language,
falling back to the Windows locale and then English. Changing language, switching
profiles, or restoring a backup refreshes the tray labels. The notice is shown
once per app-data installation, not once per profile: its shown flag is
stored in validated, atomically replaced `app-settings.json` beside
`profiles.json` in the app's user-data folder. As with profiles, uninstall keeps
app data, so reinstalling with preserved data does not repeat the notice.

**Settings → Start with Windows** is off by default and shared by all profiles
on this Windows account. The preference is stored only in Windows' login-item
setting (no duplicate JSON preference that could become stale), using
`setLoginItemSettings({ openAtLogin, args: ['--hidden'] })` and reading back with
`getLoginItemSettings({ args: ['--hidden'] })`. Signing in starts the app hidden
in the tray. The toggle is disabled with an explanation in development mode and
on non-Windows platforms. OS shutdown/logoff and the updater's **Restart** bypass
close-to-tray; the updater closes the profile before launching installation.

### Manual tray and autostart check (installed NSIS build)

Use synthetic profiles and data only. Tray interaction, login items and native
window lifecycle are manual checks, not covered by the unit suite.

1. Run `npm run build`, then `npx electron-builder --win nsis --publish never`.
   Run `"release/win-unpacked/Financial Tracker.exe" --smoke-test` and also with
   `--hidden --smoke-test`: both must print **SQLite smoke test OK**, **Image
   smoke test OK**, **OCR smoke test OK**, then **QR smoke test OK** and exit
   with code 0 without a tray icon or window.
   Repeat the smoke test while a normal
   instance is running to check it does not acquire/block the single-instance
   lock or steal focus. Install the generated NSIS installer from `release/`.
2. On a fresh app-data installation, open Settings: **Start with Windows** must
   be unchecked. Open/create a synthetic profile and close the window using X
   and Alt+F4. Verify the window/taskbar entry disappears, the tray icon remains,
   and the small native keep-running notice appears on the first close only.
   Acknowledge it, restore, close again, switch profiles, quit/relaunch and close:
   the notice must not repeat. Check the Task Manager process is still running.
3. Restore via tray left-click, double-click and **Open**; each must show/focus
   the same window. Minimize and repeat. Choose **Quick add** from the tray while
   the main window is on Overview and Settings: verify the separate compact window
   opens with Amount focused. Save a synthetic transaction and check its account
   balance and Undo. Repeat without an open profile (the last used profile opens),
   without any profiles or accounts (translated guidance), and while a main-window
   drawer/dialog has unsaved input (it must remain intact). Switch profiles while
   quick add is open and verify its profile settings, accounts, categories, payees,
   tags, and saves all change to the newly active profile.
4. Change the active profile language through HU/EN/DE. Check tray tooltip,
   **Open**, **Quick add**, and **Quit** immediately update. Switch to a profile
   with another language and restore a backup with another language. Before
   opening a profile, verify the Windows-locale fallback (unsupported locale →
   English). Check the first-close notice in each language using separate clean
   synthetic app-data installations. Verify light/dark Settings and keyboard
   access to the startup toggle. In `npm run dev`, verify the toggle is disabled
   and the explanatory text appears.
5. Hide to tray or minimize, then launch the installed app again from its shortcut.
   Verify the same window restores/focuses and there is still one tray icon and
   one main application instance. Launch again with `--hidden` and verify it does
   not show a hidden window or change a visible window. Also test a rapid ordinary
   second launch during initial startup; it must show the existing window.
6. Enable **Start with Windows**, switch profiles and restart normally: verify
   the shared toggle remains on. Quit, sign out and sign in to Windows: verify
   exactly one tray icon starts automatically, with **no main window**. Open it
   from the tray, disable startup, quit and sign out/in again: no process/tray
   icon may autostart. Relaunch manually and verify the toggle is still off.
7. With a profile open and a scheduler active, choose tray **Quit**. Verify all
   app processes stop and no tray icon remains; relaunch and verify the database
   opens normally with saved data. Repeat Windows logoff/shutdown with the window
   both visible and hidden: there must be no close-to-tray notice or shutdown
   veto, and the profile must reopen cleanly afterward.
8. With an update downloaded in an installed build, choose the updater's
   **Restart** while the window is visible, and repeat after restoring from tray.
   Verify the old process exits, installation proceeds (close-to-tray must not
   block it), and the updated app starts and opens the profile cleanly. If an
   installation attempt fails synchronously, verify the profile and scheduler
   recover and subsequent window closes hide to tray again.

Automated pure tests cover temporary-folder app-settings defaults, persistence,
validation, atomic replace/retries/failure preservation, translated menu templates
and language fallback/rebuilds, strict autostart input, and exact `--hidden`
argument parsing. No ledger schema change is required.

### Manual window chrome check (installed NSIS build)

Use synthetic profiles and data only. Windows icon caching, native title-bar
behavior and taskbar integration are manual checks, not covered by the unit suite.

1. Run `npm run build`, then `npx electron-builder --win nsis --publish never`.
   Verify the generated installer, `release/win-unpacked/Financial Tracker.exe`,
   desktop shortcut, Start menu entry, Apps list and uninstaller show the dark
   navy icon with three mint bars instead of Electron's icon. Repeat at 100%,
   125%, 150% and 200% display scaling and check the small tray, shortcut and
   taskbar icons remain legible.
2. Install or update the generated NSIS build. Windows may retain an older cached
   shortcut or pinned-taskbar icon; if it does, unpin the old entry, remove and
   recreate the shortcut or restart Windows Explorer, then launch the updated
   app again. Windows does not allow the app to pin itself: right-click the
   running taskbar button and choose **Pin to taskbar**, then relaunch from the
   pinned icon and verify the same app icon appears in the taskbar and Alt+Tab.
3. Open the profile picker, an active profile and the quick-add window. Verify
   each has no File/Edit/View/Window/Help menu or white system caption. The top
   strip must show the app icon and **Financial Tracker**, plus the active
   profile name when one is open. Repeat with a collapsed sidebar and a narrow
   window; text may truncate, but it must not overlap the native minimize,
   maximize and close buttons.
4. Drag each window from empty title-bar space, double-click to maximize/restore,
   and hover the native maximize button to open Windows snap layouts. Verify all
   three native buttons remain clickable and no app button or form control falls
   inside the draggable region.
5. Select Light and Dark, then Follow Windows and change Windows' app color mode.
   Verify the drawn strip and native window buttons update immediately in the
   main window, profile picker and an already-open quick-add window. Rename or
   switch the active profile and verify the title updates without reopening the
   quick-add window.
6. In the installed build, verify Ctrl+=, Ctrl+-, and Ctrl+0 change/reset zoom.
   In text inputs, verify Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A and text undo still work.
   Recheck Ctrl+Z ledger undo, Ctrl+Shift+H, N, Ctrl+N, ?, Alt+1–3,
   Ctrl+Enter, Esc and global Ctrl+Alt+N. Ctrl+R, Ctrl+Shift+R,
   Ctrl+Shift+I and F12 must not reload the app or open developer tools.
