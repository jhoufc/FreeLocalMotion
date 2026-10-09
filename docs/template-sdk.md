# Template SDK

`@lms/template-sdk` define o contrato entre um template e o resto da plataforma. O editor, o servidor e o renderizador falam **apenas** com esse contrato — nenhum deles contém condicionais por `templateId`.

## Contrato

```ts
interface TemplateDefinition<P extends MotionProject> {
  id: string;                 // estável, kebab-case: também é o id da Composition no Remotion
  name: string;
  version: string;            // semver; gravado em project.templateVersion
  description: string;
  tags: readonly string[];
  formats: readonly Format[]; // 'portrait' | 'landscape'
  schema: z.ZodType<P>;       // schema COMPLETO do projeto (envelope + específicos)

  createDefaults(init: ProjectInit): P;
  migrate?(raw, fromVersion): Record<string, unknown>;
  getMetadata(project: P): CompositionMetadata;      // width, height, fps, durationInFrames
  getEditableTargets(project: P): EditableTarget[];  // o que o inspector pode editar
  getTimeline(project: P): TimelineModel;            // o que a timeline desenha
}

interface TemplateModule<P> extends TemplateDefinition<P> {
  Component: ComponentType<{ project: P }>;          // a composição Remotion
}
```

- `defineTemplate(def)` valida o id e os formatos e preserva a inferência de tipos.
- `defineTemplateModule(def, Component)` junta definição e composição em um `AnyTemplateModule` para o registry. O registry só entrega a um template projetos validados pelo schema dele, o que torna esse alargamento de tipo seguro.
- `sequentialMetadata(project)` cobre o caso comum: dimensões do formato + soma das durações das cenas.

## Envelope do projeto (`@lms/shared`)

Campos que todo projeto tem, para qualquer template:

```ts
{
  schemaVersion: 1, id, name, templateId, templateVersion,
  format: 'portrait' | 'landscape', fps: 30 | 60,
  theme: { background, foreground, accent, secondary, surface },  // hex
  audio: { assetId | null, volume, fadeIn, fadeOut },
  assets: AssetRef[],
  scenes: Scene[],          // cada cena: id, name, duration (s), background, palette, layout
  globals: Record<string, unknown>,
  createdAt, updatedAt
}
```

Blocos reutilizáveis para compor o schema do seu template: `textElementSchema`, `graphicElementSchema`, `backgroundSchema` (+ `createBackground`), `paletteOverrideSchema` (+ `emptyPaletteOverride`), `sceneLayoutSchema`, `sceneBaseShape`, `projectBaseShape`.

**Cores** são `ColorRef`: hex (`#RRGGBB[AA]`) ou token do tema (`$accent`). Tokens fazem cenas herdarem a paleta; `palette` por cena sobrescreve tokens individualmente (`null` = herdar). Use `resolveColor(ref, mergePalette(theme, scene.palette))`.

**Durações** são em segundos — frames = `round(duration × fps)` — então 30 e 60 fps produzem a mesma coreografia.

## Campos editáveis

Um `EditableTarget` é qualquer coisa selecionável:

```ts
{
  id: 'impact.lineA',            // também usado em data-lms-target na composição
  label: 'Headline — linha 1',
  kind: 'project' | 'scene' | 'text' | 'graphic' | 'overlay',
  sceneId: 'impact' | null,
  visibilityPath?: ['scenes', 0, 'texts', 'lineA', 'visible'],
  sections: [{ id: 'content', label: 'Conteúdo', fields: FieldDescriptor[] }],
}
```

Descritores (construa com `field.*`):

| Tipo | Builder | Controle no Studio |
|---|---|---|
| `text` | `field.text(path, label, { maxLength, multiline })` | input/textarea com contador |
| `color` | `field.color(path, label, allowTokens)` | tokens do tema + seletor + hex, alerta de contraste para textos |
| `optional-color` | `field.optionalColor(path, label)` | herdar × personalizar (paleta por cena) |
| `number` | `field.number(path, label, { min, max, step, unit, displayScale })` | slider + campo numérico |
| `select` | `field.select(path, label, options, segmented?)` | dropdown ou segmented |
| `toggle` | `field.toggle(path, label)` | switch |
| `background` | `field.background(path, label, proceduralVariants)` | editor completo de background (4 modos, upload) |
| `asset` | `field.asset(path, label, 'image' \| 'audio')` | upload/drag-and-drop + biblioteca do projeto |
| `line-breaks` | `field.lineBreaks(path)` | modo de quebra por formato |

`path` aponta para dentro do documento (`['scenes', 2, 'texts', 'word1', 'content']`). O Studio lê com `getAtPath`, grava com `setAtPath` e valida o projeto inteiro com o seu schema antes de aceitar. **Os limites do descritor devem estar contidos nos limites do schema** (há um teste que verifica isso para o Signature / 001).

`getEditableTargets(project)` recebe o projeto, então campos podem depender do estado (o Signature / 001 gera as opções de "palavra em destaque" a partir do texto atual e mostra o layout do formato ativo).

## Timeline

```ts
interface TimelineModel {
  fps; durationInFrames;
  scenes: { id, label, index, from, durationInFrames, targetId, duration?: { path, min, max } }[];
  layers: { id, label, kind, sceneId, targetId, clips[], markers[], hidden, delay?: { path, min, max } }[];
}
```

- `duration` em uma cena habilita o arraste da borda direita (segundos, passo 0,1, limitado).
- `delay` em uma camada habilita arrastar o clipe para alterar o atraso de entrada.
- `markers` (`in`, `beat`, `out`, `transition`) são os indicadores de animação desenhados sobre as trilhas.

Recomendação: derive composição **e** timeline de uma mesma tabela de coreografia (veja `packages/templates/signature-001/src/timing.ts`), assim a timeline nunca mente sobre o que o vídeo faz.

## Registry

```ts
const registry = createTemplateRegistry([templateA, templateB]);
registry.get(id); registry.find(id); registry.list(); registry.summaries();
```

`register` falha cedo se o id for duplicado, se `createDefaults` não passar no próprio schema em algum formato, ou se o `templateId` dos defaults não bater.

Registries concretos ficam em `@lms/catalog`:

- `packages/catalog/src/definitions.ts` — só dados (usado pelo servidor);
- `packages/catalog/src/modules.ts` — com composições (Studio, `TemplateStage`, Remotion Root).

## Assets

Dentro da composição, use `useAssets()`:

```tsx
const assets = useAssets();
const url = assets.url(scene.background.image.assetId); // string | null
<Img src={url} />   // Img do Remotion: o render aguarda o carregamento
```

Nunca monte caminhos manualmente: o resolver aponta para o servidor certo no preview e no render.

## Validação

`parseProjectForTemplate(template, raw)` executa migração do envelope → `template.migrate` (se `templateVersion` difere) → schema → referências de assets, e devolve `{ ok, project, migrated }` ou `{ ok: false, issues: [{ path, message }] }`. O servidor usa isso em toda leitura e escrita.
