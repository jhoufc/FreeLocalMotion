# Arquitetura

## Visão geral

```
┌──────────────── Studio (Vite, :5173) ────────────────┐        ┌────────── Servidor local (:4317) ──────────┐
│ stores/editor (Zustand)  ── project ──┐               │  /api  │ ProjectStore  → projects/<id>/project.json │
│ useProjectModel(project)              │               │◀──────▶│               → projects/<id>/assets/*     │
│   targets, timeline ← template SDK    ▼               │        │ RenderQueue   → exports/*.mp4, jobs.json   │
│ <Player component={TemplateStage} inputProps={{project}}>      │ RemotionEngine: bundle → selectComposition │
└───────────────────────────────────────┬──────────────┘        │                 → renderMedia (H.264/AAC)  │
                                        │                        └──────────────────────┬─────────────────────┘
                                        ▼                                               ▼
                         @lms/catalog: TemplateStage  ◀── mesmo componente, mesmos dados ──  Remotion Root (Composition)
                                        │
             templates: Signature / 001 · Composição livre ──▶ biblioteca global de cenas (sceneModules)
                                        │                         Signature / 001 (4) + Studio Premium (8)
                         @lms/scene-kit ── @lms/motion-core ── @lms/template-sdk ── @lms/shared
```

O ponto central é **`TemplateStage`** (`packages/catalog/src/Stage.tsx`): é o único componente montado tanto pelo `@remotion/player` no Studio quanto pela `<Composition>` que o servidor renderiza. Ele recebe `{ project, assetBaseUrl }`, resolve o template pelo `templateId` no registry e fornece um `AssetResolver`. Não há uma "versão de preview" da animação — é o mesmo código, os mesmos dados e as mesmas fontes.

## Pacotes

| Pacote | Responsabilidade | Depende de |
|---|---|---|
| `@lms/shared` | Envelope do projeto (Zod), elementos reutilizáveis (texto, gráfico, background, layout por formato), cores/tokens, formatos e áreas seguras, contratos da API, migrações, acesso por path | zod |
| `@lms/motion-core` | Motor de animação: spring analítico, easing, `tween/keyframes/envelope`, PRNG/ruído com seed, `stagger`, `useTime`, carregamento de fontes com `delayRender`, medição e auto-fit de texto, `MaskReveal`, `DirectionalBlur`, `KineticText`, `Grain`, projeção 2.5D, layout responsivo | remotion, shared |
| `@lms/template-sdk` | Contrato `TemplateDefinition`/`TemplateModule`, descritores de campos editáveis, modelo de timeline, `createTemplateRegistry`, validação completa (`parseProjectForTemplate`), `AssetProvider` | shared |
| `@lms/scene-kit` | Toolkit compartilhado das cenas: fontes OFL, layout de texto, backgrounds, trilha/acabamento, builders de campos e camadas (`/fields`, só dados) | motion-core, sdk, shared |
| `@lms/template-signature-001` | Storyboard Signature / 001 e suas 4 cenas como tipos globais (schema, defaults, coreografia, views) | scene-kit, motion-core, sdk |
| `@lms/scenes-premium` | Família Studio Premium: 8 tipos de cena (`/definitions` só dados + views) | scene-kit, motion-core, sdk |
| `@lms/scenes-motion` | Família Studio Motion: 12 tipos de cena (apps, produtos, dados, branding, tipografia cinética) | scene-kit, motion-core, sdk |
| `@lms/speech` | Planejador pela fala: transcrições, ideias, análise, seleção de cenas pelas fichas, avaliação ([speech-planner.md](speech-planner.md)) | — |
| `@lms/catalog` | Registries concretos: templates (`definitions`/`modules`), **biblioteca global de cenas** (`sceneDefinitions`/`sceneModules`), template **Composição livre**, `TemplateStage`, entry `registerRoot` | templates, cenas |
| `apps/server` | Express 5, `ProjectStore`, `TemplateLibrary` (templates do usuário), `RenderQueue`, `RemotionEngine` | catalog/definitions |
| `apps/studio` | Editor | catalog, player |

### Separação dados × composição

Cada template expõe dois entry points:

- `@lms/template-…/definition` — schema, defaults, `getMetadata`, `getEditableTargets`, `getTimeline`. Sem React, sem `import` de fontes. O servidor usa apenas isso.
- `@lms/template-…` — a definição + `Component`.

## Fluxo de edição

