// Verifies that every icon used by categories exists in the MaterialCommunityIcons glyph map.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const glyphs = JSON.parse(readFileSync(require.resolve('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json'), 'utf8'));
const src = readFileSync(new URL('../src/lib/icons.ts', import.meta.url), 'utf8');
const used = [...src.matchAll(/:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]);
const cats = readFileSync(new URL('../../../packages/core/src/categories.ts', import.meta.url), 'utf8');
const keys = [...cats.matchAll(/c\('[a-z-]+', '(?:event|place|both)', '[a-z]+', '([a-z]+)'/g)].map((m) => m[1]);
const map = Object.fromEntries([...src.matchAll(/(\w+):\s*'([a-z0-9-]+)'/g)].map((m) => [m[1], m[2]]));
const missingGlyphs = used.filter((g) => !(g in glyphs));
const missingKeys = [...new Set(keys)].filter((k) => !map[k]);
if (missingGlyphs.length || missingKeys.length) {
  console.error({ missingGlyphs, missingKeys });
  process.exit(1);
}
console.log(`ok: ${Object.keys(map).length} icons, ${new Set(keys).size} category icon keys covered`);
