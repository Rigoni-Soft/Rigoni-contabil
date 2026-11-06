# Pesquisa: autenticação e requisitos da API Serpro (DAS, parcelamento, CND)

> Referente à issue #17. Pesquisa feita em fontes públicas (documentação oficial Serpro em
> `apicenter.estaleiro.serpro.gov.br`, `loja.serpro.gov.br`, `serpro.gov.br` e material de
> integradores/ERPs contábeis que já usam a API). Datas e preços devem ser reconfirmados
> na Loja Serpro antes de qualquer decisão de contratação, pois mudam com frequência.

## 1. Produto certo: Integra Contador

Não existem três APIs separadas para DAS, parcelamento e CND. O produto oficial do Serpro
que cobre os três casos de uso da spec (seção 5) é o **Integra Contador**
(`loja.serpro.gov.br/integra-contador`), uma plataforma única de APIs para escritórios de
contabilidade e softwares fiscais, organizada em "soluções" (subprodutos):

- **PGDAS-D / DAS** — serviço `PGDASD` dentro do Integra Contador: cálculo do Simples
  Nacional, geração e consulta da guia DAS.
- **Parcelamento** — solução **Integra-Parcelamento**, com serviços por regime:
  `PARCSN`, `PARCMEI`, `PERTSN`, `PERTMEI`, `RELPSN`, `RELPMEI` — consulta de parcelamentos
  e emissão de guia de parcela.
- **CND** — dois caminhos possíveis:
  - dentro do Integra Contador, serviço de situação fiscal/CND do contribuinte; ou
  - produto avulso **Consulta CND** (`loja.serpro.gov.br/consulta-cnd`), que consulta
    diretamente as bases da PGFN — mais direcionado a quem só precisa de CND, sem o resto
    do Integra Contador.

Para o escopo do sistema (DAS + parcelamento + CND, tudo por CNPJ de cliente), o caminho
mais simples é contratar só o **Integra Contador**, que cobre os três.

## 2. Autenticação

- Protocolo **OAuth2**, fluxo `client_credentials`.
- Após contratar na Loja Serpro, a Área do Cliente (`cliente.serpro.gov.br`) libera duas
  credenciais por contrato: **Consumer Key** e **Consumer Secret**.
- Token: `POST https://autenticacao.sapi.serpro.gov.br/authenticate`
  - Header `Authorization: Basic base64(consumerKey:consumerSecret)`
  - Header `Role-Type: TERCEIROS` (acesso em nome de terceiros — ver seção 4)
  - Corpo `grant_type=client_credentials`
  - **Exige um certificado digital e-CNPJ (ICP-Brasil), formato .p12/.pfx**, apresentado
    na própria chamada de autenticação. O certificado é o **do escritório contratante**,
    não do cliente final.
  - Retorna `access_token` (Bearer, curta duração, ~30min) + `jwt_token`.
- Chamadas de negócio: `POST https://gateway.apiserpro.serpro.gov.br/integra-contador/v1/...`
  com `Authorization: Bearer {access_token}` e `jwt_token: {jwt_token}`.
- Token expira (401) → repetir o passo de autenticação.

Implicação de arquitetura: o backend precisa guardar o certificado e-CNPJ do escritório
(arquivo .p12 + senha) como segredo de infraestrutura, e um job/serviço de emissão de
token com renovação automática — não é credencial por usuário do sistema, é uma única
identidade (a pessoa jurídica do escritório) usada para todas as chamadas.

## 3. Payload / resposta

- **JSON** em todas as chamadas de negócio (não XML), `Content-Type: application/json`,
  UTF-8, convenção `camelCase`.
- Corpo de requisição padronizado com 4 blocos: `contratante` (o escritório), `autorPedidoDados`
  (quem está pedindo — normalmente o mesmo do contratante), `contribuinte` (CNPJ do cliente
  cujo dado se quer), e `pedidoDados` (`idSistema`, `idServico`, `versaoSistema`, `dados`
  específicos do serviço, ex.: período de apuração para o PGDAS-D).
