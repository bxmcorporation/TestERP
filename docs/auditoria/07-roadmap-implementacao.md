# RAYON OS — Roadmap de Implementação

Ordem recomendada para evoluir o sistema preservando o trabalho existente.

---

## Fase 1 — Integridade e confiabilidade (P0)

**Objetivo:** Garantir que operações críticas sejam atômicas e códigos não se dupliquem.

| Ordem | Item | Esforço | Depende de |
|-------|------|---------|------------|
| 1 | P0-1: Função atômica de geração de códigos | Médio | — |
| 2 | P0-2 + P0-3: Formação de turma transacional + validação de capacidade no servidor | Médio | — |
| 3 | P0-4: Salvar frequência transacionalmente | Médio | — |

**Entrega:** 1 migration com 4 SECURITY DEFINER functions + ajustes em 3 arquivos frontend.

**Validação:** Build passa, typecheck passa, funções testadas via `execute_sql`.

---

## Fase 2 — Correções de código (P1 não-DB)

**Objetivo:** Corrigir bugs de frontend sem tocar no banco.

| Ordem | Item | Esforço | Depende de |
|-------|------|---------|------------|
| 4 | P1-2: Corrigir botão "Editar" no perfil do aluno | Baixo | — |
| 5 | P1-3: Conectar busca global | Médio | — |
| 6 | P1-5: Substituir alert() por toast notifications | Médio | — |
| 7 | P1-6: Adicionar Error Boundary | Baixo | — |
| 8 | P1-7: Corrigir 50 erros ESLint | Baixo | — |

**Entrega:** Alterações em ~15 arquivos frontend, 1-2 novos componentes.

**Validação:** Build passa, typecheck passa, lint passa (0 erros).

---

## Fase 3 — Correções de banco não destrutivas (P1 DB)

**Objetivo:** Adicionar políticas e constraints faltantes. **Requer aprovação.**

| Ordem | Item | Esforço | Depende de |
|-------|------|---------|------------|
| 9 | P1-1: Adicionar política UPDATE em activities | Baixo | — |
| 10 | P1-8: Adicionar CHECK constraints | Médio | Verificar dados primeiro |

**Entrega:** 1-2 migrations não destrutivas.

**Validação:** `get_security_posture` confirma 4 políticas em activities. CHECK constraints aceitam dados existentes.

---

## Fase 4 — Completar módulos P2

**Objetivo:** Funcionalidades de maior valor operacional.

| Ordem | Item | Esforço | Depende de |
|-------|------|---------|------------|
| 11 | P2-1: Progresso acadêmico do aluno | Alto | Fase 1 |
| 12 | P2-2: Materiais didáticos | Médio | — |
| 13 | P2-3: Relatórios detalhados funcionais | Alto | — |
| 14 | P2-4: Página de auditoria completa | Médio | — |

**Entrega:** 2-3 novas tabelas, 3-4 novas páginas, ajustes em páginas existentes.

---

## Fase 5 — Evolução P3

**Objetivo:** Preparar para produção e escala.

| Ordem | Item | Esforço | Depende de |
|-------|------|---------|------------|
| 15 | P3-3: Lazy loading de páginas | Baixo | — |
| 16 | P3-4: Otimização de queries N+1 | Médio | — |
| 17 | P3-5: Testes automatizados | Alto | Fases 1-2 |
| 18 | P3-1: Autenticação | Alto | Aprovação |
| 19 | P3-2: Isolamento entre unidades | Alto | P3-1 |
| 20 | P3-6: Portais de alunos/responsáveis | Alto | P3-1 |

---

## Resumo de dependências

```
Fase 1 (P0) ──→ Fase 4 (P2-1: Progresso)
     │
     │──→ Fase 2 (P1 frontend) ──→ Fase 5 (P3-5: Testes)
     │
     └──→ Fase 3 (P1 DB, com aprovação)
                                    │
                                    └──→ Fase 5 (P3-1: Auth, com aprovação)
                                                          │
                                                          └──→ P3-2: Unidades
                                                          └──→ P3-6: Portais
```

---

## Orçamento de tokens

Com ~3.400.000 tokens restantes:

| Fase | Estimativa | Observação |
|------|-----------|------------|
| Fase 1 | ~150.000 | 1 migration + ajustes em 3 arquivos |
| Fase 2 | ~200.000 | ~15 arquivos + 2 novos componentes |
| Fase 3 | ~80.000 | 1-2 migrations + verificação de dados |
| Fase 4 | ~400.000 | 2-3 tabelas + 3-4 páginas |
| Fase 5 (P3-1 a P3-5) | ~500.000 | Auth + testes + otimização |
| **Total estimado** | **~1.330.000** | ~39% do orçamento |

Sobram ~2.000.000 tokens para P3-6 (Portais), P3-7 (Integrações), e imprevistos.

Estimativas são aproximadas e podem variar com complexidade real.
