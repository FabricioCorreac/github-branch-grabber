import * as esbuild from 'esbuild';
import { buildOptions } from '../esbuild.config.ts';

if (process.argv.includes('--watch')) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log('Watching src/ for changes…');
} else {
  await esbuild.build(buildOptions);
  console.log(`Built ${buildOptions.outfile}`);
}
