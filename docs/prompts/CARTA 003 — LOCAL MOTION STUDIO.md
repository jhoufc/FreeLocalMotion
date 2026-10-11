# CARTA / 003 — LOCAL MOTION STUDIO
## Free Composition & Template Builder
### Criação Livre, Biblioteca de Cenas e Novos Templates

## PAPEL

Atue como Principal Creative Engineer, especialista em React, TypeScript, Remotion, motion design cinematográfico, arquitetura de editores visuais e sistemas de composição audiovisual.

Sua missão é transformar o Local Motion Studio em uma plataforma de criação modular de motion graphics.

O projeto já possui:

- CARTA 001: editor e template Signature 001.
- CARTA 002: cenas dinâmicas, duplicação, reordenação, personalização e timeline.

Não reconstruir essas funcionalidades.

Primeiro, inspecione a implementação real do repositório, identifique os contratos existentes e planeje uma evolução compatível.

**OBJETIVO PRINCIPAL: permitir criar vídeos livremente, reutilizar cenas existentes, adicionar novas cenas e transformar qualquer criação em um template reutilizável.**

---

# 1. DOIS MODOS DE CRIAÇÃO

Implementar dois fluxos dentro do Studio.

## Modo Template

O fluxo existente continua funcionando.

O usuário seleciona um template, cria um projeto baseado nele e personaliza suas cenas.

## Modo Livre

Novo fluxo:

1. Clicar em "Nova criação".
2. Selecionar "Composição livre".
3. Escolher proporção vertical ou horizontal.
4. Abrir uma timeline inicialmente vazia.
5. Selecionar cenas de uma biblioteca.
6. Adicionar e combinar diferentes cenas.
7. Personalizar individualmente cada cena.
8. Reorganizar, duplicar ou remover cenas.
9. Visualizar a composição completa.
10. Salvar como projeto, exportar MP4 ou publicar na biblioteca local como template.

Um projeto livre não precisa pertencer a um template de origem.

O usuário pode editar e exportar livremente sem precisar transformar a composição em template.

---

# 2. BIBLIOTECA GLOBAL DE CENAS

Atualmente, as cenas estão associadas ao Signature 001.

Precisamos evoluir isso para uma biblioteca reutilizável.

Cada tipo de cena deverá possuir:

- ID global estável.
- Nome.
- Categoria.
- Descrição.
- Versão.
- Componente de animação.
- Schema editável.
- Defaults.
- Metadata de duração.
- Layout portrait.
- Layout landscape.
- Recursos visuais necessários.
- Preview ou thumbnail.
- Informação de origem.

A biblioteca poderá disponibilizar cenas do Signature 001 e novas cenas adicionadas neste CARTA.

Preservar a relação de origem com o template, mas permitir reutilização fora dele.

Evitar duplicar componentes React somente para reutilizar uma cena.

Construir um registry global que resolva os tipos de cena por identificador.

Não introduzir um sistema de plugins de execução arbitrária, nem permitir código fornecido pelo usuário dentro dos projetos.

---

# 3. CRIAÇÃO LIVRE NA TIMELINE

Criar uma composição vazia funcional.

Estado inicial:

- Nome: "Nova composição".
- FPS: 30.
- Formato: 9:16 por padrão.
- Nenhuma cena.
- Duração total zero.
- Configurações globais editáveis.

Exibir estado vazio com botão "Adicionar primeira cena".

Quando adicionar cenas:

- Atualizar duração.
- Atualizar timeline.
- Atualizar preview.
- Atualizar o inspector.
- Preservar edição independente.
- Manter persistência.

O usuário poderá misturar cenas de diferentes famílias visuais.

A ordem das cenas deve determinar o resultado final.

O editor precisa funcionar tanto com composições criadas livremente quanto com projetos baseados em templates.

Não duplicar o mecanismo de timeline.

---

# 4. NOVAS CENAS PREMIUM

Além das cenas existentes, criar **8 novos tipos de animação**, visualmente distintos, completos e reutilizáveis.

Não criar apenas versões recoloridas das cenas atuais.

Cada nova cena deve ter direção de arte própria, forte qualidade visual e parâmetros editáveis.

## SCENE 01 — KINETIC TYPE EXPLOSION

Categoria: Typography

Conceito:

Tipografia gigante construída por blocos de caracteres que entram com movimentos escalonados, deslocamentos intensos e máscaras geométricas.

Movimento:

- Entrada com stagger por palavras ou caracteres.
- Escala e overshoot controlados.
- Máscaras direcionais.
- Background dinâmico.
- Encerramento com composição limpa.

