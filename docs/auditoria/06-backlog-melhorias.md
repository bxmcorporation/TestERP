# RAYON OS — Backlog de Melhorias

Priorizado por impacto, risco e dependências.

---

## P0 — CRÍTICO: segurança, integridade e confiabilidade

### P0-1. Função atômica de geração de códigos

| Aspecto | Detalhe |
|---------|---------|
| **Problema** | `generateCode()` usa `count+1` — condição de corrida gera códigos duplicados |
| **Evidência** | `src/lib/helpers.ts:17-29` — sem transação, sem lock |
| **Solução** | Criar SECURITY DEFINER function `generate_code(p_prefix text, p_table text)` no Postgres que usa `COALESCE(MAX(codigo_num), 0) + 1` atomicamente. Adicionar UNIQUE em code onde falta. |
| **Arquivos afetados** | `src/lib/helpers.ts`, nova migration, todas as páginas que chamam `generateCode()` |
| **Dependências** | Nenhuma |
| **Riscos** | Se códigos existentes já têm duplicatas, UNIQUE constraint falha. Executar query de verificação antes. |
| **Critérios de aceitação** | 1) Códigos gerados nunca se duplicam. 2) Falha graciosa se constraint violada. 3) Funciona sob concorrência. |
| **Testes necessários** | Teste de concorrência (2 inserts simultâneos), teste de sequência após delete |
| **Esforço** | Médio |

### P0-2. Operação transacional de formação de turma

| Aspecto | Detalhe |
|---------|---------|
| **Problema** | `assignStudent()` faz 3 operações separadas sem rollback. `removeStudent()` não reverte status. |
| **Evidência** | `src/pages/CoursesPage.tsx:672-721` — passos 2 e 3 sem verificação de erro |
| **Solução** | Criar SECURITY DEFINER functions: `assign_student_to_class(p_class_id, p_student_id)` e `remove_student_from_class(p_class_id, p_student_id)` que executam todas as operações numa transação |
| **Arquivos afetados** | `src/pages/CoursesPage.tsx`, nova migration |
| **Dependências** | Nenhuma |
| **Riscos** | Função SECURITY DEFINER precisa ser chamável por anon (política apropriada) |
| **Critérios de aceitação** | 1) Se qualquer passo falha, nada é alterado. 2) Capacidade máxima validada no servidor. 3) Status de matrícula e aluno atualizados junto. |
| **Testes necessários** | Teste de falha parcial, teste de capacidade no servidor, teste de remoção com reversão |
| **Esforço** | Médio |

### P0-3. Validação de capacidade no servidor

| Aspecto | Detalhe |
|---------|---------|
| **Problema** | `max_capacity` validado apenas em JavaScript — concorrência permite exceder limite |
| **Evidência** | `src/pages/CoursesPage.tsx:674` — check em `enrolledStudents.length` (estado React) |
| **Solução** | Incluir validação na function `assign_student_to_class`: `IF (SELECT count(*) FROM class_students WHERE class_id = p_class_id) >= (SELECT max_capacity FROM classes WHERE id = p_class_id) THEN RAISE EXCEPTION` |
| **Arquivos afetados** | Mesma migration de P0-2 |
| **Dependências** | P0-2 |
| **Riscos** | Nenhum |
| **Critérios de aceitação** | 1) Impossível ter mais alunos que max_capacity. 2) Erro visível no frontend. |
| **Testes necessários** | Teste de concorrência para última vaga |
| **Esforço** | Baixo (incluído em P0-2) |

### P0-4. Salvar frequência transacionalmente

| Aspecto | Detalhe |
|---------|---------|
| **Problema** | `Promise.all` de inserts/updates — falha parcial deixa alguns registros salvos |
| **Evidência** | `src/pages/AttendancePage.tsx:148-168` |
| **Solução** | Criar SECURITY DEFINER function `save_attendance(p_lesson_id, p_records jsonb)` que faz upsert atômico de todos os registros |
| **Arquivos afetados** | `src/pages/AttendancePage.tsx`, nova migration |
| **Dependências** | Nenhuma |
| **Riscos** | Nenhum |
| **Critérios de aceitação** | 1) Tudo salva ou nada salva. 2) Erro visível se falha. |
| **Testes necessários** | Teste de salvamento parcial, teste de upsert |
| **Esforço** | Médio |

