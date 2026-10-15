# RAYON OS — Auditoria de Segurança

---

## A. Autenticação e RLS

### Estado atual

- **Autenticação:** NÃO EXISTE. O app não tem tela de login. O cliente Supabase usa apenas a anon key.
- **RLS:** Habilitado em 16/16 tabelas.
- **Políticas:** 63 políticas no total. 15 tabelas com 4 políticas (SELECT, INSERT, UPDATE, DELETE). 1 tabela (`activities`) com 3 políticas (falta UPDATE).
- **Roles:** Todas as políticas usam `TO anon, authenticated USING (true)` ou `WITH CHECK (true)`.
- **Security Advisor:** 0 alertas.

### Análise

| Verificação | Resultado | Detalhe |
|-------------|-----------|---------|
| Políticas presentes e ativas | SIM | 63 políticas confirmadas via `get_security_posture` |
| Auth real existe | NÃO | Sem `supabase.auth.signInWithPassword()`, sem tela de login, sem `auth.users` |
| Usuários anônimos podem acessar registros | SIM | Todas as políticas permitem `anon` com `USING(true)` |
| Permissões aplicadas no banco | SIM | RLS habilitado, policies ativas |
| Isolamento entre unidades | NÃO | Sem filtro por `unit_id` em nenhuma política |
| Dados pessoais protegidos | NÃO | CPF, telefone, email acessíveis a qualquer anon |
| Dados financeiros protegidos | NÃO | Valores, status de pagamento acessíveis a qualquer anon |
| Usuários podem modificar além de permissões | NÃO (dentro do modelo) | Todas as operações CRUD são permitidas para anon — não há escopo de modificação porque tudo é permitido |

### Veredito

O modelo é **intencionalmente aberto** para demonstração. Isto é documentado no comentário do schema (linha 30): *"single-tenant demo app with no sign-in screen — data is intentionally shared"*. 

Para um ambiente de demonstração, isto é aceitável. Para uso real, **tudo precisa ser redesenhado**:
- Adicionar auth (login/senha via Supabase)
- Mudar todas as 64 políticas para `TO authenticated` com `auth.uid()` 
- Adicionar `user_id` nas tabelas ou usar memberships
- Adicionar filtros por `unit_id` para isolamento
- Proteger dados pessoais e financeiros com políticas específicas

---

## B. Operações transacionais

### Formação de turma — `assignStudent()`

**Arquivo:** `src/pages/CoursesPage.tsx:672-704`

```typescript
// Passo 1 — insert class_students
const { error } = await supabase
  .from('class_students')
  .insert({ class_id: cls.id, student_id: studentId, status: 'ativo' });
if (error) throw error;

// Passo 2 — update enrollments (SEM verificação de erro)
await supabase
  .from('enrollments')
  .update({ status: 'ativa' })
  .eq('student_id', studentId)
  .eq('course_id', cls.course_id)
  .eq('status', 'aguardando_turma');

// Passo 3 — update students (SEM verificação de erro)
await supabase
  .from('students')
  .update({ academic_status: 'matriculado' })
  .eq('id', studentId);
```

**Problemas:**
1. Passos 2 e 3 não verificam `error` — se falham, ninguém sabe
2. Se passo 1 sucesso + passo 2 falha: aluno na turma com matrícula inconsistente
3. Se passo 1 + 2 sucesso + passo 3 falha: aluno na turma, matrícula ativa, mas academic_status errado
4. Não há rollback de nenhum tipo

### Formação de turma — `removeStudent()`

**Arquivo:** `src/pages/CoursesPage.tsx:706-721`

Remove o aluno da turma mas **não reverte**:
- `enrollment.status` permanece `ativa` (deveria voltar para `aguardando_turma`)
- `student.academic_status` permanece `matriculado` (deveria voltar para `aguardando`)

### Frequência — `handleSave()`

**Arquivo:** `src/pages/AttendancePage.tsx:148-168`

