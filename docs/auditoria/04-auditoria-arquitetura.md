# RAYON OS — Auditoria de Arquitetura

---

## Stack tecnológica

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Frontend | React | 18.3.1 |
| Linguagem | TypeScript | 5.5.3 |
| Build tool | Vite | 5.4.2 |
| CSS | Tailwind CSS | 3.4.1 |
| Ícones | lucide-react | 0.446.0 |
| Backend | Supabase (PostgreSQL) | — |
| Roteamento | Hash-based (custom) | — |
| Estado | React hooks (useState, useCallback) | — |

Sem framework de rotas (react-router não instalado). Sem biblioteca de estado global (Redux, Zustand). Sem biblioteca de formulários (React Hook Form). Sem biblioteca de testes.

---

## Estrutura de arquivos

```
src/
├── App.tsx                    # Router hash + renderPage()
├── main.tsx                   # Entry point
├── index.css                  # Tailwind + estilos globais
├── lib/
│   ├── supabase.ts            # Cliente singleton
│   ├── helpers.ts             # logActivity(), generateCode()
│   └── types.ts               # 16 interfaces TypeScript
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx       # Shell com Sidebar + Topbar
│   │   └── Sidebar.tsx        # Navegação + Topbar export
│   └── ui/
│   │   ├── DataTable.tsx      # Tabela genérica com paginação
│   │   ├── Feedback.tsx       # Badge, StatusBadge, Spinner, etc
│   │   ├── Modal.tsx          # Modal reutilizável
│   │   ├── PageHeader.tsx     # PageHeader, Card, FormField
│   │   └── Tabs.tsx           # Sistema de abas
├── pages/
│   ├── DashboardPage.tsx
│   ├── StudentsPage.tsx       # + StudentProfile + StudentFormModal
│   ├── GuardiansPage.tsx      # + LinkStudentModal
│   ├── EnrollmentsPage.tsx
│   ├── CoursesPage.tsx        # + ClassesPage + FormationModal
│   ├── TeachersPage.tsx
│   ├── RoomsPage.tsx
│   ├── SchedulesPage.tsx
│   ├── LessonsPage.tsx
│   ├── AttendancePage.tsx
│   ├── FinancialPage.tsx
│   ├── ReportsPage.tsx
│   ├── UnitsPage.tsx
│   └── SettingsPage.tsx
```

---

## Padrões arquiteturais

### Roteamento

Hash-based sem biblioteca. `App.tsx` gerencia `path` e `search` via `useState` + `window.location.hash`. `renderPage()` faz if-chain para mapear path → componente.

**Avaliação:** Funcional mas frágil. Sem nested routes, sem route params, sem lazy loading. Adicionar uma nova rota exige editar o if-chain.

### Comunicação com banco

Todas as páginas seguem o mesmo padrão:
1. `useCallback` para função `load()` que faz query Supabase
2. `useEffect` no mount para chamar `load()`
3. Estado local: `data`, `loading`, `error`
4. Operações CRUD diretas via `supabase.from(table).insert/update/delete`
5. `logActivity()` após cada operação (silencioso)
6. `alert()` para erros

**Avaliação:** Consistente mas sem camada de serviço. Cada página fala diretamente com o Supabase. Não há repository pattern, não há validação de domínio, não há cache. Mudar a API exigiria editar todas as 14 páginas.

### Tipagem

`src/lib/types.ts` define interfaces para todas as 16 entidades. As páginas definem sub-tipos para joins (ex: `StudentWithRelations`). Os casts são frequentes — especialmente em joins que retornam arrays no Supabase.

**Avaliação:** Tipos existem mas não são gerados do schema. Se o schema mudar, os tipos ficam desatualizados manualmente. Supabase suporta geração automática de tipos via `supabase gen types` mas não é usado.

### Componentes UI

6 componentes reutilizáveis cobrem: tabela, modal, tabs, feedback (badges, loading, empty, error), page header, card. Todos seguem o design system (glassmorphism, dark theme, laranja).

**Avaliação:** Bem estruturado. Componentes são genéricos o suficiente para reuso. Mas não há component de toast/notification, nem de confirm dialog (usa `confirm()` nativo).

---

## Modelagem do PostgreSQL

### 16 tabelas com relacionamentos

```
units ──┬── courses ──┬── classes ──┬── class_students ── students
        │             │             ├── class_teachers ── teachers
        │             │             ├── schedules ── rooms
        │             │             └── lessons ── attendance
        ├── students
        ├── teachers
        ├── rooms
        ├── guardians ── student_guardians ── students
        ├── enrollments (students + courses)
        ├── financial_items
        └── activities (log)
```

### Integridade referencial

