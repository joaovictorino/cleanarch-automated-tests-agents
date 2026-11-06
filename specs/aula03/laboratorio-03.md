# SPEC-LAB03-001 — Interface, diagnóstico e performance

## 1. Objetivo e entregas

Automatizar duas jornadas de transferência pelo navegador, verificar seus efeitos no servidor e diagnosticar falhas com evidências. A comparação de performance complementa a atividade. A demonstração manual da tela usa PostgreSQL local via Docker, com migration e seed; os testes continuam em memória.

| Parte | Entrega | Obrigatoriedade |
| --- | --- | --- |
| Interface | Dois testes Playwright: transferência aceita e saldo insuficiente | Obrigatória |
| Confiabilidade | Dados independentes, locators estáveis e verificação dos dois saldos | Obrigatória |
| Diagnóstico | Relatório HTML, um trace analisado e registro da investigação | Obrigatória |
| CI | Job Chromium com publicação de evidências, inclusive quando falhar | Obrigatória; execução em repositório próprio ou evidência fornecida pelo professor |
| Performance | Interpretar p95, vazão, falhas, checks e thresholds | Obrigatória; usar medições próprias ou material fornecido pelo professor |
| Execução k6 | Comparar 5 e 10 VUs por 30 segundos | Demonstração guiada ou extensão opcional |

## 2. Estado da referência e condição de início

Nesse snapshot existem o domínio bancário, quatro arquivos de testes de domínio, specs da Aula 02 e configurações Next/Jest. **Não existem `src/app`, APIs implementadas, tela de transferência, Playwright ou script k6.** A presença de Next nas dependências não significa que a aplicação esteja pronta. Esta especificação define a evolução necessária. 

### 2.1. Preparação obrigatória

| ID | Condição verificável antes de distribuir a base |
| --- | --- |
| PRE-01 | APIs da Aula 02 implementadas conforme `specs/api-contas.md` e `specs/api-transferencias.md`, com domínio real e leitura dos saldos atualizados por HTTP |
| PRE-02 | Tela `/transferencias` disponível conforme UI-01..05; criação → transferência → consulta funcionando no servidor Next efetivamente usado pelo Playwright |
| PRE-03 | Node.js 24, dependências e lockfile ensaiados; Playwright e Chromium preparados; Jest e Playwright descobrem apenas seus próprios testes |
| PRE-04 | Instruções de escopo do `AGENTS.md` atualizadas para a Aula 03; regressão, tipos e build executados; commit do checkpoint registrado |
| PRE-05 | Helper de criação/consulta de contas entregue e validado, sem testes E2E de solução prontos; comandos, relatórios e uma evidência de diagnóstico disponíveis |
| PRE-06 | Demonstração local com PostgreSQL/Docker, migration e seed preparada conforme 2.2; Playwright, k6, regressão e CI continuam executáveis com o banco desligado |

O `AGENTS.md` atual ainda contém restrições das aulas anteriores, inclusive proibição de frontend. Doiseve acrescentar uma seção específica da Aula 03 autorizando a tela didática e o banco local para demonstração durante a preparação, com testes Playwright/k6 e CI em memória nesta etapa, preservando as regras bancárias e as restrições de segurança. Não enviar um agente para implementar a interface com instruções que ainda a proíbam.

O ambiente é um processo Next.js local na porta 3000, com frontend e API na mesma origem. Não há autenticação no exercício. Não criar login, token ou serviço na porta 3001 apenas para reproduzir exemplos ilustrativos dos slides.

Nos testes Playwright/k6 e na CI, o `Map` continua como armazenamento didático em memória. O checkpoint deve comprovar o compartilhamento do estado entre as rotas na execução real do Next. Reinício, hot reload, múltiplos processos e serverless podem perder ou divergir esse estado. Os testes verificam estado no servidor durante a execução; não comprovam persistência durável.

### 2.2. Banco apenas para demonstração local

Usar a mesma tela, as mesmas APIs e o mesmo domínio com seleção do armazenamento no servidor, por variável de ambiente. A inclusão do banco é parte da preparação da aplicação, sem criar novos exercícios de teste.

