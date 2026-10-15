import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DATA_KINDS, ROLES, SECTIONS, VISUALS, evaluatePlan, numbersInFill, parseTranscript, planSpeech, spokenNumberForms, type SpeechPlan } from '@lms/speech';
import { buildSpeechProject, refillScene, sceneDefinitions, sceneFromFill, speechSceneTypes } from '../src/definitions';
import { compositionProjectSchema } from '../src/composition/definition';

const FIXTURES = path.resolve(__dirname, '../../speech/test/fixtures');
const fixtures = fs.readdirSync(FIXTURES).filter((f) => f.endsWith('.json'));
const types = speechSceneTypes();
const init = { id: 'p-speech-test', name: 'Fala', format: 'portrait' as const, now: '2026-01-01T00:00:00.000Z' };

/** Product, person and app ideas the real fixtures do not contain. */
const SYNTHETIC = [
  'Conheça o Aurum Cold Brew, o café gelado que chegou para ficar.',
  'Na garrafa você tem tampa de alumínio, vidro reciclável, zero açúcar e preparo lento.',
  'O produto é leve, gelado, intenso.',
  'Eu sou a Marina Costa, designer de motion, e já são 120 mil seguidores no arroba marinamotion.',
  'Baixa o app Pulse no celular e veja seus gastos na tela de dados.',
  'Abra o painel. Clique em relatórios. Exporte os dados.',
  'Ele conecta com o Notion, o Slack, o Gmail e o WhatsApp.',
  'Antes eram 40 horas por mês, agora são só 6 horas.',
  'Me segue para mais dicas.',
].join(' ');

const plans = new Map<string, { plan: SpeechPlan; project: ReturnType<typeof buildSpeechProject>['project']; words: ReturnType<typeof parseTranscript>['words'] }>();
const planOf = (name: string, input: string) => {
  if (!plans.has(name)) {
    const t = parseTranscript(input, { duration: name === 'synthetic' ? 60 : undefined });
    const built = buildSpeechProject(planSpeech(t, types), init);
    plans.set(name, { ...built, words: t.words });
  }
  return plans.get(name)!;
};
const all = () => [...fixtures.map((f) => [f, fs.readFileSync(path.join(FIXTURES, f), 'utf8')] as const), ['synthetic', SYNTHETIC] as const];

/** Every string a scene shows (visible texts + string data in props). */
const visibleStrings = (scene: Record<string, unknown>): string[] => {
  const out: string[] = [];
  for (const el of Object.values((scene.texts ?? {}) as Record<string, { visible: boolean; content: string }>)) if (el.visible) out.push(el.content);
  const walk = (v: unknown, k = '') => {
    if (typeof v === 'string' && /label|caption|text|value|detail/.test(k)) out.push(v);
    else if (Array.isArray(v)) v.forEach((x) => walk(x, k));
    else if (v && typeof v === 'object') for (const [kk, x] of Object.entries(v)) walk(x, kk);
  };
  walk(scene.props ?? {});
  return out.filter(Boolean);
};

describe('scene planning cards', () => {
  it('every scene of the global library declares a complete, valid card', () => {
    const ids = new Set(sceneDefinitions.list().map((t) => t.id));
    for (const t of types) {
      const p = t.planning;
      expect(p, t.id).toBeDefined();
      expect(ROLES).toContain(p!.role);
      expect(VISUALS).toContain(p!.visual);
      for (const s of p!.sections) expect(SECTIONS, t.id).toContain(s);
      for (const d of p!.needs) expect(DATA_KINDS, t.id).toContain(d);
      for (const ref of [...(p!.combinesWith ?? []), ...(p!.avoids ?? [])]) expect(ids.has(ref), `${t.id} → ${ref}`).toBe(true);
      expect(p!.energy).toBeGreaterThanOrEqual(1);
      expect(p!.energy).toBeLessThanOrEqual(5);
      expect(p!.use.length).toBeGreaterThan(20);
      expect(p!.avoid.length).toBeGreaterThan(10);
    }
  });

  it('every scene type can be filled from real speech and the result validates', () => {
    const filled = new Set<string>();
    for (const [name, input] of all()) {
      const { plan } = planOf(name, input);
      plan.scenes.forEach((s, i) => {
        for (const t of types) {
          if (filled.has(t.id)) continue;
          const fill = refillScene(plan, i, t.id);
          if (!fill) continue;
          const def = sceneDefinitions.get(t.id);
          const d = Math.min(def.duration.max, Math.max(def.duration.min, s.duration));
          const parsed = def.schema.safeParse(sceneFromFill(t.id, { id: 'x-test', name: 'x', duration: d }, fill));
          expect(parsed.success, `${t.id}: ${parsed.success ? '' : JSON.stringify(parsed.error.issues[0])}`).toBe(true);
          filled.add(t.id);
        }
      });
    }
    expect([...filled].sort()).toEqual(types.map((t) => t.id).sort());
  });
});

