/**
 * Pure helpers for release tagging (unit-testable).
 */

/** @param {string} version Semver from package.json */
export function releaseTagFromVersion(version) {
  return `v${version}`;
}

/** @param {string} version Semver from package.json */
export function releaseCommitMessage(version) {
  return `chore: release ${releaseTagFromVersion(version)}`;
}

/**
 * @param {string | undefined} repositoryUrl e.g. git+https://github.com/owner/repo.git
 * @param {string} version Semver from package.json
 */
export function releaseTagUrl(repositoryUrl, version) {
  const tag = releaseTagFromVersion(version);
  if (!repositoryUrl) {
    return null;
  }

  const match = repositoryUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/i);
  if (!match) {
    return null;
  }

  const [, owner, repo] = match;
  return `https://github.com/${owner}/${repo}/releases/tag/${tag}`;
}