| Uso | Configuração | Dados |
| --- | --- | --- |
| Demonstração manual | `CONTAS_STORAGE=postgres` | PostgreSQL local via Docker, migration e seed |
| Playwright, k6, regressão e CI | `CONTAS_STORAGE=memory` (padrão) | `Map` existente; helper e `setup()` atuais |

Entregar `docker-compose.yaml` com serviço `db`, PostgreSQL com versão fixa, volume persistente e healthcheck; migration versionada da tabela de contas; seed; `.env.example`; e os comandos `db:migrate` e `db:seed`. Manter a aplicação Next fora do Docker. A migration preserva número de conta como texto de seis dígitos e saldo com duas casas decimais. O seed cria, sem duplicar ou sobrescrever contas existentes, `123456` com R$ 1.000,00 e `654321` com R$ 200,00.

Configurar em `.env.local` o `DATABASE_URL` de desenvolvimento indicado em `.env.example`, compatível com o serviço `db` (por exemplo, `postgresql://lab03:lab03@127.0.0.1:5432/lab03`). Os scripts de migration e seed devem carregar essa configuração. Não salvar `CONTAS_STORAGE=postgres` nesse arquivo; selecionar o modo somente na inicialização da demonstração.

```bash
docker compose up -d --wait db
npm run db:migrate
npm run db:seed
npm run build
CONTAS_STORAGE=postgres npm run start -- --hostname 127.0.0.1 --port 3000
```

Abrir `/transferencias`, consultar as duas contas do seed e fazer uma transferência manual de R$ 300,00. Demonstrar os saldos 700/500 após reiniciar a aplicação no mesmo modo, sem recriar o volume. O adaptador PostgreSQL reutiliza o domínio e persiste os dois saldos na mesma transação; os contratos HTTP e a tela permanecem os mesmos.

Encerrar o servidor antes dos testes. O `webServer` do Playwright deve forçar `CONTAS_STORAGE=memory` no ambiente do processo Next. Para k6, iniciar o servidor com `CONTAS_STORAGE=memory`. Não executar migration/seed nem abrir conexão com PostgreSQL no modo `memory`, no build ou ao importar módulos. A existência de `DATABASE_URL` não seleciona o banco. Validar as execuções de testes com `docker compose stop db`: massa por HTTP, cenários e critérios das seções 5 a 9 continuam iguais.

## 3. Contratos herdados da Aula 02

Regras bancárias continuam em `specs/transferencia.md`. Esta aula acrescenta contratos de interface e de automação; não altera os contratos de domínio e HTTP.

| Operação | Requisição | Sucesso |
| --- | --- | --- |
| Criar conta | `POST /api/contas`, `{"numero":"123456","saldoInicial":1000}` | 201; `{"numero":"123456","saldo":1000}` |
| Consultar conta | `GET /api/contas/123456` | 200; `{"numero":"123456","saldo":1000}` |
| Transferir | `POST /api/transferencias`, `{"contaOrigem":"123456","contaDestino":"654321","valor":300}` | 201; `{"comprovante":"123456"}` |
| Rejeitar por saldo | Transferência maior que o saldo disponível | 422; `{"erro":"SALDO_INSUFICIENTE"}`; ambos os saldos preservados |

Contas são strings de seis dígitos ASCII. Valores da API são números em **reais**, com até duas casas decimais. O comprovante é uma string que satisfaz `^[0-9]{6}$`.

### 3.1. Ajustes 

| Tema | Contrato deste laboratório |
| --- | --- |
| Unidade monetária | Reais na API e no campo `Valor (R$)`; não dividir/multiplicar os valores por 100 |
| Campos da transferência | `contaOrigem`, `contaDestino`, `valor` |
| Comprovante | Propriedade `comprovante`, seis dígitos, sem prefixo `TRF-` |
| URLs | Tela `/transferencias`; API `/api/contas` e `/api/transferencias`, na mesma origem |
| Autenticação | Ausente nesta base; os exemplos de Bearer token não se aplicam |
| Infraestrutura | Playwright/k6 e CI em memória; PostgreSQL via Docker, migration e seed somente para demonstração manual local, conforme 2.2 |