Editável:

- Headline.
- Subheadline.
- Cor principal.
- Cor de destaque.
- Background.
- Intensidade da animação.
- Direção da entrada.
- Escala e alinhamento.

## SCENE 02 — GLASS PANELS

Categoria: Product / UI

Conceito:

Painéis translúcidos e superfícies sofisticadas entram em perspectiva simulada, formando uma composição de apresentação tecnológica.

Movimento:

- Profundidade 2.5D.
- Painéis com deslocamento.
- Rotação.
- Reflexos sutis.
- Revelação tipográfica.
- Parallax.

Editável:

- Título.
- Subtítulo.
- Conteúdo de até três painéis.
- Cores.
- Opacidade.
- Background.
- Intensidade de profundidade.
- Imagem opcional por painel.

A cena deve funcionar sem imagens externas.

## SCENE 03 — NUMBER IMPACT

Categoria: Data / Business

Conceito:

Animação de números grandes com contagem progressiva e tipografia editorial.

Movimento:

- Contador animado.
- Marcadores geométricos.
- Linhas de velocidade.
- Revelação escalonada.
- Pulso de destaque.

Editável:

- Valor inicial.
- Valor final.
- Prefixo.
- Sufixo.
- Casas decimais.
- Legenda.
- Cores.
- Background.
- Parâmetros de timing.

A contagem deve ser determinística e funcionar na exportação.

## SCENE 04 — ORBITAL DATA

Categoria: Technology

Conceito:

Um sistema orbital tecnológico com elementos conectados, círculos concêntricos, dados visuais e um núcleo luminoso.

Diferenciar visualmente da cena Energy existente, adicionando uma composição modular com nós informativos e relações espaciais.

Movimento:

- Órbitas com velocidades diferentes.
- Conexões.
- Núcleo pulsante.
- Nós aparecendo progressivamente.
- Transição para headline.

Editável:

- Headline.
- Subheadline.
- Quantidade de nós dentro dos limites suportados.
- Labels dos nós.
- Cores.
- Background.
- Velocidade de rotação.
- Intensidade do brilho.

## SCENE 05 — PRODUCT REVEAL

Categoria: Product

Conceito:

Revelação cinematográfica de um produto, aplicativo, imagem ou elemento gráfico.

Movimento:

- Silhueta inicial.
- Linhas de luz.
- Máscaras reveladoras.
- Zoom controlado.
- Composição final com título.

Editável:

- Imagem principal.
- Headline.
- Subheadline.
- Background.
- Cor de iluminação.
- Escala.
- Posição.
- Intensidade da revelação.

Disponibilizar um visual procedural padrão para o funcionamento sem upload.

## SCENE 06 — GRID BREAKDOWN

Categoria: Abstract / Geometry

Conceito:

Uma grade geométrica se constrói, fragmenta e reorganiza para revelar uma mensagem.

Movimento:

- Construção de grid.
- Células com stagger.
- Deslocamento de blocos.
- Formas revelando texto.
- Transformação geométrica.

Editável:

- Headline.
- Subheadline.
- Cor das células.
- Background.
- Densidade da grade.
- Intensidade.
- Escala da composição.

## SCENE 07 — EDITORIAL SPLIT

Categoria: Typography / Editorial

Conceito:

Composição tipográfica sofisticada com divisão dinâmica da tela, contrastes fortes e hierarquia editorial.

Movimento:

- Divisão animada de áreas.
- Revelação em painéis.
- Texto entrando por máscaras.
- Linhas gráficas.
- Transições direcionais.

Editável:

- Dois blocos de texto.
- Texto auxiliar.
- Cor de cada painel.
- Tipografia.
- Background.
- Direção.
- Proporção da divisão.

## SCENE 08 — CINEMATIC OUTRO

Categoria: Signature / Ending

Conceito:

Encerramento visual premium para apresentar marca, produto ou chamada final.

Movimento:

- Elementos convergentes.
- Emblema abstrato animado.
- Revelação de headline.
- Subtítulo.
- Assinatura final.
- Saída controlada.

Editável:

- Headline.
- Subheadline.
- Assinatura.
- Logotipo/imagem opcional.
- Cor principal.
- Cor secundária.
- Background.
- Intensidade dos efeitos.

Todas essas cenas devem ter duração coerente e suporte a 9:16 e 16:9.

Priorizar composição gráfica real, não somente textos com transições.

---

# 5. PADRÃO OBRIGATÓRIO DE EDIÇÃO

As novas cenas devem utilizar o mesmo mecanismo de edição existente.

Não criar um inspector diferente para cada cena.

