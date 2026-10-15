# RAYON OS — Relatório de Testes

---

## Verificações executadas

### 1. Verificações estáticas

| Verificação | Comando | Resultado | Data |
|-------------|---------|-----------|------|
| TypeScript | `tsc --noEmit -p tsconfig.app.json` | PASSA — 0 erros | 15/10/2026 |
| ESLint | `eslint .` | 50 erros, 1 warning (todos `no-unused-vars`) | 15/10/2026 |
| Build | `vite build` | PASSA — 468.93 KB JS, 27.24 KB CSS | 15/10/2026 |

### 2. Verificações de banco de dados

| Verificação | Ferramenta | Resultado |
|-------------|-----------|-----------|
| RLS habilitado | `get_security_posture` | 16/16 tabelas |
| Políticas presentes | `get_security_posture` | 63 políticas (15 tabelas com 4, activities com 3) |
| Security Advisor | `get_advisors(type=security)` | 0 alertas |
| Constraints | Análise do schema SQL | 1 CHECK (schedules.weekday), faltam CHECKs em status fields |
| Índices | Análise do schema SQL | 20 índices criados |
| FKs | Análise do schema SQL | Todas com ON DELETE CASCADE ou SET NULL |

### 3. Verificação de jornadas

As jornadas abaixo foram avaliadas por **análise de código estático** (leitura do código-fonte), não por execução em ambiente. Não foi possível executar as jornadas no ambiente publicado porque não há ferramenta de browser/screenshot disponível neste ambiente.

#### Jornada 1 — Aluno e responsável

| Passo | Estado | Evidência |
|-------|--------|-----------|
| Cadastrar responsável | VERIFICADO POR CÓDIGO | `GuardiansPage.tsx` tem form completo com CPF, relacionamento, responsável financeiro |
| Cadastrar aluno | VERIFICADO POR CÓDIGO | `StudentsPage.tsx` tem form com nome, nascimento, email, telefone, curso, unidade |
| Vincular aluno a responsável | VERIFICADO POR CÓDIGO | `LinkStudentModal` em GuardiansPage filtra já vinculados, insere em `student_guardians` |
| Consultar | VERIFICADO POR CÓDIGO | Lista carrega via `supabase.from('students').select('*, student_guardians(*, guardian:guardians(*))')` |
| Editar | VERIFICADO POR CÓDIGO | `handleSave()` faz update via `.update({...}).eq('id', id)` |
| Persistência | VERIFICADO POR CÓDIGO | Dados são persistidos no Supabase — `load()` busca via select |

**Conclusão:** Jornada funcional por análise de código. Sem validação runtime.

#### Jornada 2 — Matrícula

| Passo | Estado | Evidência |
|-------|--------|-----------|
| Criar matrícula sem turma | VERIFICADO POR CÓDIGO | `EnrollmentsPage.tsx` cria matrícula com status `pendente` |
| Colocar em espera | VERIFICADO POR CÓDIGO | Status pode ser mudado para `aguardando_turma` via dropdown inline |
| Consultar status | VERIFICADO POR CÓDIGO | Lista mostra status via `StatusBadge` |
| Criar turma | VERIFICADO POR CÓDIGO | `ClassesPage` cria turma com capacidade, curso, unidade |
| Associar aluno | VERIFICADO POR CÓDIGO | `FormationModal` mostra alunos aguardando e permite associar |

**Conclusão:** Jornada funcional por análise de código. Risco: associação não transacional (P0-2).

#### Jornada 3 — Formação de turma

| Passo | Estado | Evidência |
|-------|--------|-----------|
| Criar turma com limite | VERIFICADO POR CÓDIGO | `min_capacity` e `max_capacity` no form |
| Associar alunos | VERIFICADO POR CÓDIGO | `assignStudent()` insere em `class_students` |
| Verificar ocupação | VERIFICADO POR CÓDIGO | Barra de ocupação mostra enrolled/max |
| Testar limite máximo | PROBLEMA IDENTIFICADO | Validação apenas no frontend — concorrência pode exceder (P0-3) |
| Confirmar turma | VERIFICADO POR CÓDIGO | Botão habilitado quando `enrolledStudents.length >= min_capacity` |

**Conclusão:** Jornada funciona em uso normal. Falha sob concorrência.

#### Jornada 4 — Acadêmico

| Passo | Estado | Evidência |
|-------|--------|-----------|
| Criar professor | VERIFICADO POR CÓDIGO | `TeachersPage.tsx` com especialidade, disponibilidade |
| Criar aula | VERIFICADO POR CÓDIGO | `LessonsPage.tsx` com título, data, horário, objetivo |
| Registrar frequência | VERIFICADO POR CÓDIGO | `AttendancePage.tsx` seletor → lista → 4 status → salvar |
| Consultar histórico | VERIFICADO POR CÓDIGO | Aba de histórico carrega últimas 10 aulas com frequência |

**Conclusão:** Jornada funcional. Risco: salvamento não transacional (P0-4).

#### Jornada 5 — Consistência

| Cenário | Estado | Evidência |
|---------|--------|-----------|
| Dados inválidos em status | PROBLEMA | Sem CHECK constraints — aceita qualquer string em status |
| Registros duplicados | PARCIAL | UNIQUE em code em 5 tabelas, mas generateCode pode colidir |
| Operações parcialmente concluídas | PROBLEMA | assignStudent e saveAttendance não transacionais |
| CPF duplicado | PROBLEMA | Sem UNIQUE em guardians.document_cpf |
| Capacidade excedida | PROBLEMA | Sem validação no servidor |

#### Jornada 6 — Segurança

| Verificação | Estado | Evidência |
|-------------|--------|-----------|
| Acesso anônimo negado | NÃO — por design | Todas as políticas permitem anon com USING(true) |
| Isolamento entre unidades | NÃO | Sem filtro por unit_id em políticas |
| Permissões por papel | NÃO | Sem sistema de papéis |
| Consulta direta à API | PERMITIDO | anon key permite todas as operações CRUD |

**Conclusão:** Segurança é intencionalmente aberta para demo. Não há isolamento nem restrição.

---

## Limitações desta auditoria

1. **Sem execução runtime** — Não foi possível executar as jornadas no browser. Todas as conclusões são baseadas em leitura de código estático.
2. **Sem acesso ao ambiente publicado** — Não foi possível verificar a app em https://rayon-os-educational-o017.bolt.host/
3. **Sem git** — Não foi possível verificar commits, branches ou histórico de mudanças
4. **Sem testes automatizados** — Não existem testes para executar
5. **Dados demo** — Não foi possível verificar quais dados demo existem no banco (apenas estrutura foi verificada via `get_security_posture`)

---

## Testes recomendados para próximas fases

### Unit tests (Vitest)
- `generateCode()` — sequência, concorrência, fallback
- `logActivity()` — sucesso, falha silenciosa
- Componentes UI — renderização, props, callbacks

### Integration tests (Vitest + Supabase local)
- CRUD de todas as 16 tabelas
- Formação de turma (assign + remove + confirm)
- Salvamento de frequência
- Geração de códigos

### E2E tests (Playwright)
- Jornada 1: Aluno e responsável
- Jornada 2: Matrícula
- Jornada 3: Formação de turma
- Jornada 4: Acadêmico
- Jornada 5: Consistência (dados inválidos)
