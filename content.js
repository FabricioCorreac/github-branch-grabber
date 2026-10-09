(function () {
  const BUTTON_CLASS = 'branch-grabber-btn';
  const ROW_CLASS = 'branch-grabber-row';
  const DEFAULT_LABEL = 'Copy branch name';

  const branchCache = new Map();
  let scanTimeout = null;

  function isIssuePage() {
    return /^\/[^/]+\/[^/]+\/issues\/\d+/.test(location.pathname);
  }

  function getPRInfoFromHref(href) {
    try {
      const url = new URL(href, location.origin);
      const m = url.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
      if (!m) return null;
      return { owner: m[1], repo: m[2], number: m[3] };
    } catch {
      return null;
    }
  }

  async function fetchBranchName(owner, repo, number) {
    const key = `${owner}/${repo}#${number}`;
    if (branchCache.has(key)) return branchCache.get(key);

    const resp = await fetch(`https://github.com/${owner}/${repo}/pull/${number}`, {
      credentials: 'include',
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching PR ${key}`);
    const html = await resp.text();

    // GitHub embeds the PR payload as JSON in the page. The key has been
    // renamed over time (headRefName -> headBranch), so accept both.
    const match = html.match(/"(?:headBranch|headRefName)":("(?:[^"\\]|\\.)*")/);
    if (!match) return null;

    const branch = JSON.parse(match[1]);
    branchCache.set(key, branch);
    return branch;
  }

  // The icon for each state is drawn by content.css from data-state.
  function setButtonState(btn, state, label) {
    btn.dataset.state = state;
    btn.setAttribute('aria-label', label);
    btn.title = label;
  }

  function createButton(prInfo) {
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
        const branch = await fetchBranchName(prInfo.owner, prInfo.repo, prInfo.number);
        if (branch) {
          await navigator.clipboard.writeText(branch);
          setButtonState(btn, 'success', `Copied: ${branch}`);
        } else {
          setButtonState(btn, 'error', 'Branch name not found');
        }
      } catch (err) {
        console.error('branch-grabber:', err);
        setButtonState(btn, 'error', `Could not copy branch name: ${err.message}`);
      } finally {
        setTimeout(() => setButtonState(btn, 'idle', DEFAULT_LABEL), 2000);
      }
    });

    return btn;
  }

  function scanAndInject() {
    if (!isIssuePage()) return;

    const section =
      document.querySelector('[data-testid="sidebar-development-section"]') ||
      document.querySelector('#partial-discussion-sidebar');
    if (!section) return;

    section.querySelectorAll('a[href*="/pull/"]').forEach((a) => {
      const prInfo = getPRInfoFromHref(a.getAttribute('href'));
      if (!prInfo) return;

      // React can re-render the row and drop our node, so check for the
      // button itself rather than marking the anchor.
      const row = a.closest('li') || a.parentElement;
      if (row.querySelector(`.${BUTTON_CLASS}`)) return;

      row.classList.add(ROW_CLASS);
      a.insertAdjacentElement('afterend', createButton(prInfo));
    });
  }

  function scheduleScan() {
    clearTimeout(scanTimeout);
    scanTimeout = setTimeout(scanAndInject, 300);
  }

  scanAndInject();

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, { childList: true, subtree: true });

  // GitHub navigates between issues/PRs via Turbo without a full page
  // load, so the content script stays alive but the DOM is swapped out.
  document.addEventListener('turbo:load', scheduleScan);
  document.addEventListener('pjax:end', scheduleScan);
})();
