import { existsSync, readFileSync } from 'node:fs';
import { z } from 'zod';

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

const guideSchema = {
  research: z.string().trim().min(1).optional().describe('Public facts the drafter looks up and cites with footnotes'),
  prompt: z.string().trim().min(1).optional().describe('What the author is encouraged to write. The drafter leaves it as a placeholder'),
};

const sectionSchema = z.object({ heading: z.string().trim().min(1), ...guideSchema });
const fieldSchema = z.object(guideSchema);

const templateSchema = z.object({
  description: z.string().trim().min(1),
  referencesHeading: z.string().trim().min(1),
  frontmatter: z.record(z.string().min(1), fieldSchema).default({}),
  sections: z.array(sectionSchema).default([]),
  criteria: z.array(z.string().trim().min(1)).default([]),
});

const fileSchema = z
  .object({
    default: z.string(),
    templates: z.record(z.string().regex(ID_PATTERN), templateSchema),
  })
  .refine((file) => Object.keys(file.templates).length > 0, { message: 'templates is empty', path: ['templates'] })
  .refine((file) => file.default in file.templates, { message: 'default does not name a template', path: ['default'] });

export type Template = z.infer<typeof templateSchema>;
export type TemplateSection = z.infer<typeof sectionSchema>;

export interface Templates {
  defaultId: string;
  ids: [string, ...string[]];
  byId: Record<string, Template>;
}

export class TemplatesError extends Error {
  override name = 'TemplatesError';
}

export const BUILTIN_TEMPLATES: Templates = parseTemplates({
  default: 'article',
  templates: { article: { description: 'General post', referencesHeading: 'References' } },
});

export function readTemplates(file: string): Templates {
  if (!existsSync(file)) return BUILTIN_TEMPLATES;

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw new TemplatesError(`templates file is not valid JSON: ${file}`);
  }
  return parseTemplates(raw, file);
}

export function parseTemplates(raw: unknown, source = 'templates'): Templates {
  const parsed = fileSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new TemplatesError(`${source}: ${issue?.path.join('.') || '(root)'}: ${issue?.message}`);
  }

  const { default: defaultId, templates } = parsed.data;
  const ids = Object.keys(templates) as [string, ...string[]];
  return { defaultId, ids, byId: templates };
}