Cada Scene Definition deverá expor metadados suficientes para que o editor consiga gerar controles adequados.

Suportar, conforme as propriedades de cada cena:

- Texto.
- Textarea.
- Número.
- Slider.
- Cor.
- Boolean.
- Select.
- Imagem.
- Gradiente.
- Valores agrupados.
- Propriedades repetíveis com limites definidos.

O usuário deve conseguir selecionar uma nova cena e editar suas propriedades exatamente como já faz com as cenas atuais.

Garantir validação de dados e limites seguros.

---

# 6. NOVA EXPERIÊNCIA DE BIBLIOTECA

Criar uma interface de biblioteca de cenas com:

- Busca por nome.
- Categorias.
- Miniaturas.
- Duração padrão.
- Identificação da família de origem.
- Ação "Adicionar".
- Preview rápido, quando viável.

Categorias iniciais:

- Typography.
- Technology.
- Product.
- Data.
- Abstract.
- Editorial.
- Signature.

Evitar que a interface se torne poluída.

A biblioteca deve permitir localizar rapidamente a animação desejada.

A miniatura precisa representar visualmente a cena real, preferencialmente derivada de um frame representativo, e não de uma imagem genérica.

---

# 7. SALVAR COMPOSIÇÃO COMO TEMPLATE

Essa é uma das funcionalidades principais do CARTA.

O usuário poderá criar uma composição livre e selecionar:

**"Salvar como Template"**

Implementar fluxo:

1. Validar a composição.
2. Solicitar nome.
3. Solicitar descrição opcional.
4. Definir categoria.
5. Gerar thumbnail.
6. Criar um novo registro de template.
7. Salvar as instâncias de cenas e suas configurações.
8. Disponibilizar na biblioteca de templates.

O template salvo deverá preservar:

- Ordem.
- Tipos de cena.
- Durações.
- Textos.
- Cores.
- Backgrounds.
- Imagens.
- Configurações globais.
- Layouts e overrides.
- Referências de assets.

Ao utilizar esse template:

- Criar um novo projeto independente.
- Preservar o template original.
- Permitir novas personalizações.
- Permitir duplicar e reorganizar as cenas normalmente.

Uma alteração em um projeto criado a partir do template não deve alterar o template salvo.

O sistema deve distinguir:

**Projeto:** documento em edição.

**Template:** composição reutilizável que funciona como ponto de partida para novos projetos.

---

# 8. GERENCIAMENTO DOS TEMPLATES CRIADOS

Na biblioteca, distinguir:

- Templates nativos.
- Templates criados pelo usuário.

Para templates do usuário:

- Renomear.
- Duplicar.
- Excluir.
- Abrir para edição.
- Criar projeto a partir dele.

Ao editar um template salvo, trabalhar em uma revisão própria, com salvamento explícito da nova versão.

Evitar modificações retroativas em projetos que já tenham sido criados a partir de versões anteriores.

Os templates nativos devem permanecer protegidos contra exclusão acidental.

---

# 9. PERSISTÊNCIA E ASSETS

Criar armazenamento local consistente para:

- Projetos.
- Templates do usuário.
- Imagens.
- Thumbnails.
- Metadata.
- Configurações.

Usar IDs estáveis para assets.

Quando um projeto for convertido em template, garantir que os assets necessários continuem disponíveis mesmo se o projeto original for excluído.

Adotar cópia ou gerenciamento de referências com integridade referencial.

Preservar compatibilidade com projetos dos CARTAs 001 e 002.

Adicionar migrações de schema quando necessárias.

---

# 10. COMPOSIÇÃO VISUAL E CONTINUIDADE

Como agora teremos várias cenas diferentes, garantir que vídeos compostos livremente mantenham qualidade visual.

Implementar configurações globais opcionais:

- Paleta principal.
- Cor de destaque.
- Cor secundária.
- Background padrão.
- Tipografia base.

Cada cena pode herdar esses valores ou utilizar overrides próprios.

Não aplicar automaticamente uma paleta global que destrua a identidade visual de uma cena.

Manter o comportamento original quando não existir configuração global.

### Transições

Nesta etapa, manter cortes diretos corretos como comportamento padrão.

Caso a infraestrutura já comporte transições, oferecer opções compatíveis, sem quebrar a timeline.

Não introduzir sobreposição de frames sem recalcular corretamente a duração final.

O mais importante é preservar a qualidade das cenas, inclusive quando repetidas ou combinadas.

---

# 11. RESPONSIVIDADE REAL

Todas as cenas novas deverão possuir composições adequadas para:

