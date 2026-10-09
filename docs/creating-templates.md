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
import { graphicElementSchema, projectBaseShape, sceneBaseShape, textElementSchema } from '@lms/shared';

const countScene = z.object({
  ...sceneBaseShape,
  id: z.literal('count'),
  duration: z.number().min(2).max(6),
  texts: z.object({ value: textElementSchema, label: textElementSchema }),
  elements: z.object({ bars: graphicElementSchema }),
  props: z.object({ target: z.number().int().min(0).max(1_000_000_000) }),
});

export const numbersSchema = z.object({
  ...projectBaseShape,
  templateId: z.literal('kinetic-numbers'),
  scenes: z.tuple([countScene]),
  globals: z.object({}),
});
export type NumbersProject = z.infer<typeof numbersSchema>;
```

## 3. Defaults

`createDefaults({ id, name, format, fps, now })` precisa produzir um documento que passe no schema nos dois formatos — o registry verifica isso na inicialização. Use `createBackground({ variant })` e `emptyPaletteOverride()`.

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
- marque elementos selecionáveis com `data-lms-target="<targetId>"`;
- cada cena dentro de um `<Sequence from durationInFrames>` calculado com `computeSceneRanges`.

## 6. Definição

```ts
export const numbersDefinition = defineTemplate<NumbersProject>({
  id: 'kinetic-numbers', name: 'Kinetic Numbers', version: '1.0.0',
  description: '…', tags: ['data', 'numbers'], formats: ['portrait', 'landscape'],
  schema: numbersSchema,
  createDefaults,
  getMetadata: (p) => sequentialMetadata(p),
  getEditableTargets: (p) => [ /* targets com field.* */ ],
  getTimeline: (p) => ({ /* a partir de CHOREO */ }),
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
- `pnpm render:stills 1 2.5 4` e `pnpm render:samples` (renderizam todos os templates registrados), depois `pnpm verify:videos <arquivos>`.
- Revise os dois formatos frame a frame: overflow, contraste, centralização, continuidade entre cenas.

## Evoluindo um template existente

Mudou o formato dos dados? Aumente `version` e implemente `migrate(raw, fromVersion)` — projetos antigos são convertidos e regravados ao abrir. Mudanças no envelope comum seguem o mesmo padrão em `packages/shared/src/migrations.ts` (`CURRENT_SCHEMA_VERSION`).
