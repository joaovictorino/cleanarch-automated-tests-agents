# Instruções do projeto — Aula 02

## Contexto e escopo ativo

Este é um laboratório educacional de testes e desenvolvimento assistido por agentes. A Aula 01 implementou o domínio; a Aula 02 acrescenta Next.js, APIs de contas e transferência, testes de contrato e integração, BDD executável, CI, cobertura, mutação e análise estática.

A autorização para uma etapa vem da tarefa atual do professor/aluno. Execute apenas a etapa solicitada; ao terminá-la, apresente evidências e pare. Não avance automaticamente para a seguinte.

## Fontes de verdade

1. `specs/transferencia.md`: regras e contratos bancários preservados da Aula 01.
2. `specs/criacao-nextjs.md`: preparação e regressão.
3. `specs/erros-aplicacao.md`: extensão explícita das exceções para códigos estáveis.
4. `specs/api-contas.md` e `specs/testes-contas.md`: cadastro, consulta e testes de contas.
5. `specs/api-transferencias.md` e `specs/mocks-e-integracao.md`: transferência HTTP e integração real.
6. `specs/bdd-cucumber.md` e `specs/transferencias.feature`: seis cenários Cucumber obrigatórios.
7. `specs/qualidade-ci.md`: CI, cobertura, Stryker e SonarQube.

Evidências e definição de pronto vêm da seção "Definição de pronto" de cada spec e do relatório final descrito em "Validação por etapa".

O roteiro determina a ordem de trabalho; as specs determinam os resultados esperados. Havendo conflito real, descreva-o antes de alterar contratos. Não invente requisitos para contornar falhas.

## Tecnologias e limites

- Node.js 24, npm, TypeScript strict, Jest e ts-jest já existentes.
- Next.js App Router como adaptador HTTP; React apenas para uma página mínima nesta aula.
- Jest principal com next/jest após a migração; `jest.domain.config.cjs` com ts-jest para mutação.
- Cucumber.js com tsx e carregamento CommonJS. Não adicionar `type: module` nesta atividade.
- Docker somente para SonarQube e scanner.
- Sem banco de dados, ORM, autenticação implementada, formulário bancário, endpoints extras ou infraestrutura de produção.

## Preservação do domínio

Preserve classes, assinaturas, valores em reais, validação monetária, mensagens existentes e testes da Aula 01. Use os caminhos reais da referência: `src/domain/Conta.ts`, `NumeroConta.ts`, `TransferenciaValor.ts` e `Recibo.ts`.

A extensão de exceções descrita em `specs/erros-aplicacao.md` é parte explícita desta revisão. Ela permite adicionar `ErroNegocio` e enriquecer os lançamentos indicados, mantendo mensagens e comportamentos. Não reescreva as operações bancárias.

Saldo, saque, depósito, arredondamento, transferência e validação de comprovante continuam no domínio. O handler valida o contrato de transporte, delega e traduz erros classificados. Nunca classifique erro por substring da mensagem ou converta todo erro desconhecido em HTTP 400.

### Fronteira handler × domínio (anti-duplicação)

- **Transporte (handler pode fazer):** JSON parseável, corpo é objeto, campo presente, `typeof` esperado (`string`/`number`). Nada além disso.
- **Domínio (handler nunca reimplementa):** formato do número da conta, escala de duas casas, positividade, finitude, limite máximo, saldo, mesma conta, arredondamento. Essas regras chegam ao handler como `ErroNegocio` lançado pelo domínio/adaptador e são apenas traduzidas.
- **Vetados em `src/api/**` e `src/app/**`:** `Math.round`, `* 100`, `Number.MAX_SAFE_INTEGER`, `Number.isFinite`/`isInteger` sobre dinheiro, comparações `<= 0`/`< 0` sobre valores monetários e regex de número de conta (`[0-9]{6}`).
- **Antes de escrever qualquer validação:** procure em `src/domain`. Se a regra existe, delegue; se precisar de uma checagem sem construir o objeto, exporte-a do domínio (autorizado só mediante registro da decisão) e importe, nunca copie.
- **Ordem de precedência** dos erros é garantida pelo adaptador de aplicação, usando as classes reais, e não por pré-validação no handler.
- Se um critério de aceite parecer exigir duplicar uma regra de domínio no handler, pare e descreva o conflito antes de implementar.

## Desenvolvimento e testes

Para comportamento novo: selecione um critério, escreva o teste, execute e observe RED, implemente o mínimo, execute GREEN e refatore apenas quando necessário. Configuração de ambiente usa regressão antes/depois, sem inventar RED de negócio.

- Preserve os testes; não apague asserts nem mude resultados esperados para acomodar a implementação.
- Use Arrange–Act–Assert, nomes verificáveis e `test.each` quando os casos representarem a mesma regra.
- Mock HTTP verifica chamadas e respostas. Integração usa Conta e TransferenciaValor reais e verifica ambos os saldos.
- Injete um Map novo por teste e um gerador `() => '123456'`. Não importe o estado global da aplicação nos testes.
- Cucumber usa World/estado novo por cenário e asserções de `node:assert/strict`; não depende do Jest.
- Evite `any`, testes vazios, sleeps, rede, relógio ou aleatoriedade sem controle nos testes de negócio.
- `Request`/`Response` são globais no Node 24; os testes das factories não precisam iniciar Next.
- Um teste de factory não prova a composição da rota ou comunicação HTTP de rede; faça também o smoke manual do roteiro.

## Estado e segurança do laboratório

As rotas de contas e transferência recebem o mesmo Map demonstrativo, inicialmente vazio. O compartilhamento vale somente no mesmo processo; não é persistência confiável, concorrência ou transação distribuída.

Não exponha stack traces ou mensagens técnicas em respostas HTTP. Mantenha tokens em `.env`, fora do Git, dos prompts e das evidências.

## Validação por etapa

Execute os comandos aplicáveis ao que já existe. Base: Jest, `typecheck` e `build:ts`. Depois da migração: também `build` Next. Depois do BDD: `test:bdd`. Ferramentas têm verificações próprias na spec.

Não use `--if-present`, `continue-on-error`, asserts enfraquecidos ou filtros que escondam falhas para declarar conclusão.

Ao terminar, informe: IDs atendidos; arquivos alterados; testes adicionados; RED/GREEN observados; comandos realmente executados e contagens; evidências produzidas; lacunas e decisões. Sem execução, informe a limitação e não declare aprovação.

## Escopo específico da Aula 03

Nesta etapa são autorizados Playwright Test, a tela didática de transferência
na preparação do professor e k6 para consulta HTTP. Essas autorizações
substituem as restrições anteriores que impediam interface e essas ferramentas.
As regras bancárias continuam em specs/transferencia.md; os contratos HTTP
continuam nas specs da Aula 02; o contrato da atividade está em
specs/laboratorio-03.md. Durante o laboratório dos alunos, a tela já é fornecida:
o trabalho principal é escrever testes, investigar falhas e interpretar métricas.
Preservar testes anteriores, valores em reais e o comprovante de seis dígitos.
Não introduzir autenticação, banco de dados, reset de contas ou carga de escrita.
