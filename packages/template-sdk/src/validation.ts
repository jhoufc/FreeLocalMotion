import { findMissingAssets, migrateEnvelope, MigrationError, type MotionProject } from '@lms/shared';
import type { TemplateDefinition } from './template';

export interface ValidationIssue {
  path: string;
  message: string;
}

export type ParseResult<P> = { ok: true; project: P; migrated: boolean } | { ok: false; issues: ValidationIssue[] };

/**
 * Full validation pipeline for a project document of a known template:
 * envelope migration -> template migration -> schema -> asset references.
 */
export const parseProjectForTemplate = <P extends MotionProject>(template: TemplateDefinition<P>, raw: unknown): ParseResult<P> => {
  let doc: Record<string, unknown>;
  let migrated = false;
  try {
    const before = JSON.stringify(raw);
    doc = migrateEnvelope(raw);
    if (template.migrate && typeof doc.templateVersion === 'string' && doc.templateVersion !== template.version) {
      doc = template.migrate(doc, doc.templateVersion);
    }
    migrated = JSON.stringify(doc) !== before;
  } catch (err) {
    const message = err instanceof MigrationError || err instanceof Error ? err.message : String(err);
    return { ok: false, issues: [{ path: '', message }] };
  }

  if (doc.templateId !== template.id) {
    return { ok: false, issues: [{ path: 'templateId', message: `Expected template "${template.id}", got "${String(doc.templateId)}"` }] };
  }

  const parsed = template.schema.safeParse(doc);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({ path: i.path.map(String).join('.'), message: i.message })),
    };
  }
  const missing = findMissingAssets(parsed.data);
  if (missing.length > 0) {
    return { ok: false, issues: missing.map((id) => ({ path: 'assets', message: `Missing asset "${id}"` })) };
  }
  return { ok: true, project: parsed.data, migrated };
};

export const formatIssues = (issues: readonly ValidationIssue[], max = 5): string =>
  issues
    .slice(0, max)
    .map((i) => (i.path ? `${i.path}: ${i.message}` : i.message))
    .join('\n') + (issues.length > max ? `\n(+${issues.length - max} more)` : '');