## 4. Contrato da tela didática

| ID | Comportamento |
| --- | --- |
| UI-01 | `/transferencias` apresenta campos com labels associados `Conta origem`, `Conta destino` e `Valor (R$)`, além do botão `Transferir` |
| UI-02 | Campos de conta preservam strings e zeros à esquerda. Ao perder o foco de cada campo de conta válido, a tela consulta seu saldo por GET. Os resultados usam `data-testid="saldo-origem"` e `data-testid="saldo-destino"` |
| UI-03 | O envio converte apenas o valor para número e chama `POST /api/transferencias` com o contrato herdado. O campo monetário aceita até duas casas decimais; nos testes, preencher `300` ou `1001` |
| UI-04 | No sucesso, mostrar mensagem `Transferência realizada` em `role="status"` e o código, sem texto adicional, em `data-testid="comprovante-id"`. Reconsultar ambos os saldos pela API e atualizar a tela |
| UI-05 | Em 422 `SALDO_INSUFICIENTE`, mostrar `Saldo insuficiente` em `role="alert"`, não mostrar comprovante de sucesso e reconsultar ambos os saldos. Limpar resultados anteriores ao iniciar uma nova submissão |

Exibir os saldos em pt-BR: `R$ 1.000,00`, `R$ 200,00`, `R$ 700,00` e `R$ 500,00`, conforme o estado. Um espaço comum ou não separável após `R$` é uma diferença de formatação aceitável; números, separadores e casas decimais precisam corresponder ao valor esperado.

A tela não calcula o saldo final para substituir a consulta ao servidor e não implementa regras bancárias. Para uma rejeição de negócio, não usar uma validação de saldo no cliente que impeça a chamada HTTP 422 exigida pelo cenário.

## 5. Massa independente e ciclo de vida

Cada teste cria duas contas novas por `POST /api/contas`. Os números usados abaixo ilustram o formato; o helper entrega os números efetivamente criados.

| Cenário | Origem inicial | Destino inicial | Valor em reais | HTTP | Origem final | Destino final |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| E2E-01 — aceita | 1000 | 200 | 300 | 201 | 700 | 500 |
| E2E-02 — rejeitada | 1000 | 200 | 1001 | 422 | 1000 | 200 |

```ts
import type { APIRequestContext } from '@playwright/test';

// Assinaturas de referência, não implementação pronta.
export type ContaDTO = { numero: string; saldo: number };
export type ParContas = { origem: ContaDTO; destino: ContaDTO };

export declare function prepararContas(
  request: APIRequestContext,
  saldos: { saldoOrigem: number; saldoDestino: number },
): Promise<ParContas>;

export declare function consultarConta(
  request: APIRequestContext,
  numero: string,
): Promise<ContaDTO>;
```

O helper deve:

1. Gerar candidatos de seis dígitos, preservar strings e criar contas com números diferentes.
2. Exigir 201 e conferir número/saldo retornados. Repetir a geração somente se houver 409 `CONTA_JA_EXISTE`, com limite de dez tentativas por conta; outros erros falham imediatamente.
3. Confirmar por GET o estado inicial das duas contas antes de entregá-las ao teste. `consultarConta` exige HTTP 200 e valida o DTO; um 404 não pode virar saldo zero.
4. Criar um par novo a cada chamada, inclusive em repetição e execução por navegador. Não compartilhar massa criada em `beforeAll`.

A seleção de números pode variar; saldos, entrada e resultados esperados permanecem controlados. O teste registra o par recebido. Uma colisão de cadastro tratada não autoriza retry do teste.

Não existe endpoint de reset, atualização ou exclusão de contas no contrato. Não inventar `/reset` nem importar o `Map` da aplicação no runner. O processo descartável encerra ao fim da execução e libera os dados. Durante a execução, cada par pertence a um teste; não apagar/resetar dados utilizados por outros casos.

