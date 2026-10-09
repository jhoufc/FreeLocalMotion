# Criando um novo template

Exemplo: adicionar **"Kinetic Numbers"**. Nenhum arquivo de `apps/studio` ou `apps/server` precisa mudar.

## 1. Pacote

```
packages/templates/kinetic-numbers/
  package.json          name: @lms/template-kinetic-numbers
                        exports: { ".": "./src/index.ts", "./definition": "./src/definition.ts" }
  tsconfig.json         (copie do signature-001)
  src/schema.ts
  src/defaults.ts
  src/timing.ts
  src/definition.ts     ← somente dados (nada de React, fontes ou imagens)
  src/visual/…          ← composição
  src/index.ts          ← defineTemplateModule(definition, Composition)
  test/…
```

Dependências: `@lms/shared`, `@lms/template-sdk`, `@lms/motion-core`, `remotion` (mesma versão exata do resto do monorepo), `zod`. Rode `pnpm install`.

## 2. Schema

Componha a partir dos blocos do envelope e defina **limites** para tudo que for editável:

```ts
import { z } from 'zod';
import { graphicElementSchema, projectBaseShape, sceneBaseShape, scenesArray, textElementSchema } from '@lms/shared';

// Um *tipo* de cena. O projeto guarda instâncias: `type` aponta para o tipo, `id` é único.
const countScene = z.object({
  ...sceneBaseShape,
  type: z.literal('count'),
  duration: z.number().min(2).max(6),
  texts: z.object({ value: textElementSchema, label: textElementSchema }),
  elements: z.object({ bars: graphicElementSchema }),
  props: z.object({ target: z.number().int().min(0).max(1_000_000_000) }),
});

export const numbersSchema = z.object({
  ...projectBaseShape,
  templateId: z.literal('kinetic-numbers'),
  // Qualquer ordem, qualquer repetição. Com vários tipos: z.discriminatedUnion('type', [...]).
  scenes: scenesArray(countScene),
  globals: z.object({}),
});
export type NumbersProject = z.infer<typeof numbersSchema>;
```

## 3. Defaults

- `createScene(type, { id, name })` devolve uma instância nova com os valores padrão do tipo (objetos novos a cada chamada — instâncias nunca compartilham estado).
- `createDefaults({ id, name, format, fps, now })` monta a sequência inicial do template, normalmente com `createScene`.
- Use `createBackground({ variant })` e `emptyPaletteOverride()`.

O registry verifica na inicialização que os defaults passam no schema nos dois formatos e que **cada tipo declarado** gera uma instância válida.

## 3b. Catálogo de cenas (`sceneTypes`)

Cada tipo de cena declara seus metadados para o editor ("+ Adicionar cena", limites de duração, miniaturas):

```ts
sceneTypes: [{
  id: 'count', name: 'Count', description: 'Contador com barras.',
  heroTime: 1.6,                       // segundo local usado nas miniaturas
  duration: { default: 3, min: 2, max: 6, strategy: 'hold', note: 'A sustentação absorve a duração extra.' },
}]
```

Estratégias de duração (`strategy`) — escolha a que a coreografia realmente suporta:

| Estratégia | Comportamento | Quando usar |
|---|---|---|
| `hold` | entradas com tempo absoluto, saída ancorada ao fim; a duração extra vira sustentação | padrão para cenas de entrada → leitura → saída |
| `proportional` | toda a coreografia corre num relógio normalizado escalado à duração | movimentos contínuos únicos, com limites estreitos |
| `fixed` | `min === max`; o editor esconde o controle de duração e informa | quando nenhuma das duas preserva a animação |

## 4. Coreografia

Escreva uma tabela de tempos (segundos, relativos à cena) e use-a na composição **e** na timeline:

```ts
export const CHOREO = { value: { in: 0.3, dur: 1.4 }, label: { in: 0.9, dur: 0.5 }, exit: 0.4 };
```

## 5. Composição

Regras de ouro (o render precisa ser idêntico em qualquer frame):

