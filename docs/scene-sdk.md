# Scene SDK — biblioteca global de cenas

Uma **cena** (scene type) é uma animação reutilizável: schema, valores padrão, campos editáveis, camadas de timeline e uma view React. Ela não pertence a um projeto nem a um template: a **biblioteca global** (`@lms/catalog`) resolve tipos pelo id estável guardado em `scene.type`, e qualquer composição — o storyboard do Signature / 001 ou uma composição livre — monta a mesma view para cada instância.

```
SceneTypeDefinition (dados, Node-safe)        SceneTypeModule (definição + view)
  id, name, description, category,             ...definição
  family { id, name }, version,                Component: ({ env: SceneRuntime }) => JSX
  heroTime, heroTimeOf?(scene), duration { default,min,max,
    strategy, note }, palette?
  schema (zod), create(init)
  targets(scene, ctx)  → EditableTarget[]
  layers(scene, ctx)   → TimelineLayer[]
```

| Família | Pacote | Cenas |
|---|---|---|
| Signature / 001 | `@lms/template-signature-001` | Impact, Energy, Transformation, Signature |
| Studio Premium | `@lms/scenes-premium` | Kinetic Type Explosion, Glass Panels, Number Impact, Orbital Data, Product Reveal, Grid Breakdown, Editorial Split, Cinematic Outro |
| Studio Motion | `@lms/scenes-motion` | Bouncing Ball Typography, Semantic Kinetic Words, Morphing Line Art, Iris & Liquid Reveal, Floating Smartphone, UI Feature Highlight, App Screen Transition, Product Hero 2.5D, Product Detail Callout, Product Color Impact, Animated Infographic, Personal Brand Reveal |

### Studio Motion — o que cada cena deixa trocar

| Cena | Objeto principal editável | Técnicas |
|---|---|---|
| Bouncing Ball Typography | texto final, cor/tamanho da bola, quiques, elasticidade, velocidade, posição final (pingo do i, ponto, acima) | física com arcos, antecipação, squash & stretch pela velocidade, follow-through, echo trail |
| Semantic Kinetic Words | lista de palavras (1–6) com um comportamento cada (explodir, rápido, crescer, foco, conectar, subir, girar, tremer) | presets de movimento independentes do significado, motion blur, echo, stagger |
| Morphing Line Art | sequência de formas (5 presets), espessura, comprimento, velocidade, direção | morphing entre formas compatíveis (mesmo nº de pontos), desenho de traço, eco, faísca no percurso |
| Iris & Liquid Reveal | imagem revelada, textos, máscara (íris, diagonal, explosão radial, líquida, abertura), origem, tempo | clip-path animado, borda luminosa, zoom, iris-out |
| Floating Smartphone | screenshot (ou tela procedural), modelo, perspectiva, rotação, posição, escala | CSS 3D, câmera simulada, reflexo, glow, sombra |
| UI Feature Highlight | screenshot da interface (ou dashboard), região de foco, tipo de revelação, callouts | zoom de câmera 2D, spotlight, anel de foco desenhado, callouts com linhas |
| App Screen Transition | 2–5 telas (screenshot + legenda), estilo (slide, máscara, zoom, parallax, blur), direção, cor | transições coreografadas, echo trail, swing do aparelho |
| Product Hero 2.5D | imagem PNG + até 3 ângulos reais, nome, descrição, escala, posição, sombra | rotação aparente 2.5D (sem inventar lados), luz, sombra de contato, varredura especular |
| Product Detail Callout | imagem, até 5 benefícios com posição do marcador, estilo de linha, intervalo | marcadores pulsantes, linhas desenhadas, distribuição responsiva por lado |
| Product Color Impact | imagem, duas cores, três palavras de impacto, headline | cortes rápidos, texto bicolor, eco, formas, revelação |
| Animated Infographic | até 4 indicadores (contador, barra, linha, anel) com valores, máximos, unidades, série | count-up, barras, linha a partir da série digitada (sem dados inventados), anel |
| Personal Brand Reveal | foto (ou monograma), formato, nome, cargo, @, destaques numéricos, CTA | linha que desenha moldura e sublinhado, máscara na foto, stagger, count-up, CTA com pulso |

