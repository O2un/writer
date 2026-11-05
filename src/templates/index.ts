export const TEMPLATE_IDS = ['article', 'escape-review'] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export const DEFAULT_TEMPLATE_ID: TemplateId = 'article';

export interface Template {
  description: string;
  referencesHeading: string;
  sections: readonly string[];
  criteria: readonly string[];
}

export const TEMPLATES: Record<TemplateId, Template> = {
  article: {
    description: 'General post',
    referencesHeading: '참고 자료',
    sections: [],
    criteria: [],
  },
  'escape-review': {
    description: 'Escape room review',
    referencesHeading: '참고 자료',
    sections: ['방에 들어가서', '막힌 곳', '총평'],
    criteria: [],
  },
};
