# CARTA / 001 — LOCAL MOTION STUDIO
## Editor Visual de Motion Graphics + Primeiro Template Premium

### PAPEL

Você é um Principal Creative Developer, Motion Designer Sênior, especialista em animações cinematográficas, React, Remotion, TypeScript, design systems e ferramentas de edição audiovisual.

Sua missão é criar do zero um repositório local chamado `local-motion-studio`.

Não estamos criando uma demonstração técnica. Estamos criando a fundação de um produto que permite produzir vídeos de motion graphics com qualidade de estúdio profissional, utilizando templates programáticos totalmente editáveis.

**O resultado precisa impressionar visualmente antes mesmo de qualquer personalização.**

---

# 1. VISÃO DO PRODUTO

Uma aplicação web local para editar e exportar vídeos profissionais de motion graphics.

Fluxo principal:

1. Usuário abre o Studio no navegador.
2. Escolhe um template disponível.
3. Visualiza a animação original funcionando.
4. Edita textos, cores, backgrounds e configurações.
5. Acompanha as alterações diretamente no preview.
6. Alterna entre formato vertical e horizontal.
7. Visualiza a timeline e reproduz a animação.
8. Clica em "Renderizar MP4".
9. Acompanha o progresso.
10. Obtém o vídeo final no computador.

Nesta primeira versão teremos apenas **um template completo**, porém toda a arquitetura deve suportar a inclusão de novos templates futuramente.

O sistema deve funcionar localmente, sem depender de serviços pagos, APIs externas ou tokens de inteligência artificial.

Não implementar integração com LLM nesta fase.

---

# 2. STACK E ARQUITETURA

Stack preferencial:

- React + TypeScript + Vite para o editor.
- Remotion para composições audiovisuais.
- `@remotion/player` para preview.
- Node.js para backend local.
- APIs oficiais de renderização do Remotion.
- FFmpeg quando necessário para processamento auxiliar.
- Zustand para estado do editor.
- Zod para validação dos schemas.
- CSS moderno com design tokens.
- Lucide para ícones de interface.

Priorizar simplicidade operacional e qualidade de código.

Monorepo sugerido:

```text
local-motion-studio/
├── apps/
│   ├── studio/
│   │   └── src/
│   │       ├── components/
│   │       ├── editor/
│   │       ├── panels/
│   │       ├── player/
│   │       ├── timeline/
│   │       └── stores/
│   └── server/
│       └── src/
│           ├── api/
│           ├── rendering/
│           ├── projects/
│           └── storage/
├── packages/
│   ├── motion-core/
│   ├── template-sdk/
│   ├── templates/
│   │   └── signature-001/
│   └── shared/
├── assets/
├── projects/
├── exports/
└── README.md
```

Adaptar a estrutura se existir uma solução tecnicamente superior, preservando modularidade.

---

# 3. DIREÇÃO VISUAL DO EDITOR

Construir uma interface inspirada na experiência de ferramentas profissionais de criação audiovisual.

Referências conceituais:

- After Effects: organização de camadas.
- CapCut Desktop: facilidade de edição.
- Figma: organização das propriedades.
- Linear: acabamento de interface.
- Remotion: composição programática.

Não copiar interfaces literalmente.

### Layout esperado

**Sidebar esquerda**

- Biblioteca de templates.
- Lista de cenas.
- Elementos editáveis da cena.
- Navegação entre projetos.

**Área central**

- Preview grande da composição.
- Controles de reprodução.
- Zoom e opção de ajustar à tela.
- Guias de margem segura.
- Alternância vertical/horizontal.

**Painel direito**

Inspector contextual contendo:

- Texto e tipografia.
- Cores.
- Background.
- Gradientes.
- Elementos gráficos.
- Efeitos disponíveis.
- Configurações de animação.

**Parte inferior**

Timeline audiovisual com:

- Régua temporal.
- Playhead.
- Cenas.
- Camadas.
- Duração.
- Indicadores de animação.
- Scrubbing.
- Zoom temporal.

