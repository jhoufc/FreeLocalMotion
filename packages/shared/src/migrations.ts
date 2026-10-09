import { CURRENT_SCHEMA_VERSION } from './schema/project';

/**
 * Envelope-level migrations, keyed by the version they upgrade *from*.
 * Template-specific migrations live in each template definition (`migrate`).
 *
 * To evolve the envelope: bump CURRENT_SCHEMA_VERSION, add `migrations[old] = fn`,
 * and keep old fixtures in tests so every historical file keeps loading.
 */
type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

const migrations: Record<number, Migration> = {
  // Example for the future:
  // 1: (p) => ({ ...p, schemaVersion: 2, newField: defaultValue }),
};

export class MigrationError extends Error {}

export const migrateEnvelope = (raw: unknown): Record<string, unknown> => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new MigrationError('Project file is not a JSON object');
  }
  let doc = raw as Record<string, unknown>;
  let version = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : 0;
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new MigrationError(
      `Project schema v${version} is newer than this Studio supports (v${CURRENT_SCHEMA_VERSION}). Update the Studio.`,
    );
  }
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = migrations[version];
    if (!step) throw new MigrationError(`No migration available from schema v${version}`);
    doc = step(doc);
    version = doc.schemaVersion as number;
  }
  return doc;
};
