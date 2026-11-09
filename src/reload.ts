import { statSync } from 'node:fs';

/**
 * Returns a getter that re-reads `file` whenever its modification time changes, so a session
 * picks up edits without restarting. Without a file it always returns `initial`.
 */
export function reloading<T>(file: string | undefined, initial: T, read: (file: string) => T): () => T {
  if (!file) return () => initial;

  let stamp = modified(file);
  let value = initial;
  return () => {
    const now = modified(file);
    if (now !== stamp) {
      value = read(file);
      stamp = now;
    }
    return value;
  };
}

function modified(file: string): number {
  try {
    return statSync(file).mtimeMs;
  } catch {
    return -1;
  }
}
