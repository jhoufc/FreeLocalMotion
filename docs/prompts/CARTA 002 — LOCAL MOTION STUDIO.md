# CARTA / 002 — LOCAL MOTION STUDIO
## Dynamic Scene Composer — Duplicação, Reordenação e Composição Livre

### PAPEL

Atue como Principal Software Engineer especializado em React, TypeScript, Remotion, arquitetura de editores audiovisuais e sistemas de animação baseados em timelines.

Sua missão é evoluir o Local Motion Studio existente para permitir que o usuário construa vídeos livremente a partir das cenas de um template.

**Não recriar o projeto. Não substituir o editor existente. Não reconstruir o primeiro template.**

Inspecione a implementação atual e evolua sua arquitetura preservando as funcionalidades já construídas.

---

## 1. PROBLEMA ATUAL

O template Signature 001 possui cenas com configurações próprias e uma sequência predefinida.

O usuário consegue personalizar propriedades, mas está limitado à quantidade e à ordem original das cenas.

Isso impede:

- Repetir uma animação dentro do mesmo vídeo.
- Criar vídeos mais longos.
- Alterar a narrativa.
- Reorganizar a sequência.
- Reutilizar uma cena com textos diferentes.
- Criar composições personalizadas usando os mesmos elementos visuais.

Precisamos eliminar essa limitação.

---

## 2. OBJETIVO

Transformar a sequência fixa do template em uma lista dinâmica de instâncias de cenas.

Cada cena original será tratada como um tipo reutilizável.

Por exemplo:

`Impact` é um tipo de cena.

O usuário pode inserir:

- Impact #1
- Energy #1
- Impact #2
- Animate #1
- Impact #3
- Signature #1

Cada instância possui seus próprios textos, cores, backgrounds, parâmetros e duração permitida.

Editar Impact #2 não pode modificar Impact #1.

A animação base deve continuar sendo compartilhada pelo tipo de cena.

---

## 3. ARQUITETURA — SCENE DEFINITION VS SCENE INSTANCE

Separar claramente duas responsabilidades.

### Scene Definition

Representa o tipo de animação disponibilizado por um template.

Contém:

- Identificador do tipo.
- Nome.
- Componente React/Remotion.
- Schema das propriedades.
- Valores padrão.
- Duração padrão.
- Duração mínima e máxima suportadas.
- Metadados de campos editáveis.
- Configuração de layout por proporção.
- Recursos e animações disponíveis.

### Scene Instance

Representa uma ocorrência concreta daquela animação em um projeto.

Exemplo conceitual:

```ts
interface SceneInstance {
  id: string;
  sceneTypeId: string;
  name: string;
  durationFrames: number;
  enabled: boolean;
  props: Record<string, unknown>;
}
```

Adaptar aos tipos reais do projeto e usar schemas específicos e validados.

Uma cena duplicada deve receber:

- Novo ID exclusivo.
- Cópia profunda das propriedades editáveis.
- A mesma referência ao tipo de animação.
- Mesma duração inicialmente.
- Novo posicionamento na sequência.

Nenhum estado editável pode permanecer acidentalmente compartilhado entre instâncias.

A ordem deve ser definida pela lista do projeto, não por uma posição fixa declarada dentro do template.

---

## 4. FUNCIONALIDADES OBRIGATÓRIAS

### A. Duplicar cena

Adicionar a ação "Duplicar cena" no menu contextual de cada cena.

Ao duplicar:

1. Criar uma nova instância.
2. Copiar propriedades da original.
3. Inserir imediatamente após a original.
4. Atualizar a duração total.
5. Atualizar timeline e preview.
6. Selecionar a nova cena.

Permitir duplicar quantas vezes desejar, respeitando apenas limites técnicos razoáveis.

### B. Adicionar cena

Criar um botão "+ Adicionar cena".

Ao clicar, apresentar as cenas disponíveis do template atual.

O usuário poderá escolher, por exemplo:

- Impact
- Energy
- Create
- Animate
- Inspire
- Signature