- tempo = `useTime().t` (segundos); nada de `Date.now`, `setTimeout`, animação CSS ou `Math.random`;
- `springAt`/`springWithIntensity` (forma fechada), `progress`, `keyframes`, `ease.*`;
- aleatoriedade só com `randomAt(seed, i)` / `createRng(seed)`;
- layout com `useFrameLayout()` (`u`, `safe`, `isPortrait`) e `byFormat(...)` para dirigir cada formato;
- textos com `layoutText` (respeita `breaks` por formato, `sizeScale`, auto-fit) + `KineticText`, `MaskReveal`, `DirectionalBlur`;
- fontes locais via `createFontSet([...])` e `fonts.useReady()` no componente raiz (carregamento com `delayRender`);
- imagens via `useAssets().url(id)` + `<Img>`;
- marque elementos selecionáveis com `data-lms-target="<id da instância>.<elemento>"` (nunca com o id do tipo: a mesma cena pode aparecer várias vezes);
- renderize as instâncias **habilitadas** em ordem, cada uma num `<Sequence from durationInFrames>` calculado com `computeSceneRanges` (que já ignora cenas desabilitadas), escolhendo a view por `scene.type`;
- anime com o tempo **local** da `Sequence` (`useCurrentFrame()` dentro dela): a cena precisa funcionar em qualquer posição, inclusive como a primeira do vídeo (sem nada por baixo para transicionar).

## 6. Definição

```ts
export const numbersDefinition = defineTemplate<NumbersProject>({
  id: 'kinetic-numbers', name: 'Kinetic Numbers', version: '1.0.0',
  description: '…', tags: ['data', 'numbers'], formats: ['portrait', 'landscape'],
  schema: numbersSchema,
  sceneTypes: [/* ver 3b */],
  createDefaults,
  createScene,
  getMetadata: (p) => sequentialMetadata(p),
  getEditableTargets: (p) => [ /* um conjunto por instância: ids `<scene.id>.…`, paths ['scenes', index, …] */ ],
  getTimeline: (p) => ({ /* a partir de computeSceneRanges + CHOREO */ }),
});
```

E em `src/index.ts`:

```ts
export const numbersTemplate = defineTemplateModule(numbersDefinition, NumbersComposition);
```

## 7. Registro

Duas linhas em `@lms/catalog` (adicione o pacote às dependências de `packages/catalog/package.json`):

```ts
// packages/catalog/src/definitions.ts
createTemplateRegistry([signatureDefinition, numbersDefinition])

// packages/catalog/src/modules.ts
createTemplateRegistry([signatureTemplate, numbersTemplate])
```

Pronto: o template aparece na biblioteca do Studio (com preview animado), pode criar projetos, é editado pelo inspector genérico, desenhado na timeline, validado e salvo pelo servidor e renderizado — o Remotion Root registra uma `<Composition id="kinetic-numbers">` automaticamente.

## 8. Verificação

- Testes como `packages/templates/signature-001/test/signature.test.ts`: defaults válidos nos dois formatos, todo `field.path` existe, limites de campos ⊂ schema, camadas da timeline dentro das cenas.
- Testes de composição como `packages/templates/signature-001/test/composition.test.ts`: duplicar/mover/remover instâncias com as funções puras do SDK e validar schema, targets e timeline.
- `pnpm render:stills 1 2.5 4` e `pnpm render:samples` (renderizam todos os templates registrados), depois `pnpm verify:videos <arquivos>`.
- `pnpm render:composition` renderiza um projeto recomposto (cenas repetidas, movidas, desabilitadas) e grava o snapshot ao lado do MP4 para o `verify:videos`.
- Revise os dois formatos frame a frame: overflow, contraste, centralização, continuidade entre cenas.

## Evoluindo um template existente

Mudou o formato dos dados? Aumente `version` e implemente `migrate(raw, fromVersion)` — projetos antigos são convertidos e regravados ao abrir, e o servidor guarda o original ao lado como `project.backup-v<schema>-<versão>.json`. Mudanças no envelope comum seguem o mesmo padrão em `packages/shared/src/migrations.ts` (`CURRENT_SCHEMA_VERSION`). Exemplo real: schema v1 → v2 transformou as cenas fixas em instâncias (`type` = id antigo, `enabled: true`).
