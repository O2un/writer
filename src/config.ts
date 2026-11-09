import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { LLM_PROVIDERS, type LlmProviderName } from './llm/types.js';
import { readTemplates, TemplatesError, type Templates } from './templates/index.js';

export interface Config {
  siteRoot: string;
  contentDir: string;
  schema: Record<string, unknown>;
  guidePath: string;
  templates: Templates;
  llm: { provider: LlmProviderName; model?: string; claudeBin: string };
}

const envSchema = z.object({
  SITE_ROOT: z.string().trim().min(1),
  WRITER_CONTENT_DIR: z.string().trim().min(1).default('src/content/blog'),
  WRITER_SCHEMA: z.string().trim().min(1).default('.astro/collections/blog.schema.json'),
  WRITER_GUIDE: z.string().trim().min(1).default('.claude/skills/devlog-content-writing/SKILL.md'),
  WRITER_TEMPLATES: z.string().trim().min(1).default('writer.templates.json'),
  LLM_PROVIDER: z.enum(LLM_PROVIDERS).default('claude-code'),
  WRITER_MODEL: z.string().trim().min(1).optional(),
  WRITER_CLAUDE_BIN: z.string().trim().min(1).default('claude'),
});

export class ConfigError extends Error {
  override name = 'ConfigError';
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(`environment variable ${String(parsed.error.issues[0]?.path[0])} is missing or invalid`);
  }

  const siteRoot = path.resolve(parsed.data.SITE_ROOT);
  const contentDir = path.resolve(siteRoot, parsed.data.WRITER_CONTENT_DIR);
  if (!existsSync(contentDir) || !statSync(contentDir).isDirectory()) {
    throw new ConfigError(`content folder not found: ${contentDir}`);
  }

  const { LLM_PROVIDER: provider, WRITER_MODEL: model, WRITER_CLAUDE_BIN: claudeBin } = parsed.data;

  return {
    siteRoot,
    contentDir,
    schema: readSchema(path.resolve(siteRoot, parsed.data.WRITER_SCHEMA)),
    guidePath: path.resolve(siteRoot, parsed.data.WRITER_GUIDE),
    templates: loadTemplates(path.resolve(siteRoot, parsed.data.WRITER_TEMPLATES)),
    llm: model ? { provider, model, claudeBin } : { provider, claudeBin },
  };
}

function loadTemplates(file: string): Templates {
  try {
    return readTemplates(file);
  } catch (error) {
    if (error instanceof TemplatesError) throw new ConfigError(error.message);
    throw error;
  }
}

function readSchema(file: string): Record<string, unknown> {
  if (!existsSync(file)) {
    throw new ConfigError(`schema file not found: ${file}. Check that the site has been built`);
  }

  let schema: unknown;
  try {
    schema = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw new ConfigError(`schema file is not valid JSON: ${file}`);
  }

  if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new ConfigError(`schema file is not a JSON object: ${file}`);
  }
  return schema as Record<string, unknown>;
}
