import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FIXTURE_DEVLOG_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'devlog');
export const FIXTURE_BLOG_DIR = path.join(FIXTURE_DEVLOG_ROOT, 'src', 'content', 'blog');
