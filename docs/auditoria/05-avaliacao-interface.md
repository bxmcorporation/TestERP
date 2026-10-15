# RAYON OS — Avaliação da Interface

O Design System oficial da RAYON já está aplicado e é preservado. Esta avaliação foca em melhorias incrementais de qualidade.

---

## Identidade visual atual

| Elemento | Valor | Avaliação |
|----------|-------|-----------|
| Fundo | `#050505` (surface-base) | Excelente — escuro sofisticado |
| Acento | `#F97316` (rayon-orange) | Consistente em toda a app |
| Fonte display | Montserrat | Usada em títulos e números de destaque |
| Fonte body | Manrope | Usada em textos e formulários |
| Glassmorphism | `rgba(255,255,255,0.03-0.16)` | Aplicado em cards e superfícies |
| Bordas | `border-edge` (rgba sutil) | Discreto e elegante |
| Sidebar | 264px fixa, colapsável no mobile | Boa organização em 5 seções |

---

## Legibilidade e contraste

| Elemento | Cor | Contraste com fundo | Avaliação |
|----------|-----|---------------------|-----------|
| Texto principal | `text-white/90` | Alto | Bom |
| Texto secundário | `text-white/60` | Médio | Aceitável |
| Texto terciário | `text-white/40` | Baixo | Limite — usar apenas em metadados |
| Texto disabled | `text-white/30` | Muito baixo | Difícil de ler — considerar /40 mínimo |
| Labels de menu | `text-white/50` | Médio | Aceitável |
| Code/mono | `text-white/40` | Baixo | Aceitável para códigos |
| Laranja em fundo escuro | `#F97316` | Alto | Excelente |
| Verde (success) | `text-green-400` | Alto | Bom |
| Vermelho (error) | `text-red-400` | Alto | Bom |

**Problema:** `text-white/30` em alguns lugares (timestamps, códigos) é difícil de ler em telas com brilho reduzido.

---

## Hierarquia visual

A hierarquia está bem estabelecida:
1. **PageHeader** — título da página + descrição + ações
2. **Cards** — agrupam conteúdo relacionado
3. **SectionTitle** — subtítulos dentro de cards
4. **DataTable** — listas com colunas nomeadas
5. **StatusBadge** — badges coloridos para status

**Melhoria sugerida:** O Dashboard mistura muitas informações (9 métricas + atividades + aulas + turmas + matrículas) sem uma hierarquia clara do que é mais importante. Considerar agrupar em seções com títulos.

---

## Organização dos menus

A sidebar tem 5 seções colapsáveis:
- Visão Geral (Dashboard)
- Gestão Acadêmica (Alunos, Responsáveis, Matrículas, Cursos, Turmas, Professores, Salas, Horários)
- Ensino (Aulas, Frequência)
- Administração (Financeiro, Relatórios)
- Sistema (Unidades, Configurações)

**Avaliação:** Boa organização. 8 itens em "Gestão Acadêmica" é denso mas justificado pela natureza do ERP.

**Melhoria sugerida:** Adicionar badges de contador nos itens (ex: "Matrículas (3)" mostrando aguardando_turma). Útil para operação diária.

---

## Consistência de componentes

| Componente | Consistente? | Observação |
|------------|-------------|------------|
| PageHeader | SIM | Usado em todas as 14 páginas |
| Card | SIM | Estrutura e padding consistentes |
| DataTable | SIM | Mesma estrutura em todas as listas |
| Modal | SIM | 4 tamanhos, mesmo comportamento |
| StatusBadge | SIM | Mapeia status para cores consistentes |
| Tabs | SIM | Indicador underline, ícones |
| FormField | SIM | Label + required + hint |
| LoadingState | SIM | Spinner + mensagem |
| EmptyState | SIM | Ícone + título + descrição + ação |
| ErrorState | SIM | Mensagem + botão retry |

**Avaliação:** Excelente consistência. Todos os componentes seguem o mesmo padrão visual.