Não é obrigatório criar um editor genérico de keyframes nesta primeira versão, mas os elementos editáveis devem estar corretamente representados na timeline.

A interface deve ter aparência premium, tema escuro, hierarquia visual clara, microinterações sutis e boas condições de uso em desktop.

O preview deve ser funcional, não uma imagem ou vídeo demonstrativo.

---

# 4. TEMPLATE INICIAL — SIGNATURE / 001

## Conceito: "THE FUTURE IS BUILT"

Criar um vídeo promocional cinematográfico sobre tecnologia, criatividade e inteligência artificial.

A identidade deve misturar:

- Motion graphics editorial.
- Tipografia cinética.
- Elementos geométricos sofisticados.
- Motion design tecnológico.
- Transições cinematográficas.
- Composição gráfica minimalista.
- Profundidade e iluminação simuladas por código.

### Qualidade esperada

Imagine um motion produzido por um estúdio especializado para anunciar um produto tecnológico premium.

Evitar absolutamente:

- Slides com textos entrando em fade.
- Cards genéricos deslizando.
- Transições repetitivas.
- Gradientes estáticos sem direção.
- Efeitos aleatórios sem intenção visual.
- Animações que pareçam templates básicos de PowerPoint.

Queremos movimento com identidade, direção de arte, contraste, ritmo e personalidade.

### Duração

Aproximadamente 15 segundos.

30 FPS como padrão inicial, com arquitetura preparada para 60 FPS.

### Storyboard obrigatório

**CENA 01 — IMPACT (0–3s)**

Fundo escuro com textura procedural discreta.

Uma linha luminosa atravessa a composição em alta velocidade.

A linha revela formas geométricas com sensação de profundidade.

O texto principal surge por meio de uma máscara animada, com revelação tipográfica por palavras.

Texto inicial:

"THE FUTURE"

Em seguida:

"IS BUILT"

Detalhes:

- Overshoot sutil.
- Motion blur quando suportado de maneira determinística.
- Linhas e partículas discretas.
- Variação de escala e enquadramento.
- Tipografia extremamente bem trabalhada.

**CENA 02 — ENERGY (3–6s)**

Transição em que elementos da cena anterior se reorganizam.

Um conjunto de círculos, grids e linhas constrói um núcleo visual tecnológico.

O núcleo pulsa e desloca elementos ao redor.

Texto:

"NOT JUST IMAGINED."

Aplicar máscara, timing escalonado e contraste entre tipografia e movimento geométrico.

**CENA 03 — TRANSFORMATION (6–10s)**

A câmera virtual atravessa uma composição de planos gráficos.

Criar ilusão de profundidade usando transformações 2D/2.5D.

Formas mudam de posição, escala e cor de maneira coreografada.

Texto principal:

"CREATE."

"ANIMATE."

"INSPIRE."

Cada palavra deve participar ativamente da animação, em vez de simplesmente aparecer na tela.

**CENA 04 — SIGNATURE (10–15s)**

Os elementos visuais convergem para uma composição final.

Headline:

"MOTION WITHOUT LIMITS."

Subtítulo:

"Designed with code. Made to move."

Adicionar uma assinatura visual geométrica abstrata, sem depender de um logotipo externo.

A animação finaliza com um movimento sofisticado e um breve intervalo de leitura.

### Direção de arte

Paleta padrão:

- Background: `#080A10`
- Foreground: `#F5F7FF`
- Accent: `#B8FF35`
- Secondary: `#6574FF`
- Surface: `#151925`

Tipografia:

- Fonte sans-serif expressiva.
- Headline pesada e impactante.
- Subtítulos com boa legibilidade.
- Tracking controlado.
- Quebras de linha intencionais.

Pode utilizar fontes locais de licença adequada.

Usar elementos visuais programáticos como SVG, CSS, máscaras, gradientes, shapes e padrões geométricos.

Não usar vídeos de stock como substitutos da animação.

---

# 5. SISTEMA DE EDIÇÃO PARAMÉTRICA

O template não pode possuir conteúdo principal rigidamente definido no JSX.

Todo conteúdo personalizável precisa ser declarado em um schema.

