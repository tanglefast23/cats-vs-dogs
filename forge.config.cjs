// Electron Forge is used for packaging only — no makers, publishers, signing,
// or Steam configuration yet (deferred per docs/brainstorms/2026-07-12-electron-transition.md).

/**
 * Allowlist packaging: the app ships the compiled renderer (dist/), the
 * Electron shell (electron/), and package.json. Source, tests, docs, configs,
 * and dev output stay out of the package.
 */
function ignore(filePath) {
  if (filePath === '') return false;
  if (filePath === '/package.json') return false;
  if (filePath === '/electron' || filePath.startsWith('/electron/')) return false;
  if (filePath === '/dist' || filePath.startsWith('/dist/')) return false;
  return true;
}

module.exports = {
  packagerConfig: {
    asar: true,
    // Display name deliberately avoids the ':' from the full title — colons in
    // macOS bundle filenames render as '/' in Finder.
    name: 'Cats vs Dogs Backyard Battle',
    executableName: 'cats-vs-dogs-backyard-battle',
    // Provisional bundle id — MUST be confirmed against the real Apple
    // Developer account before signing/notarization.
    appBundleId: 'com.tanglefast.cats-vs-dogs',
    ignore,
  },
  makers: [],
};
