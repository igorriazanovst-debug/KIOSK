// Map (not a plain object) so a crafted platform value like "constructor" or
// "__proto__" can't resolve to an inherited Object.prototype value instead of
// falling through to "unsupported". deb/rpm are separate, independently
// triggerable platforms (not bundled under one "linux" build) so a user can
// generate just the format they need.
const PLATFORM_SCRIPTS = new Map([
  ['win', 'electron:build:win'],
  ['deb', 'electron:build:deb'],
  ['rpm', 'electron:build:rpm'],
]);

// npm script in packages/player to run for the requested platform, or null
// if the platform isn't supported.
export function getBuildScript(platform) {
  return PLATFORM_SCRIPTS.get(platform) || null;
}

function isWinArtifact(fileName) {
  return fileName.endsWith('.exe') && fileName.includes('Setup');
}

function labelFor(fileName) {
  const format = fileName.endsWith('.deb') ? 'deb' : fileName.endsWith('.rpm') ? 'rpm' : 'exe';
  if (format === 'exe') return 'Windows';
  const arch = /arm64|aarch64/i.test(fileName) ? 'arm64' : 'x64';
  return `${format} (${arch})`;
}

const MATCHERS = new Map([
  ['win', isWinArtifact],
  ['deb', (fileName) => fileName.endsWith('.deb')],
  ['rpm', (fileName) => fileName.endsWith('.rpm')],
]);

// Picks the real installer artifacts out of electron-builder's dist-electron
// directory listing (which also contains blockmaps, unpacked dirs, and
// builder-effective-config.yaml), labeled by package format and arch.
export function selectBuildArtifacts(fileNames, platform) {
  const matcher = MATCHERS.get(platform);
  if (!matcher) return [];

  return fileNames
    .filter(matcher)
    .map((fileName) => ({ fileName, label: labelFor(fileName) }))
    .sort((a, b) => a.label.localeCompare(b.label) || a.fileName.localeCompare(b.fileName));
}
