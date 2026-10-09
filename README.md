# Local Motion Studio

Editor visual local para vídeos de motion graphics com qualidade de estúdio, construído sobre templates programáticos totalmente editáveis. Tudo roda na sua máquina: sem serviços pagos, sem APIs externas, sem IA.

- **Studio** (React + Vite): biblioteca de templates, preview real com `@remotion/player`, inspector contextual, timeline com scrubbing, alternância 9:16 / 16:9.
- **Servidor local** (Node + Express): projetos versionados em disco, assets controlados, fila de renderização com progresso real e cancelamento.
- **Renderização** com as APIs oficiais do Remotion → MP4 H.264 (yuv420p, BT.709), AAC quando há trilha.
- **Template SDK + registry**: o editor não conhece nenhum template específico; cada template declara schema, composição, campos editáveis e timeline.
- **Signature / 001 — "THE FUTURE IS BUILT"**: o primeiro template, um filme promocional de 15 s em quatro cenas, com layouts dirigidos separadamente para vertical e horizontal.

## Requisitos

- Node.js ≥ 20.11 (testado com 22.14)
- pnpm ≥ 9 (testado com 11.9)
- ~400 MB livres para dependências + o Chrome Headless Shell que o Remotion baixa uma única vez na primeira renderização (≈120 MB)
- FFmpeg/FFprobe **não** são necessários para renderizar (o Remotion traz os binários dele). São usados apenas pelo script opcional `pnpm verify:videos`.

## Início rápido

```bash
pnpm install
pnpm dev
```

Abra <http://localhost:5173>. O `pnpm dev` sobe em paralelo:

| Processo | Endereço | Função |
|---|---|---|
| `@lms/server` | `http://127.0.0.1:4317` | API, persistência, assets, render jobs |
| `@lms/studio` | `http://localhost:5173` | Editor (proxy de `/api` para o servidor) |

Na primeira execução o Studio cria um projeto a partir do Signature / 001. Na primeira exportação, o servidor baixa o Chrome Headless Shell e faz o bundle da composição (alguns segundos); as seguintes reutilizam o cache.

Modo "produção" (Studio compilado servido pelo próprio servidor em uma única porta):

```bash
pnpm build
pnpm start          # http://127.0.0.1:4317
```

Variáveis opcionais: `LMS_PORT`, `LMS_HOST`, `LMS_PROJECTS_DIR`, `LMS_EXPORTS_DIR`, `LMS_SKIP_WARMUP=1`.

## Usando o Studio

| Ação | Como |
|---|---|
| Criar projeto | Aba **Templates** → *Novo projeto com este template*, ou menu **Projeto → Novo projeto…** |
| Abrir / duplicar / excluir | Aba **Projetos** |
| Compor cenas | Aba **Cenas**: menu ⋯ de cada cena (renomear, duplicar, mover, ocultar do vídeo, excluir), arraste pela alça ⋮⋮ para reordenar, **+ Adicionar cena** no fim ou no **+** entre cenas. Cada ocorrência é independente; a animação é a mesma do tipo |
| Selecionar elemento | Clique direto no canvas, na lista *Elementos da cena* ou numa trilha da timeline |
| Editar | Painel direito (inspector): texto, quebra de linha por formato, tipografia, cores (tokens do tema ou hex), background, elementos, layout por formato, animação |
| Background | Procedural (4 variações), cor sólida, gradiente (2–5 cores, linear/radial, movimento) ou imagem local (escala, posição, push-in, desfoque, sobreposição) |
| Trilha sonora | Selecione **Projeto e tema** → *Trilha sonora* (MP3/WAV/M4A/OGG) |
| Formato | Botões **9:16 / 16:9** acima do preview |
| Timing | Arraste a borda direita de uma cena na timeline ou use *Duração da cena* no inspector (limites e estratégia definidos pelo tipo de cena), ou arraste o clipe de um texto (atraso de entrada) |
| Restaurar | Ícone ↺ no inspector restaura o item; **Projeto → Restaurar valores originais** restaura tudo (com desfazer) |
| JSON | **Projeto → Exportar/Importar configuração JSON** |
| Exportar MP4 | **Renderizar MP4** → escolha *Atual*, *9:16*, *16:9* ou *Ambos* → acompanhe etapa, frames e % reais; baixe, assista ou abra a pasta |

Atalhos: `Espaço` play/pause · `←/→` frame · `Shift+←/→` 1 s · `Home/End` · `L` loop · `Ctrl+Z / Ctrl+Shift+Z` desfazer/refazer · `Ctrl+D` duplicar cena · `Delete` excluir cena selecionada · `Ctrl+S` salvar (há também autosave).

As edições são validadas contra o schema do template antes de serem aplicadas; valores fora dos limites nunca chegam ao preview, ao disco ou ao renderizador.

## Onde ficam os arquivos

```
projects/<id>/project.json        documento do projeto (schemaVersion, validado)
projects/<id>/project.backup-*.json  original guardado quando o projeto é migrado de versão
projects/<id>/assets/<asset>.ext  uploads copiados com nome estável
exports/*.mp4                     vídeos exportados pelo Studio
exports/jobs.json                 histórico de renderizações
exports/samples/                  amostras geradas por `pnpm render:samples`
exports/composition/              projeto recomposto gerado por `pnpm render:composition` (+ snapshot .project.json)
```

## Testes e verificação

```bash
pnpm test             # vitest: schemas, persistência, registry, template, pipeline de render, API
pnpm typecheck        # TypeScript estrito em todos os pacotes e scripts
pnpm render:samples   # renderiza os MP4 de amostra (9:16 e 16:9) pelo pipeline de produção
pnpm verify:videos    # ffprobe: codec, dimensões, fps, frames, duração + frames representativos + contact sheet
pnpm render:stills    # PNGs de frames específicos (QA visual): pnpm render:stills 1.6 7.0 13.2
pnpm render:composition  # MP4s de um projeto com cenas repetidas/movidas/desabilitadas; verifique com verify:videos
```

## Estrutura

```
apps/
  studio/      editor (React, Vite, Zustand, @remotion/player)
  server/      API local, ProjectStore, RenderQueue, RemotionEngine
packages/
  shared/          tipos, schemas Zod do envelope, cores, formatos, contratos da API, migrações
  motion-core/     motor de animação determinístico (spring analítico, easing, stagger,
                   máscaras, blur direcional, tipografia cinética, câmera 2.5D, layout responsivo)
  template-sdk/    contrato MotionTemplate, descritores de campos, timeline, registry, validação
  templates/
    signature-001/ o primeiro template (schema, defaults, coreografia, 4 cenas, fontes OFL)
  catalog/         registry concreto + TemplateStage (usado pelo Player e pelo renderer) + entry do Remotion
scripts/           render-samples, verify-videos, render-stills
docs/              arquitetura, SDK, renderização, criação de templates
```

Documentação: [arquitetura](docs/architecture.md) · [Template SDK](docs/template-sdk.md) · [renderização](docs/rendering.md) · [criando templates](docs/creating-templates.md).

## Licenças

- Fontes do template (Archivo, Inter, JetBrains Mono): SIL Open Font License 1.1 — ver `packages/templates/signature-001/src/fonts/LICENSES.txt`.
- **Remotion** tem licença própria: gratuita para indivíduos e empresas de até 3 pessoas; empresas maiores precisam de uma licença de empresa (<https://remotion.dev/license>). O Player é usado com `acknowledgeRemotionLicense`.
