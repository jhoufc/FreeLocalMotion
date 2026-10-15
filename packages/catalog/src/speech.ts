/**
 * Speech → free composition. The planner (`@lms/speech`) decides which scene type tells
 * each idea and what it shows; this module turns that plan into validated scene
 * instances whose durations follow the audio clock frame by frame.
 */
import type { Format, Theme } from '@lms/shared';
import { contextOf, planSpeech, type PlanOptions, type PlannableSceneType, type SceneFill, type SpeechPlan, type Transcript } from '@lms/speech';
import { compositionDefinition, compositionProjectSchema, type CompositionProject } from './composition/definition';
import { sceneDefinitions } from './scenes';

type Scene = CompositionProject['scenes'][number];

export const SPEECH_ORIGIN_ID = 'speech';

/** Scene types the planner may choose: the whole global library (each declares a planning card). */
export const speechSceneTypes = (): PlannableSceneType[] => sceneDefinitions.list() as unknown as PlannableSceneType[];

const isPlain = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const merge = <T>(base: T, patch: unknown): T => {
  if (!isPlain(patch) || !isPlain(base)) return (patch === undefined ? base : patch) as T;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) out[k] = merge((base as Record<string, unknown>)[k], v);
  return out as T;
};

/**
 * A scene instance showing exactly what the fill says: listed texts get their content,
 * every other text of the type is hidden (its default copy never reaches the screen).
 */
export const sceneFromFill = (type: string, init: { id: string; name: string; duration: number }, fill: SceneFill): Scene => {
  const def = sceneDefinitions.get(type);
  const base = def.create({ id: init.id, name: init.name }) as unknown as Scene & { texts?: Record<string, Record<string, unknown>> };
  const texts = Object.fromEntries(
    Object.entries(base.texts ?? {}).map(([key, el]) => {
      const content = fill.texts[key];
      if (!(typeof content === 'string' && content.trim())) return [key, { ...el, content: '', visible: false }];
      // A spoken sentence is longer than a designed headline: in 16:9 the filler's balanced
      // lines ("Legenda sincronizada\ncom cada palavra") win; in 9:16 the text wraps by width
      // at full size (Kinetic Type would stack every word; two long lines would shrink it).
      const breaks = content.includes('\n') ? { portrait: 'auto', landscape: 'manual' } : el.breaks;
      return [key, { ...el, content, visible: true, ...(breaks ? { breaks } : {}) }];
    }),
  );
  return merge({ ...base, texts, duration: init.duration }, fill.props ? { props: fill.props } : {}) as Scene;
};

const sceneId = (i: number, type: string) => `s${String(i + 1).padStart(2, '0')}-${type}`.slice(0, 64);
const sceneName = (plan: SpeechPlan, i: number) => {
  const s = plan.scenes[i]!;
  const idea = plan.ideas[s.idea]!;
  return `${String(i + 1).padStart(2, '0')} · ${idea.title}`.slice(0, 60);
};

export interface SpeechProjectInit {
  id: string;
  name: string;
  format: Format;
  now: string;
  fps?: 30 | 60;
  theme?: Theme;
  /** Audio asset already attached to the project (the speech itself). */
  audio?: { assetId: string; asset: CompositionProject['assets'][number] } | null;
}

/**
 * Builds the project from a plan. Scene boundaries are rounded to frames on the audio
 * clock (no drift: the last scene ends exactly where the audio ends). A fill that does not
 * validate falls back to the next alternative (recorded in `plan.warnings`).
 */
export const buildSpeechProject = (plan: SpeechPlan, init: SpeechProjectInit): { project: CompositionProject; plan: SpeechPlan } => {
  const fps = init.fps ?? 30;
  const total = Math.round(plan.duration * fps);
  const starts = plan.scenes.map((s, i) => (i === 0 ? 0 : Math.round(s.start * fps)));
  const out: SpeechPlan = structuredClone(plan);
  const scenes: Scene[] = plan.scenes.map((s, i) => {
    const frames = (i + 1 < starts.length ? starts[i + 1]! : total) - starts[i]!;
    const duration = frames / fps;
    const options = [{ type: s.type, fill: s.fill }, ...s.alternatives.map((a) => ({ type: a.type, fill: a.fill }))];
    for (const [k, o] of options.entries()) {
      const def = sceneDefinitions.get(o.type);
      if (duration < def.duration.min - 1e-6 || duration > def.duration.max + 1e-6) continue;
      const scene = sceneFromFill(o.type, { id: sceneId(i, o.type), name: sceneName(plan, i), duration }, o.fill);
      const parsed = def.schema.safeParse(scene);
      if (!parsed.success) {
        out.warnings.push(`Cena ${i + 1} (${def.name}): conteúdo inválido (${parsed.error.issues[0]?.path.join('.')}: ${parsed.error.issues[0]?.message}).`);
        continue;
      }
      if (k > 0) {
        const alt = s.alternatives[k - 1]!;
        out.scenes[i] = { ...s, type: alt.type, fill: alt.fill, score: alt.score, reasons: [alt.reason, `substituiu ${sceneDefinitions.get(s.type).name}`], alternatives: [] };
      }
      out.scenes[i]!.duration = Math.round(duration * 1000) / 1000;
      return parsed.data as Scene;
    }
    throw new Error(`Cena ${i + 1}: nenhuma alternativa válida para ${duration.toFixed(2)} s`);
  });
  const base = compositionDefinition.createDefaults({ id: init.id, name: init.name, format: init.format, fps, now: init.now });
  const project = compositionProjectSchema.parse({
    ...base,
    theme: init.theme ? { ...init.theme } : base.theme,
    origin: { kind: 'template', templateId: SPEECH_ORIGIN_ID, version: '1.0.0' },
    assets: init.audio ? [init.audio.asset] : [],
    audio: init.audio ? { assetId: init.audio.assetId, volume: 1, fadeIn: 0, fadeOut: 0.2 } : base.audio,
    scenes,
  });
  return { project, plan: out };
};

/** Plan + project in one call. */
export const planSpeechProject = (transcript: Transcript, init: SpeechProjectInit, opts: PlanOptions = {}) =>
  buildSpeechProject(planSpeech(transcript, speechSceneTypes(), opts), init);

/** Re-fills scene `index` of a plan with another type (the Studio's "trocar cena"). */
export const refillScene = (plan: SpeechPlan, index: number, type: string): SceneFill | null => {
  const def = sceneDefinitions.get(type) as unknown as PlannableSceneType;
  const ctx = contextOf(plan, index);
  if (!def.planning) return null;
  if (def.planning.needs.some((d) => !ctx.data.includes(d))) return null;
  return def.planning.fill(ctx);
};