---

## P1 — ESSENCIAL: completar processos existentes

### P1-1. Adicionar política UPDATE na tabela activities

| Aspecto | Detalhe |
|---------|---------|
| **Problema** | 15 tabelas têm 4 políticas; `activities` tem apenas 3 (falta UPDATE) |
| **Evidência** | `supabase/migrations/20261015173446_rayon_os_core_schema.sql:443-449` |
| **Solução** | Migration adicionando `CREATE POLICY "anon_update_activities" ON activities FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)` |
| **Arquivos afetados** | Nova migration |
| **Dependências** | Nenhuma |
| **Riscos** | Nenhum — apenas adiciona política |
| **Critérios de aceitação** | `UPDATE` em `activities` funciona pelo frontend |
| **Esforço** | Baixo |

### P1-2. Corrigir botão "Editar" no perfil do aluno

| Aspecto | Detalhe |
|---------|---------|
| **Problema** | `onClick={() => onNavigate('/students')}` redireciona em vez de abrir modal |
| **Evidência** | `src/pages/StudentsPage.tsx:812` |
| **Solução** | Adicionar callback `onEdit` que abre StudentFormModal em modo edição |
| **Arquivos afetados** | `src/pages/StudentsPage.tsx` |
| **Dependências** | Nenhuma |
| **Riscos** | Nenhum |
| **Critérios de aceitação** | Click em "Editar" abre modal pré-preenchido |
| **Esforço** | Baixo |

### P1-3. Conectar busca global

| Aspecto | Detalhe |
|---------|---------|
| **Problema** | Topbar tem input de busca mas `searchQuery` no AppShell nunca é usado; `handleSearch` no App.tsx nunca é chamado |
| **Evidência** | `src/App.tsx:39-41` (não usado), `src/components/layout/AppShell.tsx:12-16` (não propagado) |
| **Solução** | Topbar.onSearch → AppShell → App.tsx → passar `search` para todas as páginas que suportam busca |
| **Arquivos afetados** | `src/App.tsx`, `src/components/layout/AppShell.tsx`, páginas que aceitam search |
| **Dependências** | Nenhuma |
| **Riscos** | Nenhum |
| **Critérios de aceitação** | Digitar no Topbar filtra resultados na página atual |
| **Esforço** | Médio |

### P1-4. Reverter status ao remover aluno da turma

| Aspecto | Detalhe |
|---------|---------|
| **Problema** | `removeStudent()` não reverte enrollment.status nem student.academic_status |
| **Evidência** | `src/pages/CoursesPage.tsx:706-721` |
| **Solução** | Incluído em P0-2 (function `remove_student_from_class`) |
| **Dependências** | P0-2 |
| **Esforço** | Baixo (incluído em P0-2) |

### P1-5. Substituir alert() por toast notifications

| Aspecto | Detalhe |
|---------|---------|
| **Problema** | Todas as páginas usam `alert()` para erros — inadequado |
| **Evidência** | 14+ ocorrências de `alert()` em todas as páginas |
| **Solução** | Criar componente Toast + contexto, substituir todas as chamadas |
| **Arquivos afetados** | Todas as páginas + novo componente |
| **Dependências** | Nenhuma |
| **Critérios de aceitação** | Erros aparecem como toasts auto-desaparecentes |
| **Esforço** | Médio |

### P1-6. Adicionar Error Boundary

| Aspecto | Detalhe |
|---------|---------|
| **Problema** | Sem Error Boundary — erro em qualquer componente derruba a app |
| **Evidência** | `src/App.tsx` sem ErrorBoundary |
| **Solução** | Criar `<ErrorBoundary>` wrapper no App.tsx |
| **Arquivos afetados** | `src/App.tsx`, novo componente |
| **Esforço** | Baixo |

### P1-7. Corrigir 50 erros ESLint (código morto)

