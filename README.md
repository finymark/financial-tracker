# Financial Tracker

A local-first personal expense tracker for Windows, built with Electron, React,
TypeScript, and SQLite. The app opens to a collapsible sidebar with Overview,
Transactions, Accounts, and Settings pages. On start you pick or create a
profile; each profile has its own SQLite database and data folder. Financial
data stays local. Accounts track opening balances, signed expense/income
transactions, both legs of transfers, and target-based balance adjustments.
Settings includes payee alias/merge management and two-level expense/income
category management.

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
transfer, balance adjustment, payee, tag, and backup commands/queries. Every IPC input is validated in the main
process, and every handler rejects calls not sent by the app's own renderer frame.
Production CSP permits only same-origin connections; localhost WebSockets are
added only by the development server for hot reload. SQLite foreign-key
enforcement and shared Unicode text functions are enabled when each profile
connection opens. Financial writes use the profile application API, with each command
executed in one SQLite transaction. SQLite is used only in the main
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
signing is not configured. Executable resource editing is disabled, so the
installer/app currently use Electron's default icon. Native SQLite binaries are
explicitly unpacked from asar, and native dependency rebuilding is disabled:
`better-sqlite3` 13 already ships the compatible Node-API binary.

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

Check the packaged native module from PowerShell:

```powershell
$exe = Join-Path $PWD 'release/win-unpacked/Financial Tracker.exe'
$log = Join-Path $env:TEMP 'financial-tracker-smoke.log'
$process = Start-Process -FilePath $exe -ArgumentList '--smoke-test' -Wait -PassThru -RedirectStandardOutput $log
Get-Content $log
$process.ExitCode
```

It must print `SQLite smoke test OK` and exit 0. The flag opens a temporary
file-backed database, runs a query, closes it, deletes it, and exits without
opening a window or reading profiles. For an installed-artifact check, silently
install `Financial Tracker Setup <version>.exe` with `/S /D=<temporary-directory>`
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
waits for the database operation to finish. These are local database backups,
not off-device copies or backups of the separate data folder.

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
  Base currency is stored for later reports; currency conversion is not included.
- The system theme follows Windows through `prefers-color-scheme`, using
  Electron's default system `nativeTheme`. Explicit light/dark modes override
  that preference in the renderer, including native form controls.
- A small typed i18n module uses HU/EN/DE catalogs in
  `src/renderer/src/i18n/`, without a runtime library. `createFormatters` uses
  `Intl` with `hu-HU`, `en-GB`, and `de-DE` for dates and numbers. The
  completeness test checks the union of catalog keys, so a missing key in any
  language fails; TypeScript also checks Hungarian and German against English.
- The profile area at the bottom of the sidebar shows the active profile and
  switches profiles. Accounts lists active and archived accounts with balances in
  their own currency. Transactions provides a filterable, virtualised table and a
  right-side create/edit drawer; Overview remains a placeholder.

## Accounts

- Create an account with a name, HUF or CHF currency, an opening balance, and a
  valid calendar opening date. The shared calculator amount field accepts dot or
  comma decimals and thousands grouping, and allows negative or zero opening
  balances. See **Amount calculator** below.
- Money is stored as exact integer hundredths for both currencies. CHF displays
  two decimal places; HUF displays no decimals (rounded for display only).
- Rename accounts or change their currency while they have no transactions.
  Changing currency changes the denomination, not the amount; it is not a
  currency conversion.
- Archive an account to hide it from account pickers without deleting it. Archived
  accounts remain visible on Accounts with their balance and opening date.
- Delete an account after confirming in the page. An opening balance alone does
  not prevent deletion: "empty" means no transactions.
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
  lines are never orphaned.

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
- Each transaction currently has exactly one line whose amount equals its total.
  Tags are many-to-many associations on that line (`transaction_line_tags`), not
  duplicated on the header, so #66 can give each split part its own tags without
  migrating existing associations. Split transactions are not included yet.
- Edit any listed transaction or transfer from the same drawer, or delete it after
  confirmation. Create, edit, delete, category reassignment, and balance updates
  run through the profile application command boundary in one SQLite transaction.
- After a transaction or transfer is created, edited, or deleted, a toast offers **Undo**.
  `Ctrl+Z` also undoes the latest transaction command unless focus is in a text
  editing control. Undo restores the transaction header, all of its lines,
  timestamps, identifiers, payee reference, and any payee created by that command
  from before/after aggregate images captured in the original write transaction.
  Tag associations and inline-created tags are included; undo removes only tags
  created by the undone command, not reused tags. Tag rename and delete use the
  same undo extension point and offer the same toast and keyboard action.
  Transfer undo includes both legs and its linked fee.
  History is in memory for the open profile only and is cleared by profile
  switching, restart, restore, or another profile write that has no declared undo
  aggregate. Account and category commands are not undoable yet.
- **Settings → Payees** lists each payee and its raw-name aliases. Alias keys are
  unique within the profile ignoring case and diacritics. Add and remove alias
  commands are undoable. Merging moves every transaction and alias to the chosen
  surviving payee, keeps the merged name as an alias, and is undoable as one
  command. Payee aliases use appended migration 12 after the unchanged tag and
  target-based balance-adjustment migrations 10–11.
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
  local writes reset to the first page to avoid stale offsets. The performance
  test times a filtered first page plus all aggregates with a generous 500 ms
  bound, arranging the 20 000 transactions through application commands in one
  fixture transaction (outside the measured query).

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
  actions. Focus stays inside the drawer or shortcut-help dialog and returns
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
replacement. Delete subcategories before deleting their parent. Restore a backup
and verify the category list refreshes to the restored state. Repeat in light/dark
appearance and with keyboard navigation. UI checks are manual; application-API
SQLite tests cover defaults, language/custom-name precedence, hierarchy, ordering,
replacement validation, isolation, migration, and persistence.

### Manual shell check

Run `npm run dev`, navigate all four pages, and collapse/expand the sidebar.
In Settings, select each language and verify labels and formatting change live.
Select HUF and CHF as the base currency. Create a second profile with a different
language, theme, and base currency; switch between the profiles and restart the
app to verify that each profile restores its own choices.
Select Light and Dark, then Follow Windows; while following Windows, change
Windows' app color mode and verify the shell follows it. Explicit Light/Dark
must stay unchanged when Windows changes. Check keyboard navigation and focus
indicators with both sidebar sizes. UI behavior is checked manually, not by the
automated test suite.

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
archive it, and confirm it remains listed as archived. Try deleting an account,
cancel, then confirm deletion. Switch profiles and check that accounts remain
separate. Repeat with Hungarian/German and light/dark themes; check keyboard
navigation, focus indicators, and validation errors. UI checks are manual.