Apresentar nome, descrição e, quando viável, miniatura de preview.

Ao selecionar um tipo, criar uma nova instância com propriedades padrão.

### C. Reordenar cenas

Permitir drag-and-drop para reorganizar cenas na timeline ou no painel de cenas.

Adicionar também ações:

- Mover para cima.
- Mover para baixo.

Ao reorganizar:

- Recalcular os offsets temporais.
- Preservar dados das cenas.
- Atualizar o player.
- Preservar a seleção.
- Evitar inconsistências no playhead.

A sequência visual exportada deve corresponder à ordem definida pelo usuário.

### D. Excluir cena

Permitir remover qualquer instância.

Solicitar confirmação apenas quando fizer sentido para evitar perda acidental de trabalho.

Não excluir a Scene Definition.

Não remover o tipo do catálogo.

### E. Renomear cena

Permitir nomes personalizados:

- Abertura
- Demonstração
- Benefício principal
- Encerramento

O nome personalizado deve aparecer no painel e na timeline.

### F. Editar duração

Permitir alterar a duração de uma instância dentro dos limites suportados por seu tipo.

Não acelerar ou desacelerar indiscriminadamente a animação inteira.

Implementar uma estratégia explícita para adaptar o timing:

- Trechos de entrada.
- Trecho de sustentação.
- Trechos de saída.
- Parâmetros de duração configuráveis.

Preservar a integridade das animações.

Se determinada cena ainda não suportar duração variável com qualidade, manter sua duração fixa e informar isso na interface.

---

## 5. TIMELINE DINÂMICA

A timeline não pode mais depender de timestamps fixos das cenas originais.

Os tempos devem ser calculados automaticamente:

```ts
startFrame(scene[0]) = 0;

startFrame(scene[n]) =
  sum(durationFrames das cenas anteriores);
```

A duração total do projeto deve refletir a soma de todas as instâncias habilitadas.

Implementar funções puras para:

- Calcular offsets.
- Determinar cena ativa.
- Localizar uma cena pelo ID.
- Converter tempo global para frame local.
- Atualizar duração total.
- Reordenar instâncias.

O cálculo precisa ser consistente entre editor, preview, persistência e renderização.

Cenas desabilitadas, se suportadas, não devem acrescentar frames à duração exportada.

---

## 6. INTEGRAÇÃO COM REMOTION

Remover qualquer lógica que pressuponha uma sequência fixa do Signature 001.

Renderizar dinamicamente as cenas do projeto, usando os tipos registrados.

Usar `Sequence` ou abstração equivalente para posicionar cada instância no tempo.

Cada componente de cena deverá receber:

- Propriedades da instância.
- Duração efetiva.
- Layout ativo.
- Configuração visual aplicável.

As animações devem trabalhar com tempo local da instância, de forma que a cena funcione independentemente da sua posição na timeline.

**Duplicar uma cena nunca deve fazer a animação começar pela metade por depender do frame global do vídeo.**

Preservar determinismo e compatibilidade com exportação MP4.

---

## 7. INSPECTOR CONTEXTUAL

Ao selecionar uma instância, o painel direito deve apresentar suas configurações.

A edição deve ser independente para cada ocorrência.

Exemplo:

Impact #1:
- Texto: MOTION GRAPHICS
- Fundo: Preto
- Destaque: Verde

Impact #2:
- Texto: 100% LOCAL
- Fundo: Azul escuro
- Destaque: Branco

Ambas usam a mesma animação, mas com dados próprios.

O inspector deve continuar utilizando os metadados e schemas já existentes.

Não duplicar código de formulários por instância.

---

## 8. UNDO E REDO

Adicionar suporte às operações estruturais:

- Adicionar cena.
- Duplicar cena.
- Excluir cena.
- Mover cena.
- Renomear cena.
- Alterar duração.

Implementar histórico consistente, com Undo/Redo.

Atalhos recomendados:

