# CARTA / 004 — LOCAL MOTION STUDIO
## Motion Design Expansion Pack — Advanced Scenes & Compositions

### MISSÃO

Atue como Creative Technical Director, Senior Motion Designer e Principal Engineer especializado em React, TypeScript, Remotion, SVG, animações determinísticas e ferramentas de criação audiovisual.

Sua missão é expandir o Local Motion Studio com novos tipos de cenas, técnicas avançadas de animação e composições profissionais completas, tomando como referência a linguagem de motion design utilizada em comerciais, apresentações de aplicativos, produtos digitais, showreels e vídeos de criadores de conteúdo.

O projeto já passou por:

- CARTA 001: Editor base e Signature 001.
- CARTA 002: Cenas dinâmicas, duplicação e reordenação.
- CARTA 003: Composição livre, biblioteca global, novos tipos de cenas e templates criados pelo usuário.

**Não recrie o projeto. Inspecione o código existente, reutilize o Scene Registry, o Inspector, o Template SDK, a timeline e a renderização MP4.**

Não substitua as cenas existentes.

A missão é ampliar a diversidade e a qualidade da biblioteca.

---

# 1. OBJETIVO PRINCIPAL

Entregar um pacote de expansão com:

- 12 novos tipos de cenas reutilizáveis.
- 5 novas composições completas.
- Um conjunto de técnicas avançadas de motion.
- Propriedades editáveis no inspector existente.
- Suporte verdadeiro a 9:16 e 16:9.
- Compatibilidade com Modo Livre.
- Compatibilidade com o sistema de templates.
- Exportação MP4 local.

Cada composição deve utilizar cenas reais do catálogo e permanecer totalmente editável.

Não criar vídeos prontos que não possam ser personalizados.

---

# 2. DIREÇÃO DE MOTION DESIGN

As referências visuais seguem cinco estilos principais:

1. Lançamento de aplicativos.
2. Showreel de motion designer.
3. Apresentação de produto digital.
4. Comerciais de produtos físicos.
5. Apresentação pessoal e marca.

A linguagem de animação deve incorporar:

- Squash & stretch.
- Anticipation.
- Follow-through.
- Overshoot.
- Stagger.
- Kinetic typography.
- Motion blur.
- Echo trails.
- Mask reveals.
- Wipes.
- Iris transitions.
- Morphing geométrico.
- Parallax.
- Perspectiva 2.5D.
- Animação com curvas de easing.
- Animação de UI.
- Contadores e gráficos dinâmicos.

Priorizar qualidade de movimento, e não quantidade de efeitos.

**Nenhuma cena deve se limitar a texto surgindo com fade ou slide genérico.**

---

# 3. NOVAS CENAS — TYPOGRAPHY & MOTION

## SCENE 01 — BOUNCING BALL TYPOGRAPHY

Uma bolinha colorida percorre a composição com física estilizada.

A bola quica com squash & stretch, deixa um rastro sutil e finalmente se transforma em um ponto de uma letra ou elemento de uma headline.

A animação precisa ter:

- Arcos de movimento.
- Antecipação.
- Compressão no impacto.
- Alongamento no deslocamento.
- Follow-through.
- Transformação final.

Editável:

- Cor da bola.
- Cor do fundo.
- Texto final.
- Tamanho.
- Quantidade de quiques.
- Intensidade elástica.
- Velocidade.
- Posição final.

## SCENE 02 — SEMANTIC KINETIC WORDS

Palavras devem se movimentar de acordo com seu significado.

Exemplos:

"EXPLODE" se fragmenta.

"FAST" atravessa a tela rapidamente.

"GROW" aumenta progressivamente.

"FOCUS" passa de desfocado para nítido.

"CONNECT" une elementos gráficos.

Criar presets de comportamento semântico.

Editável:

- Lista de palavras.
- Preset por palavra.
- Cores.
- Tipografia.
- Timing.
- Background.
- Intensidade.
- Alinhamento.

As palavras devem poder ser modificadas sem quebrar a animação. Os presets descrevem movimentos, não dependem do significado literal do texto.

## SCENE 03 — MORPHING LINE ART

Uma linha desenha formas progressivamente e transforma sua geometria.

Exemplos:

Linha → círculo → seta → símbolo abstrato.

Utilizar morphing SVG ou técnica equivalente, com interpolação compatível entre as geometrias.

Editável:

- Preset de formas.
- Cores.
- Espessura.
- Comprimento do percurso.
- Velocidade.
- Direção.
- Background.

Não prometer morphing arbitrário entre SVGs incompatíveis.

## SCENE 04 — IRIS & LIQUID REVEAL

Criar uma cena baseada em revelações por máscaras animadas.

Suportar presets como:

