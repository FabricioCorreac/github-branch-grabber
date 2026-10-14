import type { BuildOptions } from 'esbuild';

// Shared by the build script and the tests, so the tests run the same bundle
// that Chrome loads. Content scripts are classic scripts, hence the IIFE.
export const buildOptions = {
  entryPoints: ['src/content.ts'],
  outfile: 'dist/content.js',
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  absWorkingDir: import.meta.dirname,
} satisfies BuildOptions;
