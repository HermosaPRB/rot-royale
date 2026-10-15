import { cp, mkdir, readdir } from 'node:fs/promises';
// Vinext cleans dist before building. Restore the unchanged canonical static
// source from the prebuild snapshot, also retaining GitHub Pages compatibility.
await mkdir('dist', { recursive: true });
for (const entry of await readdir('public', { withFileTypes: true })) {
  if ((entry.isFile() && !entry.name.startsWith('.')) || entry.name === 'assets') await cp(`public/${entry.name}`, `dist/${entry.name}`, {recursive:true});
}
