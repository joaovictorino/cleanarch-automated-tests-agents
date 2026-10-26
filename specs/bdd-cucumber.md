# Spec — BDD com Cucumber.js no Laboratório 02

**Identificador:** BDD-CUCUMBER-02  
**Aplicação:** bank-tdd-lab — Aula 02  
**Tecnologias:** Node.js 24 LTS, TypeScript, Next.js App Router, Cucumber.js, Gherkin, tsx e Jest  
**Situação:** especificação fornecida pelo professor; configuração e automação são atividades do aluno.

## 1. Objetivo

Automatizar, com **Cucumber.js**, os comportamentos da API de transferências bancárias descritos em linguagem Gherkin. Os cenários devem executar a **fábrica real** `criarPostTransferencias(operacao)` e o **domínio verdadeiro** da Aula 01, utilizando apenas um **fake de persistência em memória** e um **stub determinístico do comprovante**.

**Não** basta vincular títulos dos cenários a testes Jest: o comando `npm run test:bdd` deve localizar e executar de fato os steps `Dado`, `Quando` e `Então`.

## 2. Pré-requisitos e fontes de verdade

- Preservar o domínio e os testes da Aula 01 (`specs/criacao.md` e `specs/transferencia.md`).
- Ter concluído as etapas de criação da API e testes com mock/integração do Laboratório 02.
- Respeitar `specs/api-transferencias.md` e `specs/mocks-e-integracao.md` em caso de dúvidas sobre precedência dos erros ou outros códigos HTTP.
- Existir `src/api/transferencias/handler.ts` exportando `criarPostTransferencias` e adaptador que utilize o serviço real de transferência.
- Utilizar os métodos de Conta efetivamente desenvolvidos na Aula 01, sem reescrever lógica de saldo na automação.
- O arquivo `features/transferencias.feature` deve ser entregue **preenchido pelo professor**. O trabalho do aluno é configurá-lo e automatizá-lo, não inventar os cenários.

## 3. História de usuário

**Como** cliente de uma instituição financeira,  
**quero** transferir valores entre duas contas por uma API,  
**para** movimentar recursos com segurança e receber um comprovante de seis dígitos.

## 4. Estrutura esperada

```text
bank-tdd-lab/
├── specs/
│   ├── api-transferencias.md
│   ├── mocks-e-integracao.md
│   └── bdd-cucumber.md             # esta especificação, pronta
├── features/
│   ├── transferencias.feature      # cenários, prontos
│   ├── step-definitions/
│   │   └── transferencias.steps.ts  # atividade do aluno
│   └── support/
│       └── world.ts                # atividade do aluno
├── src/
│   ├── domain/                     # implementação preservada da Aula 01
│   ├── application/
│   └── api/transferencias/handler.ts
├── tests/                          # testes Jest preservados
├── cucumber.cjs                    # atividade do aluno
├── jest.config.cjs
├── package.json
└── package-lock.json
```

É permitido reutilizar *helpers* de montagem de contas e adaptadores provenientes dos testes de integração, desde que não introduzam dependência de `jest.fn()`, `expect()` ou outros recursos exclusivos do Jest nas definições do Cucumber.

## 5. Atividade A — instalar dependências

Execute no diretório raiz:

```bash
npm install --save-dev @cucumber/cucumber tsx
```

Não instale `@types/cucumber`: o pacote oficial já fornece tipos TypeScript. Preserve a configuração Jest existente; Cucumber terá executor e relatórios próprios.

**Evidência:** `package.json` e `package-lock.json` atualizados, sem remoção de dependências da Aula 01.

## 6. Atividade B — configurar `cucumber.cjs`

O aluno deve **criar** o arquivo `cucumber.cjs` na raiz. Utilize a configuração-base abaixo como referência:

```js
module.exports = {
  default: {
    paths: ['features/**/*.feature'],
    requireModule: ['tsx/cjs'],
    require: [
      'features/support/**/*.ts',
      'features/step-definitions/**/*.ts',
    ],
    format: [
      'progress',
      ['html', 'reports/cucumber.html'],
      ['json', 'reports/cucumber.json'],
    ],
    publish: false,
    parallel: 0,
  },
};
```

O exemplo pressupõe projeto configurado em **CommonJS** (`package.json` sem `"type": "module"`, ou com `"type": "commonjs"`). O laboratório mantém o arquivo `cucumber.cjs` por simplicidade.

**Se seu projeto usa ESM** (`"type": "module"`), utilize um registrador em `tsx-register.js`:

```js
import { register } from 'tsx/esm/api';
register();
```

E, no `cucumber.cjs`, **troque** `requireModule` e `require` por:

```js
import: [
  './tsx-register.js',
  'features/support/**/*.ts',
  'features/step-definitions/**/*.ts',
],
```

