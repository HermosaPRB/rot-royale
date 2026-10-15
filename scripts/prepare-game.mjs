import { cp, mkdir, readdir } from 'node:fs/promises';
// Preserve top-level dist files as the canonical game/GitHub Pages source.
await mkdir('public', { recursive: true });
for (const entry of await readdir('dist', { withFileTypes: true })) {
  if ((entry.isFile() && !entry.name.startsWith('.')) || entry.name === 'assets') await cp(`dist/${entry.name}`, `public/${entry.name}`, {recursive:true});
}