- Resposta também em JSON, com um envelope padrão + `dados` específico do serviço (ex.: para
  procuração: `dtexpiracao`, `nrsistemas`, `sistemas`).
- Assinatura digital XML aparece em outros contextos (ex.: envio de declarações), mas as
  chamadas normais de consulta/emissão usadas aqui são JSON puro sobre HTTPS/REST.

## 4. Procuração eletrônica — ponto crítico para este sistema

Este é o ponto que mais importa para a arquitetura, porque o sistema não vai consultar o
próprio CNPJ do escritório, e sim ~1.000 CNPJs de clientes diferentes.

- O certificado e-CNPJ usado na autenticação é sempre o do **escritório contratante**
  (Rigoni Contábil), não o de cada cliente. Isso está certo e é o esperado — não seria
  viável nem faz sentido ter certificado de cada cliente.
- Para consultar dados de um CNPJ que não é o do contratante, a maioria dos serviços do
  Integra Contador **exige procuração eletrônica válida** registrada previamente pelo
  cliente (outorgante) autorizando o escritório (outorgado) no **portal e-CAC** da Receita
  Federal — é o mesmo mecanismo de procuração eletrônica já usado hoje fora da API.
- O Serpro expõe isso como um serviço próprio: **Integra-Procurações**
  (`idSistema: PROCURACOES`, `idServico: OBTERPROCURACAO41`), que consulta se existe
  procuração vigente entre outorgante (cliente) e outorgado (escritório) e para quais
  sistemas ela vale, retornando data de expiração. Nem todo serviço do Integra Contador
  exige procuração — existe uma tabela oficial "Serviços x Procurações" que mapeia quais
  serviços pedem e quais não.
- **A API não cria/concede a procuração.** Ela só consulta se já existe uma procuração
  ativa. A concessão em si é um ato que o **cliente** (ou seu representante legal) precisa
  fazer manualmente no e-CAC, com certificado digital ou código de acesso, autorizando
  explicitamente a Rigoni Contábil.
- Procurações eletrônicas no e-CAC **têm prazo de validade** (a resposta traz
  `dtexpiracao`) e podem ser revogadas pelo outorgante a qualquer momento — ou seja, não é
  "configura uma vez e esquece": o sistema precisa monitorar validade e sinalizar quando
  uma procuração está perto de vencer ou foi revogada, para não quebrar silenciosamente a
  automação daquele cliente.

### Consequência prática para ~1.000 clientes

Isso é um requisito operacional pesado, não só técnico: para os ~1.000 CNPJs funcionarem
na automação, cada um precisa ter, individualmente, outorgado procuração eletrônica ao
CNPJ da Rigoni Contábil no e-CAC, cobrindo os sistemas relevantes (PGDAS-D, parcelamento,
situação fiscal/CND). Pontos a decidir com o usuário:

1. **Quantos dos ~1.000 clientes já têm procuração e-CAC vigente para o escritório hoje?**
   (Provavelmente muitos, já que procuração e-CAC é prática comum em contabilidade — mas
   precisa ser levantado, não assumido.)
2. Quem faz o trabalho de regularizar/renovar procurações faltantes ou vencidas — isso é
   fora do escopo de código, é operação/relacionamento com cliente.
3. O sistema deveria ter uma tela/relatório de **status de procuração por cliente**
   (vigente / vencendo / vencida / ausente), usando o serviço `PROCURACOES`, para a equipe
   saber para quem a automação de DAS/parcelamento/CND vai funcionar e para quem não vai.
4. Tratamento de erro: quando a procuração está ausente ou vencida, a chamada ao
   PGDAS-D/parcelamento/CND falha para aquele CNPJ especificamente — o backend precisa
   tratar isso como falha esperada por cliente, não como erro de sistema, e reportar de
   forma acionável (ex.: "cliente X sem procuração válida", não um erro genérico).

## 5. Custo