Exemplo conceitual:

```ts
type MotionProject = {
  templateId: string;
  format: "portrait" | "landscape";
  fps: number;
  durationFrames: number;
  theme: {
    background: string;
    foreground: string;
    accent: string;
    secondary: string;
  };
  scenes: MotionScene[];
};
```

Cada cena deverá declarar:

- Identificador estável.
- Nome.
- Intervalo temporal.
- Textos editáveis.
- Background configurável.
- Paleta própria ou herdada.
- Elementos gráficos parametrizáveis.
- Configurações de animação permitidas.
- Propriedades específicas do template.

O schema real pode ser mais sofisticado.

### Funcionalidades mínimas

**Texto**

- Editar o conteúdo de todos os textos.
- Alterar tamanho quando permitido.
- Alterar cor.
- Alterar peso/estilo.
- Controlar quebra de linha.
- Visualizar a mudança no preview.

**Background**

- Cor sólida.
- Gradiente.
- Background procedural do template.
- Upload de imagem local.
- Controles básicos de posição e escala para imagens.

**Elementos**

- Alterar cores.
- Alternar visibilidade.
- Editar parâmetros disponibilizados pelo template.
- Selecionar elementos pela lista ou diretamente no canvas.

**Animação**

- Permitir editar parâmetros expostos, como intensidade, delay e duração, dentro de limites validados.
- Preservar o sincronismo geral da composição.

As edições precisam aparecer no preview sem reconstruir manualmente o projeto.

Alterações de propriedades não devem provocar reinicializações desnecessárias do player.

---

# 6. VERTICAL E HORIZONTAL — RESPONSIVIDADE REAL

Suportar inicialmente:

- Vertical: 1080×1920 (9:16).
- Horizontal: 1920×1080 (16:9).

Não é aceitável simplesmente esticar, cortar ou rotacionar uma composição.

Construir um sistema de layouts adaptativos para motion graphics.

O mesmo template deverá produzir duas composições visualmente planejadas.

### Regras

**Vertical**

- Headlines maiores proporcionalmente ao espaço útil.
- Composições mais centralizadas.
- Hierarquia vertical.
- Elementos geométricos redistribuídos.
- Margens de segurança para Reels e Shorts.

**Horizontal**

- Maior exploração de espaço lateral.
- Composições assimétricas quando apropriado.
- Movimento distribuído pela largura.
- Hierarquia adaptada para formato widescreen.

Permitir diferenças específicas de posicionamento, escala, alinhamento e quebra de linha entre formatos.

Se necessário, cada cena pode possuir `portraitLayout` e `landscapeLayout`.

Manter conteúdo semântico compartilhado e overrides visuais por formato.

**Critério essencial:** os dois formatos precisam parecer versões profissionalmente dirigidas do mesmo vídeo.

---

# 7. MOTOR DE ANIMAÇÃO

Todas as animações devem ser determinadas pelo frame atual.

Priorizar:

- `useCurrentFrame`.
- `useVideoConfig`.
- `interpolate`.
- `spring`.
- `Sequence`.
- Composições React.
- SVG parametrizado.
- Transformações CSS determinísticas.

Não depender de `setTimeout`, `requestAnimationFrame` livre, animações CSS baseadas no relógio real ou estados aleatórios não reproduzíveis para determinar o resultado final.

Toda animação precisa funcionar de maneira idêntica ao avançar para qualquer frame.

Se utilizar partículas ou ruído, empregar seeds estáveis.

Criar utilitários reutilizáveis para:

- Stagger de palavras e caracteres.
- Revelação por máscaras.
- Overshoot.
- Interpolação de transformações.
- Curvas de easing.
- Parallax.
- Transições de cena.
- Efeitos geométricos.
- Coreografia tipográfica.

O motor deve permitir animações futuras sem acoplá-las ao primeiro template.

---

# 8. PREVIEW E TIMELINE

O preview deve consumir a mesma composição React utilizada na renderização final.

Implementar:

