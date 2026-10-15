import { describe, expect, it } from 'vitest';
import {
  analyzeIdeas,
  chapterLabel,
  commentWord,
  estimateTimings,
  extractClaim,
  extractContrast,
  extractItems,
  extractNumbers,
  extractSteps,
  groupIdeas,
  parseTranscript,
  realignText,
  shortTitle,
  transcriptText,
} from '../src';

describe('transcripts', () => {
  it('reads plain text, SRT, WebVTT and word JSON', () => {
    const text = parseTranscript('Olá, tudo bem? Hoje eu vou mostrar três dicas.');
    expect(text.source).toBe('text');
    expect(text.timed).toBe(false);
    expect(text.words.map((w) => w.text)).toEqual(['Olá', 'tudo', 'bem', 'Hoje', 'eu', 'vou', 'mostrar', 'três', 'dicas']);
    expect(text.words[2]!.punct).toBe('?');
    expect(text.language).toBe('pt');

    const srt = parseTranscript('1\n00:00:01,000 --> 00:00:03,000\nOlá <b>mundo</b>\n\n2\n00:00:03,500 --> 00:00:05,000\nSegunda frase.\n');
    expect(srt.source).toBe('srt');
    expect(srt.words.map((w) => w.text)).toEqual(['Olá', 'mundo', 'Segunda', 'frase']);
    expect(srt.words[0]!.start).toBeCloseTo(1, 2);
    expect(srt.words[3]!.end).toBeLessThanOrEqual(5);

    const vtt = parseTranscript('WEBVTT\n\n00:00.500 --> 00:04.000\nThis is what you need to know about the new tool.\n');
    expect(vtt.source).toBe('vtt');
    expect(vtt.language).toBe('en');

    const json = parseTranscript(JSON.stringify([{ w: 'Esse', s: 0, e: 0.2 }, { w: 'vídeo.', s: 0.2, e: 0.6 }]));
    expect(json.source).toBe('words');
    expect(json.words[1]).toEqual({ text: 'vídeo', punct: '.', start: 0.2, end: 0.6 });
    // Whisper-style segments too.
    expect(parseTranscript(JSON.stringify({ segments: [{ words: [{ word: ' Oi', start: 0, end: 0.3 }] }] })).words[0]!.text).toBe('Oi');
  });

  it('stretches estimated timings to the audio length when it is known', () => {
    const words = estimateTimings('uma frase curta de teste.', { duration: 10 });
    expect(words[words.length - 1]!.end).toBeCloseTo(9.6, 1);
  });

  it('keeps the audio clock when the user corrects the transcript', () => {
    const t = parseTranscript(JSON.stringify([
      { w: 'O', s: 0, e: 0.1 },
      { w: 'Cloud', s: 0.1, e: 0.5 },
      { w: 'é', s: 0.5, e: 0.6 },
      { w: 'ótimo.', s: 0.6, e: 1 },
    ]));
    const fixed = realignText('O Claude é ótimo demais.', t.words);
    expect(fixed.map((w) => w.text)).toEqual(['O', 'Claude', 'é', 'ótimo', 'demais']);
    expect(fixed[0]!.start).toBe(0);
    expect(fixed[2]!.start).toBe(0.5);
    // Edited and added words are interpolated between their anchors.
    expect(fixed[1]!.start).toBeGreaterThanOrEqual(0.1);
    expect(fixed[1]!.end).toBeLessThanOrEqual(0.5);
    expect(fixed[4]!.start).toBeGreaterThanOrEqual(1);
    expect(transcriptText(fixed)).toBe('O Claude é ótimo demais.');
  });
});

