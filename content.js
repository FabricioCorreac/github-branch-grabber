(function () {
  const PROCESSED_ATTR = 'data-branch-grabber-processed';
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
    const html = await resp.text();

    let branch = null;

    // GitHub embeds the PR payload as JSON in the page; this survives
    // DOM/class-name churn better than scraping rendered markup.
    const jsonMatch = html.match(/"headRefName":"((?:[^"\\]|\\.)*)"/);
    if (jsonMatch) {
      branch = jsonMatch[1].replace(/\\u002F/g, '/').replace(/\\(.)/g, '$1');
    } else {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const ref = doc.querySelector('.commit-ref .css-truncate-target[title], .commit-ref[title]');
      if (ref) branch = ref.getAttribute('title') || ref.textContent.trim();
    }

    branchCache.set(key, branch);
    return branch;
  }

  function createButton(prInfo) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'branch-grabber-btn';
    btn.title = 'Copiar nombre de rama';
    btn.textContent = '⎘';

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.disabled = true;
      const original = btn.textContent;
      try {
        const branch = await fetchBranchName(prInfo.owner, prInfo.repo, prInfo.number);
        if (branch) {
          await navigator.clipboard.writeText(branch);
          btn.textContent = '✓';
          btn.title = `Copiado: ${branch}`;
        } else {
          btn.textContent = '!';
          btn.title = 'No se pudo encontrar la rama';
        }
      } catch (err) {
        console.error('branch-grabber:', err);
        btn.textContent = '!';
        btn.title = 'Error al copiar la rama';
      } finally {
        setTimeout(() => {
          btn.textContent = original;
          btn.disabled = false;
        }, 1500);
      }
    });

    return btn;
  }

  function scanAndInject() {
    if (!isIssuePage()) return;

    const sidebar = document.querySelector('#partial-discussion-sidebar') || document;
    const anchors = sidebar.querySelectorAll('a[href*="/pull/"]');

    anchors.forEach((a) => {
      if (a.hasAttribute(PROCESSED_ATTR)) return;
      const prInfo = getPRInfoFromHref(a.getAttribute('href'));
      if (!prInfo) return;
      a.setAttribute(PROCESSED_ATTR, '1');
      const btn = createButton(prInfo);
      a.insertAdjacentElement('afterend', btn);
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
