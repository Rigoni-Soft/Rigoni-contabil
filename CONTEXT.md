# Sistema de Atendimento e Gestão (Rigoni Contábil)

Domínio de atendimento a clientes (empresas contábeis) via WhatsApp e de gestão interna por setor da Rigoni Contábil, um escritório de contabilidade.

## Language

### Organização e acesso

**Setor**:
Unidade organizacional do escritório (ex.: Simples Nacional, Tributário), com no máximo um Líder de setor ativo (não desativado) por vez — promover outro exige rebaixar o atual antes (#57). Fonte da lista de setores: `organograma.pdf`. Zeladoria é subtime de Financeiro, não é Setor próprio — decisão definitiva, confirmada por Cledson em 25/09/2026 na revisão do #28. Contábil Externo é o mesmo Setor que Contábil (não dois Setores) e T.I. não é Setor próprio — cai dentro de Administrativo, mesmo padrão da Zeladoria — decisão definitiva, confirmada por Cledson em 28/09/2026.
_Avoid_: Departamento, área.

**Papel**:
O nível de acesso de um usuário logado: Admin, Líder de setor ou Funcionário. Determina o que o usuário pode ver e alterar, restrito ao seu Setor exceto para Admin.
_Avoid_: Role, perfil (como sinônimo de Papel — "perfil" é a tela abaixo).

**Perfil**:
A tela "Meu perfil" (`/perfil`), acessível a qualquer usuário logado, exceto enquanto a troca obrigatória de Senha provisória estiver pendente (que bloqueia qualquer tela): mostra a própria conta (nome, e-mail, Papel, Setor) e permite trocar a própria senha por escolha. Não confundir com Papel nem com a troca obrigatória de Senha provisória (`/trocar-senha`).

**Senha provisória**:
A senha gerada automaticamente quando Admin/Líder cadastra uma conta. Expira em 48h se não trocada; a troca é obrigatória no primeiro login, bloqueando qualquer tela até acontecer. Não elimina o risco de quem autenticar primeiro com ela definir a senha definitiva da conta — ver `docs/adr/0002`.
_Avoid_: Senha temporária, senha padrão.

**Atendente**:
Quem está conduzindo um Atendimento no momento — pode ser a URA ou um Funcionário. Termo genérico usado quando a distinção entre os dois não importa.
_Avoid_: Operador.

**URA**:
Ator de sistema (service role, sem login humano) que conduz o Atendimento automatizado via WhatsApp antes de uma eventual transferência para um Funcionário. Não é um Papel.
_Avoid_: Bot, chatbot.

**Expediente**:
Janela em que a URA atende: dia útil (não sábado, domingo nem feriado), das 8h às 18h, horário de São Paulo. Fora dele a URA só responde um aviso com a volta do escritório — sem menu, documento, sessão nem Atendimento. Atendimento em andamento segue até ser finalizado e continua anexando as Mensagens do número. Feriados nacionais (fixos e móveis) estão no código; estaduais e municipais são cadastrados pelo Admin e auditados.
_Avoid_: Horário comercial, plantão.

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
O Funcionário do Simples Nacional atribuído pelo Líder a um Cliente (#65). Um Cliente tem no máximo um; um Funcionário pode ser Responsável por vários. Funcionário só enxerga e edita os Clientes pelos quais é Responsável (RLS no banco); o Líder enxerga todos e é o único que atribui, troca ou remove. Sem atribuição, o Cliente aparece como "Sem responsável". Funcionário removido (conta excluída) também deixa o Cliente sem responsável; a desativação (soft delete) nasce no #58, que deve fazer o mesmo.
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
A sessão completa de contato entre um Contato e o escritório, do início ao encerramento — pode passar por vários Atendentes e Setores via Transferência. Contém muitas Mensagens. **Começa quando o contato é encaminhado a um humano** (um Setor ou a Fila): a conversa com a URA antes disso (saudação, "já é cliente?", CNPJ, menu) não é guardada como Mensagem; quem recebe o Atendimento vê o resumo e o CNPJ informado na URA (#46), não os balões (decisão do usuário, 2026-10-08, devolutiva da PR #77, B5).
O Atendimento que a URA abre na recepção traz o motivo (resumo) e, se o número informou, o CNPJ: o CNPJ de um Cliente liga o Atendimento a ele; CNPJ que não existe no sistema é um provável cliente novo. Nenhum Contato é salvo.
_Avoid_: Conversa, ticket, chamado.

**Mensagem**:
Uma única troca dentro de um Atendimento (um "balão"), enviada pelo Contato ou por um Atendente.
_Avoid_: Balão (usar só informalmente), texto.

**Inatividade**:
Atendimento em andamento com Funcionário parado por 2 horas de expediente (a noite, o fim de semana e os feriados não contam): a última Mensagem é do Funcionário e o cliente não responde, ou é do cliente e o Funcionário não responde. A URA avisa quem está inativo (o cliente pelo WhatsApp; o Funcionário na tela de atendimento, que ainda não existe — o aviso fica gravado no Atendimento) e, sem ação em 10 minutos de expediente, encerra o Atendimento como o encerramento comum, auditado com a URA como ator. Mensagem de quem estava inativo cancela o encerramento. O Funcionário segue dono do Atendimento até lá. Atendimento na Fila não entra.

**Fila**:
O estado de um Atendimento aguardando um Funcionário disponível no Setor — ao abrir, ou depois de uma Transferência, sem Atendente livre. Não é uma entidade separada do Atendimento — é um estado dele. A fila pode ser do Setor ou de um usuário específico (destino fixo ocupado, ex.: Responsável do Cliente). O cliente recebe sua posição; o Setor vê quem espera, com o que já foi coletado e o tempo de espera (mm:ss, h:mm:ss a partir de 1h). Quando um Funcionário fica livre (encerra ou transfere o Atendimento), assume o cliente mais antigo da fila do Setor ou da sua própria, sempre por antiguidade de entrada na fila e não pela ordem do Balanceamento; esse Atendimento ainda conta no Balanceamento mensal dele. Nenhum Atendimento novo ou transferido passa na frente de um mais antigo e elegível: se o Funcionário escolhido está livre mas há alguém esperando, o mais antigo assume e o recém-chegado espera (PR #77, B3). Desativar um usuário devolve à fila do Setor os Atendimentos dele (e os que esperavam na fila pessoal dele), na posição da criação do Atendimento e com auditoria; havendo Funcionário ativo livre no Setor, o mais antigo da fila é atribuído a ele na mesma operação. Mensagens e o crédito por assunção não mudam; a desconexão temporária (#48) segue só mantendo a atribuição (PR #77, 2ª devolutiva).
_Avoid_: Fila de espera (como entidade própria).

**Transferência**:
A ação de mover um Atendimento de um Atendente/Setor para outro. O Funcionário transfere pelo Painel do Funcionário: escolhe o Setor de destino (nunca o Setor em que o Atendimento já está) e informa o resumo do assunto. Depois de transferir ele perde o controle e a visão da conversa: a tela sai dela e abre o Atendimento da Fila que ele assumiu ao ficar livre, ou volta ao início (#49).
Para o Setor Simples Nacional só vale para Cliente do Simples Nacional ou MEI e ignora o Balanceamento mensal: vai ao Responsável do Cliente ou, sem Responsável, ao Líder do Setor; se o destino estiver ocupado, o Atendimento entra na fila dele. Responsável inativo (usuário desativado, #58) não conta: o Atendimento vai ao Líder.

**Balanceamento mensal**:
A regra de distribuição de novos Atendimentos entre os usuários de um Setor (Admin, Líder de setor e Funcionário — todos podem assumir Atendimento), de forma equilibrada ao longo do mês. Não se aplica à ordem de saída da Fila, que é sempre por antiguidade. Só conta e só recebe perfil **ativo** do Setor. O crédito do mês é por **assunção** (evento imutável): quem assumiu um Atendimento mantém o crédito mesmo depois de transferi-lo, e quem recebe a Transferência ganha o seu ao assumir; a URA sozinha não gera crédito (PR #77, I1, decidido pelo usuário em 2026-10-08).

**Painel do Funcionário**:
A tela `/atendimento/[id]` em que o Funcionário conduz um Atendimento (#49): a conversa em balões, o campo de resposta e, ao lado, os Serviços do cliente e a Transferência. Quem pode abri-la e agir é o dono do Atendimento, o Líder do Setor onde ele está ou o Admin (mesma regra da Transferência). O balão do cliente mostra o nome do Contato cujo número bate com o do Atendimento (o Contato padrão desempata) e o CNPJ da empresa — ou "CNPJ não definido" quando o número não foi identificado ou é cliente novo; o balão do atendente mostra nome e Setor de quem escreveu.
_Avoid_: Chat do funcionário, tela de atendimento (ambíguo com Atendimento).

**Serviços do cliente**:
Os mesmos serviços do menu da URA (contrato social, alterações contratuais, guia de imposto, guia de parcelamento, CND) disparados pelo Funcionário com um clique, usando o Cliente já vinculado ao Atendimento, sem perguntar o CNPJ de novo. Hoje funcionam o contrato social e as alterações (a alteração é escolhida num seletor, da mais recente para a mais antiga); guias e CND aparecem desabilitados, "em construção", como na URA (#42 e os adapters do Serpro, #66–#68).

**Dock de Atendimentos**:
O cartão no canto inferior direito de toda tela autenticada com os Atendimentos em andamento do usuário, para ele trocar de tela sem perder o Atendimento. Mostra o Contato, a empresa e o começo da última mensagem; se o cliente escreveu por último, o cartão é destacado. Atualiza a cada 15 s: o cartão aparece com animação e toca um aviso sonoro quando surge um Atendimento ou o cliente escreve de novo. Some na própria conversa e nas telas de login e troca de senha.
_Avoid_: Notificação, bandeja.

### Auditoria

**Registro de auditoria**:
Evento imutável gravado quando uma ação muda estado no sistema — grava Ator, Setor, ação, alvo e resultado. Nunca registra leituras.
_Avoid_: Log de auditoria, histórico.

**Período**:
Um intervalo de datas sempre com início e fim definidos juntos; não existe Período com só uma ponta preenchida — isso é rejeitado, não interpretado como "a partir de" ou "até". Vale em qualquer filtro por data do sistema, não só no de auditoria.
_Avoid_: Intervalo aberto (não existe nesse domínio).