describe('extraction (lessons from EditorReels’ comparativo_planos.md)', () => {
  it('reads numbers as said and never treats dates, list items or "100% automático" as data', () => {
    const n = extractNumbers('O modelo A é 30% mais econômico do que o modelo B, que é 50% mais devagar.', 'pt');
    expect(n.map((x) => [x.value, x.unit])).toEqual([[30, '%'], [50, '%']]);
    expect(n[1]!.subject).toMatch(/modelo B/);
    expect(extractNumbers('Setenta por cento das pessoas assistem sem som.', 'pt').map((x) => [x.value, x.unit])).toEqual([[70, '%']]);
    expect(extractNumbers('Custa R$ 49,90 por mês e tem 1.500 alunos.', 'pt').map((x) => [x.value, x.prefix])).toEqual([[49.9, 'R$'], [1500, '']]);
    expect(extractNumbers('São 10 mil inscritos.', 'pt')[0]!.value).toBe(10000);
    expect(extractNumbers('No dia 15 de setembro lançamos.', 'pt')).toEqual([]);
    expect(extractNumbers('Erro número dois: legenda pequena.', 'pt')).toEqual([]);
    expect(extractNumbers('Ele monta tudo 100% no automático.', 'pt')[0]!.rhetorical).toBe(true);
    expect(extractNumbers('100% dos usuários aprovaram.', 'pt')[0]!.rhetorical).toBe(false);
  });

  it('finds contrasts only when the Y is really affirmed, keeping the speaker’s verb', () => {
    expect(extractContrast('Não é sorte, é método.')).toMatchObject({ x: 'sorte', y: 'método', kind: 'not-but', neg: 'Não é' });
    expect(extractContrast('Você não precisa de um computador caro, mas sim de método.')).toMatchObject({ neg: 'Não precisa', x: 'um computador caro', y: 'de método' });
    expect(extractContrast('Não precisa de câmera cara, mas de constância.')).toMatchObject({ neg: 'Não precisa', x: 'câmera cara', y: 'de constância' });
    // A list of adjectives after a comma is not the Y (EditorReels showed "é SOFISTICADA").
    expect(extractContrast('O que você precisa não é de uma edição robusta, sofisticada.')).toBeNull();
    expect(extractContrast('Antes o trabalho era manual, agora o fluxo é automático.')).toMatchObject({ kind: 'before-now' });
  });

  it('finds lists, steps, claims and comment words', () => {
    expect(extractItems('Três ferramentas ajudam a organizar ideias: pesquisa, escrita e revisão.')).toEqual(['Pesquisa', 'Escrita', 'Revisão']);
    expect(extractItems('Você cola a transcrição e ele devolve os tópicos e as tarefas.')).toEqual([]);
    expect(extractItems('A quarta é o Perplexity, que pesquisa na internet e mostra as fontes.')).toEqual([]);
    expect(extractSteps('Primeiro organize a ideia, em seguida conecte os dados, por fim revise o resultado.')).toEqual(['Organize a ideia', 'Conecte os dados', 'Revise o resultado']);
    expect(extractSteps('Digite sua pergunta na tela. Selecione o resultado para abrir os detalhes.')).toHaveLength(2);
    expect(extractClaim('Ou seja, zero consumo de tokens para editar.')).toBe('ZERO CONSUMO DE TOKENS');
    expect(extractClaim('No final o vídeo fica 100% editável.')).toBe('100% EDITÁVEL');
    expect(extractClaim('Ele coloca 100% na tela.')).toBeNull();
    expect(commentWord('Comente aí o YouTube que eu te mando o tutorial completo.')).toEqual({ word: 'YouTube', rest: 'que eu te mando o tutorial completo' });
  });

  it('writes headlines without fillers or dangling connectors', () => {
    expect(shortTitle('Ou seja, zero consumo de tokens', 6)).toBe('Zero consumo de tokens');
    expect(shortTitle('Cinco ferramentas de IA que vão economizar', 5)).toBe('Cinco ferramentas de IA');
    expect(shortTitle('Entendeu? Então eu vou disponibilizar o software', 5)).toBe('Vou disponibilizar o software');
    expect(chapterLabel('Erro número um: começar o vídeo com bom dia.')).toBe('Começar o vídeo com bom dia');
    expect(chapterLabel('A primeira é o Notion AI, que resume suas reuniões.')).toBe('Notion AI');
    expect(chapterLabel('Tem o corte automático de silêncio, que tira as pausas.')).toBe('Corte automático de silêncio');
  });
});

describe('ideas and analysis', () => {
  const words = (s: string) => parseTranscript(s).words;

  it('never splits a comparison or a "não é X, é Y" across ideas', () => {
    const long = 'Eu falo que o modelo A é trinta e cinco por cento mais rápido em tudo o que faz, enquanto o modelo B, que é cinquenta por cento mais lento, perde em tudo.';
    const ideas = groupIdeas(parseTranscript(long, { duration: 12 }).words, { maxSeconds: 4 });
    expect(ideas).toHaveLength(1);
  });

  it('detects explicit and implicit list videos', () => {
    const t = parseTranscript('Tem três atalhos que mudaram meu jeito de trabalhar. Tem o corte automático de silêncio. Tem a legenda gerada pela transcrição. E tem os modelos de animação prontos.');
    const g = groupIdeas(t.words, { minSeconds: 0.5 });
    const { theme } = analyzeIdeas(g, t.duration, 'pt');
    expect(theme.promise).toMatchObject({ n: 3, noun: 'atalhos' });
    expect(theme.items.map((i) => i.n)).toEqual([1, 2, 3]);
    expect(words('a').length).toBe(1);
  });
});
