# RAYON OS — Diagnóstico Executivo

**Data da auditoria:** 15 de outubro de 2026
**Versão analisada:** Estado atual do repositório (sem git — projeto Bolt.new)
**Aplicação publicada:** https://rayon-os-educational-o017.bolt.host/

---

## Visão geral

O RAYON OS é um ERP educacional para a RAYON Academy com 14 módulos funcionais operando sobre 16 tabelas no Supabase. O sistema foi construído sobre React 18 + TypeScript + Vite + Tailwind CSS, com persistência real no PostgreSQL via Supabase.

**Estado geral: PROTÓTIPO FUNCIONAL com problemas de integridade**

O sistema funciona como demonstração: todas as páginas carregam dados reais, todos os formulários salvam no banco, todos os fluxos principais são navegáveis. No entanto, problemas de concorrência, falta de transacionalidade e ausência de validação no servidor impedem uso confiável em produção.

---

## Verificações estáticas executadas

| Verificação | Resultado |
|-------------|-----------|
| TypeScript (`tsc --noEmit`) | PASSA — 0 erros de tipo |
| ESLint (`eslint .`) | 50 erros, 1 warning — todos `no-unused-vars` (imports não utilizados, desestruturações não usadas) |
| Build (`vite build`) | PASSA — 468.93 KB JS (118.97 KB gzip), 27.24 KB CSS (5.51 KB gzip) |
| Security Advisor (Supabase) | 0 alertas |
| RLS habilitado | 16/16 tabelas |
| Testes automatizados | Nenhum existe |

---

## Resumo de problemas por gravidade

### CRÍTICO (impede operações confiáveis)

1. **`generateCode()` — condição de corrida** — Códigos sequenciais (ALU-00001) podem colidir sob concorrência. A coluna `code` tem `UNIQUE` em algumas tabelas (students, enrollments, classes, financial_items) mas não em todas. Quando colide numa tabela com UNIQUE, o insert falha silenciosamente.
   - Arquivo: `src/lib/helpers.ts:17-29`

2. **Formação de turma não transacional** — `assignStudent()` faz 3 operações separadas (insert class_student, update enrollment, update student) sem verificar erro nos passos 2 e 3. Falha parcial deixa dados inconsistentes.
   - Arquivo: `src/pages/CoursesPage.tsx:672-704`

3. **Capacidade de turma validada apenas no frontend** — O limite `max_capacity` é verificado em JavaScript antes do insert, mas nada impede que duas requisições concorrentes insiram alunos além do limite no banco.
   - Arquivo: `src/pages/CoursesPage.tsx:674`

### MÉDIO (funciona mas com riscos)

4. **Tabela `activities` sem política UPDATE** — 15 das 16 tabelas têm 4 políticas CRUD; `activities` tem apenas 3 (falta UPDATE). Impossível editar atividades pelo frontend.
   - Arquivo: `supabase/migrations/20261015173446_rayon_os_core_schema.sql:443-449`

5. **Botão "Editar" do perfil do aluno redireciona** — `onClick={() => onNavigate('/students')}` em vez de abrir modal de edição.
   - Arquivo: `src/pages/StudentsPage.tsx:812`

6. **`removeStudent()` não reverte status** — Remove aluno da turma mas não reverte enrollment para `aguardando_turma` nem student para `aguardando`.
   - Arquivo: `src/pages/CoursesPage.tsx:706-721`

7. **Pesquisa global desconectada** — `handleSearch` no App.tsx define estado `search` mas o AppShell tem seu próprio `searchQuery` que nunca é usado. A busca do Topbar flui para App.tsx mas só chega a Students, Guardians e Enrollments — outras páginas ignoram.
   - Arquivos: `src/App.tsx:39-41`, `src/components/layout/AppShell.tsx:12-16`

8. **Salvamento de frequência não transacional** — `Promise.all` com inserts/updates individuais. Se um falha, outros já commitaram.
   - Arquivo: `src/pages/AttendancePage.tsx:148-168`

### BAIXO (qualidade e manutenabilidade)

9. **N+1 queries** — Dashboard, Professores e Cursos fazem queries individuais por item em vez de agregação.
10. **Sem constraints CHECK** — Campos de status aceitam qualquer string.
11. **50 erros ESLint** — Todos são `no-unused-vars` (código morto).
12. **Sem Error Boundary** — Erro em qualquer componente derruba a app.
13. **`alert()` para erros** — Inadequado para produção.
14. **Sem testes automatizados** — Nenhum teste unitário, integração ou E2E.
15. **Sem isolamento entre unidades** — Por design (demo single-tenant), mas limita expansão.
16. **Sem identificação de usuário em auditoria** — `activities` não registra quem fez a ação.

---

## Decisão de arquitetura: single-tenant sem auth

O sistema foi intencionalmente construído como demo sem autenticação. Todas as 16 tabelas usam `TO anon, authenticated USING (true)`. Isso é correto para o contexto atual (demo), mas significa:

- Qualquer pessoa com a URL pode ler e modificar todos os dados
- Não há isolamento entre unidades
- Não há trilha de auditoria com identificação de usuário
- Dados pessoais (CPF, telefone) e financeiros são acessíveis

Esta decisão **deve ser revisada** antes de qualquer uso real. A transição para auth requer: tela de login, mudança de todas as 64 políticas RLS, adição de `user_id` nas tabelas, e rebuild do fluxo de auditoria.
