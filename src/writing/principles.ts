import { readFile } from 'node:fs/promises';

export const WRITING_PRINCIPLES: readonly string[] = [
  'Do not invent experiences, impressions, figures, quotes or sources. Mark a claim that has no source as needing verification instead of stating it as fact.',
  "Keep the author's voice. Fix what is unclear or wrong, and do not rewrite the post into generic copy.",
  'The post explains its subject, never itself: no commentary on its own layout or order, no forward references to a section the reader will reach anyway, no arguing with a misreading nobody made, no explaining its own notation or wording choices. If a transition is needed to hold two sections together, the order is wrong.',
  "Spell out a shortened name or nickname of a theme, game, product or person in full at its first mention in the body, and use the short form only after that. The title and frontmatter do not count as a first mention. Slang that is not a shortened name is the author's voice.",
  'A footnote explanation says what the source establishes or who or what the marker points at, in one or two sentences. It does not summarize the source. Cite only pages that exist and were read.',
];

export const REVISION_PRINCIPLES: readonly string[] = [
  'A revised post reads as if it had been written that way from the start. Leave no contrast whose discarded half is the earlier draft ("not X but Y" when X was the old version), no sentence that justifies or softens the change, and no earlier wording kept beside the new one.',
];

export function formatPrinciples(principles: readonly string[]): string {
  return principles.map((principle) => `- ${principle}`).join('\n');
}

export function guideBlock(guide: string | null): string[] {
  return guide ? [`The site's own writing guide, which adds to the principles above:\n<guide>\n${guide}\n</guide>`] : [];
}

export async function readGuide(file: string): Promise<string | null> {
  try {
    const guide = (await readFile(file, 'utf8')).trim();
    return guide || null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw new Error(`cannot read guide file: ${file}. Check WRITER_GUIDE`);
  }
}