1. O inspector renderiza `EditableTarget.sections[].fields[]` (descritores do template) com controles genéricos.
2. Cada mudança chama `update(path, value)` no store: `setAtPath` (imutável, com compartilhamento estrutural) → `template.schema.safeParse` → só então o projeto é substituído. Valores inválidos ficam como erro no campo.
3. O novo `project` vira um novo `inputProps` do Player: o frame atual é re-renderizado **sem remontar o Player nem reiniciar a reprodução**.
4. Histórico (desfazer/refazer) com coalescência de alterações contínuas (sliders, digitação). Autosave após 1,2 s de inatividade via `PUT /api/projects/:id` (validado novamente no servidor; escrita atômica).

A frequência de frames (30/60 Hz) fica em um store separado (`stores/playback.ts`), assinado só pelo transporte, pela timeline e pelo playhead — o inspector e a sidebar não re-renderizam durante a reprodução.

## Composição dinâmica de cenas

Um template oferece **tipos de cena** (`sceneTypes`: Impact, Energy, Transformation e Signature no Signature / 001); o projeto guarda uma lista ordenada de **instâncias** (`project.scenes`), cada uma com `id` único, `type`, `name`, `enabled`, `duration` e seus próprios dados. A animação é compartilhada pelo tipo; o estado editável nunca é.

- **Tempo**: `computeSceneRanges` deriva os offsets da ordem da lista (soma das durações habilitadas anteriores). Composição, timeline, HUD, metadados do render e editor usam a mesma função — não há timestamps fixos.
- **Remotion**: a composição percorre os ranges, monta cada instância num `<Sequence key={scene.id}>` e escolhe a view por `scene.type`. Dentro da `Sequence` o frame é local, então uma cena duplicada ou movida sempre começa do início da sua animação. A primeira cena do vídeo não aplica transição de entrada (não há nada por baixo).
- **Duração**: cada tipo declara limites e uma estratégia (`hold`: entradas fixas, saída ancorada ao fim, a sobra vira sustentação; `proportional`: relógio normalizado dentro de limites estreitos; `fixed`). O inspector mostra a regra junto do controle.
- **Editor**: operações estruturais (adicionar, duplicar, excluir, mover, renomear, ativar/desativar, duração) são funções puras do SDK aplicadas pelo store, validadas pelo schema e registradas no mesmo histórico de desfazer/refazer (`Ctrl+Z`, `Ctrl+Shift+Z`; `Ctrl+D` duplica; `Delete` exclui a cena selecionada — atalhos ignorados enquanto se digita). Excluir uma cena com conteúdo personalizado pede confirmação; cenas intactas saem direto (desfazer as recupera).
- **Targets**: ids `<instância>.<elemento>`, então seleção no canvas, inspector e timeline apontam para a ocorrência certa mesmo com a mesma animação repetida.

## Modo Template × Modo Livre

- **Modo Template**: projeto criado de um template nativo (Signature / 001) ou de um template do usuário — começa com um storyboard pronto.
- **Modo Livre**: "Nova criação → Composição livre" cria um projeto do template nativo `composition` (`mode: 'free'`, `allowEmpty`): timeline vazia, 30 fps, 9:16 por padrão. O schema dele é a união discriminada (`type`) de **todos** os tipos da biblioteca global, então cenas de famílias diferentes convivem e cada instância continua validada pelo schema do seu tipo.

Os dois modos usam o mesmo editor, a mesma timeline, o mesmo inspector genérico, a mesma persistência e o mesmo pipeline de render — a composição livre é apenas mais um template registrado. Cenas trocam por corte seco (sem sobreposição de frames: duração = soma das cenas habilitadas). O render recusa um vídeo sem cenas ativas.

### Estilo global (composição livre)

`theme` é a paleta da composição; `globals.style` guarda a tipografia base (família de títulos usada pelas cenas Premium) e o background padrão; `globals.grain`/`vignette` o acabamento. Cenas herdam a paleta por tokens e o background quando estão em `inherit`; overrides por cena (paleta, background) preservam identidades. Na biblioteca, “Original da cena” adiciona uma cena já com a paleta com que ela foi desenhada. Sem configuração, cada cena mantém seu comportamento original.

## Fala → composição

`POST /api/speech/uploads` (áudio/vídeo → ffmpeg), `POST /api/speech/uploads/:id/transcribe` (faster-whisper local, job com progresso), `POST /api/speech/plan` (prévia) e `POST /api/projects { speech }` criam uma composição livre planejada pela fala, com a voz como trilha e o plano em `projects/<id>/speech.json` (`GET /api/projects/:id/speech`). Detalhes em [speech-planner.md](speech-planner.md).