## 6. Critérios dos testes Playwright

### E2E-01 — transferência aceita

Dado um par novo com saldos 1000 e 200, abrir `/transferencias`, preencher os números recebidos pelo helper e informar `300`.

Antes do clique, verificar os saldos iniciais na tela e iniciar a observação da resposta de `POST /api/transferencias`. Submeter pelo botão `Transferir`.

Asserções obrigatórias:

- O navegador enviou `{contaOrigem, contaDestino, valor: 300}` com os números desse cenário e valor numérico.
- A resposta observada foi 201, com comprovante de seis dígitos.
- A mensagem de sucesso está visível e o código mostrado é igual ao da resposta real.
- A interface mostra origem `R$ 700,00` e destino `R$ 500,00`.
- Duas consultas HTTP independentes, após a submissão, retornam os números corretos e saldos 700 e 500.

Não exigir um código fixo: o comprovante desta jornada é gerado pelo domínio real.

### E2E-02 — saldo insuficiente

Preparar outro par com saldos 1000 e 200. Abrir a tela, confirmar os saldos iniciais e enviar `1001` pelo formulário.

Asserções obrigatórias:

- O navegador enviou `{contaOrigem, contaDestino, valor: 1001}` com os números desse cenário.
- A resposta foi 422, com corpo `{"erro":"SALDO_INSUFICIENTE"}`.
- O alerta de saldo insuficiente está visível; não há mensagem/comprovante de sucesso visível.
- A interface preserva origem `R$ 1.000,00` e destino `R$ 200,00`.
- Duas consultas HTTP independentes confirmam os números e os saldos 1000 e 200.

Um teste que apenas verifica o alerta não satisfaz E2E-02.

### Critérios transversais

| ID | Critério verificável |
| --- | --- |
| E2E-03 | Navegador, API HTTP e domínio reais; sem `page.route().fulfill`, mock de transferência, sobrescrita de saldo ou comprovante fabricado nos dois cenários obrigatórios |
| E2E-04 | Pares independentes por teste; ambos passam sozinhos e em uma execução com `--repeat-each=3`, sem depender da ordem |
| E2E-05 | Usar papel/nome, label e test IDs previstos; asserções web-first; sem `waitForTimeout`, sincronização por `networkidle`, seletores posicionais ou retry para mascarar falhas |
| E2E-06 | Dois casos descobertos no Chromium; `workers: 1`, `retries: 0`; Jest não executa arquivos E2E e Playwright não coleta testes de domínio |

Aguardar uma resposta real com `page.waitForResponse` não é mock. Registrar a espera **antes** do clique, filtrar método POST e pathname exato `/api/transferencias` e ler o JSON da resposta uma vez. Aguardar os saldos da tela com asserções web-first antes de consultar o estado final por `request`.

## 7. Diagnóstico e evidências

| ID | Critério |
| --- | --- |
| DIAG-01 | Gerar relatório HTML; usar `trace: 'retain-on-failure'` e `screenshot: 'only-on-failure'` com retries zero |
| DIAG-02 | Analisar uma falha real ou uma falha controlada, preservando relatório/trace em pasta própria antes de executar a versão corrigida |
| DIAG-03 | Registrar primeira divergência, estado inicial, locator, request/response e observação dos logs do servidor; distinguir fato, hipótese, causa sustentada e correção |

Se não houver falha espontânea, alterar temporariamente a expectativa de saldo final de 700 para 701 em uma cópia local não commitada do teste E2E-01. O erro deve produzir evidência de falha de asserção do teste, com a API e a UI mostrando 700. Restaurar 700 e executar a suíte final. Essa simulação não é um defeito encontrado na aplicação e não é um experimento de mutação com Stryker.

Com todos os testes aprovados, a ausência de trace retido é normal. A evidência da investigação vem da execução separada que falhou. O relatório final aprovado e o relatório da investigação devem ser identificáveis.

## 8. CI e regressão

