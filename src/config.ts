import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export interface Config {
  devlogRoot: string;
  blogDir: string;
}

const envSchema = z.object({
  DEVLOG_ROOT: z.string().trim().min(1, 'DEVLOG_ROOT가 비어 있다'),
});

export class ConfigError extends Error {
  override name = 'ConfigError';
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError('DEVLOG_ROOT 환경변수에 devlog 레포 루트 경로를 지정해야 한다');
  }

  const devlogRoot = path.resolve(parsed.data.DEVLOG_ROOT);
  const blogDir = path.join(devlogRoot, 'src', 'content', 'blog');
  if (!existsSync(blogDir) || !statSync(blogDir).isDirectory()) {
    throw new ConfigError(`글 폴더를 찾을 수 없다: ${blogDir}`);
  }

  return { devlogRoot, blogDir };
}