- Ctrl+Z: desfazer.
- Ctrl+Shift+Z: refazer.
- Ctrl+D: duplicar cena selecionada, quando o foco não estiver em um campo de texto.
- Delete: excluir cena selecionada, respeitando o foco.

Evitar capturar atalhos quando o usuário estiver digitando em inputs.

---

## 9. PERSISTÊNCIA E COMPATIBILIDADE

Atualizar o formato do projeto para suportar instâncias dinâmicas.

Projetos anteriores precisam continuar funcionando.

Criar migração para converter a lista fixa de cenas para o novo modelo de instâncias.

Preservar:

- Textos.
- Backgrounds.
- Cores.
- Durações.
- Configurações.
- Identidade do template.

Não sobrescrever ou descartar projetos existentes.

Implementar versionamento do schema e testes de migração.

---

## 10. EXPORTAÇÃO MP4

A renderização final deve respeitar integralmente:

- Quantidade de cenas.
- Ordem.
- Conteúdo personalizado.
- Duração.
- Layout.
- Propriedades visuais.

A composição não pode continuar limitada à duração original do template.

Calcular os metadados da composição a partir do projeto antes de iniciar o render.

O preview e o MP4 devem consumir a mesma sequência normalizada.

Testar exportações com cenas repetidas em posições diferentes.

---

## 11. EXPERIÊNCIA VISUAL

Manter a estética profissional do editor.

Na lista de cenas, oferecer:

- Nome da cena.
- Indicador do tipo.
- Duração.
- Miniatura, quando disponível.
- Menu de ações.
- Indicação de seleção.
- Drag handle.

Adicionar botão "+ Cena" ao fim da lista e, se viável, entre as cenas.

Operações devem refletir imediatamente no editor.

O usuário não deve precisar atualizar a página para enxergar alterações.

---

## 12. TESTES DE ACEITAÇÃO

Validar pelo menos os seguintes cenários:

1. Duplicar uma cena e modificar somente a cópia.
2. Duplicar a mesma cena três vezes.
3. Adicionar uma cena no final do vídeo.
4. Mover a última cena para a primeira posição.
5. Excluir uma cena intermediária.
6. Reordenar cenas e validar offsets.
7. Alterar duração de uma cena compatível.
8. Salvar e reabrir um projeto com cenas duplicadas.
9. Migrar um projeto antigo.
10. Executar Undo/Redo.
11. Renderizar MP4 com cenas repetidas.
12. Validar duração total do MP4.
13. Validar o resultado vertical e horizontal.
14. Verificar que nenhuma cena duplicada herda indevidamente o estado de outra.
15. Confirmar que o template original permanece disponível.

Executar testes reais sempre que o ambiente permitir.

Não declarar exportação funcional sem verificar o arquivo produzido.

---

## 13. ESCOPO E LIMITES

Este CARTA não precisa implementar:

- Editor de keyframes completo.
- Transições arbitrárias entre quaisquer cenas.
- Trilhas múltiplas de áudio e vídeo.
- Composição aninhada.
- Editor de curvas Bezier.
- Marketplace de templates.
- Recursos de IA.

Foco total na composição dinâmica e confiável de cenas existentes.

Preparar contratos extensíveis, mas não implementar funcionalidades futuras apenas por especulação.

---

## 14. RESULTADO ESPERADO

Ao concluir, o Local Motion Studio deve permitir criar diferentes vídeos utilizando as mesmas animações originais.

O usuário poderá:

1. Abrir o Signature 001.
2. Duplicar a cena Impact.
3. Trocar o texto da duplicata.
4. Inserir outra cena Energy.
5. Reorganizar tudo.
6. Excluir cenas indesejadas.
7. Alterar configurações individuais.
8. Salvar o projeto.
9. Renderizar o MP4 completo.

O resultado deve ser uma evolução real do editor existente, preservando a qualidade visual do primeiro template.

**Princípio principal: uma animação é reutilizável; cada ocorrência dela é independente.**

Inspecione a base existente, implemente a evolução, execute os testes e apresente o resultado.