- Iris circular.
- Wipe diagonal.
- Máscara radial.
- Formas orgânicas.
- Abertura geométrica.

Editável:

- Texto principal.
- Texto secundário.
- Imagem opcional.
- Preset.
- Direção.
- Cor.
- Intensidade.
- Timing.

O movimento da máscara precisa revelar conteúdo de maneira visualmente significativa.

---

# 4. NOVAS CENAS — APPS & UI

## SCENE 05 — FLOATING SMARTPHONE

Apresentação de aplicativo com smartphone tridimensional estilizado.

A cena deve permitir exibir uma screenshot real do aplicativo.

Implementar:

- Mockup premium.
- Movimento de câmera simulado.
- Rotação em perspectiva.
- Zoom.
- Reflexos.
- Glow opcional.
- Profundidade.
- Texto sincronizado.

Editável:

- Screenshot.
- Headline.
- Subheadline.
- Cor de fundo.
- Modelo visual do dispositivo.
- Intensidade da perspectiva.
- Rotação.
- Posição.
- Escala.

Não depender de modelos 3D externos obrigatórios.

O dispositivo deve funcionar com CSS 3D, SVG ou renderização compatível com o pipeline.

## SCENE 06 — UI FEATURE HIGHLIGHT

Uma interface digital aparece em destaque com animações de seus componentes.

Suportar:

- Cards surgindo.
- Botões destacados.
- Gráficos animados.
- Elementos reorganizados.
- Foco em funcionalidade.
- Zoom para regiões relevantes.

Editável:

- Imagem ou composição de interface.
- Título.
- Benefício.
- Cor de destaque.
- Tipo de revelação.
- Região de foco.
- Posição dos callouts.

Permitir trabalhar com UI procedural ou screenshot.

## SCENE 07 — APP SCREEN TRANSITION

Sequência de telas de aplicativo em um dispositivo.

Uma tela substitui a outra com movimento coreografado.

Efeitos:

- Deslocamento.
- Máscara.
- Zoom.
- Parallax.
- Echo trail opcional.
- Transição com blur.

Editável:

- Lista de screenshots.
- Legendas.
- Velocidade.
- Cor do dispositivo.
- Background.
- Direção.
- Estilo de transição.

Suportar pelo menos três screenshots e permitir quantidades variáveis dentro de limites validados.

---

# 5. NOVAS CENAS — PRODUCTS

## SCENE 08 — PRODUCT HERO 2.5D

Apresentação de produto isolado com sensação tridimensional.

O usuário faz upload de uma imagem do produto, preferencialmente PNG com transparência.

A cena constrói:

- Iluminação gráfica.
- Sombras.
- Plano de fundo.
- Rotação aparente.
- Deslocamento em profundidade.
- Linhas de destaque.
- Composição publicitária.

Editável:

- Imagem.
- Nome.
- Descrição.
- Cor.
- Escala.
- Posição.
- Sombra.
- Intensidade dos efeitos.

Não simular uma rotação tridimensional completa de um produto a partir de uma única imagem plana como se existissem lados não fornecidos.

Utilizar perspectivas 2.5D e permitir múltiplas imagens quando uma rotação visual mais completa for desejada.

## SCENE 09 — PRODUCT DETAIL CALLOUT

Produto no centro com destaque de características ao redor.

As características surgem com linhas de conexão, marcadores e pequenas animações.

Editável:

- Produto.
- Headline.
- Até cinco benefícios.
- Posição dos marcadores.
- Cores.
- Estilo das linhas.
- Timing.

Distribuir os benefícios de maneira responsiva.

## SCENE 10 — PRODUCT COLOR IMPACT

Composição comercial focada em contraste e impacto.

Elementos:

- Duas cores predominantes.
- Produto central.
- Tipografia extrabold.
- Formas geométricas.
- Movimentos rápidos.
- Efeitos de eco.
- Revelação final.

Editável:

- Imagem do produto.
- Duas cores.
- Headline.
- Subheadline.
- Três palavras de impacto.
- Intensidade.
- Duração permitida.

---

# 6. NOVAS CENAS — DATA & PERSONAL BRANDING

## SCENE 11 — ANIMATED INFOGRAPHIC

Cena com dados e indicadores animados.

Permitir combinar:

- Counter.
- Barra de progresso.
- Gráfico de linha.
- Porcentagem circular.
- Pequenos indicadores.

Editável:

- Valores.
- Labels.
- Unidades.
- Cores.
- Tipo de gráfico.
- Background.
- Estilo de entrada.

Dados devem ser representados de forma consistente, sem valores inventados.

## SCENE 12 — PERSONAL BRAND REVEAL

Apresentação premium de criador de conteúdo ou profissional.

