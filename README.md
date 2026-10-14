# GitHub Branch Grabber

Chrome extension that adds a button to GitHub issues to copy the branch name of the linked pull
request to the clipboard, without having to open the PR.

## What it does

On an issue page, or an issue opened from a project, it adds a button with GitHub's copy icon to the
right of each pull request and linked branch listed in the sidebar's **Development** section. When clicked, it copies the branch
name to the clipboard and shows a green check (or a red warning icon if something failed; hover over
it to see the details).

- **Linked branch without a PR**: the row links to the branch (`/<owner>/<repo>/tree/<branch>`), so
  the name is read straight from that link.
- **Pull request**: it fetches the PR page using your existing GitHub session (works on private
  repos, no token needed) and extracts the branch name (`headBranch`, formerly `headRefName`) from
  the JSON that GitHub embeds in the HTML. The result is cached until the page is reloaded.

## Installation

The extension is written in TypeScript, so it has to be built first. Requires Node.js 24 or later.

```bash
npm install
npm run build
```

1. Open `chrome://extensions` (Edge works too: `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this folder (not `dist/`: the manifest lives at the root and
   points to `dist/content.js`).

After changing the code, rebuild (or keep `npm run watch` running), click the extension's reload
button in `chrome://extensions` and refresh the GitHub tab.

## Development

| Command            | What it does                                                        |
| ------------------ | ------------------------------------------------------------------- |
| `npm run build`    | Bundles `src/content.ts` into `dist/content.js` with esbuild.       |
| `npm run watch`    | Rebuilds on every change in `src/`.                                 |
| `npm run lint`     | Lints with [Biome](https://biomejs.dev) (`npm run lint:fix` fixes). |
| `npm run typecheck`| Type-checks with `tsc` (strict mode).                               |
| `npm test`         | Type-checks, then runs the tests.                                   |
| `npm run check`    | Lint, type-check, tests and build: run it before committing.        |
| `npm run icons`    | Updates the button icons from `@primer/octicons`.                   |

Everything runs locally; there is no CI.

The linter is Biome rather than ESLint because `typescript-eslint` doesn't support TypeScript 7
yet. Only Biome's linter is enabled, with its recommended rules; it doesn't format the code.

## Structure

| File                       | Description                                                        |
| -------------------------- | ------------------------------------------------------------------ |
| `manifest.json`            | Manifest V3: permissions, icons and content script registration.   |
| `src/branch-utils.ts`      | Pure helpers: link parsing and branch extraction.                  |
| `src/content.ts`           | Finds the Development links, adds the buttons and copies.          |
| `content.css`              | Button styles and icons (uses GitHub's color variables).           |
| `dist/`                    | Build output (not committed).                                      |
| `esbuild.config.ts`        | Build options, shared by the build script and the tests.           |
| `scripts/build.ts`         | Build and watch script.                                            |
| `scripts/copy-octicons.ts` | Copies the button icons from `node_modules`.                       |
| `icons/`                   | Logo: `icon.svg` is the source; the PNGs are generated from it.    |
| `icons/octicons/`          | Button icons, copied from `@primer/octicons` (see below).          |
| `test/`                    | Unit tests (see below).                                            |

If you change `icons/icon.svg`, regenerate the PNGs (16, 32, 48 and 128 px) so they match.

### Button icons

The button uses GitHub's own icons from [Primer Octicons](https://github.com/primer/octicons)
(`copy`, `check` and `alert`), installed as the `@primer/octicons` dev dependency. The copies in
`icons/octicons/` are committed; to update them, run `npm run icons`.

## Tests

The tests use Node's built-in test runner, which runs TypeScript directly, and
[jsdom](https://github.com/jsdom/jsdom).

- `test/branch-utils.test.ts` covers the pure helpers: issue-page detection, PR and branch link
  parsing (including accents and slashes in branch names) and branch extraction from the PR HTML.
- `test/content.test.ts` bundles `src/content.ts` with the same esbuild options as the real build,
  runs it in a simulated issue page and checks where the buttons appear and what gets copied, with
  the clipboard and `fetch` mocked. Its markup mirrors GitHub's Development section; if GitHub
  changes it, update `issuePage()` in that file along with the selectors in `src/content.ts`.

## Notes

- **Navigation without reloads**: GitHub switches pages with Turbo, so the content script is
  injected on all of `github.com` and only acts on an issue (`/<owner>/<repo>/issues/<n>`) or a
  project (`/orgs/<org>/projects/<n>`, `/users/<user>/projects/<n>` or
  `/<owner>/<repo>/projects/<n>`). Projects open issues in a side pane without changing the path. A
  `MutationObserver` re-adds the buttons when the DOM changes, including when that pane opens.
- **Where the button goes**: it is added inside `[data-testid="sidebar-development-section"]`
  (with `#partial-discussion-sidebar` as a fallback for the old UI), which is the same on the issue
  page and in a project's issue pane. If GitHub changes that `data-testid`, the button stops
  appearing and the selector in `scanAndInject` needs updating. The row becomes a two-column grid:
  the link and the button on top, and any extra links (like a merged PR's release) below.
- **Styling**: the button mimics Primer's invisible `IconButton` (like the sections' gear icon) and
  uses its variables (`--fgColor-muted`, `--control-transparent-bgColor-hover`, etc.), so it adapts
  to light and dark themes.
- **Icons as CSS masks**: `content.css` uses each octicon SVG as a `mask-image` over
  `currentColor`, so the icon follows the button's color for each state (`data-state`). The SVGs are
  listed in `web_accessible_resources` so github.com can load them.
- **Depends on GitHub's HTML**: if GitHub renames the PR JSON key again, extraction breaks and the
  button shows the red warning icon ("Branch name not found"). To find the current key, search for
  `head` in the PR page's source and add it to the regex in `extractHeadBranch` in
  `src/branch-utils.ts`. Network errors are logged to the browser console with the
  `branch-grabber:` prefix.
