# SPEC-QUAL-001 — CI, cobertura, StrykerJS e SonarQube

**Versão:** 1.0  
**Etapas:** 05 a 07  
**Fontes:** `specs/api-transferencias.md` e `specs/mocks-e-integracao.md`.

## 1. Objetivo, escopo e distinções

Confrontar quatro evidências distintas:

| Instrumento | Pergunta respondida | Evidência mínima |
| --- | --- | --- |
| **Jest** | O comportamento esperado foi observado? | Testes executados, contagem real, falhas e resultados |
| **Cobertura Jest** | Quais partes do código foram executadas? | `coverage/lcov.info` + linhas/branches por arquivo |
| **StrykerJS** | Os testes detectam alterações artificiais relevantes? | relatório de mutação e interpretação de um mutante |
| **SonarQube** | Quais problemas e métricas de qualidade estática existem? | dashboard, cobertura importada, Quality Gate e análise crítica |

Nunca tratar `100%` de cobertura como prova de conformidade funcional. Não fixar meta arbitrária de cobertura nem desabilitar verificações para produzir nota favorável.

## 2. QUAL-01 — Cobertura local no Jest

Manter `test:coverage` no `package.json`, com cobertura de `src/**/*.{ts,tsx}`. Excluir artefatos gerados, definições `*.d.ts`, build e diretórios de dependências. Qualquer exclusão de código real precisa ser justificada no relatório; **não excluir código para melhorar porcentagem**.

```bash
npm run test:coverage
# resultado esperado: arquivo coverage/lcov.info
```

Registre `Statements`, `Branches`, `Functions` e `Lines`. Compare principalmente handler, adaptador e domínio. Se linhas críticas não forem exercitadas, crie teste baseado em critério de aceite (não apenas para ganhar percentual).

## 3. QUAL-02 — GitHub Actions

Fornecer `.github/workflows/tests.yml` que rode para `push` e `pull_request` **sem restringir a `main`**, pois cada aluno trabalha em branch própria. O job deve:

1. Fazer checkout (`actions/checkout`).
2. Preparar Node.js 24 com cache npm (`actions/setup-node`).
3. Executar `npm ci` usando `package-lock.json` versionado.
4. Executar `npm run typecheck`.
5. Executar `npm run test:coverage`.
6. Executar `npm run build`.
7. Publicar `coverage/` como artifact **mesmo se os testes falharem**, quando gerado.

Modelo inicial em `exemplos/.github/workflows/tests.yml` (copiar ao caminho operacional depois que o professor liberar a etapa). A presença do arquivo na branch não comprova execução: capturar link para run, commit SHA, status e resumo dos jobs na aba **Actions**. Sonar local e mutação podem permanecer fora do CI obrigatório deste laboratório para preservar recursos.

## 4. QUAL-03 — StrykerJS (configuração é atividade do aluno)

### 4.1 Instalar

```bash
npm install --save-dev @stryker-mutator/core @stryker-mutator/jest-runner
```

**Criar**, e não apenas referenciar, `stryker.config.json` na raiz. O modelo `exemplos/stryker.config.json` precisa ser adaptado à organização real dos arquivos: `src/domain/Conta.ts` ou `src/model/Conta.ts`.

Campos exigidos:

```json
{
  "$schema": "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
  "testRunner": "jest",
  "jest": { "projectType": "custom", "configFile": "jest.domain.config.cjs" },
  "mutate": ["src/domain/Conta.ts"],
  "coverageAnalysis": "perTest",
  "concurrency": 2,
  "reporters": ["clear-text", "progress", "html"]
}
```

**`mutate` é propositalmente um exemplo:** conferir caminho real e escolher **um arquivo com regra relevante**. Não mutar `tests/**`, `route.ts`, arquivos `.next`, configurações ou a suíte inteira de uma vez.

Como o Jest principal usa `next/jest`, manter `jest.domain.config.cjs` isolado e enxuto com `ts-jest` e `testMatch` para a pasta de testes unitários do domínio (modelo em `exemplos/jest.domain.config.cjs`). Essa configuração reduz dependências de build Next em cada rodada de mutação.

### 4.2 Executar e validar

```bash
npx jest --config jest.domain.config.cjs --runInBand
npx stryker run
```

Inspecionar `reports/mutation/mutation.html` (verifique o caminho efetivo mostrado pelo Stryker). Diferenciar:

- **Killed:** algum teste detectou o mutante.
- **Survived:** o código mutado continuou compatível com as asserções existentes.
- **NoCoverage:** mutação não atingida pelos testes medidos.
- **Timeout:** execução não finalizou no limite; **não** é prova inequívoca de bom teste.

Exemplo pedagógico: alteração de `valor > saldo` para `valor >= saldo` deve ser detectada por um teste de **valor igual ao saldo**. O agente deve localizar um mutante real no relatório; se não houver sobreviventes relevantes, não inventar um.

**Evidência obrigatória:** arquivos de configuração criados, saída real da execução, score informado pela ferramenta, mutante selecionado, regra afetada, teste existente ou novo que o mata e, se houve mudança, comparação antes/depois. Não editar asserções apenas para fabricar mutantes mortos.

## 5. QUAL-04 — SonarQube Community Build no Docker

**O servidor e o scanner rodam em contêineres**; os testes Jest continuam executando localmente. O SonarQube importa cobertura, mas não executa os testes nem o Stryker.

### 5.1 Pré-requisitos

Docker Engine/Desktop e Compose disponíveis, porta 9000 livre, memória suficiente. A imagem demonstrativa do servidor utiliza banco embutido somente para **exercício local**; não configura produção. Confirmar também permissões de leitura/escrita no diretório montado pelo scanner (especialmente em Linux).

### 5.2 Arquivos a criar

- `docker-compose.sonar.yml` — `sonarqube` + `scanner` no profile `scan`.
- `sonar-project.properties` — chave, caminhos e cobertura LCOV.
- `.env.sonar` — token local **nunca versionado**; copiar de `.env.sonar.example`.

Modelos completos estão em `exemplos/`. O aluno deve explicar cada seção ao professor, não apenas copiar o resultado do agente.

### 5.3 Geração da cobertura

```bash
npm run test:coverage
# confirme coverage/lcov.info antes do scanner
```

### 5.4 Subir o servidor

```bash
docker compose -f docker-compose.sonar.yml up -d sonarqube
docker compose -f docker-compose.sonar.yml ps
docker compose -f docker-compose.sonar.yml logs -f sonarqube
```

Abra **http://localhost:9000** e espere o SonarQube estar pronto. Credenciais iniciais da instalação didática normalmente são `admin` / `admin`; altere a senha no primeiro acesso e **não** exponha o serviço à internet.

### 5.5 Projeto e token

Criar projeto local com `sonar.projectKey=bank-tdd-lab-aula-02`. Criar token de análise e salvar em `.env.sonar`:

```dotenv
SONAR_TOKEN=seu_token_local
```

**Não** adicionar o token a `sonar-project.properties`, AGENTS.md, GitHub, screenshots ou respostas do agente.

### 5.6 Inspeção e encerramento

Registrar valor/estado real do Quality Gate, confiabilidade, segurança, manutenibilidade, duplicação e cobertura importada. Se um indicador não aparecer na edição instalada, registrar a limitação em vez de inventar um valor.

```bash
docker compose -f docker-compose.sonar.yml down
```

Não usar `down -v` inadvertidamente, pois apaga dados do laboratório.