Não mantenha simultaneamente o carregamento CommonJS e o ESM. Esse arranjo segue a documentação de transpilation do Cucumber.js.

Explique no relatório os campos `paths`, `requireModule`, `require`, `format`, `publish` e `parallel`. O valor `parallel: 0` facilita a inspeção do isolamento no primeiro experimento.

**Evidência:** configuração efetiva, não apenas cópia da spec.

## 7. Atividade C — adicionar scripts ao `package.json`

Preservando todos os scripts existentes, acrescente:

```json
{
  "scripts": {
    "test:bdd": "cucumber-js",
    "test:bdd:dry": "cucumber-js --dry-run"
  }
}
```

O bloco mostra **somente os novos scripts**; não substitua todo o `package.json`.

Comandos de verificação:

```bash
npm run test:bdd:dry
npm run test:bdd
npm run test:bdd -- --tags '@bdd-01'
```

O `--dry-run` verifica descoberta de arquivos e compatibilidade de steps, **mas não executa o comportamento**; um dry-run bem-sucedido não substitui a execução real.

## 8. Atividade D — implementar `World` e isolamento

Crie `features/support/world.ts`, usando `World` e `setWorldConstructor` de `@cucumber/cucumber`. Cada cenário deve ter uma **instância independente** de estado que contenha, no mínimo:

- coleção de **Contas reais** criadas para o cenário (o `Map` armazena as contas, não valores fictícios);
- `POST` injetável construído com `criarPostTransferencias` e adaptador real;
- resposta HTTP e corpo JSON da última requisição;
- gerador de comprovante determinístico (por exemplo, `() => '123456'`).

**Regras obrigatórias:**

1. As contas devem ser criadas com os saldos descritos no `Dado` e usar os métodos reais da Aula 01.
2. Instancie **novo Map e novas contas para cada cenário**; não compartilhe estado mutável entre cenários.
3. O `Quando` deve produzir uma `Request` da Web API para `/api/transferencias` e aguardar a função `POST` da fábrica HTTP. Não é necessário iniciar `npm run dev`.
4. Após a execução, verifique **ambos os saldos reais**, inclusive nos casos rejeitados.
5. Não substitua o serviço real por um `jest.fn()` ou por uma função que devolva respostas previamente calculadas.
6. A construção das dependências pode reutilizar um *fixture builder* separado, compartilhado com os testes de integração Jest, contanto que esse helper não dependa do Jest.

> **Atenção:** o `World` de Cucumber não tem relação com o ambiente de teste Jest. Não use variáveis globais, singletons mutáveis ou uma única instância de `Map` para todos os cenários.

## 9. Atividade E — implementar os steps

Crie `features/step-definitions/transferencias.steps.ts` e implemente as definições correspondentes ao Gherkin fornecido. Os steps devem contemplar os seguintes contratos:

| Step Gherkin | Ação ou asserção esperada |
|---|---|
| `Dado que existe a conta "123456" com saldo 1000` | Preparar conta real identificada por seis dígitos |
| `Quando solicito uma transferência de 300 da conta "123456" para a conta "654321"` | Construir Request JSON e invocar o POST real |
| `Quando envio o seguinte corpo bruto para a API de transferências:` | Invocar POST com o conteúdo literal do DocString (inclusive JSON inválido) |
| `Então o status HTTP deve ser 201` | Comparar `response.status` com 201 |
| `E o saldo da conta "123456" deve ser 700` | Consultar o saldo na **conta real do cenário** |
| `E a resposta deve conter um comprovante de seis dígitos` | Verificar `^\d{6}$` no campo `comprovante` |
| `E o erro retornado deve ser "SALDO_INSUFICIENTE"` | Conferir o campo JSON `erro` |

Exemplo de definição de **asserção** que pode ser adotado depois que o aluno criar seu tipo de `World`:

```ts
import assert from 'node:assert/strict';
import { Then } from '@cucumber/cucumber';
import type { BancoWorld } from '../support/world';

Then('o status HTTP deve ser {int}', function (this: BancoWorld, status: number) {
  assert.ok(this.resposta, 'A requisição ainda não foi executada');
  assert.equal(this.resposta.status, status);
});
```

Este trecho é **apenas um exemplo de step**, não é uma implementação completa. O aluno deve criar `BancoWorld`, os demais steps e a ligação com o domínio da Aula 01. Use `function (...)`, e não *arrow functions*, quando precisar acessar o `this` do World.

## 10. Cenários de aceite — fornecidos em `features/transferencias.feature`

