/**
 * Project-relative path normalization shared by the Project Intelligence
 * analyzers. Kept tiny and dependency-free so every analyzer agrees on how a
 * path is compared (forward slashes, no leading `./`, no trailing slash).
 */

export function normalizePath(path: string): string {
  const cleaned = path.trim().replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
  return cleaned.startsWith('./') ? cleaned.slice(2) : cleaned;
}

export function baseName(path: string): string {
  const normalized = normalizePath(path);
  return normalized.split('/').pop() ?? normalized;
}

export function dirName(path: string): string {
  const normalized = normalizePath(path);
  const idx = normalized.lastIndexOf('/');
  return idx > 0 ? normalized.slice(0, idx) : normalized;
}

export function extensionOf(path: string): string {
  const name = baseName(path);
  const dot = name.lastIndexOf('.');
  if (dot <= 0) {
    return '';
  }
  return name.slice(dot).toLowerCase();
}