Elementos:

- Nome.
- Cargo.
- Foto circular ou retangular.
- Destaques.
- @ do Instagram.
- Assinatura final.
- CTA.

Movimentos:

- Linha animada formando elementos gráficos.
- Foto revelada por máscara.
- Texto com stagger.
- Números com count-up.
- CTA animado.
- Encerramento.

Editável:

- Nome.
- Cargo.
- Foto.
- Instagram.
- Headline.
- Destaques.
- CTA.
- Cores.
- Background.
- Tipografia.

---

# 7. COMPOSIÇÕES COMPLETAS

Além das cenas, criar cinco novas composições registradas na biblioteca de templates.

Cada composição deve ser formada por instâncias das cenas disponíveis.

As durações são sugestões iniciais, e não limitações rígidas.

## COMPOSITION 01 — APP LAUNCH CINEMATIC

Duração aproximada: 25–30 segundos.

Objetivo: divulgação de aplicativos.

Sequência:

1. Abertura com logotipo e headline.
2. Revelação tipográfica.
3. Smartphone surgindo.
4. Tela principal do aplicativo.
5. Destaque de funcionalidade.
6. Transição entre telas.
7. Benefícios.
8. Encerramento com logo e tagline.

Personalização:

- Nome do app.
- Logo.
- Tagline.
- Headlines.
- Screenshots.
- Cores.
- Benefícios.
- CTA.

## COMPOSITION 02 — MOTION DESIGN SHOWREEL

Duração aproximada: 15–20 segundos.

Objetivo: apresentar a qualidade das animações do Studio.

Sequência:

1. Bola quicando com squash & stretch.
2. Bola se transforma em elemento tipográfico.
3. Palavras animadas semanticamente.
4. Linha se transforma em gráfico.
5. Transição por máscara.
6. Formas se reorganizam.
7. Headline final.
8. Assinatura.

Este template deve demonstrar princípios de motion design, com ritmo e continuidade.

## COMPOSITION 03 — DIGITAL PRODUCT PROMO

Duração aproximada: 25–30 segundos.

Objetivo: divulgar SaaS, dashboards e produtos digitais.

Sequência:

1. Headline inicial.
2. Interface do produto.
3. Zoom em funcionalidade.
4. Cards e indicadores.
5. Métricas animadas.
6. Segunda funcionalidade.
7. Benefícios.
8. CTA final.

Permitir utilizar screenshots do sistema.

## COMPOSITION 04 — PRODUCT COMMERCIAL

Duração aproximada: 15–20 segundos.

Objetivo: anúncio de produtos físicos ou digitais.

Sequência:

1. Elemento gráfico explode.
2. Produto é revelado.
3. Close visual.
4. Produto com benefícios.
5. Transição tipográfica.
6. Composição publicitária.
7. Marca e tagline.

Priorizar acabamento comercial de alto nível.

## COMPOSITION 05 — CREATOR INTRO

Duração aproximada: 15–20 segundos.

Objetivo: apresentação pessoal ou perfil profissional.

Sequência:

1. Linha geométrica inicial.
2. Headline de apresentação.
3. Revelação de foto.
4. Nome e cargo.
5. Destaques profissionais.
6. Métricas opcionais.
7. CTA.
8. Assinatura final.

Permitir composição sem foto, mantendo qualidade visual.

---

# 8. NOVA CAMADA DE MOTION PRIMITIVES

Criar ou consolidar uma biblioteca compartilhada de funções e componentes de animação.

Sugestão conceitual:

```text
motion-core/
├── easing/
├── springs/
├── typography/
├── masks/
├── geometry/
├── transitions/
├── trails/
├── perspective/
├── counters/
└── timing/
```

Componentes e utilitários candidatos:

- AnimatedText.
- StaggerText.
- MaskReveal.
- MotionPath.
- SquashStretch.
- SpringTransform.
- EchoTrail.
- AnimatedCounter.
- SVGDraw.
- MorphShape.
- ParallaxLayer.
- IrisReveal.
- AnimatedGrid.
- ProgressRing.
- Camera2D.

Antes de criar cada primitive, verificar se já existe implementação equivalente.

Não duplicar funcionalidades existentes.

Esses recursos devem servir à construção de cenas, mas não precisam se tornar elementos livres do editor nesta fase.

---

# 9. EDIÇÃO DAS NOVAS CENAS

Todos os novos tipos de cenas precisam seguir o contrato existente do Studio.

Obrigatório:

- Scene Definition.
- Schema validado.
- Defaults.
- Inspector integrado.
- Thumbnail.
- Metadata temporal.
- Suporte a duplicação.
- Suporte a reordenação.
- Persistência.
- Exportação.
- Portrait layout.
- Landscape layout.

