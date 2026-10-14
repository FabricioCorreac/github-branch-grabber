import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractHeadBranch, isIssuePath, isProjectPath, parseDevelopmentLink } from '../src/branch-utils.ts';

const ORIGIN = 'https://github.com';

describe('isIssuePath', () => {
  it('accepts issue pages', () => {
    assert.equal(isIssuePath('/net2phone/uc-uContact/issues/7372'), true);
  });

  it('rejects other pages', () => {
    for (const path of [
      '/net2phone/uc-uContact/issues',
      '/net2phone/uc-uContact/pull/7517',
      '/net2phone/uc-uContact',
      '/',
    ]) {
      assert.equal(isIssuePath(path), false, path);
    }
  });
});

describe('isProjectPath', () => {
  it('accepts org, user and repo projects', () => {
    for (const path of [
      '/orgs/primer/projects/22',
      '/orgs/net2phone/projects/5/views/1',
      '/users/FabricioCorreac/projects/1',
      '/net2phone/uc-uContact/projects/3',
    ]) {
      assert.equal(isProjectPath(path), true, path);
    }
  });

  it('rejects project lists and other pages', () => {
    for (const path of ['/orgs/primer/projects', '/net2phone/uc-uContact/issues/7372', '/']) {
      assert.equal(isProjectPath(path), false, path);
    }
  });
});

describe('parseDevelopmentLink', () => {
  it('parses a pull request link', () => {
    assert.deepEqual(parseDevelopmentLink('https://github.com/cli/cli/pull/14629', ORIGIN), {
      type: 'pull',
      owner: 'cli',
      repo: 'cli',
      number: '14629',
    });
  });

  it('parses a relative link to a PR subpage', () => {
    assert.deepEqual(parseDevelopmentLink('/cli/cli/pull/14629/files', ORIGIN), {
      type: 'pull',
      owner: 'cli',
      repo: 'cli',
      number: '14629',
    });
  });

  it('decodes a linked branch with accents', () => {
    const href =
      'https://github.com/net2phone/uc-uContact/tree/7372-marcadores-de-email---env%C3%ADo-de-2-archivos-o-m%C3%A1s';
    assert.deepEqual(parseDevelopmentLink(href, ORIGIN), {
      type: 'branch',
      branch: '7372-marcadores-de-email---envío-de-2-archivos-o-más',
    });
  });

  it('keeps slashes in branch names, raw or encoded', () => {
    for (const href of ['/o/r/tree/feature/copy-button', '/o/r/tree/feature%2Fcopy-button']) {
      assert.deepEqual(parseDevelopmentLink(href, ORIGIN), {
        type: 'branch',
        branch: 'feature/copy-button',
      });
    }
  });

  it('returns null for links that are neither a PR nor a branch', () => {
    for (const href of ['/o/r/issues/1', '/o/r', '/o/r/tree/', '/o/r/pull/abc', '/o']) {
      assert.equal(parseDevelopmentLink(href, ORIGIN), null, href);
    }
  });

  it('returns null for a malformed branch encoding', () => {
    assert.equal(parseDevelopmentLink('/o/r/tree/bad%E0%A4%A', ORIGIN), null);
  });
});

describe('extractHeadBranch', () => {
  it('reads headBranch', () => {
    const html = '<script>{"baseBranch":"trunk","headBranch":"fix/issue-14621"}</script>';
    assert.equal(extractHeadBranch(html), 'fix/issue-14621');
  });

  it('reads the older headRefName key', () => {
    assert.equal(extractHeadBranch('{"headRefName":"feature/x"}'), 'feature/x');
  });

  it('unescapes JSON escapes', () => {
    const html = String.raw`{"headBranch":"feature/envío \"quoted\""}`;
    assert.equal(extractHeadBranch(html), 'feature/envío "quoted"');
  });

  it('does not confuse the base branch with the head branch', () => {
    assert.equal(extractHeadBranch('{"baseRefName":"main","headBranch":"topic"}'), 'topic');
  });

  it('returns null when the page has no branch data', () => {
    assert.equal(extractHeadBranch('<html><body>Not found</body></html>'), null);
  });
});