| ID | Comportamento | Resultado esperado |
|---|---|---|
| BDD-01 / API-01 | Transferir 300 de 1000 para 200 | 201; origem 700; destino 500; comprovante com seis dígitos |
| BDD-02 / API-02 | Transferir exatamente o saldo de 1000 | 201; origem 0; destino 1200 |
| BDD-03 / API-03 | Tentar transferir 1001 | 422; `SALDO_INSUFICIENTE`; saldos 1000/200 |
| BDD-04 | Transferir valor zero | 400; `VALOR_INVALIDO`; saldos preservados |
| BDD-05 | Transferir valor negativo | 400; `VALOR_INVALIDO`; saldos preservados |
| BDD-06 | Enviar JSON malformado | 400; saldos preservados |

Os códigos e mensagens acima são os explicitamente estabelecidos ou exemplificados no material do Laboratório 02. **Outros casos** (conta inexistente, números inválidos, origem igual ao destino, precedência entre erros) devem seguir integralmente `specs/api-transferencias.md`, sem deduzir códigos não especificados nesta spec.

## 11. Atividade F — executar RED, GREEN e REFACTOR

**RED:** com `.feature` pronto e sem steps, execute `npm run test:bdd`; o Cucumber deverá indicar definições ausentes. Registre esse estado.

**GREEN:** implemente World e steps, execute novamente e faça todos os cenários passarem. Execute primeiro os mais simples, depois casos de erro e limites. Uma execução com *undefined/pending/skipped* não satisfaz esta etapa.

**REFACTOR:** remova duplicações da montagem de contas e requisições. A regra de negócio deve permanecer no domínio; as definições dos steps só preparam ações e verificam resultados.

Comandos finais:

```bash
npm run test:bdd
npm run test:bdd -- --tags '@bdd-01 or @bdd-03'
npm run test:bdd -- --order random
npm test -- --runInBand
npx tsc --noEmit
```

O `--order random` auxilia a identificar dependência indevida de ordem. Faça mais de uma execução, sem alterar código só para que o resultado passe. Os relatórios serão gerados em `reports/cucumber.html` e `reports/cucumber.json`.

## 12. Integração contínua e relatórios

Depois de implementar os steps, acrescente uma etapa ao workflow existente `.github/workflows/tests.yml`, **após `npm ci`**:

```yaml
- name: Executar cenários BDD com Cucumber
  run: npm run test:bdd
```

A indentação exata depende da organização de `steps` do workflow existente. Garanta que falhas BDD façam o job falhar. Os testes Jest e o Cucumber devem executar separadamente; não force o Jest a carregar arquivos `features/**/*.ts` como testes.

Em `.gitignore`, inclua:

```gitignore
reports/
```

O relatório LCOV atual continuará vindo do Jest. **Executar Cucumber não incorpora, automaticamente, sua execução aos percentuais de cobertura do Jest ou do SonarQube.** Instrumentar e consolidar cobertura BDD é trabalho adicional fora do escopo.

## 13. Critérios de aceite da atividade

- [ ] Dependências `@cucumber/cucumber` e `tsx` instaladas e versionadas no lockfile.
- [ ] Arquivo `cucumber.cjs` criado, explicado e funcional.
- [ ] Scripts `test:bdd` e `test:bdd:dry` criados sem remover os anteriores.
- [ ] Todos os cenários da feature fornecida têm steps implementados e executados.
- [ ] Há pelo menos um teste de limite, um de erro de negócio e um de entrada inválida.
- [ ] Nos cenários de sucesso e rejeição, os dois saldos reais são verificados.
- [ ] O `World` cria novas contas e novo Map por cenário; execução em ordem aleatória passa.
- [ ] Nenhum step simula artificialmente o sucesso do domínio ou depende de Jest.
- [ ] Relatórios HTML e JSON de uma execução real disponíveis.
- [ ] GitHub Actions executa Jest e Cucumber sem depender de `npm run dev`.
- [ ] Os testes anteriores da Aula 01 e da Aula 02 continuam passando.

## 14. Entrega do aluno

Envie na sua branch: `cucumber.cjs`, `features/step-definitions/transferencias.steps.ts`, `features/support/world.ts`, atualização dos scripts, lockfile e workflow. Apresente os comandos e relatórios de uma execução real, além de uma tabela simples `BDD-xx ↔ step(s) ↔ resultado` e uma breve análise da diferença entre asserções com Jest, testes integrados e BDD executável.

**Não entregue** apenas uma feature em Gherkin ou um print de dry-run: o objetivo é demonstrar cenários efetivamente executados e conectados ao domínio bancário.

## Referências técnicas

- Cucumber.js — instalação: https://cucumber.io/docs/installation/javascript/
- Cucumber.js — configuração: https://github.com/cucumber/cucumber-js/blob/main/docs/configuration.md
- Cucumber.js — execução de TypeScript com tsx: https://github.com/cucumber/cucumber-js/blob/main/docs/transpiling.md
- Cucumber.js — definições de steps e World: https://github.com/cucumber/cucumber-js/blob/main/docs/support_files/step_definitions.md
