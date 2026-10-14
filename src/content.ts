import { extractHeadBranch, isIssuePath, isProjectPath, parseDevelopmentLink } from './branch-utils.ts';

type ButtonState = 'idle' | 'loading' | 'success' | 'error';
type BranchResolver = () => Promise<string | null>;

const BUTTON_CLASS = 'branch-grabber-btn';
const ROW_CLASS = 'branch-grabber-row';
const DEFAULT_LABEL = 'Copy branch name';

const branchCache = new Map<string, string>();
let scanTimeout: ReturnType<typeof setTimeout> | undefined;

// Returns a function that resolves the branch name for a Development-row
// link, or null if the link is neither a PR nor a branch.
function getBranchResolver(href: string): BranchResolver | null {
  const link = parseDevelopmentLink(href, location.origin);
  if (!link) return null;
  if (link.type === 'branch') return async () => link.branch;
  return () => fetchBranchName(link.owner, link.repo, link.number);
}

async function fetchBranchName(owner: string, repo: string, number: string): Promise<string | null> {
  const key = `${owner}/${repo}#${number}`;
  const cached = branchCache.get(key);
  if (cached) return cached;

  const resp = await fetch(`https://github.com/${owner}/${repo}/pull/${number}`, {
    credentials: 'include',
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching PR ${key}`);

  const branch = extractHeadBranch(await resp.text());
  if (branch) branchCache.set(key, branch);
  return branch;
}

// The icon for each state is drawn by content.css from data-state.
function setButtonState(btn: HTMLButtonElement, state: ButtonState, label: string): void {
  btn.dataset.state = state;
  btn.setAttribute('aria-label', label);
  btn.title = label;
}

function createButton(resolveBranch: BranchResolver): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = BUTTON_CLASS;
  setButtonState(btn, 'idle', DEFAULT_LABEL);

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (btn.dataset.state !== 'idle') return;
    setButtonState(btn, 'loading', 'Looking up branch…');
    try {
      const branch = await resolveBranch();
      if (branch) {
        await navigator.clipboard.writeText(branch);
        setButtonState(btn, 'success', `Copied: ${branch}`);
      } else {
        setButtonState(btn, 'error', 'Branch name not found');
      }
    } catch (err) {
      console.error('branch-grabber:', err);
      const message = err instanceof Error ? err.message : String(err);
      setButtonState(btn, 'error', `Could not copy branch name: ${message}`);
    } finally {
      setTimeout(() => setButtonState(btn, 'idle', DEFAULT_LABEL), 2000);
    }
  });

  return btn;
}

function scanAndInject(): void {
  if (!isIssuePath(location.pathname) && !isProjectPath(location.pathname)) return;

  const links = document.querySelectorAll<HTMLAnchorElement>(
    ['[data-testid="sidebar-development-section"]', '#partial-discussion-sidebar']
      .map((section) => `${section} a[href*="/pull/"], ${section} a[href*="/tree/"]`)
      .join(', '),
  );

  links.forEach((a) => {
    const href = a.getAttribute('href');
    const resolveBranch = href ? getBranchResolver(href) : null;
    if (!resolveBranch) return;

    // React can re-render the row and drop our node, so check for the
    // button itself rather than marking the anchor.
    const row = a.closest('li') ?? a.parentElement;
    if (!row || row.querySelector(`.${BUTTON_CLASS}`)) return;

    row.classList.add(ROW_CLASS);
    a.insertAdjacentElement('afterend', createButton(resolveBranch));
  });
}

function scheduleScan(): void {
  clearTimeout(scanTimeout);
  scanTimeout = setTimeout(scanAndInject, 300);
}

scanAndInject();

new MutationObserver(scheduleScan).observe(document.body, { childList: true, subtree: true });

// GitHub navigates between issues/PRs via Turbo without a full page
// load, so the content script stays alive but the DOM is swapped out.
document.addEventListener('turbo:load', scheduleScan);
document.addEventListener('pjax:end', scheduleScan);
