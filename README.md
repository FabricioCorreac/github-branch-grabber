# GitHub Branch Grabber

Chrome extension that adds a button to GitHub issues to copy the branch name of the linked pull
request to the clipboard, without having to open the PR.

## What it does

On an issue page, it adds a button with GitHub's copy icon to the right of each pull request
listed in the sidebar's **Development** section. When clicked, it:

1. Fetches the PR page using your existing GitHub session (works on private repos, no token
   needed).
2. Extracts the branch name (`headBranch`, formerly `headRefName`) from the JSON that GitHub embeds
   in the HTML.
3. Copies it to the clipboard and shows a green check (or a red warning icon if something failed;
   hover over it to see the details).

The branch name is cached until the page is reloaded.

## Installation

1. Open `chrome://extensions` (Edge works too: `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this folder.

After changing the code, click the extension's reload button in `chrome://extensions` and refresh
the GitHub tab.

## Structure

| File                       | Description                                                       |
| -------------------------- | ----------------------------------------------------------------- |
| `manifest.json`            | Manifest V3: permissions, icons and content script registration.  |
| `content.js`               | Finds the PR links, adds the buttons and fetches the branch name. |
| `content.css`              | Button styles and icons (uses GitHub's color variables).          |
| `icons/`                   | Logo: `icon.svg` is the source; the PNGs are generated from it.   |
| `icons/octicons/`          | Button icons, copied from `@primer/octicons` (see below).         |
| `scripts/copy-octicons.js` | Copies those icons from `node_modules`.                           |

If you change `icons/icon.svg`, regenerate the PNGs (16, 32, 48 and 128 px) so they match.

### Button icons

The button uses GitHub's own icons from [Primer Octicons](https://github.com/primer/octicons)
(`copy`, `check` and `alert`), installed as the `@primer/octicons` dev dependency. The copies in
`icons/octicons/` are committed so the extension loads without running npm. To update them:

```bash
npm install
npm run icons
```

## Notes

- **Navigation without reloads**: GitHub switches pages with Turbo, so the content script is
  injected on all of `github.com` and only acts when the URL is an issue
  (`/<owner>/<repo>/issues/<n>`). A `MutationObserver` re-adds the buttons when the DOM changes.
- **Where the button goes**: it is added inside `[data-testid="sidebar-development-section"]`
  (with `#partial-discussion-sidebar` as a fallback for the old UI). If GitHub changes that
  `data-testid`, the button stops appearing and the selector in `scanAndInject` needs updating.
- **Styling**: the button mimics Primer's invisible `IconButton` (like the sections' gear icon) and
  uses its variables (`--fgColor-muted`, `--control-transparent-bgColor-hover`, etc.), so it adapts
  to light and dark themes.
- **Icons as CSS masks**: `content.css` uses each octicon SVG as a `mask-image` over
  `currentColor`, so the icon follows the button's color for each state (`data-state`). The SVGs are
  listed in `web_accessible_resources` so github.com can load them.
- **Depends on GitHub's HTML**: if GitHub renames the PR JSON key again, extraction breaks and the
  button shows the red warning icon ("Branch name not found"). To find the current key,
  search for `head` in the PR page's source and add it to the regex in `fetchBranchName` in
  `content.js`. Network errors are logged to the browser console with the `branch-grabber:` prefix.
