# Planejador pela fala

Você envia o **áudio ou vídeo** da sua fala (ou só a transcrição). O Studio monta uma composição livre em que cada ideia dita vira a cena que melhor a conta: números viram gráficos, listas ganham capítulos, “não é X, é Y” vira contraste, um nome dito é revelado e a chamada final fecha o vídeo. Tudo roda no computador: a transcrição usa o faster-whisper local e nada é enviado para fora.

O motor é uma adaptação do Plano v2 do EditorReels (`reels/plano_v2.py` + `reels/fichas.py`) e incorpora as lições de `docs/comparativo_planos.md` daquele projeto.

## Fluxo

```
áudio/vídeo ──ffmpeg──▶ speech.wav (16 kHz) ──faster-whisper──▶ palavras com tempo
transcrição (texto, SRT, VTT ou JSON de palavras) ─────────────▶ palavras com tempo (estimado se for texto)
                                   │ correções do usuário: realinhadas palavra a palavra (o relógio do áudio é mantido)
                                   ▼
             @lms/speech  ideias → análise → fichas das cenas → seletor global → plano
                                   ▼
             @lms/catalog buildSpeechProject: instâncias validadas, durações em frames no relógio do áudio
                                   ▼
             projeto livre comum + trilha (speech-audio.m4a) + projects/<id>/speech.json (plano com motivos)
```

| Onde | O quê |
|---|---|
| `packages/speech` | Pacote puro (sem I/O): transcrição → ideias → análise → seleção → avaliação |
| `packages/*/src/planning.ts` | A **ficha** de cada cena da biblioteca (Signature, Premium, Motion) |
| `packages/catalog/src/speech.ts` | Plano → projeto (instâncias, frames, fallback para alternativas) |
| `apps/server/src/speech` | Upload (ffmpeg), transcrição local (job com progresso), rotas e o `speech.json` |
| `apps/server/python/transcribe.py` | faster-whisper com tempos por palavra |
| Studio | **Nova criação → A partir da fala** e a aba **Fala** do projeto |

## Etapas do planejador

1. **Ideias** (`ideas.ts`, de `agrupar_ideias`). Cada frase é uma ideia.
   - Frase longa parte na vírgula mais próxima do meio, mas **nunca** separa os dois números de uma comparação nem o “não é X” do seu “é Y”. Enumerações ficam inteiras.
   - “Acabou X. Agora Y.” vira uma ideia só.
   - Pergunta curta se junta à resposta.
   - Frase curta com sinal forte (“O nome é X.”, número, CTA) **abre** a ideia seguinte.
   - Frase que abre um item de lista (“A terceira é…”) nunca se cola no item anterior.
   - Uma frase curta completa (“Não é mágica, é método.”) fica sozinha.
2. **Análise** (`analysis.ts`, de `analisar`). Cada ideia recebe:
   - seção do roteiro (gancho, contexto, problema, explicação, demonstração, prova, virada, CTA);
   - energia de 1 a 5;
   - os dados que contém: número, %, tempo, valor, marcas, itens, passos, pergunta, contraste, CTA, pessoa, revelação, app, produto, interface e afirmação.

   O vídeo inteiro também é lido: promessa de lista (“3 ferramentas…”) e itens numerados, explícitos (“a primeira…”, “erro número dois…”) ou implícitos (“Tem o…, Tem a…, E tem…”).
3. **Extração** (`extract.ts`). São os fatos que as cenas mostram:
   - números como foram ditos (“R$ 49,90”, “10 mil”, “Setenta por cento”, “mais de 10 mil” → 10.000+);
   - rótulo e sujeito de cada número (“Modelo B · mais caro”);
   - contraste com o verbo do falante (“Não precisa…”);
   - listas, passos e instruções no imperativo;
   - a palavra a comentar (`Comente “YouTube”`);
   - nome revelado, @, nome e cargo;
   - afirmações-carimbo (“ZERO TOKENS”, “100% EDITÁVEL”) e palavras com comportamento (“absurdo” explode, “rápido” atravessa).
4. **Seleção** (`planner.ts`, de `escolhedor_cenas`). Para cada trecho, toda cena cuja duração cabe propõe seu conteúdo (`fill`). A nota soma:
   - **ficha × análise:** seção, energia e dados;
   - **força do sinal**, de 0 (genérica) a 6 (a fala pede exatamente esta cena);
   - **contexto do vídeo:** repetição, teto de 25% para genéricas, `combinesWith`/`avoids` com a cena anterior, mesma família visual, `maxPerVideo`.

   Itens de lista repetem o capítulo de propósito e ficam fora das penalidades.
5. **Tempo.** As cenas ficam coladas no relógio do áudio e cada uma começa ~0,12 s antes da primeira palavra.
   - Uma cena forte mais curta que a ideia ocupa o começo dela. O corte só acontece em pontuação e nunca separa uma comparação; o resto vira outra cena, analisada só com as próprias palavras.
   - Se as palavras cabem, a pausa depois delas passa para a cena seguinte, que começa até 1,5 s antes.
   - O encerramento pode ficar até 1,5 s depois da última palavra.
   - Duas frases com sinais próprios viram duas cenas quando cada uma sozinha rende uma cena melhor.
6. **Fidelidade.** Nenhum número aparece se não foi dito, e o planejador descarta a cena que mostraria um. Textos que a fala não preenche ficam **ocultos**: nenhum texto de exemplo da cena chega à tela. A trava é testada em cada cena e em cada alternativa.

## A ficha de uma cena

Toda cena da biblioteca declara `planning` (há teste para isso):

