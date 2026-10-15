import fs from 'node:fs';
import { parseTranscript, groupIdeas, analyzeIdeas } from '../src';
for (const f of process.argv.slice(2)) {
  const t = parseTranscript(fs.readFileSync(`packages/speech/test/fixtures/${f}.json`, 'utf8'));
  const g = groupIdeas(t.words);
  const { ideas, theme } = analyzeIdeas(g, t.duration, t.language);
  console.log(`\n### ${f} ${t.language} ${t.duration}s ideas=${ideas.length} theme=${JSON.stringify(theme)}`);
  for (const i of ideas) {
    const facts = { n: i.numbers.map((x) => `${x.raw}${x.rhetorical ? '(ret)' : ''}[${x.label}|${x.subject}]`), b: i.brands, it: i.items, st: i.steps, ac: i.actions, c: i.contrast, d: i.dangling, cta: i.cta?.kind, rv: i.reveal, bh: i.behaviours.map((b) => b.word + ':' + b.behaviour), kw: i.keyword, ti: i.title, ch: i.chapter };
    const clean = Object.fromEntries(Object.entries(facts).filter(([, v]) => v && (!Array.isArray(v) || v.length)));
    console.log(`${String(i.index).padStart(2)} ${i.start.toFixed(1)}-${i.end.toFixed(1)} ${i.section}/${i.energy} [${i.data.filter((d) => d !== 'phrase' && d !== 'word').join(',')}] ${i.text}\n     ${JSON.stringify(clean)}`);
  }
}
