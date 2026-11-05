# SPEC-QUAL-001 — CI, cobertura, mutação e SonarQube

Versão 2.0 — Aula 02. Pré-requisitos: etapas de API e BDD concluídas para a validação final; a CI inicial também pode executar sobre o domínio isolado.

## 1. Evidências diferentes

| Ferramenta | O que observar | Limite da evidência |
| --- | --- | --- |
| Jest | Comportamentos e asserções executados | Testes com mock não comprovam movimentação real |
| Cucumber | Seis cenários com domínio real e steps aprovados | Não executa rede/roteamento ao chamar a factory |
| LCOV do Jest | Linhas e branches executadas | Não mede força das asserções nem incorpora automaticamente Cucumber |
| Stryker | Mutantes mortos, sobreviventes e sem cobertura | Sobrevivente exige análise; pode ser equivalente ou fora do contrato |
| SonarQube | Análise estática, cobertura importada e Quality Gate | O servidor não executa Jest/Stryker por conta própria |

## 2. QUAL-01 — Cobertura

```bash
npm run test:coverage
```

Exigir `coverage/lcov.info` não vazio. Registrar Statements, Branches, Functions e Lines por domínio, adaptadores e handlers. Não fixar meta arbitrária nem excluir código real para aumentar percentual. O Jest Next fornecido coleta `src/**/*.{ts,tsx}`, excluindo declarações.

A página/layout mínimos podem ter linhas não cobertas; identificar essa limitação sem confundir com ausência de testes de regras bancárias. A automação da interface fica para a próxima aula.

### Verificação de duplicação de domínio (QUAL-01b)

Antes de declarar pronta qualquer etapa de API, executar e registrar o resultado (esperado: nenhuma ocorrência):

```bash
grep -rnE "Math\.round|\* ?100|MAX_SAFE_INTEGER|Number\.isFinite|\[0-9\]\{6\}|\\\\d\{6\}" src/api src/app
```

Cada ocorrência é duplicação de regra de domínio, a menos que justificada por escrito (por exemplo, texto de resposta). Não excluir diretórios para esconder o resultado. Opcionalmente, transformar em regra ESLint `no-restricted-syntax` ou teste de arquitetura.

## 3. QUAL-02 — Evolução do workflow único

O arquivo operacional é `.github/workflows/ci.yml`. O pacote fornece a versão **inicial**, que executa instalação, tipos, Jest/cobertura e `build:ts`, compatível com a base sem Next.

Após a etapa NEXT, trocar seu passo de build por `npm run build`. Depois de concluir BDD, adotar o modelo final:

```bash
cp exemplos/ci.final.yml .github/workflows/ci.yml
```

No PowerShell, usar `Copy-Item`. O workflow final executa `npm ci`, `npm run typecheck`, `npm run test:coverage`, `npm run test:bdd:full` e `npm run build`; publica `coverage/` e relatórios Cucumber com `if: always()`. Dispara em push e pull_request sem limitar à main.

Versionar lockfile e configurações. O aluno precisa de permissão de push/Actions no seu repositório. Apresentar URL do run, SHA, resultados e artifact. Mutação e Sonar local ficam fora da CI obrigatória para controlar recursos. Não adicionar `continue-on-error` ou `--if-present`.

## 4. QUAL-03 — StrykerJS

A instalação usa o mesmo par de versões para core e runner:

```bash
npm install --save-dev --save-exact @stryker-mutator/core@10.1.1 @stryker-mutator/jest-runner@10.1.1
npx jest --config jest.domain.config.cjs --runInBand
npx stryker run
```

O pacote fornece `stryker.config.json` e `jest.domain.config.cjs` efetivos na raiz. O aluno deve explicar e ajustar a configuração, em vez de apenas executá-la sem compreender. Não há dependência de um diretório de modelos inexistente.

O alvo inicial é somente `src/domain/Conta.ts`; o executor é Jest; a configuração isolada usa ts-jest sobre `tests/domain/**/*.test.ts`; análise `perTest`; concorrência 2. Não mutar route.ts, testes, configurações ou a aplicação inteira nesse experimento.

