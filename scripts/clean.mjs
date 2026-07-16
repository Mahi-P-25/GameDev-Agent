import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

const targets = ['node_modules/.tmp', 'coverage', '.turbo'];

for (const target of targets) {
  await rm(join(root, target), { recursive: true, force: true });
}

console.log('[clean] removed root build artifacts');