```typescript
const updates: Promise<void>[] = records.map((r) => {
  if (r.attendanceId) {
    return (async () => {
      const { error } = await supabase
        .from('attendance')
        .update({ status: r.status, ... })
        .eq('id', r.attendanceId);
      if (error) throw error;
    })();
  }
  return (async () => {
    const { error } = await supabase.from('attendance').insert({ ... });
    if (error) throw error;
  })();
});
await Promise.all(updates);
```

**Problemas:**
1. `Promise.all` falha no primeiro erro, mas outros promises já podem ter commitado
2. Resultado parcial: alguns alunos com frequência atualizada, outros não
3. Sem rollback

### Recomendação

Criar **SECURITY DEFINER functions** no Postgres que executam atomicamente:
- `assign_student_to_class(p_class_id, p_student_id)` — insert + 2 updates numa transação
- `remove_student_from_class(p_class_id, p_student_id)` — delete + 2 updates numa transação  
- `save_attendance(p_lesson_id, p_records jsonb)` — upsert atômico de todos os registros

---

## C. Capacidade de turma

**Arquivo:** `src/pages/CoursesPage.tsx:674`

```typescript
if ((enrolledStudents.length) >= cls.max_capacity) {
  alert('Capacidade maxima da turma atingida');
  return;
}
```

**Problemas:**
1. Validação apenas em JavaScript — `enrolledStudents.length` é do estado React (dados carregados anteriormente)
2. Entre o load e o click, outro usuário pode ter inserido um aluno
3. Nada no banco impede exceder `max_capacity`
4. A coluna `max_capacity` existe na tabela `classes` mas não há CHECK constraint ou trigger

### Risco de concorrência

Cenário: turma com max_capacity=15, 14 alunos matriculados.
- Usuário A carrega a página (vê 14/15)
- Usuário B carrega a página (vê 14/15)
- Ambos clicam "Associar" para o mesmo aluno diferente
- Ambos passam pela validação JS (14 < 15)
- Ambos inserem no banco — turma fica com 16 alunos

### Recomendação

Adicionar uma SECURITY DEFINER function que faz `INSERT INTO class_students` **apenas se** `(SELECT count(*) FROM class_students WHERE class_id = p_class_id) < (SELECT max_capacity FROM classes WHERE id = p_class_id)`.

---

## D. Geração de identificadores

**Arquivo:** `src/lib/helpers.ts:17-29`

```typescript
export async function generateCode(prefix: string, table: string): Promise<string> {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });
  if (error) {
    const timestamp = Date.now().toString().slice(-6);
    return `${prefix}-${timestamp}`;
  }
  const next = (count || 0) + 1;
  return `${prefix}-${String(next).padStart(5, '0')}`;
}
```

**Problemas:**
1. `count + 1` não é atômico — duas requisições concorrentes recebem o mesmo count
2. Se a tabela tem `UNIQUE` em `code` (students, enrollments, classes, financial_items têm), o segundo insert falha com erro de constraint. O usuário vê `alert()` genérico.
3. Se a tabela NÃO tem `UNIQUE` (teachers, rooms, guardians, units — code pode ser null), códigos duplicados são persistidos silenciosamente
4. Se registros foram deletados, `count` diminui e códigos podem reutilizar números de registros antigos (ALU-00003 depois que ALU-00003 foi deletado)

### Tabelas com UNIQUE em code:

| Tabela | UNIQUE em code |
|--------|---------------|
| students | SIM |
| enrollments | SIM |
| classes | SIM |
| financial_items | SIM |
| units | SIM |
| guardians | NÃO |
| teachers | NÃO (sem campo code) |
| rooms | NÃO (code pode ser null) |

### Recomendação

Criar uma sequence ou função Postgres `generate_code(p_prefix, p_table)` que usa `COALESCE(MAX(...)) + 1` dentro de uma transação, ou usar `SEQUENCE` objects do Postgres.

---

## E. Frequência

**Arquivo:** `src/pages/AttendancePage.tsx:143-185`

- Carrega alunos da turma via `class_students` join `students`
- Carrega frequência existente via `attendance` por `lesson_id`
- Permite 4 status: presente, ausente, justificado, pendente
- Salva via `Promise.all` de updates/inserts individuais