- Play.
- Pause.
- Replay.
- Loop opcional.
- Scrubbing.
- Exibição do tempo.
- Exibição do frame.
- Seleção de cena.
- Alteração de formato.
- Preview dimensionado ao container.
- Indicador de carregamento de assets.

### Timeline

Exibir as quatro cenas.

Representar camadas editáveis com seus intervalos temporais.

Clicar numa cena deve posicionar o playhead.

Clicar numa camada deve selecionar o elemento correspondente no inspector.

Arrastar o playhead deve atualizar o preview.

Alterações de timing devem permanecer dentro das regras do template.

Não fingir oferecer recursos avançados não implementados.

---

# 9. RENDERIZAÇÃO MP4 LOCAL

Implementar uma pipeline real de exportação.

O botão "Renderizar MP4" deve iniciar um job no backend local.

Fluxo:

1. Validar o projeto.
2. Congelar um snapshot dos dados do projeto.
3. Resolver e validar assets locais.
4. Preparar a composição.
5. Renderizar frames.
6. Codificar o vídeo.
7. Salvar o MP4.
8. Disponibilizar download e acesso ao arquivo exportado.

### Configurações

- Formato vertical/horizontal.
- Resolução Full HD.
- FPS 30 por padrão.
- Codec H.264.
- Container MP4.
- Qualidade alta.
- Áudio AAC quando existir trilha.

### Interface de exportação

Exibir:

- Status do job.
- Percentual real de progresso.
- Etapa atual.
- Erros legíveis.
- Caminho do arquivo.
- Botão para obter o MP4.

Implementar cancelamento quando tecnicamente viável.

Renderizar de forma assíncrona em relação à requisição HTTP, sem bloquear o frontend.

O processamento pode demorar; não bloquear toda a interface.

Não utilizar exportação simulada, gravação de tela ou captura improvisada do player.

### Critério de fidelidade

A composição do preview e a do MP4 devem compartilhar a mesma implementação, os mesmos dados e as mesmas regras de animação.

Evitar divergências de fontes, imagens, posições e timings.

---

# 10. PROJETOS E PERSISTÊNCIA

Permitir:

- Criar projeto a partir do template.
- Editar projeto.
- Salvar.
- Reabrir.
- Duplicar.
- Restaurar valores originais.
- Exportar configuração JSON.
- Importar configuração JSON válida.

Persistir localmente no servidor ou em arquivos versionados.

Não depender exclusivamente de localStorage.

Uploads devem ser copiados para armazenamento controlado pelo projeto, com caminhos estáveis.

Cada projeto deve referenciar seus assets.

Manter versionamento do schema para futuras migrações.

---

# 11. TEMPLATE SDK — EXTENSIBILIDADE

O primeiro template deve ser tratado como uma implementação de um contrato compartilhado.

Exemplo conceitual:

```ts
interface MotionTemplate {
  id: string;
  name: string;
  version: string;
  description: string;

  defaults: MotionProject;
  schema: unknown;

  Component: React.ComponentType<any>;

  getMetadata(
    project: MotionProject
  ): CompositionMetadata;

  getEditableFields(): EditableField[];

  getTimeline(
    project: MotionProject
  ): TimelineTrack[];
}
```

Melhorar a tipagem e eliminar `any` na implementação real.

### Objetivo

No futuro, adicionar novos templates como:

- Typography Explosion.
- Product Reveal.
- Logo Animation.
- Kinetic Numbers.
- Social Media Announcement.
- Cinematic Title.
- Glassmorphism Motion.
- Data Visualization Motion.

Um novo template deve poder registrar seu próprio schema, composição, metadata, campos editáveis e timeline.

O editor principal não deve conter condicionais espalhadas verificando `templateId`.

Criar um registry de templates.

O primeiro template deverá usar esse registry desde o início.

---

# 12. PERFORMANCE E QUALIDADE

Prioridades técnicas:

- Preview fluido.
- Animações determinísticas.
- Separação editor/composição.
- Tipagem forte.
- Validação de entrada.
- Render jobs isolados.
- Persistência confiável.
- Tratamento de falhas.
- Arquitetura testável.

