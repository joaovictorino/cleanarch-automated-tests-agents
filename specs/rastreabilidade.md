# SPEC-TRACE-001 — Matriz de rastreabilidade e evidências

**Status:** matriz-base da atividade; aluno deve completar caminhos e nomes exatos.

## 1. Rastreabilidade prevista

| Requisito | BDD | Testes Jest exigidos | Evidência final (preencher) |
| --- | --- | --- | --- |
| API-01 — Sucesso 300 | BDD-01 | MOCK-01, INT-01 | `arquivo::nome do teste`, status |
| API-02 — Saldo exato | BDD-02 | INT-03 | `arquivo::nome do teste`, status |
| API-03 — Saldo insuficiente | BDD-03 | MOCK-04, INT-02 | `arquivo::nome do teste`, status |
| API-04 — Zero/negativo | BDD-04 | MOCK-02 | `arquivo::nome do teste`, status |
| API-05 — Tipos/centavos inválidos | — | Testes API-05 | `arquivo::nome do teste`, status |
| API-06 — Conta malformada | BDD-05 | MOCK-03 | `arquivo::nome do teste`, status |
| API-07 — Conta inexistente | BDD-06 | Teste API-07, INT-05 | `arquivo::nome do teste`, status |
| API-08 — Mesma conta | BDD-07 | Teste API-08, INT-05 | `arquivo::nome do teste`, status |
| API-09 — JSON malformado | BDD-08 | MOCK-03, teste API-09 | `arquivo::nome do teste`, status |
| API-10 — Zeros à esquerda/centavos | BDD-09 | Teste API-10 | `arquivo::nome do teste`, status |
| API-11 — Erro inesperado | BDD-10 | MOCK-05 | `arquivo::nome do teste`, status |
| API-12 — Precedência | — | Teste API-12 | `arquivo::nome do teste`, status |
| API-13 — Comprovante inválido | BDD-11 | INT-06 | `arquivo::nome do teste`, status |
| Isolamento entre testes | — | INT-04 | `arquivo::nome do teste`, status |
| Regressão BANK-SPEC-001 | — | `tests/domain/**` da Aula 01 | contagem antes/depois |

**Nota:** a coluna de requisitos é a expectativa do exercício, **não afirma que os testes foram criados**. Para BDD, nenhuma etapa requer Cucumber: os IDs servem como rastreabilidade manual para Jest. Onde não há BDD, o requisito continua válido.

## 2. Evidência de RED / GREEN / REFACTOR

| Ciclo | Critério | Nome do teste | RED (erro real) | GREEN (resultado real) | REFACTOR (se houver) |
| --- | --- | --- | --- | --- | --- |
| 1 | MOCK-01 | A preencher | A preencher | A preencher | A preencher |
| 2 | INT-01 | A preencher | A preencher | A preencher | A preencher |
| 3 | API-03 | A preencher | A preencher | A preencher | A preencher |

## 3. Checklist de execução

- [ ] `npm test -- --runInBand` — informar nº de suítes e testes.
- [ ] `npm run typecheck` — anexar saída ou log.
- [ ] `npm run build` — anexar saída ou log.
- [ ] `npm run test:coverage` — valores reais, LCOV existente.
- [ ] GitHub Actions — URL da execução, branch, commit e status.
- [ ] `npx jest --config jest.domain.config.cjs --runInBand` — resultado.
- [ ] `npx stryker run` — score, mutante escolhido e análise.
- [ ] Docker Compose + SonarScanner — execução, cobertura importada, Quality Gate.

## 4. Registro de decisões humanas

| ID | Conflito ou lacuna | Alternativas | Decisão do professor | Arquivos impactados |
| --- | --- | --- | --- | --- |
| DEC-01 | Como mapear erros de negócio existentes para HTTP? | Erro com código / outra opção explícita | Pendente | Adaptador, domínio (se necessário) |
| DEC-02 | Caminho real dos arquivos do domínio | `src/domain` / `src/model` | Seguir o aluno | Imports e Stryker |

**Entrega final:** o agente deve destacar qualquer linha ainda com "A preencher" ou "Pendente", sem marcar a atividade como concluída.