---

## Responsividade

| Breakpoint | Comportamento | Avaliação |
|------------|--------------|-----------|
| Desktop (lg+) | Sidebar fixa, conteúdo com max-w-7xl | Bom |
| Tablet (md) | Sidebar oculta, hamburger menu | Funcional |
| Mobile (sm) | Layout em coluna única | Funcional |

**Problemas identificados:**
1. **Frequência:** Grid de 4 colunas de stats (`grid-cols-4`) não é responsivo — em mobile fica espremido
2. **Formulários:** Alguns modais têm muitos campos empilhados sem seções visuais
3. **DataTable:** Em telas pequenas, colunas podem estourar — sem scroll horizontal ou colunas ocultas
4. **Dashboard:** Grid de 9 métricas em `grid-cols-2 md:grid-cols-3` — adequado

---

## Estados vazios

Todas as páginas têm `EmptyState` com ícone, título, descrição e às vezes botão de ação. Bom.

**Melhoria:** Alguns estados vazios poderiam ter ilustrações ou dicas mais específicas (ex: "Cadastre um curso primeiro para poder criar matrículas").

---

## Formulários

| Aspecto | Avaliação |
|---------|-----------|
| Validação | Parcial — campos required têm indicador visual mas sem validação JS |
| Feedback | `alert()` para erros — inadequado |
| Layout | Campos empilhados, sem seções em formulários longos |
| Selects | Usam `input-base` — consistentes |
| Date pickers | Input type="date" nativo — funcional |
| Toggle/checkbox | Apenas para booleanos (is_primary, is_financial) |

**Melhorias sugeridas:**
1. Validação de campos antes de salvar (email válido, CPF válido, datas coerentes)
2. Seções visuais em formulários longos (ex: "Dados Pessoais", "Dados Acadêmicos", "Observações")
3. Substituir `alert()` por toast notifications
4. Substituir `confirm()` por dialog modal customizado

---

## Navegação e operações diárias

| Operação | Facilidade | Observação |
|----------|-----------|------------|
| Cadastrar aluno | Boa | Botão "Novo Aluno" visível, modal claro |
| Buscar aluno | Razoável | Busca por nome/código funciona na página, mas busca global do Topbar não funciona |
| Ver perfil do aluno | Boa | Click na linha abre perfil com 8 abas |
| Editar aluno | Problemática | Botão "Editar" no perfil redireciona para lista em vez de abrir modal |
| Matricular aluno | Boa | Fluxo claro: criar matrícula → status aguardando_turma → associar na turma |
| Formar turma | Razoável | Modal de formação funciona mas sem feedback de erro transacional |
| Registrar frequência | Boa | Seletor de aula → lista de alunos → 4 status → salvar |
| Ver dashboard | Boa | Métricas em cards, visualmente rico |

---

## Melhorias de interface recomendadas (sem reconstruir design)

### Prioridade alta
1. **Corrigir busca global** — Topbar não filtra nada; conectar a páginas
2. **Corrigir botão "Editar" no perfil** — abrir modal em vez de redirecionar
3. **Toast notifications** — substituir todos os `alert()` por toasts
4. **Confirm dialog customizado** — substituir `confirm()` nativo

### Prioridade média
5. **Badges de contador na sidebar** — mostrar números em Matrículas, Turmas
6. **Grid responsivo na Frequência** — `grid-cols-2 sm:grid-cols-4` em vez de `grid-cols-4`
7. **Seções em formulários longos** — dividir StudentFormModal em seções visuais
8. **Lazy loading de páginas** — reduzir bundle inicial

### Prioridade baixa
9. **Skeleton loading** — substituir spinners por skeletons em tabelas
10. **Breadcrumbs** — mostrar caminho atual (Dashboard > Alunos > Perfil)
11. **Atalhos de teclado** — ESC para fechar modais (já existe), Ctrl+K para busca
12. **Scroll horizontal em DataTable no mobile** — ou colunas ocultas