- Modelo de tarifação por consumo mensal, pós-pago, sem fidelidade contratual, agrupado em
  8 faixas de preço, por 3 categorias de operação: **Consultas**, **Emissão** e
  **Declaração**. Quanto maior o volume mensal do contratante, menor o valor por chamada.
  A tabela oficial e atualizada de valores por faixa fica na página do produto na Loja
  Serpro (não capturada aqui em detalhe — varia e deve ser confirmada lá antes de orçar).
- Exemplo de referência encontrado (fonte de terceiro, não oficial): uma empresa do Simples
  Nacional gera ~6 interações/mês (2 declarações + 2 consultas + 2 emissões). Para uma
  carteira de 50 clientes isso dá ~R$ 96/mês (~R$ 1,92/cliente); para 200 clientes,
  ~R$ 334/mês (~R$ 1,67/cliente) — o custo por cliente cai com volume por causa das faixas.
  **Extrapolando (não oficial, só ordem de grandeza) para ~1.000 clientes**: por volta de
  R$ 1.000–1.700/mês, possivelmente menos se a faixa de maior volume tiver desconto maior
  — precisa ser confirmado com a tabela oficial de preços e o padrão real de uso do
  sistema (nem todo cliente vai gerar DAS/parcelamento/CND todo mês).
- A contratação inicial na Loja Serpro é gratuita; ao confirmar, o contratante autoriza a
  cobrança recorrente pelo uso.

## 6. Fontes

- [Integra Contador — visão geral e soluções](https://apicenter.estaleiro.serpro.gov.br/documentacao/api-integra-contador/pt/solucoes/)
- [Como autenticar na API — Integra Contador](https://apicenter.estaleiro.serpro.gov.br/documentacao/api-integra-contador/pt/quick_start/)
- [Integra-Procurações — Obter procuração](https://apicenter.estaleiro.serpro.gov.br/documentacao/api-integra-contador/pt/solucoes/integra-procuracoes/procuracoes/servicos/obter_procuracao/)
- [Serviços x Procurações](https://apicenter.estaleiro.serpro.gov.br/documentacao/api-integra-contador/pt/servicos_vs_procuracoes/)
- [Integra-Parcelamento — Introdução](https://apicenter.estaleiro.serpro.gov.br/documentacao/api-integra-contador/pt/solucoes/integra-parcelamento/pertsn/)
- [Serpro/RFB: Integra Parcelamento (notícia oficial)](https://www.serpro.gov.br/menu/noticias/noticias-2024/integra-parcelamento)
- [Consulta CND — Loja Serpro](https://www.loja.serpro.gov.br/consulta-cnd/product/consultacnd)
- [Consulta CND — documentação da API](https://apicenter.estaleiro.serpro.gov.br/documentacao/consulta-cnd/)
- [Integra Contador — Loja Serpro (produto)](https://loja.serpro.gov.br/integra-contador/product/integracontador)
- [Análise de custos do Integra Contador (SCI Sistemas Contábeis, fonte não oficial)](https://www.blog.sci.com.br/post/an%C3%A1lise-de-custos-do-integra-contador-o-que-toda-empresa-cont%C3%A1bil-deve-saber)
- [C1725 — Contratação e Procuração (Alterdata, fonte de integrador)](https://ajuda.alterdata.com.br/prosoftcontabil/c1725-simples-nacional-serpro-integra-contador-contratacao-e-procuracao-220178525.html)

## 7. Próximos passos sugeridos

1. Levantar quantos dos ~1.000 clientes já têm procuração e-CAC vigente para o escritório
   (decisão de negócio/operação, não técnica).
2. Confirmar tabela de preços atual e simular custo real com o padrão de uso esperado do
   sistema (nem todo cliente consulta todo mês).
3. Contratar acesso de homologação/trial do Integra Contador para validar payloads reais
   antes de implementar o cliente HTTP.
4. Desenhar a tela/relatório de status de procuração por cliente como parte do backlog,
   não como afterthought — é pré-requisito funcional para a automação de DAS/parcelamento/CND
   funcionar na prática.
