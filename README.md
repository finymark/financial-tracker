# Financial Tracker

A local-first personal expense tracker for Windows, built with Electron, React,
TypeScript, and SQLite. The app opens to a collapsible sidebar with Overview,
Transactions, Accounts, and Settings pages. Financial data and profile storage
are not implemented yet.

## Requirements

- Windows (x64 or ARM64)
- Node.js 24.x (the development machine runs 24.15.0); see `.nvmrc`
- npm 12.2.0 or newer (upgrade Node's bundled npm with
  `npm install --global npm@12.2.0`)

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

Install requires npm 12.2.0 or newer, enforced by `.npmrc`'s `engine-strict`.
npm loses SQLite's `gypfile: false` metadata in lockfiles and incorrectly invokes
node-gyp during clean installation. Previously `ignore-scripts=true` avoided that
bug but also prevented Husky's `prepare` script from installing Git hooks.
Instead, npm 12's `allowScripts` policy in `package.json` explicitly denies
dependency scripts for SQLite, Electron, and esbuild, while allowing the root
`prepare` script to install hooks automatically on `npm install` and `npm ci`.
SQLite includes its native binary, Electron 44 downloads its executable on first
`dev` or `test`, and esbuild uses its platform-specific optional dependency.
`strict-allow-scripts=true` rejects unreviewed dependency scripts; review this
policy whenever dependencies change. Do not restore `ignore-scripts=true` or
install with `--ignore-scripts`: either would skip hook installation. Run
`npm run prepare` to repair hooks after an intentionally script-free install.

## Scripts

| Command                       | Purpose                                                                           |
| ----------------------------- | --------------------------------------------------------------------------------- |
| `npm run dev`                 | Start the desktop app with renderer hot reload.                                   |
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
- **pre-push** runs `npm run typecheck` and then `npm test` against the working
  tree; either failure aborts the push.

The guard is also usable outside hooks, for example
`npm run guard -- README.md package.json`. Pass filenames as separate arguments
(quote filenames containing spaces), relative to the repository root or absolute.
Deleted files in a diff are skipped. No arguments or an unreadable/malformed
configuration exits with code 2; findings exit with code 1; clean files exit 0.
The guard's CLI tests run as part of `npm test`.

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
revokes it; there are no wildcard or blanket file exemptions. JSON, merge-marker,
and size checks cannot be allowlisted. Stage the reviewed allowlist with the file
so hooks and a later CI diff scan see the same approval. Hooks are a local safety
net, not a substitute for review or CI: Git's `--no-verify` and `HUSKY=0` can bypass
them, and pattern matching cannot detect every possible form of sensitive data.

The renderer has no Node access; a sandboxed, isolated preload exposes only the
typed `app:getVersion` and `db:ping` calls. SQLite is used only in the main process.
The app's scaffold database is in memory; the database module also accepts a file
path, as exercised by the test. Installer packaging is not included yet.

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
- The profile area at the bottom of the sidebar reserves space only; it does
  not switch or create profiles yet. The other financial pages are placeholders.

### Manual shell check

Run `npm run dev`, navigate all four pages, and collapse/expand the sidebar.
In Settings, select each language and verify labels and formatting change live.
Select Light and Dark, then Follow Windows; while following Windows, change
Windows' app color mode and verify the shell follows it. Explicit Light/Dark
must stay unchanged when Windows changes. Check keyboard navigation and focus
indicators with both sidebar sizes. UI behavior is checked manually, not by the
automated test suite.