- 1080×1920.
- 1920×1080.

Não simplesmente redimensionar ou esticar.

Implementar estratégias de layout por formato.

Tratar:

- Quebras de linha.
- Margens seguras.
- Tamanho de tipografia.
- Posicionamento de elementos.
- Intensidade espacial.
- Áreas úteis.

Templates salvos devem funcionar nos dois formatos.

Quando existir um ajuste específico por formato, preservá-lo no projeto e no template.

---

# 12. EXPORTAÇÃO DIRETA

O Modo Livre não pode exigir que o usuário salve como template.

O fluxo precisa permitir:

Nova composição → adicionar cenas → editar → exportar MP4.

A exportação deve utilizar o pipeline existente.

Garantir:

- Sequência correta.
- Tempo correto.
- Propriedades independentes.
- Duração calculada.
- Resolução selecionada.
- Assets disponíveis.
- Renderização determinística.

Não duplicar o motor de renderização.

---

# 13. QUALIDADE DE MOTION DESIGN

Este é um requisito central.

As novas cenas devem ser tão boas ou melhores que as cenas do Signature 001.

Não aceitar como resultado final:

- Slides com fade simples.
- Animações repetitivas sem personalidade.
- Movimentos genéricos.
- Gráficos estáticos.
- Textos apenas deslizando.
- Layouts sem hierarquia.
- Cenas que pareçam placeholders.

Utilizar de maneira intencional:

- Kinetic typography.
- Máscaras.
- Transformações 2D e 2.5D.
- Overshoot.
- Stagger.
- Motion blur compatível.
- SVGs animados.
- Geometria procedural.
- Composições com profundidade.
- Transições e efeitos coreografados.

Todas as animações devem ser determinadas pelo frame para garantir fidelidade entre preview e MP4.

Não depender de APIs externas, tokens ou serviços de geração audiovisual.

---

# 14. TESTES DE ACEITAÇÃO

Executar os seguintes cenários:

1. Criar composição livre vazia.
2. Adicionar uma cena existente do Signature 001.
3. Adicionar uma nova cena deste CARTA.
4. Duplicar cenas de tipos diferentes.
5. Reorganizar toda a composição.
6. Alterar textos independentemente.
7. Alterar backgrounds e cores.
8. Testar propriedades exclusivas de cada nova cena.
9. Salvar e reabrir composição livre.
10. Exportar composição livre em MP4.
11. Salvar composição como template.
12. Criar novo projeto a partir do template salvo.
13. Editar o novo projeto sem modificar o template.
14. Reabrir o template após reiniciar o servidor.
15. Exportar nos formatos 9:16 e 16:9.
16. Verificar integridade dos assets.
17. Validar duração e sequência na exportação.
18. Abrir projetos antigos dos CARTAs 001 e 002.
19. Excluir template do usuário sem apagar projetos independentes.
20. Confirmar que as novas cenas aparecem corretamente no registry e na biblioteca.

Criar testes unitários e de integração pertinentes.

Executar ao menos uma renderização real com cenas antigas e novas combinadas.

Verificar frames de início, meio e final de cada novo tipo de cena em ambas as proporções.

---

# 15. LIMITES DO CARTA

Não implementar:

- Geração de cenas por LLM.
- Marketplace.
- Editor de keyframes completo.
- Sistema de colaboração.
- Login ou contas de usuário.
- Renderização em nuvem.
- Editor 3D completo.
- Integrações externas pagas.

Não criar abstrações complexas sem necessidade.

Tudo deve funcionar localmente.

---

# 16. ENTREGÁVEIS

Ao finalizar, o Studio deverá possuir:

- Modo Template preservado.
- Modo Livre funcional.
- Biblioteca global de cenas.
- Todas as cenas originais disponíveis.
- Oito novos tipos de animação.
- Inspector parametrizado para as novas cenas.
- Sistema de criação de templates.
- Biblioteca de templates do usuário.
- Persistência confiável.
- Exportação MP4 de composições livres.
- Compatibilidade com projetos anteriores.
- Documentação atualizada.

Criar ou atualizar a documentação de arquitetura, SDK de cenas e criação de templates.

Explicar como adicionar uma nova cena ao registry no futuro.

Apresentar resumo das funcionalidades implementadas, testes executados e limitações.

**REGRA FINAL: o Studio deve permitir que o usuário crie um vídeo novo combinando cenas existentes, personalize tudo e decida se deseja apenas exportar o vídeo ou transformar aquela composição em um novo template reutilizável.**

Não parar na documentação ou em protótipos. Implementar, integrar e verificar.