Nenhuma nova cena deve ter seu conteúdo principal fixo no JSX.

Expor propriedades editáveis adequadas ao contexto.

Uma cena de smartphone precisa permitir trocar a tela.

Uma cena de produto precisa permitir trocar o produto.

Uma cena de números precisa permitir editar os dados.

Uma cena de apresentação pessoal precisa permitir trocar nome, foto e cargo.

Apenas alterar cores e textos não é suficiente quando o objeto principal da animação também deve ser personalizável.

---

# 10. FORMATOS OBRIGATÓRIOS

Todas as cenas e composições devem suportar:

**Vertical — 9:16**
1080 × 1920.

**Horizontal — 16:9**
1920 × 1080.

Ambos em 30 FPS por padrão.

Os layouts devem possuir direção de arte adequada a cada formato.

Não esticar ou simplesmente recortar a composição horizontal para gerar a vertical.

Criar overrides responsivos quando necessário.

Validar:

- Margens.
- Legibilidade.
- Posição dos elementos.
- Tamanho de headline.
- Área de destaque do produto.
- Layout de smartphone.
- Visibilidade de gráficos.
- Safe zones de interface social.

Permitir preservar ajustes específicos de cada orientação.

---

# 11. FIDELIDADE ENTRE PREVIEW E EXPORTAÇÃO

Todas as animações precisam ser determinísticas.

Calcular movimento a partir do frame, evitando relógios independentes.

Utilizar as APIs adequadas do Remotion e utilitários compartilhados.

Para recursos como blur, trails, máscaras e transformações complexas, validar compatibilidade com Chromium e exportação MP4.

O preview e o MP4 precisam apresentar a mesma composição.

Não inserir GIFs ou vídeos pre-renderizados como substitutos das cenas que deveriam ser programáticas.

---

# 12. QUALIDADE VISUAL E CONTROLE DE ESCOPO

O pacote deve buscar qualidade de motion design de nível profissional.

Regras:

- Movimentos com intenção.
- Hierarquia tipográfica.
- Ritmo adequado.
- Continuidade visual.
- Transições coerentes.
- Acabamento consistente.
- Boa legibilidade.
- Uso controlado de efeitos.
- Design responsivo.

Não tratar a quantidade de cenas como substituta da qualidade.

Se a complexidade exigir implementação em etapas, organizar checkpoints internos:

A. Motion primitives.

B. Cenas de tipografia e geometria.

C. Cenas de apps e UI.

D. Cenas de produtos.

E. Cenas de dados e branding.

F. Composições completas.

G. Validação e renderização.

Todos pertencem ao CARTA 004.

Não encerrar o trabalho apenas por ter registrado placeholders para cenas ainda não implementadas.

---

# 13. VALIDAÇÃO VISUAL

Não considerar uma cena concluída apenas porque compila.

Para cada novo tipo de cena:

1. Renderizar frames representativos.
2. Inspecionar entrada, desenvolvimento e saída.
3. Verificar se a animação está coerente.
4. Corrigir overflow e sobreposições.
5. Validar propriedades editadas.
6. Testar vertical e horizontal.
7. Confirmar que a cena funciona quando duplicada.
8. Verificar comportamento em uma composição maior.

Para as cinco composições, testar a reprodução integral.

Renderizar pelo menos um vídeo completo em cada orientação, misturando novos tipos de cenas.

Validar MP4 com metadados de duração, dimensões e codec.

Documentar verificações não realizadas e suas razões.

---

# 14. RESULTADO ESPERADO

Ao final, o Local Motion Studio deve permitir criar:

- Comerciais de aplicativos.
- Vídeos de apresentação de SaaS.
- Showreels de motion design.
- Anúncios de produtos.
- Apresentações profissionais.
- Introduções de criadores.
- Vídeos tipográficos.
- Composições abstratas e tecnológicas.

O usuário poderá utilizar qualquer uma das novas cenas individualmente ou como parte das cinco composições.

Deverá ser possível:

1. Abrir uma composição pronta.
2. Alterar textos e imagens.
3. Trocar o produto ou aplicativo apresentado.
4. Duplicar cenas.
5. Acrescentar cenas de outra composição.
6. Reorganizar tudo na timeline.
7. Salvar como um novo template.
8. Exportar MP4 em 9:16 ou 16:9.

**REGRA FINAL**

Estamos construindo uma biblioteca profissional de motion graphics parametrizados, não uma coleção de apresentações de slides.

A tecnologia é o meio. A qualidade visual é o produto.

Inspecione o projeto atual, aproveite os recursos disponíveis, implemente a expansão, execute testes e documente o resultado.

Não declarar concluídas cenas ou composições que não estejam realmente integradas e funcionais.
