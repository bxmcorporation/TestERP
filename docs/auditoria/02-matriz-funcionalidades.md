# RAYON OS — Matriz de Funcionalidades

**Legenda:** IMPLEMENTADO | PARCIAL | SOMENTE VISUAL | NÃO IMPLEMENTADO | NÃO VERIFICADO

---

## Gestão Administrativa

| Funcionalidade | Estado | Evidência | Arquivo |
|---------------|--------|-----------|---------|
| Dashboard | PARCIAL | 14 métricas em paralelo, turmas em formação, atividades recentes. N+1 query para ocupação de turmas. | `src/pages/DashboardPage.tsx` |
| Unidades | IMPLEMENTADO | CRUD completo com nome, código, endereço, cidade, estado, telefone, email. Bloqueia exclusão se vinculado. | `src/pages/UnitsPage.tsx` |
| Configurações | PARCIAL | Mostra info do sistema e contagens de tabelas. Sem configurações editáveis além de exibição. | `src/pages/SettingsPage.tsx` |
| Usuários | NÃO IMPLEMENTADO | Sem tela de usuários, sem auth, sem gestão de contas. | — |
| Permissões | NÃO IMPLEMENTADO | Sem sistema de papéis ou permissões. | — |
| Auditoria | PARCIAL | Tabela `activities` registra ações (criar, editar, excluir) via `logActivity()`. Sem identificação de usuário. Sem tela para visualizar log completo. | `src/lib/helpers.ts:3-15` |
| Relatórios | PARCIAL | Métricas resumidas (financeiro, turmas, matrículas). 6 cards de tipos de relatório sem navegação funcional. | `src/pages/ReportsPage.tsx` |

## Gestão Educacional

| Funcionalidade | Estado | Evidência | Arquivo |
|---------------|--------|-----------|---------|
| Alunos — CRUD | IMPLEMENTADO | Criar, listar, buscar, filtrar, editar, excluir. Código ALU automático. Campos: nome, nascimento, email, telefone, curso, unidade, observações. | `src/pages/StudentsPage.tsx` |
| Alunos — Perfil | PARCIAL | 8 abas: visão geral (ok), responsáveis (ok), matrículas (ok), turmas (ok), frequência (ok), progresso (placeholder vazio), financeiro (ok), histórico (ok). Botão "Editar" redireciona em vez de abrir modal. | `src/pages/StudentsPage.tsx:800-823` |
| Responsáveis — CRUD | IMPLEMENTADO | Criar, listar, buscar, editar, excluir. CPF, tipo de relacionamento, responsável financeiro. Modal para vincular a alunos. | `src/pages/GuardiansPage.tsx` |
| Vínculo aluno-responsável | IMPLEMENTADO | Tabela `student_guardians` com many-to-many, tipo de relação, flag primário, flag financeiro. Modal filtra alunos já vinculados. | `src/pages/GuardiansPage.tsx` |
| Matrículas | IMPLEMENTADO | CRUD com 6 status (pendente, aguardando_turma, ativa, suspensa, cancelada, concluida). Dropdown inline. Card destacado para aguardando_turma. | `src/pages/EnrollmentsPage.tsx` |
| Cursos | IMPLEMENTADO | CRUD com nome, descrição, duração, modalidade, status. Contagem de turmas (N+1). | `src/pages/CoursesPage.tsx` |
| Turmas — CRUD | IMPLEMENTADO | Criar, listar, editar, excluir. Capacidade min/max, curso, unidade, sala. Barras de ocupação. | `src/pages/CoursesPage.tsx` |
| Formação de turmas | PARCIAL | Modal mostra alunos aguardando e matriculados. Permite associar e remover. Confirma quando mínimo atingido. **Não transacional**: assignStudent faz 3 operações sem rollback. removeStudent não reverte status. Capacidade validada só no frontend. | `src/pages/CoursesPage.tsx:672-825` |
| Professores | IMPLEMENTADO | CRUD com especialidade, disponibilidade (JSONB), unidade, status. Contagem de turmas. Bloqueia exclusão se vinculado. | `src/pages/TeachersPage.tsx` |
| Salas | IMPLEMENTADO | CRUD com nome, código, capacidade, unidade, status. | `src/pages/RoomsPage.tsx` |
| Horários | IMPLEMENTADO | Grade semanal + lista. Detecção de conflito de professor e sala com confirmação opcional. | `src/pages/SchedulesPage.tsx` |
| Aulas | IMPLEMENTADO | CRUD com título, data, horário, objetivo, conteúdo, observações. Abas (próximas, passadas, todas). Log de atividade. | `src/pages/LessonsPage.tsx` |
| Frequência | PARCIAL | Seletor de aula → lista alunos com 4 status (presente, ausente, justificado, pendente). Salvamento em lote via Promise.all (não transacional). Estatísticas e histórico. | `src/pages/AttendancePage.tsx` |

## Gestão Complementar

| Funcionalidade | Estado | Evidência | Arquivo |
|---------------|--------|-----------|---------|
| Financeiro | IMPLEMENTADO | Dashboard (receita, despesa, em aberto, vencido, saldo). CRUD com tipo, categoria, valor, vencimento, pagamento. BRL. Status inline. Marcar como pago. | `src/pages/FinancialPage.tsx` |
| Contratos | NÃO IMPLEMENTADO | — | — |
| Materiais didáticos | NÃO IMPLEMENTADO | Tabela `materials` mencionada no schema mas nunca criada. | — |
| Atividades pedagógicas | NÃO IMPLEMENTADO | Tabela `student_activities` mencionada no schema mas nunca criada. | — |
| Avaliações | NÃO IMPLEMENTADO | — | — |
| Progresso acadêmico | SOMENTE VISUAL | Aba "Progresso" no perfil do aluno mostra EmptyState genérico. | `src/pages/StudentsPage.tsx` |
| Comunicação | NÃO IMPLEMENTADO | — | — |
| Portais de alunos/responsáveis | NÃO IMPLEMENTADO | — | — |

---

## Resumo quantitativo

| Estado | Quantidade |
|--------|-----------|
| IMPLEMENTADO | 13 |
| PARCIAL | 7 |
| SOMENTE VISUAL | 1 |
| NÃO IMPLEMENTADO | 8 |
| **Total** | **29** |
