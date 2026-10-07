# Financial Tracker

A local-first personal expense tracker for Windows, built with Electron, React,
TypeScript, and SQLite. The app opens to a collapsible sidebar with Overview,
Transactions, Accounts, and Settings pages. On start you pick or create a
profile; each profile has its own SQLite database and data folder. Financial
data stays local. Accounts now track opening balances; transactions are not
implemented yet.

## Requirements

- Windows (x64 or ARM64)
- Node.js 24.x (the development machine runs 24.15.0); see `.nvmrc`
- npm (included with Node.js)

## Setup

```sh
npm install
npm run dev
```

Dependencies are pinned exactly. `better-sqlite3` 13 ships Windows binaries using
the stable Node-API 10 ABI, so no Electron-specific rebuild is needed. There is
one dependency installation, and `npm test` verifies SQLite using Electron's Node
runtime (`ELECTRON_RUN_AS_NODE=1`). This avoids the native ABI mismatch of older
`better-sqlite3` versions without separate Node and Electron installations.

`.npmrc` disables install lifecycle scripts because npm 11.12.1 loses SQLite's
`gypfile: false` metadata in lockfiles and incorrectly invokes node-gyp during
clean installation. No current dependency needs those scripts: SQLite includes
its native binary, and Electron 44 downloads its executable on first `dev` or
`test` invocation. Explicit `npm run` commands still work. Revisit this setting
when adding dependencies that require lifecycle scripts.

## Scripts

| Command                | Purpose                                                                           |
| ---------------------- | --------------------------------------------------------------------------------- |
| `npm run dev`          | Start the desktop app with renderer hot reload.                                   |
| `npm run build`        | Typecheck and build main, preload, and renderer into `out/`.                      |
| `npm test`             | Run SQLite, translation completeness, and formatting tests under Electron's Node. |
| `npm run lint`         | Run ESLint.                                                                       |
| `npm run format`       | Format project files with Prettier.                                               |
| `npm run format:check` | Check formatting without modifying files.                                         |
| `npm run typecheck`    | Check strict Node and renderer TypeScript configurations.                         |

The renderer has no Node access; a sandboxed, isolated preload exposes only the
typed app, profile, and account commands/queries. Every IPC input is validated
in the main process. Account writes use the profile application API, with each
command executed in one SQLite transaction. SQLite is used only in the main
process. Profiles are listed in `profiles.json` under the app's user-data folder; each
profile lives in `profiles/<id>/` (database, data folder, pre-migration
backups). Migrations are forward-only and run after a verified backup; a
database with a newer schema is refused. Installer packaging is not included yet.

## App shell

- The shell uses Tailwind CSS 4 via its Vite plugin, lucide icons, and the
  [shadcn/ui](https://ui.shadcn.com/) Button, Card, and Native Select components,
  adapted to the shell's needs. Their MIT license is included alongside the
  components in `src/renderer/src/components/ui/LICENSE`.
- Visual tokens live in `src/renderer/src/tokens.css`: calm green/teal accent,
  light and dark surfaces, radius, and density (the Tailwind spacing unit).
- Settings has temporary, in-memory language and appearance selectors. English
  and the system theme are the initial defaults. Choices apply immediately but
  reset on restart; profile settings belong to a later ticket.
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
  their own currency; Overview and Transactions are still placeholders.

## Accounts

- Create an account with a name, HUF or CHF currency, an opening balance, and a
  valid calendar opening date. Amount entry accepts a dot or comma with up to two
  decimal places, no thousands separators, and allows negative opening balances.
- Money is stored as exact integer hundredths for both currencies. CHF displays
  two decimal places; HUF displays no decimals (rounded for display only).
- Rename accounts or change their currency while they have no transactions.
  Changing currency changes the denomination, not the amount; it is not a
  currency conversion.
- Archive an account to hide it from account pickers without deleting it. Archived
  accounts remain visible on Accounts with their balance and opening date.
- Delete an account after confirming in the page. An opening balance alone does
  not prevent deletion: "empty" means no transactions.
- Balances currently equal opening balances. The profile application's
  `getAccountBalance` and `hasAccountTransactions` queries are the integration
  points for #56, which will add signed transaction totals and transaction
  existence checks. Deletion and currency-change guards already use the same
  existence check; its positive cases will be tested when transactions arrive.

### Manual shell check

Run `npm run dev`, navigate all four pages, and collapse/expand the sidebar.
In Settings, select each language and verify labels and formatting change live.
Select Light and Dark, then Follow Windows; while following Windows, change
Windows' app color mode and verify the shell follows it. Explicit Light/Dark
must stay unchanged when Windows changes. Check keyboard navigation and focus
indicators with both sidebar sizes. UI behavior is checked manually, not by the
automated test suite.

### Manual Accounts check

Run `npm run dev`, open a profile, and navigate to Accounts. Create HUF and CHF
accounts with positive, zero, and negative opening balances; confirm HUF has no
decimals and CHF has two. Enter a comma decimal separator and verify the amount
round-trips after restarting. Rename an account, change its currency while empty,
archive it, and confirm it remains listed as archived. Try deleting an account,
cancel, then confirm deletion. Switch profiles and check that accounts remain
separate. Repeat with Hungarian/German and light/dark themes; check keyboard
navigation, focus indicators, and validation errors. UI checks are manual.
