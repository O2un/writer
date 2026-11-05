import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config.js';

export const FIXTURE_SITE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'site');
export const FIXTURE_CONTENT_DIR = path.join(FIXTURE_SITE_ROOT, 'src', 'content', 'blog');
export const FIXTURE_CONFIG = loadConfig({ SITE_ROOT: FIXTURE_SITE_ROOT, WRITER_GUIDE: 'guide.md' });
