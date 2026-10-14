// Copies the octicons used by content.css from @primer/octicons into the
// extension. The copies are committed so they don't depend on node_modules.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ICONS = ['copy', 'check', 'alert'];
const SIZE = 16;

const require = createRequire(import.meta.url);
const srcDir = path.join(path.dirname(require.resolve('@primer/octicons/package.json')), 'build', 'svg');
const outDir = path.join(import.meta.dirname, '..', 'icons', 'octicons');

fs.mkdirSync(outDir, { recursive: true });
for (const name of ICONS) {
  fs.copyFileSync(path.join(srcDir, `${name}-${SIZE}.svg`), path.join(outDir, `${name}.svg`));
  console.log(`icons/octicons/${name}.svg`);
}
