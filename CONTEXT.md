# Sistema de Atendimento e Gestão (Rigoni Contábil)

Domínio de atendimento a clientes (empresas contábeis) via WhatsApp e de gestão interna por setor da Rigoni Contábil, um escritório de contabilidade.

## Language

### Organização e acesso

**Setor**:
Unidade organizacional do escritório (ex.: Simples Nacional, Tributário), com um líder. Fonte da lista de setores: `organograma.pdf`. Zeladoria é subtime de Financeiro, não é Setor próprio — decisão definitiva, confirmada por Cledson em 25/09/2026 na revisão do #28. Contábil Externo é o mesmo Setor que Contábil (não dois Setores) e T.I. não é Setor próprio — cai dentro de Administrativo, mesmo padrão da Zeladoria — decisão definitiva, confirmada por Cledson em 28/09/2026.
_Avoid_: Departamento, área.

**Papel**:
O nível de acesso de um usuário logado: Admin, Líder de setor ou Funcionário. Determina o que o usuário pode ver e alterar, restrito ao seu Setor exceto para Admin.
_Avoid_: Role, perfil.

**Senha provisória**:
A senha gerada automaticamente quando Admin/Líder cadastra uma conta. Expira em 48h se não trocada; a troca é obrigatória no primeiro login, bloqueando qualquer tela até acontecer. Não elimina o risco de quem autenticar primeiro com ela definir a senha definitiva da conta — ver `docs/adr/0002`.
_Avoid_: Senha temporária, senha padrão.

**Atendente**:
Quem está conduzindo um Atendimento no momento — pode ser a URA ou um Funcionário. Termo genérico usado quando a distinção entre os dois não importa.
_Avoid_: Operador.

**URA**:
Ator de sistema (service role, sem login humano) que conduz o Atendimento automatizado via WhatsApp antes de uma eventual transferência para um Funcionário. Não é um Papel.
_Avoid_: Bot, chatbot.

### Cliente e cadastro

**Cliente**:
Uma empresa cadastrada no sistema, identificada por CNPJ. "Empresa" é o nome do Cliente, não uma entidade separada.
_Avoid_: Empresa (como entidade à parte), conta.

**Regime**:
O regime tributário do Cliente — Simples Nacional, Lucro Presumido, Lucro Real ou MEI, livremente escolhido no cadastro (#33). Só Simples Nacional e MEI ganham Cadastro operacional (ver termo abaixo); Lucro Presumido e Lucro Real não têm cadastro nesta rodada.
_Avoid_: Regime de atendimento (não é isso).

**Cadastro operacional**:
O conjunto de campos que o Funcionário do Simples Nacional mantém atualizado por Cliente — forma de envio, Contatos, documento recebido, DAS, Parcelamento, Atividade do mês, observações gerais (#34). Nasce automaticamente quando o Cliente é cadastrado com Regime Simples Nacional ou MEI (#33), com os campos de status em suas opções negativa/pendente por padrão (documento recebido = negativo; DAS e Parcelamento = pendente) até o Funcionário atualizar de verdade — nunca fica em branco esperando o primeiro acesso. Outros Setores só visualizam; nunca inclui contrato social/alterações contratuais, mesmo pro próprio Funcionário do Simples Nacional.
_Avoid_: Cadastro do cliente (ambíguo com o cadastro básico do #33 — Empresa/CNPJ/Regime/documentos jurídicos).

**Responsável**:
O Funcionário do Simples Nacional atribuído pelo Líder a um Cliente (#65). Um Cliente tem no máximo um; um Funcionário pode ser Responsável por vários. Funcionário só enxerga e edita os Clientes pelos quais é Responsável (RLS no banco); o Líder enxerga todos e é o único que atribui, troca ou remove. Sem atribuição, o Cliente aparece como "Sem responsável".
_Avoid_: Dono, atendente do cliente (Atendente é outro conceito — quem conduz um Atendimento).

**Contato**:
Um vínculo nome + número de WhatsApp a um Cliente. Um Cliente tem um Contato marcado como padrão e pode ter outros Contatos adicionais.
_Avoid_: Cliente (um Contato não é o Cliente, é quem fala em nome dele).

**DAS**:
Documento de Arrecadação do Simples Nacional — a guia de imposto mensal do Cliente, obtida via integração Serpro.
_Avoid_: Guia de imposto (usar DAS quando for especificamente essa guia).

**Parcelamento**:
Acordo de parcelamento de débitos tributários do Cliente junto à Receita, cuja guia também é obtida via Serpro.

**Atividade do mês**:
Registro mensal por Cliente com três marcações independentes (Indústria, Comércio, Serviço), indicando os tipos de nota fiscal emitidos naquele mês — pode mudar mês a mês e não é exclusivo (um Cliente pode ter mais de um tipo marcado no mesmo mês). Usado para determinar o anexo do Simples Nacional aplicável ao cálculo do DAS.
_Avoid_: Regime (é outro conceito — ver acima).

**CND**:
Certidão Negativa de Débitos — documento que atesta a regularidade fiscal do Cliente, obtido via Serpro.

### Atendimento

**Atendimento**:
A sessão completa de contato entre um Contato e o escritório, do início ao encerramento — pode passar por vários Atendentes e Setores via Transferência. Contém muitas Mensagens.
_Avoid_: Conversa, ticket, chamado.

**Mensagem**:
Uma única troca dentro de um Atendimento (um "balão"), enviada pelo Contato ou por um Atendente.
_Avoid_: Balão (usar só informalmente), texto.

**Fila**:
O estado de um Atendimento aguardando um Funcionário disponível no Setor, depois de uma Transferência sem Atendente livre. Não é uma entidade separada do Atendimento — é um estado dele.
_Avoid_: Fila de espera (como entidade própria).

**Transferência**:
A ação de mover um Atendimento de um Atendente/Setor para outro.

**Balanceamento mensal**:
A regra de distribuição de novos Atendimentos entre os Funcionários de um Setor, de forma equilibrada ao longo do mês. Não se aplica à ordem de saída da Fila, que é sempre por antiguidade.

### Auditoria

**Registro de auditoria**:
Evento imutável gravado quando uma ação muda estado no sistema — grava Ator, Setor, ação, alvo e resultado. Nunca registra leituras.
_Avoid_: Log de auditoria, histórico.

**Período**:
Um intervalo de datas sempre com início e fim definidos juntos; não existe Período com só uma ponta preenchida — isso é rejeitado, não interpretado como "a partir de" ou "até". Vale em qualquer filtro por data do sistema, não só no de auditoria.
_Avoid_: Intervalo aberto (não existe nesse domínio).