Registrar em `reports/mutation/` o caminho efetivamente exibido pelo Stryker, score, mortos, sobreviventes, sem cobertura e timeouts. Explicar pelo menos um mutante real e o critério afetado. Se criar um teste novo, registrar o antes/depois sem remover testes antigos.

Exemplos para investigação: trocar `valor > saldo` por `valor >= saldo`, ou a comparação de excesso do saldo máximo de `>` para `>=`. O segundo distingue ultrapassar o limite de atingir exatamente o limite. Não criar sobreviventes artificialmente nem assumir que toda alteração de mensagem é um defeito funcional.

## 5. QUAL-04 — SonarQube e scanner

Arquivos efetivos fornecidos: `docker-compose.yml`, `sonar-project.properties` e `.env.example`. O token local usa **somente `.env`**. Servidor e scanner compartilham a rede `devops`; o servidor é acessado no host por localhost:9000 e no scanner por sonarqube:9000.

Antes: Docker/Compose disponíveis, porta livre e diretório do projeto acessível ao usuário da imagem do scanner. Prepare imagens e recursos antes da aula. O servidor usa a tag já adotada no repositório. O scanner usa a tag `latest`; para repetir uma turma com a mesma imagem, o professor pode registrar e fixar seu digest após o ensaio.

### 5.1. Gerar cobertura e iniciar servidor

```bash
npm run test:coverage
docker compose up -d sonarqube
docker compose ps
```

Abra `http://localhost:9000` e espere o servidor ficar operacional. `depends_on` inicia o contêiner, mas não comprova prontidão da aplicação. Para diagnóstico, use `docker compose logs -f sonarqube`; Ctrl+C encerra o acompanhamento dos logs, não o serviço.

### 5.2. Projeto e token

Criar projeto local com chave `bank-tdd-lab-aula-02`. No primeiro acesso da instalação didática, trocar as credenciais iniciais se solicitado. Gerar token com permissão de análise e copiar o modelo:

```bash
cp .env.example .env
```

Editar somente o arquivo local:

```dotenv
SONAR_TOKEN=seu_token_local
```

O Compose lê `.env` e passa o token ao serviço scanner. `.gitignore` preserva a exclusão de `.env` e permite versionar `.env.example` sem segredo. Nunca colocar token nos prompts, properties, Git ou evidências.

### 5.3. Scanner

Com o servidor pronto, execute na raiz do projeto:

```bash
docker compose --profile scan run --rm scanner
```

O projeto é montado em `/usr/src`. O arquivo properties analisa `src`, classifica testes em `tests` e `features` e importa `coverage/lcov.info` do Jest. O diretório `features` deve existir após a implementação do BDD. Não usar localhost como endereço do servidor dentro do scanner.

Para aguardar o resultado do Quality Gate e fazer a execução falhar se ele reprovar, pode-se acrescentar o parâmetro de análise:

```bash
docker compose --profile scan run --rm scanner -Dsonar.qualitygate.wait=true
```

Para a atividade, registrar o estado efetivamente observado, inclusive se reprovado; o objetivo é interpretar o resultado. A conclusão da análise não significa automaticamente Quality Gate aprovado.

### 5.4. Leitura e encerramento

Examine confiabilidade, segurança, manutenibilidade, duplicação, cobertura importada e Quality Gate. Se houver cobertura zero, conferir LCOV e os caminhos dos fontes antes de atribuir o problema aos testes. Registrar limitações de indicadores da edição instalada.

```bash
docker compose down
```

Os volumes nomeados preservam dados do servidor entre reinícios normais. `down -v` remove esses dados e exige nova configuração. Este ambiente é didático e local; não define implantação de produção.

## 6. Definição de pronto

QUAL-01: LCOV e análise de lacunas. QUAL-02: run real verde de Jest/BDD/build e artifacts. QUAL-03: relatório real e interpretação de mutante. QUAL-04: scanner executado, cobertura importada e Quality Gate observado/interpretado. Não declarar aprovação de ferramentas que não foram executadas.