Imagens são opcionais em todas: sem upload, cada cena usa uma versão procedural com a paleta da cena (telas de app, dashboard, produto, monograma).

## Motion primitives (`@lms/motion-core`)

| Área | Utilitários |
|---|---|
| Easing / springs | `ease.*`, `springAt`, `springWithIntensity`, `SPRINGS`, `velocityOf` |
| Timing | `progress`, `tween`, `keyframes`, `envelope`, `stagger` |
| Física | `bounceAt` (arcos, antecipação, squash & stretch, follow-through), `bounceImpacts` |
| Geometria / morph | `shapePoints` (12 formas), `resample`, `lerpPoints`, `pointsToPath`, `pointAlong` (motion path), `bezierPoints`, `blobPoints` (formas líquidas), `polygonClip`, `arcPath`, `project` (2.5D) |
| Máscaras | `MaskReveal`, `wipeClip`, `irisClip`, `polygonClip` |
| Trails / blur | `EchoTrail`, `DirectionalBlur`, `motionBlurFromVelocity` |
| Câmera | `cameraTransform` (Camera2D), `ParallaxLayer` |
| Dados | `countValue`, `formatNumber`, `ProgressRing`, `DrawPath` |
| Tipografia | `layoutText`, `KineticText`, `measureUnitWidth`, `lineUnitWidth` |

Todos são funções puras do tempo da cena — nenhum relógio próprio.

Categorias: `typography`, `technology`, `product`, `data`, `abstract`, `editorial`, `signature` (`SCENE_CATEGORIES` em `@lms/shared`).

## Runtime de uma cena

A composição cria um `SceneRuntime` por instância e frame (`createSceneRuntime`):

| Campo | Significado |
|---|---|
| `scene` | dados da instância (já validados pelo schema do tipo) |
| `t`, `duration`, `fps` | tempo **local** da instância em segundos — a cena funciona em qualquer posição da timeline |
| `layout`, `override` | `FrameLayout` (formato, `u`, áreas seguras) e os ajustes do usuário para o formato ativo |
| `palette`, `color(ref)`, `alpha(ref,a)` | tema da composição + overrides da cena; tokens `$accent` etc. |
| `background` | background a pintar, com `inherit` já resolvido para o background padrão da composição |
| `style.typography` | famílias `display`/`text`/`mono` (a tipografia base da composição livre) |
| `hasPrevious` | `false` na primeira cena do vídeo |
| `target(key)` | id para `data-lms-target` (`<instância>.<elemento>`) — seleção no canvas |

Regras de ouro: tudo é função de `env.t` (nada de `Date.now`, `Math.random`, animação CSS); aleatoriedade só com `randomAt/createRng` com seed; tamanhos em `u`; texto com `useTextLayout` (auto-fit, quebras por formato); entradas com tempo absoluto e saída ancorada ao fim (`env.duration - exit`).

## Adicionando uma cena à biblioteca

1. **Dados** — `packages/scenes-premium/src/scenes/minhaCena.ts` (ou o pacote da sua família):

