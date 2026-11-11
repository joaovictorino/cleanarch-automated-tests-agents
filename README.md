# Bank Lab

Projeto educacional desenvolvido para demonstração de conceitos.

O projeto simula operações bancárias, como criação de contas, saques, depósitos e transferências entre contas, utilizando **Node.js, TypeScript, Next.js e Jest**.

Seu objetivo é demonstrar práticas de **Test-Driven Development (TDD)**, aplicando o ciclo RED → GREEN → REFACTOR, com apoio de agentes de codificação.

As funcionalidades são implementadas progressivamente, a partir de critérios de aceite e testes automatizados, permitindo explorar regras de negócio, cenários de sucesso, falhas e valores-limite.

O projeto também utiliza `AGENTS.md` para orientar os agentes de IA e especificações em `specs/` para definir os comportamentos esperados.

## Tecnologias

- Node.js 24, TypeScript (strict)
- Next.js (App Router) e React
- Jest com ts-jest (testes de domínio, mock e integração); `jest.domain.config.cjs` para mutação
- Cucumber.js com tsx (BDD)
- Playwright Test (E2E de interface) e k6 (performance de consulta)
- Stryker (mutação), SonarQube via Docker (análise estática) e GitHub Actions (CI)
- Agentes de codificação

## Estrutura

```text
src/
├── domain/        # Conta, NumeroConta, TransferenciaValor, Recibo, ErroNegocio
├── application/   # adaptadores API → domínio (contas/, transferencias/) e estado-contas.ts (Map compartilhado)
├── api/           # handlers HTTP testáveis sem servidor (contas/handlers.ts, transferencias/handler.ts)
└── app/           # Next.js: layout, página mínima e rotas /api/contas, /api/contas/[id], /api/transferencias
tests/
├── domain/        # testes unitários do domínio e da classificação de erros
├── api/           # handlers com mock e integração com o domínio real
└── e2e/           # Playwright (fixtures/conta.ts com helpers de criação/consulta)
features/          # Cucumber: step-definitions/ e support/world.ts
perf/              # script k6 de consulta (consulta.ts)
scripts/           # verificar-bdd.cjs
specs/
├── aula01/        # criação e transferência (regras bancárias)
├── aula02/        # APIs, erros, mocks, BDD (.feature) e qualidade/CI
└── laboratorio-03.md  # interface, diagnóstico e performance
.github/workflows/ # ci.yml
```

Arquivos de configuração na raiz: `jest.config.cjs`, `jest.domain.config.cjs`, `cucumber.cjs`, `playwright.config.ts`, `stryker.config.json`, `sonar-project.properties`, `docker-compose.yml` (SonarQube e scanner), `tsconfig*.json` (`tsconfig.build.json` e `tsconfig.k6.json` para builds específicos).

Diretórios gerados e ignorados pelo Git: `dist/`, `coverage/`, `reports/`, `playwright-report/`, `test-results/`, `evidencias/`.

## Executando

Instale as dependências:

```bash
npm install
```

Scripts disponíveis:

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento do Next.js |
| `npm run build` | Build de produção do Next.js |
| `npm start` | Executa o build de produção |
| `npm test` | Executa a suíte Jest (ignora `tests/e2e`) |
| `npm run test:watch` | Jest em modo watch |
| `npm run test:coverage` | Jest com cobertura |
| `npm run typecheck` | Verificação de tipos (`tsc --noEmit`) |
| `npm run build:ts` | Transpila apenas `src/domain` e `tests` para `dist/` |
| `npm run test:bdd` | Cenários Cucumber (relatórios em `reports/`) |
| `npm run test:bdd:dry` | Valida os steps sem executar (dry-run) |
| `npm run test:bdd:full` | Cucumber + `scripts/verificar-bdd.cjs` |
| `npm run test:e2e` | Playwright em Chromium (executa `next start`; rode `npm run build` antes) |
| `npm run test:e2e:headed` | Playwright com navegador visível |
| `npm run test:e2e:report` | Abre o relatório HTML do Playwright |
| `npm run typecheck:k6` | Verifica os tipos do script k6 |

O k6 não é instalado pelo npm: instale o binário separadamente e rode, por exemplo, `k6 run -e VUS=5 perf/consulta.ts` com a aplicação no ar (`BASE_URL` padrão `http://127.0.0.1:3000`).

## API de transferências

`POST /api/transferencias` (contrato em `specs/aula02/api-transferencias.md`):

```bash
curl -X POST localhost:3000/api/transferencias \
  -d '{"contaOrigem":"123456","contaDestino":"654321","valor":300}'
# 201 {"comprovante":"123456"}
```

Erros retornam `{"erro":"<CODIGO>"}`:

| HTTP | Código |
| --- | --- |
| 400 | `REQUISICAO_INVALIDA`, `CONTA_INVALIDA`, `VALOR_INVALIDO` |
| 404 | `CONTA_NAO_ENCONTRADA` |
| 422 | `MESMA_CONTA`, `SALDO_INSUFICIENTE` |
| 500 | `ERRO_INTERNO` |

As rotas de contas (`/api/contas`, `/api/contas/[id]`, contrato em `specs/aula02/api-contas.md`) e de transferência compartilham o mesmo `Map` em memória (`src/application/estado-contas.ts`), inicialmente vazio: crie as contas pela API antes de transferir. O estado vale só no mesmo processo e é perdido ao reiniciar; não há persistência, concorrência nem transação.
