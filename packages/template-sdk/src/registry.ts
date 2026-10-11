import type { TemplateSummary } from '@lms/shared';
import type { AnyTemplateDefinition } from './template';

export class TemplateRegistryError extends Error {}

export interface TemplateRegistry<T extends AnyTemplateDefinition> {
  register(template: T): void;
  get(id: string): T;
  find(id: string): T | undefined;
  has(id: string): boolean;
  list(): T[];
  summaries(): TemplateSummary[];
}

/**
 * The single source of truth about which templates exist. The editor, server and
 * Remotion root all iterate the registry; nothing branches on a template id.
 *
 * `register` validates the template's own defaults against its schema in both formats,
 * so a broken template fails at startup instead of in front of the user.
 */
export const createTemplateRegistry = <T extends AnyTemplateDefinition>(initial: readonly T[] = []): TemplateRegistry<T> => {
  const templates = new Map<string, T>();

  const register = (template: T) => {
    if (templates.has(template.id)) {
      throw new TemplateRegistryError(`Template "${template.id}" is already registered`);
    }
    for (const format of template.formats) {
      const defaults = template.createDefaults({
        id: 'registry-check',
        name: 'Registry check',
        format,
        now: new Date(0).toISOString(),
      });
      const parsed = template.schema.safeParse(defaults);
      if (!parsed.success) {
        throw new TemplateRegistryError(
          `Template "${template.id}" defaults are invalid for ${format}: ${parsed.error.issues
            .slice(0, 3)
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ')}`,
        );
      }
      if (defaults.templateId !== template.id) {
        throw new TemplateRegistryError(`Template "${template.id}" defaults declare templateId "${defaults.templateId}"`);
      }
      // Every scene type must yield an instance the schema accepts in any position.
      for (const type of template.sceneTypes) {
        const scene = template.createScene(type.id, { id: `registry-${type.id}`, name: type.name });
        const withScene = { ...defaults, scenes: [scene, ...defaults.scenes] };
        const r = template.schema.safeParse(withScene);
        if (!r.success || scene.type !== type.id) {
          throw new TemplateRegistryError(
            `Template "${template.id}" scene type "${type.id}" creates an invalid instance${r.success ? '' : `: ${r.error.issues[0]?.path.join('.')}: ${r.error.issues[0]?.message}`}`,
          );
        }
      }
      for (const scene of defaults.scenes) {
        if (!template.sceneTypes.some((t) => t.id === scene.type)) {
          throw new TemplateRegistryError(`Template "${template.id}" defaults use undeclared scene type "${scene.type}"`);
        }
      }
    }
    templates.set(template.id, template);
  };

  for (const t of initial) register(t);

  return {
    register,
    get(id) {
      const t = templates.get(id);
      if (!t) throw new TemplateRegistryError(`Unknown template "${id}"`);
      return t;
    },
    find: (id) => templates.get(id),
    has: (id) => templates.has(id),
    list: () => [...templates.values()],
    summaries: () =>
      [...templates.values()].map((t) => {
        const defaults = t.createDefaults({ id: 'summary', name: t.name, format: t.formats[0]!, now: new Date(0).toISOString() });
        const meta = t.getMetadata(defaults);
        return {
          id: t.id,
          name: t.name,
          version: t.version,
          description: t.description,
          tags: [...t.tags],
          formats: [...t.formats],
          durationSeconds: defaults.scenes.some((s) => s.enabled) ? meta.durationInFrames / meta.fps : 0,
          mode: t.mode ?? 'template',
        };
      }),
  };
};
