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
                         template module (Signature / 001) ── @lms/motion-core ── @lms/template-sdk ── @lms/shared
```

O ponto central é **`TemplateStage`** (`packages/catalog/src/Stage.tsx`): é o único componente montado tanto pelo `@remotion/player` no Studio quanto pela `<Composition>` que o servidor renderiza. Ele recebe `{ project, assetBaseUrl }`, resolve o template pelo `templateId` no registry e fornece um `AssetResolver`. Não há uma "versão de preview" da animação — é o mesmo código, os mesmos dados e as mesmas fontes.

## Pacotes

| Pacote | Responsabilidade | Depende de |
|---|---|---|
| `@lms/shared` | Envelope do projeto (Zod), elementos reutilizáveis (texto, gráfico, background, layout por formato), cores/tokens, formatos e áreas seguras, contratos da API, migrações, acesso por path | zod |
| `@lms/motion-core` | Motor de animação: spring analítico, easing, `tween/keyframes/envelope`, PRNG/ruído com seed, `stagger`, `useTime`, carregamento de fontes com `delayRender`, medição e auto-fit de texto, `MaskReveal`, `DirectionalBlur`, `KineticText`, `Grain`, projeção 2.5D, layout responsivo | remotion, shared |
| `@lms/template-sdk` | Contrato `TemplateDefinition`/`TemplateModule`, descritores de campos editáveis, modelo de timeline, `createTemplateRegistry`, validação completa (`parseProjectForTemplate`), `AssetProvider` | shared |
| `@lms/template-signature-001` | Schema, defaults, tabela de coreografia, definição (campos + timeline) e composição das 4 cenas | motion-core, sdk, shared |
| `@lms/catalog` | Registry concreto: `definitions` (só dados, seguro em Node) e `modules` (com React), `TemplateStage`, entry `registerRoot` | templates |
| `apps/server` | Express 5, `ProjectStore`, `RenderQueue`, `RemotionEngine` | catalog/definitions |
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
