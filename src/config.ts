import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export interface Config {
  siteRoot: string;
  contentDir: string;
  schema: Record<string, unknown>;
}

const envSchema = z.object({
  SITE_ROOT: z.string().trim().min(1),
  WRITER_CONTENT_DIR: z.string().trim().min(1).default('src/content/blog'),
  WRITER_SCHEMA: z.string().trim().min(1).default('.astro/collections/blog.schema.json'),
});

export class ConfigError extends Error {
  override name = 'ConfigError';
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(`환경변수 ${String(parsed.error.issues[0]?.path[0])}에 값을 지정해야 한다`);
  }

  const siteRoot = path.resolve(parsed.data.SITE_ROOT);
  const contentDir = path.resolve(siteRoot, parsed.data.WRITER_CONTENT_DIR);
  if (!existsSync(contentDir) || !statSync(contentDir).isDirectory()) {
    throw new ConfigError(`글 폴더를 찾을 수 없다: ${contentDir}`);
  }

  return { siteRoot, contentDir, schema: readSchema(path.resolve(siteRoot, parsed.data.WRITER_SCHEMA)) };
}

function readSchema(file: string): Record<string, unknown> {
  if (!existsSync(file)) {
    throw new ConfigError(`스키마 파일을 찾을 수 없다: ${file}. 사이트를 한 번 빌드했는지 확인한다`);
  }

  let schema: unknown;
  try {
    schema = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw new ConfigError(`스키마 파일을 JSON으로 읽을 수 없다: ${file}`);
  }

  if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new ConfigError(`스키마 파일이 JSON 객체가 아니다: ${file}`);
  }
  return schema as Record<string, unknown>;
}
