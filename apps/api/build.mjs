// Bundles the API, worker and CLI scripts for production. The TypeScript workspace package
// @passtra/core is bundled in; all other dependencies stay external (installed in node_modules).
import { build } from 'esbuild';

await build({
  entryPoints: ['src/server.ts', 'src/worker.ts', 'src/scripts/migrate.ts', 'src/scripts/ingest.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  plugins: [{
    name: 'externals',
    setup(b) {
      b.onResolve({ filter: /^[^./]/ }, (args) => (args.path.startsWith('@passtra/') ? undefined : { path: args.path, external: true }));
    },
  }],
});
console.log('built dist/');