| ID | Critério |
| --- | --- |
| CI-01 | Preservar os checks anteriores aplicáveis; adicionar job E2E com `npm ci`, Chromium/dependências do sistema, build e execução dos dois cenários |
| CI-02 | Publicar `playwright-report/` e `test-results/` com `if: always()`; falhas dos testes mantêm o job reprovado, sem `continue-on-error` ou `|| true` |
| CI-03 | Registrar commit e execução real da CI; não deixar `test.only`, `test.skip`, teste vazio ou falha controlada na entrega final |

O job E2E deve iniciar o servidor com `CONTAS_STORAGE=memory`; não incluir serviço PostgreSQL, Docker, migration ou seed na CI.

## 9. Performance com k6 — demonstração ou extensão

### 9.1. Modelo de carga

Testar **consulta**, usando `GET /api/contas/{numero}` de uma conta sintética com saldo 1000, preparada antes da carga. Não executar transferências concorrentes sobre o `Map` demonstrativo.

| Parâmetro | Definição |
| --- | --- |
| Executor | `constant-vus`, modelo fechado |
| Linha de base | 5 VUs por 30 segundos |
| Comparação | 10 VUs por 30 segundos; alterar apenas os VUs |
| Iteração | Um GET e `sleep(1)`; pausa representa tempo entre ações |
| Massa | Uma conta criada e verificada em `setup()`; somente leitura durante as iterações |
| Marcador | Tag `operacao: 'consulta'` nas requisições e nos checks de carga; preparação com outra tag |
| Ambiente | Mesmo build e máquina, sem Playwright simultâneo; registrar versões, modo de execução, horário e aquecimento |

`setup()` executa uma vez e devolve número/saldo para os VUs. Não é um mecanismo de estado mutável compartilhado. A conta pode ser compartilhada porque a carga é somente leitura. O encerramento do processo descartável remove os dados; não criar API de exclusão apenas para a demonstração.

### 9.2. Critérios e interpretação

| ID | Critério |
| --- | --- |
| PERF-01 | Declarar modelo, duração, pausa, ambiente e dados; executar o arquivo `.ts` no runtime k6, não com Node ou Jest |
| PERF-02 | Validar em cada resposta HTTP 200, número da conta e saldo 1000; JSON inválido produz check falso e não pode ser ignorado |
| PERF-03 | Aplicar thresholds às submétricas com tag `operacao:consulta`: p95 < 500 ms; falhas HTTP < 1%; checks > 99%; pelo menos uma requisição de consulta |
| PERF-04 | Registrar p95, req/s, falhas, checks, thresholds e status de saída; comparar a mesma operação entre 5 e 10 VUs |
| PERF-05 | Limitar a conclusão ao ambiente e às consultas medidas; não inferir capacidade máxima, estabilidade prolongada ou comportamento de transferências |

Os limites são **critérios didáticos propostos**, não um SLO contratado. Devem ser declarados antes da execução e mantidos na comparação, mesmo se reprovarem. Usar `http_req_failed` com resposta esperada 200 para esta consulta. Um 422 não é esperado no fluxo de leitura.

A tag deve estar também no terceiro argumento de `check`; tags da requisição não são automaticamente o contrato dos checks. Não misturar a criação/aquecimento do `setup()` com os resultados de consulta. O relatório deve identificar a submétrica usada, inclusive ao registrar vazão.

VUs não equivalem a req/s. `http_req_duration` mede a requisição HTTP e não a renderização no navegador. Check falso não reprova sozinho a execução; o threshold de checks cumpre esse papel. Trinta segundos não demonstram soak nem vazamento de memória. Em memória, não há evidência para diagnosticar um pool de banco inexistente.

## 10. Fora do escopo

Nova regra bancária, autenticação, banco/ORM nos testes e na CI, endpoint de reset, carga concorrente de escrita, teste de estresse/soak real, preparação de produção e avaliação de LLMs. Firefox/WebKit e teste de campo vazio são extensões; não substituem os dois cenários obrigatórios no Chromium.