- Todas as FKs usam `REFERENCES` com `ON DELETE CASCADE` ou `ON DELETE SET NULL`
- `UNIQUE` constraints em: units.code, students.code, enrollments.code, classes.code, financial_items.code, student_guardians(student_id, guardian_id), class_teachers(class_id, teacher_id), class_students(class_id, student_id), attendance(lesson_id, student_id)
- **Faltam:** UNIQUE em guardians.document_cpf (permite CPF duplicado)

### Constraints CHECK

- **Única existente:** `schedules.weekday CHECK (weekday >= 0 AND weekday <= 6)`
- **Faltam:** CHECK em todos os campos de status (students.status, enrollment.status, class.status, etc.)
- **Faltam:** CHECK em `classes.min_capacity <= classes.max_capacity`
- **Faltam:** CHECK em `financial_items.amount >= 0`
- **Faltam:** CHECK em `schedules.start_time < schedules.end_time`

### Índices

20 índices criados cobrindo FKs e campos de filtro frequentes. Adequado para o volume atual.

---

## N+1 Queries

### Dashboard (`src/pages/DashboardPage.tsx`)
Busca turmas em formação, depois para cada turma faz `count` individual de class_students. Com 10 turmas em formação, são 11 queries.

### Professores (`src/pages/TeachersPage.tsx:39-47`)
`Promise.all` com `count` individual por professor via `class_teachers`. Com 20 professores, são 21 queries.

### Cursos (`src/pages/CoursesPage.tsx`)
Contagem de turmas por curso feita individualmente.

**Solução:** Usar queries com agregação:
```sql
SELECT classes.id, count(class_students.id) as enrolled
FROM classes LEFT JOIN class_students ON class_students.class_id = classes.id
WHERE classes.status = 'em_formacao'
GROUP BY classes.id;
```
Ou criar uma view materializada ou RPC.

---

## Desempenho

- **Bundle:** 468.93 KB JS (118.97 KB gzip) — aceitável para uma SPA
- **CSS:** 27.24 KB (5.51 KB gzip) — otimizado pelo Tailwind purge
- **Sem lazy loading:** Todas as 14 páginas são importadas no App.tsx e incluídas no bundle. Com lazy loading + Suspense, o bundle inicial poderia cair para ~200 KB.
- **Sem paginação no Dashboard:** Carrega todos os registros de múltiplas tabelas para calcular métricas

---

## Manutenabilidade

### Pontos positivos
- Padrão consistente em todas as páginas (load/useEffect/CRUD)
- Componentes UI reutilizáveis
- Tipagem TypeScript presente
- Design system bem definido no Tailwind config

### Pontos negativos
- 50 erros ESLint (imports não utilizados, desestruturações mortas)
- Arquivos grandes: StudentsPage.tsx (824 linhas), CoursesPage.tsx (826 linhas), FinancialPage.tsx (682 linhas)
- Sem separação de responsabilidades: página = UI + lógica + acesso a dados
- Sem camada de serviço: regra de negócio misturada com UI
- `alert()` e `confirm()` nativos em toda a aplicação
- Código em português sem acentos (ex: "Situacao" em vez de "Situação") — por causa de limitações de encoding em algum momento

---

## GitHub e portabilidade

- **Repositório:** https://github.com/bxmcorporation/TestERP
- **Sem git local** no ambiente Bolt — não é possível verificar commits/branches
- **Build reproduzível:** `npm install && npm run build` funciona
- **Sem CI/CD:** Nenhum arquivo de workflow (.github/workflows)
- **Dependências:** 4 pacotes em dependencies + 12 em devDependencies — enxuto

### Portabilidade para outra hospedagem

O app é uma SPA que fala diretamente com Supabase. Para migrar:
1. Exportar schema do Supabase
2. Criar nova instância Postgres
3. Atualizar `.env` com novas credenciais
4. Deploy do build estático em qualquer CDN

Sem dependência de features específicas do Supabase além de RLS e gen_random_uuid().

---

## Escalabilidade

### Preparado para crescer?
- **Volume de dados:** Com poucas centenas de registros por tabela, funciona bem. Com milhares, N+1 queries e carregamento de todos os registros no Dashboard serão problemáticos.
- **Múltiplas unidades:** Sem isolamento por unidade. Adicionar exige mudar políticas RLS e adicionar filtros em todas as queries.
- **Múltiplos usuários:** Sem auth. Adicionar exige redesenhar todo o modelo de segurança.
- **Novos módulos:** Estrutura de páginas permite adicionar facilmente, mas sem lazy loading o bundle cresce.

### Recomendação incremental (sem reestruturação)

1. Adicionar lazy loading nas páginas (React.lazy + Suspense)
2. Extrair camada de serviço (`src/services/`) para encapsular acesso a dados
3. Criar SECURITY DEFINER functions para operações transacionais
4. Adicionar paginação no Dashboard ou mover cálculos para RPC
5. Substituir `alert()`/`confirm()` por componentes de UI
