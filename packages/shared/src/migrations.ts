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
  /**
   * v1 -> v2: fixed scene slots become scene instances. In v1 every template used the
   * scene `id` as its slot/type identifier, so it becomes the `type`, and is also kept as
   * the instance id: target ids (`impact.lineA`) and every field value survive unchanged.
   */
  1: (p) => ({
    ...p,
    schemaVersion: 2,
    scenes: Array.isArray(p.scenes)
      ? p.scenes.map((scene: unknown) => {
          if (!scene || typeof scene !== 'object') return scene;
          const s = scene as Record<string, unknown>;
          return { ...s, type: typeof s.type === 'string' ? s.type : s.id, enabled: typeof s.enabled === 'boolean' ? s.enabled : true };
        })
      : p.scenes,
  }),
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
