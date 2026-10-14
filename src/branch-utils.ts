export type DevelopmentLink =
  | { type: 'pull'; owner: string; repo: string; number: string }
  | { type: 'branch'; branch: string };

export function isIssuePath(pathname: string): boolean {
  return /^\/[^/]+\/[^/]+\/issues\/\d+/.test(pathname);
}

// Org, user and repo projects. A project opens issues in a side pane without
// changing the path (/orgs/<org>/projects/<n>?pane=issue&...).
export function isProjectPath(pathname: string): boolean {
  return /^\/[^/]+\/[^/]+\/projects\/\d+/.test(pathname);
}
// Classifies a link from the sidebar's Development section: a pull request,
// a linked branch (which links to its tree), or null for anything else.
export function parseDevelopmentLink(href: string, origin: string): DevelopmentLink | null {
  let pathname: string;
  try {
    pathname = new URL(href, origin).pathname;
  } catch {
    return null;
  }

  const pr = pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (pr) {
    const [, owner = '', repo = '', number = ''] = pr;
    return { type: 'pull', owner, repo, number };
  }

  // The branch name may contain slashes and is percent-encoded.
  const tree = pathname.match(/^\/[^/]+\/[^/]+\/tree\/(.+)$/);
  if (tree?.[1]) {
    try {
      return { type: 'branch', branch: decodeURIComponent(tree[1]) };
    } catch {
      return null;
    }
  }

  return null;
}

// GitHub embeds the PR payload as JSON in the page. The key has been
// renamed over time (headRefName -> headBranch), so accept both.
export function extractHeadBranch(html: string): string | null {
  const literal = html.match(/"(?:headBranch|headRefName)":("(?:[^"\\]|\\.)*")/)?.[1];
  return literal === undefined ? null : (JSON.parse(literal) as string);
}