| Aspecto | Detalhe |
|---------|---------|
| **Problema** | 50 imports não utilizados e desestruturações mortas |
| **Evidência** | `npm run lint` — 50 erros `no-unused-vars` |
| **Solução** | Remover imports não utilizados, ajustar desestruturações |
| **Arquivos afetados** | 12 arquivos |
| **Esforço** | Baixo |

### P1-8. CHECK constraints no banco

| Aspecto | Detalhe |
|---------|---------|
| **Problema** | Campos de status aceitam qualquer string; sem validação de min/max capacity |
| **Evidência** | Schema sem CHECK em status fields |
| **Solução** | Migration adicionando CHECK constraints: status fields, min <= max capacity, amount >= 0, start_time < end_time |
| **Dependências** | Verificar se dados existentes violam constraints |
| **Riscos** | Se dados existentes violam, constraint falha — executar query de verificação primeiro |
| **Esforço** | Médio |

---

## P2 — EVOLUÇÃO: funcionalidades novas de maior valor

### P2-1. Progresso acadêmico do aluno

| Aspecto | Detalhe |
|---------|---------|
| **Necessidade** | Aba "Progresso" no perfil é placeholder vazio |
| **Solução** | Criar tabelas `student_activities` e `evaluations`, implementar tracking de notas e entregas |
| **Arquivos afetados** | Nova migration, `src/pages/StudentsPage.tsx`, nova página de gestão |
| **Dependências** | Tabelas de aulas e frequência já existem |
| **Esforço** | Alto |

### P2-2. Materiais didáticos

| Aspecto | Detalhe |
|---------|---------|
| **Necessidade** | Mencionado no schema mas nunca criado |
| **Solução** | Criar tabela `materials`, página de gestão, vincular a cursos/turmas/aulas |
| **Esforço** | Médio |

### P2-3. Relatórios detalhados funcionais

| Aspecto | Detalhe |
|---------|---------|
| **Necessidade** | 6 cards de relatório sem navegação |
| **Solução** | Implementar páginas de relatório: desempenho, frequência, financeiro, matrículas, turmas, alunos |
| **Esforço** | Alto |

### P2-4. Página de auditoria completa

| Aspecto | Detalhe |
|---------|---------|
| **Necessidade** | Activities aparecem no Dashboard mas sem página dedicada com filtros |
| **Solução** | Criar página /audit com lista paginada, filtros por tipo/data |
| **Esforço** | Médio |

---

## P3 — FUTURO: melhorias avançadas

### P3-1. Autenticação e multi-usuário

| Aspecto | Detalhe |
|---------|---------|
| **Necessidade** | Sem auth, sem isolamento, sem trilha de usuário |
| **Solução** | Supabase email/password, mudar 64 políticas RLS para `TO authenticated`, adicionar `user_id` |
| **Dependências** | Requer aprovação — muda modelo de segurança inteiro |
| **Esforço** | Alto |

### P3-2. Isolamento entre unidades

| Aspecto | Detalhe |
|---------|---------|
| **Solução** | Adicionar filtro por `unit_id` em políticas RLS, middleware no frontend |
| **Dependências** | P3-1 (auth) |
| **Esforço** | Alto |

### P3-3. Lazy loading de páginas

| Aspecto | Detalhe |
|---------|---------|
| **Solução** | `React.lazy()` + `Suspense` para reduzir bundle inicial |
| **Esforço** | Baixo |

### P3-4. Otimização de queries (N+1)

| Aspecto | Detalhe |
|---------|---------|
| **Solução** | Substituir N+1 por queries com agregação ou RPC |
| **Esforço** | Médio |

### P3-5. Testes automatizados

| Aspecto | Detalhe |
|---------|---------|
| **Solução** | Vitest para unit tests, React Testing Library para componentes, Playwright para E2E |
| **Esforço** | Alto |

### P3-6. Portais de alunos e responsáveis

| Aspecto | Detalhe |
|---------|---------|
| **Solução** | Interfaces separadas com permissões limitadas |
| **Dependências** | P3-1 (auth) |
| **Esforço** | Alto |

### P3-7. Integrações com APIs externas

| Aspecto | Detalhe |
|---------|---------|
| **Solução** | Edge functions para webhooks e integrações |
| **Esforço** | Variável |