## Composições prontas

`packages/catalog/src/starters.ts` define cinco composições nativas (App Launch Cinematic, Motion Design Showreel, Digital Product Promo, Product Commercial, Creator Intro). Cada uma é apenas uma lista de **instâncias** de cenas da biblioteca com textos, dados e tema próprios — nada pré-renderizado. `POST /api/projects { templateId: 'composition', starterId }` cria uma composição livre comum (`origin: { kind: 'template', templateId: 'starter:<id>' }`), que pode ser editada, recomposta com cenas de outras composições e salva como template do usuário. As composições ficam protegidas (código) e aparecem na aba Templates com preview ao vivo.

## Templates do usuário

`TemplateLibrary` (`apps/server/src/templates/library.ts`) guarda em `templates/<id>/`:

```
template.json            nome, descrição, categoria, revisão atual e histórico
revisions/r<n>.json      snapshot imutável da composição de cada revisão
assets/<arquivo>         cópias de todo asset referenciado por qualquer revisão
thumb-r<n>.jpg           frame representativo (renderStill do mesmo bundle)
```

- **Salvar como template**: valida (≥ 1 cena ativa, todos os tipos na biblioteca), converte para composição livre se veio de um template nativo (`toComposition`), copia só os assets usados e renderiza a miniatura.
- **Criar projeto**: cópia independente da revisão atual (novo id, assets copiados para o projeto, `origin: user-template`). Excluir o template não afeta projetos; excluir o projeto de origem não afeta o template.
- **Editar**: cria um rascunho (`origin: template-draft`); "Publicar revisão" grava `r<n+1>` explicitamente. Revisões antigas e projetos criados a partir delas não mudam.
- Templates nativos ficam em código e não podem ser excluídos pela interface.

## Seleção no canvas

A composição marca nós com `data-lms-target="<targetId>"`. O Player renderiza no mesmo DOM do editor, então um clique sobe pela árvore até o alvo mais interno conhecido. O destaque é um `<style>` injetado (`outline` compensado pela escala do Player) — a composição não recebe nenhum estado do editor, e o atributo não tem efeito visual no MP4.

## Layouts responsivos

- O formato atual vive no projeto (`project.format`), mas o conteúdo semântico (textos, cores, elementos) é único.
- `computeFrameLayout(width, height)` fornece formato, unidade de design `u` (1 px num lado curto de 1080), centro e **áreas seguras** (`SAFE_AREAS`: margens de Reels/Shorts no vertical e title-safe no horizontal).
- Cada cena tem art direction por formato no código (posições, tamanhos, direções de varredura, composição simétrica × assimétrica) e overrides limitados no schema (`scene.layout.portrait|landscape`: alinhamento, escala, deslocamento).
- Quebra de linha por formato em cada texto (`breaks.portrait|landscape`: manual, 1 linha, palavras, auto).
- `layoutText` mede o texto com as fontes reais (canvas) e **reduz o tamanho até caber** na largura/altura do bloco, então edições longas nunca são cortadas.

## Determinismo

Toda animação é função pura do frame: tempo em segundos (`frame / fps`), spring de forma fechada (idêntico a 30 e 60 fps e em qualquer seek), ruído e partículas com seed (`randomAt`, `createRng`), grain com offset derivado do tempo a 24 "fps de grão". Nada usa `setTimeout`, `requestAnimationFrame` livre, animações CSS por relógio ou `Math.random` dentro da composição. O motion blur é direcional e calculado a partir da velocidade analítica do movimento (filtro SVG por frame).

## Persistência

- `projects/<id>/project.json`: documento completo com `schemaVersion` (envelope) e `templateVersion` (template). Escritas são atômicas (arquivo temporário + rename).
- Leitura passa por `migrateEnvelope` → `template.migrate` (se a versão do template mudou) → schema → verificação de referências de assets. Projetos migrados são regravados, e o documento original fica ao lado como `project.backup-v<schema>-<versão do template>.json` (gravado uma única vez).
- Schema v2: a migração v1 → v2 converte as cenas fixas em instâncias (`type` = id antigo, `enabled: true`) mantendo o id — target ids antigos e todos os valores continuam válidos.
- Uploads: o tipo é identificado pelos *magic bytes* (PNG, JPEG, WebP, GIF, MP3, WAV, M4A, OGG), copiados para `assets/<assetId>.<ext>` e registrados em `project.assets`. Referências usam `assetId`, nunca caminhos.
- `localStorage` guarda apenas o último projeto aberto (conveniência).
