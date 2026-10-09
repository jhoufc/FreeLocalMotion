# Renderização MP4

## Pipeline

`POST /api/renders { projectId, format?, project?, frameRange? }` responde `202` imediatamente com o job; o trabalho acontece de forma assíncrona em `RenderQueue` (um job por vez — a renderização já usa vários núcleos).

| # | Etapa (`job.stage`) | O que acontece |
|---|---|---|
| 1 | `validating` | O documento (salvo ou o enviado pelo Studio) passa pela validação completa do template |
| 2 | `snapshot` | Um `structuredClone` congelado é gravado em `exports/.tmp/<job>.snapshot.json`; edições posteriores no Studio não afetam o job |
| 3 | `assets` | Todo asset referenciado precisa existir em `projects/<id>/assets/` |
| 4 | `bundling` | `@remotion/bundler` empacota `packages/catalog/src/remotion/index.ts` (cacheado; refeito automaticamente se algo em `packages/` mudar) |
| 5 | `composition` | `selectComposition` com o snapshot como `inputProps`; `calculateMetadata` do template define dimensões, fps e duração — e o engine confere se batem com `template.getMetadata` |
| 6 | `rendering` | `renderMedia` renderiza os frames no Chrome Headless Shell |
| 7 | `encoding` | Codificação H.264 (e AAC se houver trilha) |
| 8 | `saving` | O arquivo temporário é movido para `exports/<projeto>-<formato>-<timestamp>.mp4` |

`job.progress` é o progresso real reportado pelo Remotion (frames renderizados + codificados). O Studio consulta `GET /api/renders` a cada ~600 ms enquanto houver jobs ativos.

**Cancelamento**: `POST /api/renders/:id/cancel`. Jobs na fila saem da fila; o job em execução recebe o `cancelSignal` do Remotion, que interrompe o Chrome e o FFmpeg; o arquivo temporário é removido.

**Erros**: mensagens resumidas (sem stack) em `job.error`; o log das etapas fica em `job.log`. Jobs interrompidos por reinício do servidor são marcados como falhos ao recarregar `exports/jobs.json`.

## Configuração de saída

| Parâmetro | Valor |
|---|---|
| Container / codec | MP4 / H.264 High (`codec: 'h264'`) |
| Pixel format / cor | `yuv420p`, BT.709, range limitado (`colorSpace: 'bt709'`) — máxima compatibilidade com players e redes sociais |
| Qualidade | `crf: 16`, `x264Preset: 'medium'`, frames intermediários JPEG qualidade 95 |
| Resolução | 1080×1920 (9:16) ou 1920×1080 (16:9) |
| FPS | do projeto: 30 (padrão) ou 60 |
| Áudio | AAC, somente quando o projeto tem trilha (`Html5Audio` com fades calculados por frame) |

## Fidelidade preview × MP4

- Mesmo componente (`TemplateStage`), mesmo `project`, mesmas regras de animação.
- Fontes: arquivos `.woff2` locais carregados via `FontFace` + `delayRender` nos dois ambientes; o auto-fit de texto mede com as fontes reais.
- Assets: servidos pela mesma rota `/api/projects/:id/assets/*` — no Studio via proxy do Vite, no render via `http://127.0.0.1:<porta>`. `<Img>` do Remotion aguarda o carregamento antes de capturar o frame.

## Scripts

```bash
pnpm render:samples                    # 9:16 e 16:9 completos → exports/samples/
pnpm render:samples --frames 0-59      # render parcial rápido
pnpm verify:videos                     # ffprobe + checagem de frames por cena + contact sheet
pnpm render:stills 0.5 6.2 13          # PNGs (escala 0.5) em exports/stills/<execução>/
```

`render:samples` usa exatamente `ProjectStore → RenderQueue → RemotionEngine` e serve os assets por HTTP numa porta efêmera, como o servidor faz.

## Desempenho de referência

Máquina de desenvolvimento (12 threads, Windows 11): 450 frames Full HD em ~40–60 s por formato, com `concurrency = min(8, núcleos/2)`. O primeiro render da sessão inclui o bundle (~5–15 s) e, na primeira vez na máquina, o download do Chrome Headless Shell.
