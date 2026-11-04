import { Ajv2020, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import { ConfigError } from '../config.js';
import { reporter, type Rule, type Violation } from './types.js';

const report = reporter('frontmatter');

const BRANCH = /^(.*\/oneOf\/\d+)\//;

const isDate = (value: string): boolean => !Number.isNaN(new Date(value).getTime());

export function createFrontmatterRule(schema: Record<string, unknown>): Rule {
  const validate = compileSchema(schema);
  const known = Object.keys((schema['properties'] as object | undefined) ?? {});

  return {
    id: 'frontmatter',
    check(post, context) {
      const fm = post.frontmatter;
      if (fm.status === 'missing') return [report.error('frontmatter is missing', 1)];
      if (fm.status === 'invalid') return [report.error(`frontmatter YAML cannot be parsed: ${fm.error}`, fm.line)];

      const violations: Violation[] = [];

      if (!validate(fm.data)) {
        for (const issue of withoutOtherBranches(validate.errors ?? [])) {
          const path = toPath(issue);
          const field = path.join('.');
          violations.push(report.error(field ? `${field}: ${issue.message}` : `${issue.message}`, fm.locate(path)));
        }
      }

      if (known.length > 0) {
        for (const key of Object.keys(fm.data)) {
          if (!known.includes(key)) {
            violations.push(report.warning(`unknown field '${key}': not in the site schema`, fm.locate([key])));
          }
        }
      }

      const thumbnail = fm.data['thumbnail'];
      if (typeof thumbnail === 'string' && !/^https?:\/\//.test(thumbnail) && !context.assetExists(thumbnail)) {
        violations.push(report.error(`thumbnail file not found: ${thumbnail}`, fm.locate(['thumbnail'])));
      }

      return violations;
    },
  };
}

function compileSchema(schema: Record<string, unknown>): ValidateFunction {
  const { $schema: _, ...body } = schema;
  const ajv = new Ajv2020({ strict: false, allErrors: true, formats: { 'date-time': isDate, date: isDate } });
  try {
    return ajv.compile(body);
  } catch (error) {
    throw new ConfigError(`schema cannot be compiled: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function withoutOtherBranches(errors: ErrorObject[]): ErrorObject[] {
  const branchOf = (issue: ErrorObject) => BRANCH.exec(issue.schemaPath)?.[1];
  const mismatched = new Set(errors.filter((issue) => issue.keyword === 'const' && branchOf(issue)).map(branchOf));
  const kept = errors.filter((issue) => !mismatched.has(branchOf(issue)));
  const hasBranchError = kept.some((issue) => branchOf(issue));
  return kept.filter((issue) => issue.keyword !== 'oneOf' || !hasBranchError);
}

function toPath(issue: ErrorObject): string[] {
  return issue.instancePath
    .split('/')
    .slice(1)
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
}
