/**
 * A 0–100 score for a plan of one video (EditorReels' avaliar_plano). It is an automatic
 * yardstick — proxies, not taste — meant to compare plans of the SAME speech (planner
 * changes, user edits), not videos with each other.
 *
 * - structure (25): a strong opening; a CTA scene when the speech asks for one; list videos
 *   keep their chapters.
 * - adherence (25): a specific scene (proves what is said) counts 1, a generic one 0.4,
 *   weighted by duration.
 * - fidelity (20): every number shown must have been said (−10 per invented number).
 * - variety (15): generic share above 25% and any type used more than twice.
 * - rhythm (15): scene durations between 3 and 9 s, scenes starting with their idea.
 */
import { numbersInFill, spokenNumberForms, type PlannableSceneType, type SpeechPlan } from './planner';

export interface PlanScore {
  total: number;
  parts: { structure: number; adherence: number; fidelity: number; variety: number; rhythm: number };
  notes: string[];
}

const WEIGHTS = { structure: 25, adherence: 25, fidelity: 20, variety: 15, rhythm: 15 };

export const evaluatePlan = (plan: SpeechPlan, types: readonly PlannableSceneType[]): PlanScore => {
  const byId = new Map(types.map((t) => [t.id, t]));
  const notes: string[] = [];
  const scenes = plan.scenes;
  const total = scenes.reduce((a, s) => a + s.duration, 0) || 1;
  const generic = (id: string) => Boolean(byId.get(id)?.planning?.generic);
  // A chapter ("01 / 05") is structure, not a generic repetition of the speech.
  const genericScene = (s: SpeechPlan['scenes'][number]) => generic(s.type) && !s.fill.chapter;

  // Structure
  let structure = 1;
  const first = scenes[0];
  if (first && generic(first.type) && (byId.get(first.type)?.planning?.energy ?? 0) < 4) {
    structure -= 0.3;
    notes.push('abertura genérica e calma');
  }
  const wantsCta = plan.ideas.some((i) => i.cta);
  const hasCta = scenes.some((s) => ['call', 'close'].includes(byId.get(s.type)?.planning?.role ?? ''));
  if (wantsCta && !hasCta) {
    structure -= 0.4;
    notes.push('a fala pede uma ação (CTA) e nenhuma cena chama');
  }
  if (plan.theme.items.length) {
    const marked = plan.theme.items.filter((it) => scenes.some((s) => s.origin === it.idea && s.part === 0 && /\b0?\d\s*\/|capítulo|dica|item/i.test(Object.values(s.fill.texts).join(' '))));
    if (marked.length < plan.theme.items.length) {
      structure -= 0.3 * (1 - marked.length / plan.theme.items.length);
      notes.push(`${plan.theme.items.length - marked.length} item(ns) da lista sem número na tela`);
    }
  }

  // Adherence
  const adherence = scenes.reduce((a, s) => a + s.duration * (genericScene(s) ? 0.4 : 1), 0) / total;

  // Fidelity
  const said = spokenNumberForms(plan.ideas);
  const listMax = Math.max(plan.theme.promise?.n ?? 0, plan.theme.items.length);
  let fake = 0;
  for (const s of scenes) {
    const bad = numbersInFill(s.fill).filter((n) => !said.has(n) && !(Number.isInteger(n) && n >= 1 && n <= listMax));
    if (bad.length) notes.push(`cena ${scenes.indexOf(s) + 1} mostra ${bad.join(', ')} (não dito)`);
    fake += bad.length;
  }
  const fidelity = Math.max(0, 1 - fake * 0.5);

  // Variety
  let variety = 1;
  const genShare = scenes.filter(genericScene).reduce((a, s) => a + s.duration, 0) / total;
  if (genShare > 0.25) {
    variety -= Math.min(0.6, (genShare - 0.25) * 1.5);
    notes.push(`${Math.round(genShare * 100)}% do tempo em cenas genéricas`);
  }
  const counts = new Map<string, number>();
  scenes.forEach((s) => counts.set(s.type, (counts.get(s.type) ?? 0) + 1));
  for (const [id, n] of counts) {
    if (n > 2 && !(plan.theme.items.length && n <= plan.theme.items.length + 1)) {
      variety -= 0.15 * (n - 2);
      notes.push(`${byId.get(id)?.name ?? id} ×${n}`);
    }
  }
  variety = Math.max(0, variety);

  // Rhythm
  const bad = scenes.filter((s) => s.duration < 2.9 || s.duration > 9.6).length;
  const misaligned = scenes.filter((s) => s.part === 0 && s.idea > 0 && Math.abs(s.start + 0.12 - plan.ideas[s.idea]!.start) > 0.4).length;
  const rhythm = Math.max(0, 1 - (bad + misaligned) / Math.max(1, scenes.length));
  if (bad) notes.push(`${bad} cena(s) fora de 3–9 s`);

  const parts = {
    structure: Math.round(Math.max(0, structure) * WEIGHTS.structure * 10) / 10,
    adherence: Math.round(adherence * WEIGHTS.adherence * 10) / 10,
    fidelity: Math.round(fidelity * WEIGHTS.fidelity * 10) / 10,
    variety: Math.round(variety * WEIGHTS.variety * 10) / 10,
    rhythm: Math.round(rhythm * WEIGHTS.rhythm * 10) / 10,
  };
  return { total: Math.round(Object.values(parts).reduce((a, b) => a + b, 0)), parts, notes };
};
