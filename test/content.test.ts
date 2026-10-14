import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as esbuild from 'esbuild';
import { JSDOM } from 'jsdom';
import { buildOptions } from '../esbuild.config.ts';

// Bundles src/content.ts exactly like the real build, but in memory, and runs
// it in the simulated page as Chrome would run dist/content.js.
const [bundle] = esbuild.buildSync({ ...buildOptions, write: false }).outputFiles;
assert.ok(bundle);
const CONTENT_SCRIPT = new vm.Script(bundle.text, { filename: 'content.js' });

const ISSUE_URL = 'https://github.com/net2phone/uc-uContact/issues/7372';
const PR_HREF = 'https://github.com/net2phone/uc-uContact/pull/7517';
const BRANCH_HREF =
  'https://github.com/net2phone/uc-uContact/tree/7372-marcadores-de-email---env%C3%ADo-de-2-archivos-o-m%C3%A1s';
const BRANCH_NAME = '7372-marcadores-de-email---envío-de-2-archivos-o-más';

type FakeResponse = { ok: boolean; status: number; text: () => Promise<string> };
type FetchImpl = (url: string) => FakeResponse | Promise<FakeResponse>;

// Mirrors the markup GitHub renders for the issue sidebar's Development
// section, plus the PR "pill" in the issue header.
function issuePage(rowHrefs: string[]): string {
  const rows = rowHrefs
    .map(
      (href) => `
        <li data-component="ActionList.Item">
          <a href="${href}" target="_blank">
            <span data-component="ActionList.LeadingVisual"><svg></svg></span>
            <span><span>Row title</span><span>net2phone/uc-uContact</span></span>
          </a>
        </li>`,
    )
    .join('');
  return `
    <div class="HeaderMetadata"><a href="${PR_HREF}"><span>#7517</span></a></div>
    <div data-testid="sidebar-development-section">
      <h3>Development</h3>
      <ul data-testid="issue-viewer-linked-pr-container">${rows}</ul>
    </div>`;
}

const PROJECT_URL =
  'https://github.com/orgs/net2phone/projects/5?pane=issue&itemId=76887784&issue=net2phone%7Cuc-uContact%7C7372';
const RELEASE_HREF = 'https://github.com/net2phone/uc-uContact/releases/tag/v6.600';

// Mirrors the issue pane a project opens: same Development section, but a
// merged PR's row also links to the release that shipped it.
function projectPane(): string {
  return `
    <div class="project-board"><a href="${PR_HREF}">#7517 in a board card</a></div>
    <div role="dialog">
      <div data-testid="sidebar-development-section">
        <h3>Development</h3>
        <ul data-testid="issue-viewer-linked-pr-container">
          <li>
            <a href="${PR_HREF}" target="_blank"><span>Fix pause on reconnect</span></a>
            <a href="${RELEASE_HREF}" target="_blank"><span class="sr-only">Release</span>v6.600</a>
          </li>
        </ul>
      </div>
    </div>`;
}

let dom: JSDOM | undefined;

function load(
  bodyHtml: string,
  { url = ISSUE_URL, fetchImpl = () => assert.fail('unexpected fetch') }: { url?: string; fetchImpl?: FetchImpl } = {},
) {
  dom = new JSDOM(`<!doctype html><html><body>${bodyHtml}</body></html>`, {
    url,
    runScripts: 'outside-only',
  });
  const { window } = dom;
  const copied: string[] = [];
  Object.defineProperty(window.navigator, 'clipboard', {
    value: { writeText: async (text: string) => void copied.push(text) },
  });
  const fetchCalls: string[] = [];
  Object.assign(window, {
    fetch: async (input: string | URL) => {
      fetchCalls.push(String(input));
      return fetchImpl(String(input));
    },
  });
  CONTENT_SCRIPT.runInContext(dom.getInternalVMContext());
  return { window, document: window.document, copied, fetchCalls };
}

const htmlResponse = (body: string, status = 200): FakeResponse => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => body,
});

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

async function click(button: HTMLButtonElement): Promise<void> {
  button.click();
  for (let i = 0; i < 5; i++) await tick();
}

function getButton(document: Document): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>('.branch-grabber-btn');
  assert.ok(button, 'button not found');
  return button;
}

afterEach(() => dom?.window.close());

