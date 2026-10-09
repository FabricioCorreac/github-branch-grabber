// Copies the octicons used by content.css from @primer/octicons into the
// extension. The copies are committed so "Load unpacked" works without npm.
const fs = require('fs');
const path = require('path');

const ICONS = ['copy', 'check', 'alert'];
const SIZE = 16;

const srcDir = path.join(path.dirname(require.resolve('@primer/octicons/package.json')), 'build', 'svg');
const outDir = path.join(__dirname, '..', 'icons', 'octicons');

fs.mkdirSync(outDir, { recursive: true });
for (const name of ICONS) {
  fs.copyFileSync(path.join(srcDir, `${name}-${SIZE}.svg`), path.join(outDir, `${name}.svg`));
  console.log(`icons/octicons/${name}.svg`);
}
