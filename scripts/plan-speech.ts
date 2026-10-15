/**
 * Plans a video from a transcript and prints every choice with its reasons and the
 * plan's score — the tool used to tune the planner against real speech.
 *
 *   pnpm plan:speech fala.txt                    # plain text, SRT, VTT or word JSON
 *   pnpm plan:speech packages/speech/test/fixtures/*.json --brief
 */
import fs from 'node:fs';
import path from 'node:path';
import { evaluatePlan, parseTranscript, planSpeech } from '@lms/speech';
import { buildSpeechProject, sceneDefinitions, speechSceneTypes } from '@lms/catalog/definitions';

const args = process.argv.slice(2);
const brief = args.includes('--brief');
const files = args.filter((a) => !a.startsWith('--'));
if (!files.length) {
  console.error('uso: pnpm plan:speech <transcrição> [...] [--brief]');
  process.exit(1);
}
const types = speechSceneTypes();
const scores: [string, number][] = [];
for (const file of files) {
  const transcript = parseTranscript(fs.readFileSync(file, 'utf8'));
  const plan = planSpeech(transcript, types);
  const { plan: built } = buildSpeechProject(plan, { id: 'p-plan-cli', name: 'cli', format: 'portrait', now: new Date().toISOString() });
  const score = evaluatePlan(built, types);
  scores.push([path.basename(file), score.total]);
  console.log(`\n### ${path.basename(file)} — ${transcript.language}, ${transcript.duration.toFixed(1)} s, ${built.scenes.length} cenas · nota ${score.total} ${JSON.stringify(score.parts)}`);
  if (score.notes.length) console.log(`    notas: ${score.notes.join(' | ')}`);
  for (const w of built.warnings) console.log(`    aviso: ${w}`);
  if (brief) continue;
  built.scenes.forEach((s, i) => {
    const idea = built.ideas[s.idea]!;
    const texts = Object.entries(s.fill.texts)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=“${String(v).replace(/\n/g, ' / ')}”`)
      .join(' ');
    const props = s.fill.props ? JSON.stringify(s.fill.props).slice(0, 160) : '';
    console.log(`${String(i + 1).padStart(2)} ${s.start.toFixed(1).padStart(5)}s +${s.duration.toFixed(1)}s ${sceneDefinitions.get(s.type).name.padEnd(26)} ${s.score.toFixed(1).padStart(5)}  «${idea.text}»`);
    console.log(`      ${texts} ${props}`);
    console.log(`      por quê: ${s.reasons.join(' · ')}`);
    if (s.alternatives.length) console.log(`      alternativas: ${s.alternatives.map((a) => `${sceneDefinitions.get(a.type).name} ${a.score.toFixed(1)}`).join(', ')}`);
  });
}
if (files.length > 1) console.log(`\nnotas: ${scores.map(([f, n]) => `${f} ${n}`).join(' · ')} · média ${(scores.reduce((a, [, n]) => a + n, 0) / scores.length).toFixed(1)}`);
