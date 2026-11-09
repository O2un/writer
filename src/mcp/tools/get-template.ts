import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { Config } from '../../config.js';
import type { Template } from '../../templates/index.js';
import { templateById, templateInput } from './post-check.js';

const guide = {
  research: z.string().optional().describe('Public facts to look up and cite with footnotes'),
  prompt: z.string().optional().describe('First-hand content for the author. Leave it as a TODO comment'),
};

const outputSchema = {
  template: z.string(),
  description: z.string(),
  referencesHeading: z.string().describe('Heading of the final section that holds the footnote definitions'),
  frontmatter: z.record(z.string(), z.object(guide)).describe('Guidance for frontmatter fields, keyed by field path'),
  sections: z.array(z.object({ heading: z.string(), ...guide })).describe('Sections such posts usually have. A guideline, not a rule'),
  instructions: z.string().describe('How to draft with this template'),
};

export function draftingInstructions(template: Template): string {
  return [
    'Draft the post yourself with this template:',
    '- The sections are a guideline. Rename, reorder, merge or drop them to fit the topic.',
    `- research: look up public sources such as official pages and articles, write the facts, and cite them with footnotes collected in a final '${template.referencesHeading}' section. Cite only pages you actually read. Mark anything you could not verify as needing verification.`,
    '- If search finds nothing or a page cannot be fetched, open it with a browser tool when one is available. Otherwise ask the author for a link or the text itself instead of leaving the fact out silently.',
    "- prompt: this is first-hand content. Do not write impressions, experiences or opinions for the author. Use only what the author told you, and otherwise leave an HTML comment '<!-- TODO: <prompt> -->' for the author. It stays hidden on the site.",
    '- Leave TODOs only for the prompts in this template. Do not add sections or TODOs the template does not have.',
    "- Frontmatter: fill fields the same way. Leave out optional fields you have no value for, without a TODO. When a required field has no value, name the missing required fields in one '# TODO:' YAML comment.",
    '- Problems outside the post, such as a value the site schema does not allow, go to the author in your reply, not into the file.',
    '- Call list_posts first to avoid repeating a topic and to find posts to link.',
    '- Save a new post with draft: true, never over an existing post, then run check_post on it.',
  ].join('\n');
}

export function registerGetTemplate(server: McpServer, config: Config): void {
  server.registerTool(
    'get_template',
    {
      title: 'Get post template',
      description:
        'Returns a post template for drafting: the usual sections, what to research and what to leave for the author, and drafting instructions. The caller researches and writes the draft. Does not use an LLM or modify files.',
      inputSchema: { template: templateInput(config.templates) },
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ template: id }): Promise<CallToolResult> => {
      const template = templateById(config.templates, id);
      const { description, referencesHeading, frontmatter, sections } = template;
      const instructions = draftingInstructions(template);

      return {
        content: [{ type: 'text', text: formatTemplate(id, template, instructions) }],
        structuredContent: { template: id, description, referencesHeading, frontmatter, sections, instructions },
      };
    },
  );
}

function formatTemplate(id: string, { description, frontmatter, sections }: Template, instructions: string): string {
  const guideLines = (item: { research?: string | undefined; prompt?: string | undefined }) => [
    ...(item.research ? [`  research: ${item.research}`] : []),
    ...(item.prompt ? [`  prompt: ${item.prompt}`] : []),
  ];
  const fields = Object.entries(frontmatter).flatMap(([field, item]) => [`- ${field}`, ...guideLines(item)]);
  return [
    `${id}: ${description}`,
    ...(fields.length ? ['', 'frontmatter:', ...fields] : []),
    ...(sections.length ? ['', 'sections:', ...sections.flatMap((s) => [`- ${s.heading}`, ...guideLines(s)])] : []),
    '',
    instructions,
  ].join('\n');
}