Evitar dependências pesadas que não tragam benefício claro.

Não criar uma engine de vídeo própria se o Remotion já resolver o problema.

Não usar WebGL indiscriminadamente. Caso exista um efeito visual mais complexo, avaliar primeiro sua compatibilidade e determinismo na renderização.

Não sacrificar estabilidade por efeitos que funcionam apenas no navegador.

---

# 13. PROCESSO DE EXECUÇÃO

Executar o trabalho em etapas, mas entregar uma aplicação integrada.

**FASE A — Fundação**

- Inicializar o repositório.
- Configurar workspace.
- Criar frontend e backend.
- Implementar contratos compartilhados.
- Preparar pipeline de renderização.

**FASE B — Template cinematográfico**

Implementar as quatro cenas com direção de arte e animação completas.

Não criar placeholders visuais como resultado final.

**FASE C — Editor**

Implementar interface, preview, inspector, painel de cenas e timeline.

**FASE D — Persistência e exportação**

Projetos locais, assets, jobs e MP4 real.

**FASE E — Ajuste visual**

Revisar cuidadosamente o vídeo inteiro em 9:16 e 16:9.

Corrigir:

- Overflow.
- Texto cortado.
- Contraste inadequado.
- Movimento desconexo.
- Transições sem continuidade.
- Timing ruim.
- Espaçamento inconsistente.
- Erros de centralização.
- Sobreposição indesejada.

**FASE F — Verificação**

Executar testes e renderizações reais.

---

# 14. TESTES DE ACEITAÇÃO

O trabalho só estará concluído quando:

1. O Studio iniciar localmente por comando documentado.
2. O primeiro template abrir e reproduzir.
3. As quatro cenas estiverem implementadas.
4. Todos os textos principais puderem ser alterados.
5. As alterações aparecerem no preview.
6. As cores e backgrounds puderem ser modificados.
7. Imagens locais puderem ser utilizadas como background.
8. A timeline controlar corretamente o player.
9. Os formatos vertical e horizontal possuírem layouts adaptados.
10. Um projeto editado puder ser salvo e reaberto.
11. A exportação gerar arquivos MP4 reais.
12. Os MP4s renderizados reproduzirem corretamente.
13. Os arquivos possuírem as dimensões e durações esperadas.
14. O resultado final não apresentar cortes ou sobreposições inesperadas.
15. Um novo template puder ser registrado sem reescrever o editor.

Criar testes automatizados para schemas, persistência, registry e pipeline.

Realizar renderizações de exemplo nos dois formatos.

Usar ferramentas de inspeção de vídeo disponíveis para validar metadados e verificar frames representativos das quatro cenas.

Não declarar sucesso para funcionalidades não executadas ou não verificadas.

---

# 15. DOCUMENTAÇÃO FINAL

Criar:

- README.md
- docs/architecture.md
- docs/template-sdk.md
- docs/rendering.md
- docs/creating-templates.md

Explicar:

- Como iniciar o Studio.
- Como criar um projeto.
- Como editar um template.
- Como exportar MP4.
- Como adicionar novos templates.
- Como são tratados assets e layouts responsivos.
- Como executar testes.

---

# 16. REGRA FUNDAMENTAL DE QUALIDADE

Não confundir complexidade técnica com qualidade visual.

Uma animação simples e excepcionalmente dirigida é superior a uma composição com dezenas de efeitos mal coordenados.

O primeiro template deve ser suficientemente bom para funcionar como demonstração comercial do produto.

**O Studio é a plataforma. O template Signature / 001 é a prova de qualidade da plataforma.**

Entregar código funcional, não somente planos, documentação, protótipos ou estruturas vazias.

Se houver limitações reais de ambiente, documentá-las e concluir tudo o que for possível verificar.

Ao finalizar, apresentar:

- Arquitetura criada.
- Funcionalidades concluídas.
- Testes executados.
- Local dos MP4s gerados.
- Limitações existentes.
- Procedimento para adicionar o próximo template.

Comece inspecionando o ambiente e implemente o projeto.