```ts
planning: {
  role: 'prove',                       // enfatizar, explicar, provar, demonstrar, comparar, listar…
  sections: ['proof', 'explain'],       // trechos do roteiro em que cabe
  energy: 3,                            // 1 calmo … 5 explosivo
  needs: ['number'],                    // dados que a fala precisa ter
  visual: 'data',                       // família visual (duas iguais seguidas cansam)
  generic: false,                       // só repete texto da fala? (teto de 25%)
  combinesWith: ['morph-line'], avoids: ['number-impact'], maxPerVideo: 2,
  use: 'Quando usar…', avoid: 'Quando não usar…',   // aparecem no Studio
  fill: (ctx) => ({ texts: { title: … }, props: { widgets: … }, strength: 5, reason: '2 porcentagens comparadas' }) ?? null,
}
```

`fill` recebe o `SpeechContext`: o texto e os fatos extraídos da ideia, as ideias vizinhas, o tema do vídeo e a duração da cena. Ele devolve `null` quando a fala não sustenta a cena. Os helpers de `@lms/speech` (`headline`, `secondary`, `chapterTag`, `numberLabel`, `threeWords`, `ctaHeadline`…) mantêm a redação consistente entre as famílias.

### Ajustes feitos nas cenas para a fala

| Cena | Ajuste |
|---|---|
| Kinetic Type | Até 8 s (antes 6) |
| Impact | Até 7 s (antes 5) |
| Energy | Até 8 s (antes 5) |
| Editorial Split, Glass Panels, Orbital Data, Iris | Até 9 s |
| Number Impact, Grid Breakdown | Até 8 s |
| Infographic | Até 10 s |
| Signature, Cinematic Outro | Até 10 s |

O motivo: são cenas *hold*. A entrada tem tempo fixo e a saída fica ancorada no fim, então a duração extra só estende a sustentação, e uma ideia falada costuma durar entre 4 e 9 s. As durações mínimas não mudaram. A família da cena, os textos e os dados continuam sendo os mesmos campos do inspector.

## Studio

- **Nova criação → A partir da fala**:
  1. Solte o áudio ou vídeo; a transcrição local começa sozinha e mostra o progresso.
  2. Corrija as palavras que quiser: os tempos são mantidos.
  3. Ou cole um texto, SRT ou VTT.
  4. Escolha proporção e paleta e clique em **Planejar cenas**.

  Cada linha mostra o tempo, a seção, o trecho dito, o motivo da escolha e um seletor para trocar a cena daquela ideia, que replaneja o vídeo com essa escolha fixa. Depois clique em **Criar composição**.
- A aba **Fala** do projeto lista as ideias com a cena escolhida e o motivo.
  - Clicar em uma ideia leva o playhead até ela.
  - O seletor troca a cena por outra preenchida com as mesmas palavras, mantendo posição e duração. A troca é um único passo de desfazer.
  - O resto do projeto é uma composição livre comum: tudo é editável, a trilha é a sua voz e o projeto pode ser salvo como template.

## Comandos

```bash
pnpm plan:speech fala.txt                         # plano com motivos e nota (texto, SRT, VTT ou JSON)
pnpm plan:speech packages/speech/test/fixtures/*.json --brief
pnpm render:speech fala.mp4                        # áudio/vídeo → transcrição local → plano → MP4 9:16 e 16:9
pnpm render:speech fala.mp3 --transcript fala.srt  # sua transcrição, tempos do áudio
```

Variáveis do servidor: `LMS_PYTHON`, `LMS_WHISPER_MODEL` (padrão `small`), `LMS_SPEECH_LANGUAGE` (`pt`, `en` ou `auto`), `LMS_FFMPEG`, `LMS_FFPROBE` e `LMS_SPEECH_DIR`. Sem faster-whisper (`pip install faster-whisper`), o Studio ainda aceita a transcrição colada.

## Nota do plano

`evaluatePlan` dá uma régua automática de 0 a 100, a mesma de `avaliar_plano.py`. Serve para comparar planos da **mesma** fala, não vídeos diferentes.

| Critério | Peso | O que mede |
|---|---|---|
| Estrutura | 25 | Gancho, CTA quando a fala pede, capítulos da lista |
| Aderência | 25 | Cena específica vale 1, genérica 0,4, ponderado pela duração |
| Fidelidade | 20 | Número inventado desconta |
| Variedade | 15 | Genéricas acima de 25%, repetição |
| Ritmo | 15 | Cenas entre 3 e 9 s, alinhadas à fala |

Média nas 10 transcrições reais do EditorReels usadas como fixtures: 87,7 (começou em 77,5). A fidelidade é 20/20 em todas.

## Limites conhecidos

- **Sincronia dentro da cena.** A cena começa com a fala, mas a coreografia interna (stagger, contadores) não segue cada palavra. Em Semantic Words, por exemplo, as palavras dividem o tempo da cena igualmente.
- **Só a voz vira trilha.** O vídeo do apresentador não é composto na cena. O resultado é o motion sincronizado com a sua voz, pronto para ser usado como insert/B-roll na edição.
- **Telas e produtos procedurais.** Telas de app, dashboards e produtos que aparecem sem upload são ilustrações e podem conter números decorativos da arte procedural. Troque pelo print ou foto real no inspector.
- **Transcrição.** Erros do Whisper (“modelo A” → “modelo é”) não são corrigidos sozinhos. Corrija no campo de transcrição antes de planejar.
- **Idioma.** As regras são feitas para português, com pistas básicas em inglês.
