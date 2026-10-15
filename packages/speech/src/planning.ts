import type { DataKind, IdeaAnalysis, Section, SpeechTheme } from './analysis';
import type { Lang } from './text';

/** Narrative role of a scene type (EditorReels' `papel`). */
export const ROLES = ['emphasize', 'explain', 'prove', 'demonstrate', 'compare', 'list', 'warn', 'call', 'reveal', 'identify', 'close'] as const;
export type SceneRole = (typeof ROLES)[number];

export const ROLE_LABELS: Record<SceneRole, string> = {
  emphasize: 'Enfatizar',
  explain: 'Explicar',
  prove: 'Provar',
  demonstrate: 'Demonstrar',
  compare: 'Comparar',
  list: 'Listar',
  warn: 'Alertar',
  call: 'Chamar (CTA)',
  reveal: 'Revelar',
  identify: 'Identificar',
  close: 'Encerrar',
};

/** Visual family: two scenes of the same family back to back feel repetitive. */
export const VISUALS = ['type', 'card', 'interface', 'data', 'product', 'brand', 'abstract', 'cta'] as const;
export type VisualFamily = (typeof VISUALS)[number];

/** Everything a scene filler may read about the idea it is filling. */
export interface SpeechContext extends IdeaAnalysis {
  lang: Lang;
  /** Ideas around this one (a "não é X." may get its Y from the next idea). */
  prev: IdeaAnalysis | null;
  next: IdeaAnalysis | null;
  count: number;
  isFirst: boolean;
  isLast: boolean;
  theme: SpeechTheme;
  /** Seconds this scene will last on screen. */
  span: number;
}

/**
 * What a scene puts on screen for one idea. Texts not listed are hidden (no placeholder
 * survives); `props` are merged over the type's defaults, arrays replaced.
 */
export interface SceneFill {
  texts: Record<string, string | null>;
  props?: Record<string, unknown>;
  /**
   * 0 = generic (it only repeats words of the speech) … 6 = the speech asks for exactly
   * this scene (two percentages compared → infographic bars).
   */
  strength: number;
  /** One sentence, in Portuguese, shown to the user as the reason for the choice. */
  reason: string;
  /**
   * Marks a list item ("01 / 05"): list videos repeat their chapter scene on purpose, so
   * repetition and the generic cap do not apply.
   */
  chapter?: boolean;
}

/**
 * A scene type's planning card ("ficha"): when it makes sense in a video, and how to
 * build its content from the speech. Every scene in the library declares one (tested).
 */
export interface ScenePlanning {
  role: SceneRole;
  /** Script sections it fits. */
  sections: readonly Section[];
  /** 1 (calm) … 5 (explosive). */
  energy: number;
  /** Data the idea must contain (checked before `fill`). */
  needs: readonly DataKind[];
  visual: VisualFamily;
  /** Only repeats words of the speech (capped to ~25% of the video). */
  generic?: boolean;
  /** Scene types that work right before/after it. */
  combinesWith?: readonly string[];
  /** Scene types that should not sit next to it (same idea, visual clash). */
  avoids?: readonly string[];
  maxPerVideo?: number;
  /** When to use it / when not to — shown in the Studio next to the alternatives. */
  use: string;
  avoid: string;
  /** Content for one idea, or null when the speech does not support this scene. */
  fill(ctx: SpeechContext): SceneFill | null;
}