describe('button injection', () => {
  it('adds a button next to each PR and linked branch in the Development section', () => {
    const { document } = load(issuePage([PR_HREF, BRANCH_HREF]));
    const rows = document.querySelectorAll('[data-testid="sidebar-development-section"] li');
    assert.equal(rows.length, 2);
    for (const row of rows) {
      const buttons = row.querySelectorAll<HTMLButtonElement>('.branch-grabber-btn');
      assert.equal(buttons.length, 1);
      const [button] = buttons;
      assert.ok(button);
      assert.equal(button.previousElementSibling?.tagName, 'A');
      assert.ok(row.classList.contains('branch-grabber-row'));
      assert.equal(button.dataset.state, 'idle');
      assert.equal(button.getAttribute('aria-label'), 'Copy branch name');
    }
  });

  it('does not add a button to the PR link in the issue header', () => {
    const { document } = load(issuePage([PR_HREF]));
    assert.equal(document.querySelectorAll('.HeaderMetadata .branch-grabber-btn').length, 0);
    assert.equal(document.querySelectorAll('.branch-grabber-btn').length, 1);
  });

  it('ignores Development links that are neither a PR nor a branch', () => {
    const { document } = load(issuePage(['https://github.com/net2phone/uc-uContact/issues/1']));
    assert.equal(document.querySelectorAll('.branch-grabber-btn').length, 0);
  });

  it('adds a button in the issue pane of a project, right after the PR link', () => {
    const { document } = load(projectPane(), { url: PROJECT_URL });
    const buttons = document.querySelectorAll<HTMLButtonElement>('.branch-grabber-btn');
    assert.equal(buttons.length, 1);
    const [button] = buttons;
    assert.ok(button?.closest('[role="dialog"]'), 'button outside the issue pane');
    assert.equal(button.previousElementSibling?.getAttribute('href'), PR_HREF);
    assert.equal(button.nextElementSibling?.getAttribute('href'), RELEASE_HREF);
  });

  it('does nothing outside issue pages', () => {
    const { document } = load(issuePage([PR_HREF]), {
      url: 'https://github.com/net2phone/uc-uContact/pull/7517',
    });
    assert.equal(document.querySelectorAll('.branch-grabber-btn').length, 0);
  });

  it('adds the button again after the row is re-rendered', async () => {
    const { document } = load(issuePage([BRANCH_HREF]));
    getButton(document).remove();
    await tick(400);
    assert.equal(document.querySelectorAll('.branch-grabber-btn').length, 1);
  });
});

describe('copying', () => {
  it('copies a linked branch name from its link without fetching', async () => {
    const { document, copied, fetchCalls } = load(issuePage([BRANCH_HREF]));
    const button = getButton(document);
    await click(button);
    assert.deepEqual(copied, [BRANCH_NAME]);
    assert.deepEqual(fetchCalls, []);
    assert.equal(button.dataset.state, 'success');
    assert.equal(button.title, `Copied: ${BRANCH_NAME}`);
  });

  it('copies a PR head branch by fetching the PR page, and caches it', async () => {
    const { document, copied, fetchCalls } = load(issuePage([PR_HREF]), {
      fetchImpl: () => htmlResponse('{"baseBranch":"development","headBranch":"7517-fix"}'),
    });
    const button = getButton(document);
    await click(button);
    assert.deepEqual(copied, ['7517-fix']);
    assert.deepEqual(fetchCalls, [PR_HREF]);
    assert.equal(button.dataset.state, 'success');

    await tick(2100);
    assert.equal(button.dataset.state, 'idle');
    await click(button);
    assert.deepEqual(copied, ['7517-fix', '7517-fix']);
    assert.equal(fetchCalls.length, 1);
  });

  it('shows an error when the PR page has no branch data', async () => {
    const { document, copied } = load(issuePage([PR_HREF]), {
      fetchImpl: () => htmlResponse('<html>no data</html>'),
    });
    const button = getButton(document);
    await click(button);
    assert.deepEqual(copied, []);
    assert.equal(button.dataset.state, 'error');
    assert.equal(button.title, 'Branch name not found');
  });

  it('shows the HTTP status when the PR page cannot be fetched', async () => {
    const { window, document, copied } = load(issuePage([PR_HREF]), {
      fetchImpl: () => htmlResponse('', 404),
    });
    window.console.error = () => {};
    const button = getButton(document);
    await click(button);
    assert.deepEqual(copied, []);
    assert.equal(button.dataset.state, 'error');
    assert.match(button.title, /HTTP 404/);
  });

  it('ignores clicks while a copy is in progress', async () => {
    let release: () => void = () => {};
    const { document, fetchCalls } = load(issuePage([PR_HREF]), {
      fetchImpl: () =>
        new Promise((resolve) => {
          release = () => resolve(htmlResponse('{"headBranch":"x"}'));
        }),
    });
    const button = getButton(document);
    button.click();
    await tick();
    assert.equal(button.dataset.state, 'loading');
    button.click();
    await tick();
    assert.equal(fetchCalls.length, 1);
    release();
    for (let i = 0; i < 5; i++) await tick();
    assert.equal(button.dataset.state, 'success');
  });
});