describe.each(all().map(([n]) => n))('speech plan of %s', (name) => {
  const input = all().find(([n]) => n === name)![1];

  it('builds a valid project that follows the audio clock frame by frame', () => {
    const { plan, project } = planOf(name, input);
    expect(compositionProjectSchema.safeParse(project).success).toBe(true);
    const frames = project.scenes.reduce((a, s) => a + Math.round(s.duration * project.fps), 0);
    expect(frames).toBe(Math.round(plan.duration * project.fps));
    // Scenes start with their words: never after the first word, at most ~1.6 s before it.
    for (const s of plan.scenes) {
      const idea = plan.ideas[s.idea]!;
      if (s.start === 0 || !idea.text) continue;
      expect(s.start, idea.title).toBeLessThanOrEqual(idea.start + 0.01);
      expect(idea.start - s.start, idea.title).toBeLessThanOrEqual(1.7);
    }
  });

  it('shows only what was said: no invented numbers, no default placeholder copy', () => {
    const { plan, project, words } = planOf(name, input);
    const said = spokenNumberForms(plan.ideas);
    const spoken = words.map((w) => w.text.toLowerCase()).join(' ');
    for (const scene of project.scenes as unknown as Record<string, unknown>[]) {
      const def = sceneDefinitions.get(scene.type as string);
      const defaults = visibleStrings(def.create({ id: 'd', name: 'd' }) as unknown as Record<string, unknown>);
      for (const str of visibleStrings(scene)) {
        for (const m of str.matchAll(/\d+(?:[.,]\d+)?/g)) {
          const n = Number(m[0].replace(',', '.'));
          expect(said.has(n) || n <= Math.max(plan.theme.promise?.n ?? 0, plan.theme.items.length), `${scene.type}: “${str}”`).toBe(true);
        }
        if (defaults.includes(str)) expect(spoken, `${scene.type} kept its default “${str}”`).toContain(str.toLowerCase());
      }
    }
  });

  it('each scene (and each alternative for it) shows numbers said in its own words', () => {
    const { plan } = planOf(name, input);
    const listMax = Math.max(plan.theme.promise?.n ?? 0, plan.theme.items.length);
    plan.scenes.forEach((s, i) => {
      const local = spokenNumberForms([plan.ideas[s.idea]!, ...(plan.ideas[s.idea + 1] ? [plan.ideas[s.idea + 1]!] : [])]);
      for (const fill of [s.fill, ...s.alternatives.map((a) => a.fill), ...types.map((t) => refillScene(plan, i, t.id)).filter((f) => f !== null)]) {
        for (const n of numbersInFill(fill)) expect(local.has(n) || (Number.isInteger(n) && n <= listMax), `cena ${i + 1} «${plan.ideas[s.idea]!.text}» mostraria ${n}`).toBe(true);
      }
    });
  });

  it('scores well on the plan yardstick', () => {
    const score = evaluatePlan(planOf(name, input).plan, types);
    expect(score.parts.fidelity).toBe(20);
    expect(score.total, score.notes.join(' | ')).toBeGreaterThanOrEqual(72);
  });
});

describe('choices the speech asks for', () => {
  const scenesOf = (name: string) => {
    const input = all().find(([n]) => n === name)![1];
    return planOf(name, input).plan.scenes;
  };
  const texts = (s: SpeechPlan['scenes'][number]) => Object.values(s.fill.texts).filter(Boolean).join(' | ');

  it('compares two percentages with bars and reveals a product name on the word', () => {
    const scenes = scenesOf('misto-comparacoes.json');
    const bars = scenes.find((s) => s.type === 'infographic');
    expect((bars?.fill.props?.widgets as { kind: string; value: number }[]).map((w) => [w.kind, w.value])).toEqual([['bar', 30], ['bar', 50]]);
    const iris = scenes.find((s) => s.type === 'iris-reveal');
    expect(texts(iris!)).toContain('VideoAI');
    expect(scenesOf('misto-comparacoes.json').at(-1)!.type).toMatch(/signature|cinematic-outro/);
  });

  it('numbers every item of a list video', () => {
    const tags = scenesOf('lista-ferramentas.json').filter((s) => s.fill.chapter).map(texts);
    expect(tags.map((t) => /0(\d) \/ 05/.exec(t)?.[1])).toEqual(['1', '2', '3', '4', '5']);
    expect(scenesOf('lista-implicita.json').filter((s) => s.fill.chapter)).toHaveLength(3);
  });

  it('turns three narrated steps into three words, and a comment CTA into the word to comment', () => {
    const steps = scenesOf('studio-qa.json').find((s) => s.type === 'transformation' && s.fill.texts.word1 === 'Organize.');
    expect(Object.values(steps!.fill.texts)).toEqual(['Organize.', 'Conecte.', 'Revise.']);
    const cta = scenesOf('noticia-youtube.json').at(-1)!;
    expect(texts(cta).replace(/\s+/g, ' ')).toContain('Comente “YouTube”');
  });
});