**Problemas:**
1. Não transacional (ver item B acima)
2. `recorded_at` é atualizado em updates mas não em inserts (insert usa default `now()`)
3. Sem histórico de alterações — se alguém muda de presente para ausente, o valor anterior é sobrescrito
4. Sem validação de duplicatas no frontend — mas `UNIQUE(lesson_id, student_id)` no banco protege

---

## F. Pesquisa global

**Arquivo:** `src/App.tsx:39-41`, `src/components/layout/AppShell.tsx:12-16`

```typescript
// App.tsx
const handleSearch = useCallback((query: string) => {
  setSearch(query);
}, []);
// handleSearch é definido mas NUNCA é passado para AppShell

// AppShell.tsx
const [searchQuery, setSearchQuery] = useState('');
const handleSearch = useCallback((query: string) => {
  setSearchQuery(query);
}, []);
// searchQuery é definido mas NUNCA usado ou passado para children
```

**Fluxo real:**
1. Topbar chama `onSearch` (AppShell.handleSearch)
2. AppShell define `searchQuery` mas não faz nada com ele
3. App.tsx tem `handleSearch` que define `search` mas nunca é chamado

**Resultado:** A barra de busca do Topbar **não funciona** para a maioria das páginas. Apenas Students, Guardians e Enrollments recebem `initialSearch` via props, mas esse valor vem de `search` no App.tsx que nunca é atualizado pelo Topbar.

**Veredito:** SOMENTE VISUAL — a busca aparenta funcionar (o input aceita texto) mas não filtra nada em nenhuma página.

---

## G. Auditoria

**Arquivo:** `src/lib/helpers.ts:3-15`

```typescript
export async function logActivity(type, title, description?, entityType?, entityId?) {
  try {
    await supabase.from('activities').insert({ type, title, description, entity_type: entityType, entity_id: entityId });
  } catch {
    // Silent fail
  }
}
```

**Problemas:**
1. **Sem identificação de usuário** — sem `user_id`, sem `auth.uid()`. Todas as ações são anônimas.
2. **Falha silenciosa** — se o log falha, ninguém sabe. Erros de auditoria são ignorados.
3. **Sem trilha de alteração** — registra apenas "Aluno atualizado" mas não o que mudou (antes/depois).
4. **Sem tela de visualização** — atividades aparecem no Dashboard (últimas 10) mas não há página de log completo com filtros.
5. **Sem timestamps de modificação confiáveis** — `created_at` existe mas `updated_at` só é setado manualmente no frontend.

---

## H. Financeiro

**Arquivo:** `src/pages/FinancialPage.tsx`

- Dashboard calcula receita/despesa/em_aberto/vencido **no frontend** a partir de todos os registros carregados
- Valores usam `numeric(10,2)` no banco — adequado
- Formatação BRL via `Intl.NumberFormat` — correto
- Status: em_aberto, pago, vencido, cancelado — 4 estados
- `paid_date` é setado ao marcar como pago — correto
- Sem transações reais — apenas demonstrativo — conforme especificado

**Problemas:**
1. Cálculos no frontend — se houver muitos registros, carrega tudo para memória
2. Sem validação de valor negativo (aceita `amount: -100`)
3. Sem validação de type (aceita `type: 'xyz'`)
4. Status `vencido` é manual — não há job automático para marcar vencidos (expected para demo)

---

## I. Qualidade e testes

| Item | Status | Evidência |
|------|--------|-----------|
| Testes unitários | NÃO EXISTEM | Nenhum arquivo de teste no projeto |
| Testes de integração | NÃO EXISTEM | — |
| Testes E2E | NÃO EXISTEM | — |
| TypeScript | PASSA | `tsc --noEmit` com 0 erros |
| ESLint | 50 erros | Todos `no-unused-vars` — código morto, não erros lógicos |
| Build reproduzível | SIM | `vite build` passa, 468.93 KB JS |
| Documentação técnica | PARCIAL | README.md existe mas não cobre arquitetura. Esta auditoria é a primeira documentação técnica. |