```ts
export const minhaCenaSchema = z.object({
  ...sceneBaseShape,
  type: z.literal('minha-cena'),          // id global, kebab-case, estável
  duration: z.number().min(3).max(6),
  texts: z.object({ headline: textElementSchema }),
  elements: z.object({ shapes: graphicElementSchema }),
  animation: animationSchema,
  props: z.object({ items: z.array(z.object({ label: z.string().max(20) })).min(1).max(4) }),
});

export const CHOREO = { shapes: { in: 0, dur: 0.8 }, headline: { in: 0.4, dur: 0.9 }, exit: 0.6 } as const;

export const minhaCenaType = premiumSceneType<MinhaCena>({
  id: 'minha-cena', name: 'Minha Cena', description: '…', category: 'abstract',
  heroTime: 2, duration: { default: 4, min: 3, max: 6 },
  schema: minhaCenaSchema,
  palette: { background: '#0A0A0F', foreground: '#FFFFFF', accent: '#FF4D2E', secondary: '#3B3BFF', surface: '#17171F' },
  create: (init) => ({ id: init.id, type: 'minha-cena', name: init.name, duration: 4, ...baseInstance('void', ['center', 'start']), /* textos, elementos, props */ }),
  texts: { headline: { label: 'Headline', maxLength: 40, multiline: true, ...CHOREO.headline } },
  graphics: { shapes: { label: 'Formas', intensityLabel: 'Quantidade', description: '…', ...CHOREO.shapes } },
  exit: CHOREO.exit,
  contentFields: (base) => [field.list([...base, 'props', 'items'], 'Itens', { min: 1, max: 4, itemLabel: 'Item', newItem: { label: 'Novo' }, itemFields: [field.text(['label'], 'Rótulo', { maxLength: 20 })] })],
});
```

`heroTime` é o segundo local usado em miniaturas, no frame de referência do `verify:videos` e no thumb dos templates do usuário. Se o momento legível depender dos dados (ex.: Semantic Kinetic Words divide o tempo entre as palavras), defina também `heroTimeOf: (scene) => segundos`.

`premiumSceneType` gera os targets do inspector (cena, textos, elementos — com as seções padrão do kit) e as camadas da timeline a partir da tabela de coreografia. Fora do pacote premium, use `defineSceneType` diretamente com os builders de `@lms/scene-kit/fields` (`sceneSections`, `instanceTargets`, `choreoLayers`).

2. **View** — `packages/scenes-premium/src/visual/MinhaCena.tsx`: `({ env }: { env: SceneRuntime<MinhaCena> }) => …`, com `SceneBackground`, `useRoleText`/`MaskedLines` e arte direcionada por formato (`env.layout.isPortrait`).

3. **Registro** — append em `PREMIUM_SCENE_TYPES` (`src/definitions.ts`) e a view em `VIEWS` (`src/index.ts`). O catálogo (`packages/catalog/src/scenes.ts` / `sceneModules.ts`) já inclui o pacote; uma família nova entra com uma linha em cada um.

4. **Verificação** — `createSceneRegistry` falha na inicialização se o id se repetir ou se `create()` não passar no schema. Rode:

```bash
pnpm test                                  # inclui premium.test.ts: campos, limites, timeline, independência
pnpm render:scene-stills minha-cena        # início, entrada, meio, hero, saída e fim — 9:16 e 16:9
```

A cena aparece automaticamente na Biblioteca de cenas da composição livre (busca, categoria, família, miniatura real), no inspector genérico e na timeline.

## Ficha de planejamento (fala)

Toda cena da biblioteca declara `planning`: papel, seções do roteiro, energia, dados que precisa, família visual, combinações e `fill(ctx)`, que monta o conteúdo da cena a partir da fala (ou devolve `null`). O planejador escolhe a cena de cada ideia com essas fichas. Veja [speech-planner.md](speech-planner.md).

## Campos disponíveis

`text` (input/textarea), `number` (slider + campo), `color` (tokens ou hex), `optional-color` (herdar × personalizar), `toggle`, `select` (dropdown/segmented), `asset` (imagem/áudio com upload), `background` (procedural, sólida, gradiente, imagem e — em composições livres — `inherit`), `line-breaks` por formato e `list` (grupo repetível com `min`/`max`, mover, remover e adicionar). Os limites de todo descritor precisam estar contidos no schema — há teste para isso.

## Segurança

Cenas são código distribuído com o Studio. Projetos e templates guardam apenas dados validados (Zod); não existe mecanismo para executar código vindo de um projeto.
