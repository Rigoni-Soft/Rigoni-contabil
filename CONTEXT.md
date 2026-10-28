# Sistema de Atendimento e Gestão (Rigoni Contábil)

Domínio de atendimento a clientes (empresas contábeis) via WhatsApp e de gestão interna por setor da Rigoni Contábil, um escritório de contabilidade.

## Language

### Organização e acesso

**Setor**:
Unidade organizacional do escritório (ex.: Simples Nacional, Tributário), com no máximo um Líder de setor ativo (não desativado) por vez — promover outro exige rebaixar o atual antes (#57). Fonte da lista de setores: `organograma.pdf`. Zeladoria é subtime de Financeiro, não é Setor próprio — decisão definitiva, confirmada por Cledson em 25/09/2026. Contábil Externo é o mesmo Setor que Contábil (não dois Setores) e T.I. não é Setor próprio — cai dentro de Administrativo, mesmo padrão da Zeladoria — decisão definitiva, confirmada por Cledson em 28/09/2026.
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
O conjunto de campos que o Funcionário do Simples Nacional mantém atualizado por Cliente — forma de envio, Contatos, documento recebido, DAS, Atividade do mês, observações gerais (#34) e a lista de Parcelamentos (#122). Nasce automaticamente quando o Cliente é cadastrado com Regime Simples Nacional ou MEI (#33), com os campos de status em suas opções negativa/pendente por padrão (documento recebido = negativo; DAS = pendente; sem Parcelamentos) até o Funcionário atualizar de verdade — nunca fica em branco esperando o primeiro acesso. Outros Setores só visualizam; nunca inclui contrato social/alterações contratuais (estes só se abrem pelo botão de visualização, para Admin, Líder do Simples Nacional e Responsável do Cliente — #140).
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
Acordo de parcelamento de débitos tributários do Cliente junto à Receita, cuja guia também é obtida via Serpro. Um Cliente tem zero, um ou vários, cada um com código, parcelas restantes, a marca "é interno" e o PDF do acordo anexado (obrigatório); "Tem parcelamento" é só o resumo derivado ("Sim (2)"). Quem edita o Cadastro operacional (Funcionário SN Responsável, Líder SN, Admin) cadastra à mão, com mínimo 1 parcela restante, e remove um Parcelamento sem registro de envio (o anexo vai junto). Dois eixos: a **situação** (em aberto → quitado) e o **status do mês** (pendente/enviado, derivado do registro de envio). Cliente sem Parcelamento cadastrado não tem guia a enviar. O PDF fica em bucket privado, só o servidor lê (#122). O Parcelamento PGFN cadastrado só ganha guias mensais: código, origem, "é interno" e restantes não se editam, e a guia anexada troca ou se remove até o envio (#184).

**Parcelamento em aberto / quitado**:
Em aberto é o que ainda gera guia; quitado é o marcado como quitado ou com parcelas restantes em zero. Quem decide é o banco: a edição à mão nunca grava zero nem a situação (o zero vem do sistema, ao entregar a última parcela).

**Parcelamento interno**:
Parcelamento pago pelo escritório (marca "é interno"): a guia dele não vai ao Cliente, e sim ao WhatsApp do financeiro (`FINANCEIRO_TELEFONE`), por template próprio e qualquer que seja a forma de envio do Cliente (#127).

**Registro de envio do Parcelamento**:
Uma linha por Parcelamento e parcela (AAAAMM), gravada só pelo sistema quando a guia é entregue; nenhuma sessão de usuário escreve (ADR 0008). É a base do status do mês e trava a remoção do Parcelamento.

**Atividade do mês**:
Registro mensal por Cliente com três marcações independentes (Indústria, Comércio, Serviço), indicando os tipos de nota fiscal emitidos naquele mês — pode mudar mês a mês e não é exclusivo (um Cliente pode ter mais de um tipo marcado no mesmo mês). Usado para determinar o anexo do Simples Nacional aplicável ao cálculo do DAS.
_Avoid_: Regime (é outro conceito — ver acima).

**CND**:
Certidão Negativa de Débitos — documento que atesta a regularidade fiscal do Cliente, obtido via Serpro.

**Aviso de cadastro**:
O registro permanente, por destinatário, de que um Cliente entrou no Cadastro operacional (*novo cliente*) ou ganhou uma alteração contratual (*nova alteração*). O de novo cliente vai ao Líder do Setor Simples Nacional; o de nova alteração vai ao Líder e ao Responsável do Cliente (só ao Líder, se não houver Responsável ativo). O Admin nunca é destinatário e não vê o sino de avisos: só os Setores são avisados. Fica "não visto" até o destinatário abri-lo. Não expira.
_Avoid_: Notificação, aviso (aviso é o de Inatividade).

**Alteração contratual**:
Documento que altera o contrato social do Cliente, anexado pelo Admin com a data e um número de sequência (1, 2, 3...) que é único por Cliente. A mais recente é a de maior número.

### Atendimento

**Atendimento**:
A sessão completa de contato entre um Contato e o escritório, do início ao encerramento — pode passar por vários Atendentes e Setores via Transferência. Contém muitas Mensagens. **Começa quando o contato é encaminhado a um humano** (um Setor ou a Fila): a conversa com a URA antes disso (saudação, "já é cliente?", CNPJ, menu) não é guardada como Mensagem; quem recebe o Atendimento vê o resumo e o CNPJ informado na URA (#46), não os balões (decisão do usuário, 2026-10-08).
O Atendimento que a URA abre na recepção traz o motivo (resumo) e, se o número informou, o CNPJ: o CNPJ de um Cliente liga o Atendimento a ele; CNPJ que não existe no sistema é um provável cliente novo. Nenhum Contato é salvo.
_Avoid_: Conversa, ticket, chamado.

**Mensagem**:
Uma única troca dentro de um Atendimento (um "balão"), enviada pelo Contato ou por um Atendente.
_Avoid_: Balão (usar só informalmente), texto.

**Inatividade**:
Atendimento em andamento com Funcionário parado por 2 horas de expediente (a noite, o fim de semana e os feriados não contam): a última Mensagem é do Funcionário e o cliente não responde, ou é do cliente e o Funcionário não responde. A URA avisa quem está inativo (o cliente pelo WhatsApp; o Funcionário no cabeçalho da conversa do Painel do Funcionário, só o dono do Atendimento, e o aviso some assim que ele escreve; sem alerta no dock) e, sem ação em 10 minutos de expediente, encerra o Atendimento como o encerramento comum, auditado com a URA como ator. Mensagem de quem estava inativo cancela o encerramento. O Funcionário segue dono do Atendimento até lá. Atendimento na Fila não entra.

**Fila**:
O estado de um Atendimento aguardando que alguém o assuma — ao abrir, ou depois de uma Transferência. Não é uma entidade separada do Atendimento — é um estado dele. Todo Atendimento novo ou transferido cai na espera do Setor, sem escolha automática de Funcionário: o sistema não distribui, não há fila pessoal e o cliente não recebe posição, só "aguarde, já vamos atendê-lo". A espera pode ser dirigida a um usuário específico (Transferência ao Setor Simples Nacional: Responsável do Cliente ou Líder). O Setor vê quem espera, com o que já foi coletado e o tempo de espera (mm:ss, h:mm:ss a partir de 1h), do mais antigo ao mais novo. Encerrar ou transferir um Atendimento não puxa ninguém da espera. Desativar um usuário devolve à espera do Setor os Atendimentos dele (e os que esperavam dirigidos a ele), com auditoria e sem atribuição. A **assunção** continua gravada como evento imutável, sem efeito na distribuição; a desconexão temporária (#48) segue só mantendo a atribuição.
_Avoid_: Fila de espera (como entidade própria).

**Transferência**:
A ação de mover um Atendimento de um Atendente/Setor para outro. O Funcionário transfere pelo Painel do Funcionário: escolhe o Setor de destino (nunca o Setor em que o Atendimento já está) e informa o resumo do assunto. Depois de transferir ele perde o controle e a visão da conversa: a tela volta ao início (#49). O Atendimento transferido cai na espera do Setor de destino e o cliente recebe só "aguarde, já vamos atendê-lo".
Para o Setor Simples Nacional só vale para Cliente do Simples Nacional ou MEI: fica dirigido ao Responsável do Cliente ou, sem Responsável, ao Líder do Setor. Responsável inativo (usuário desativado, #58) não conta: o Atendimento vai ao Líder.

**Painel do Funcionário**:
A tela `/atendimento/[id]` em que o Funcionário conduz um Atendimento (#49): a conversa em balões, o campo de resposta e, ao lado, os Serviços do cliente e a Transferência. Quem pode abri-la e agir é o dono do Atendimento, o Líder do Setor onde ele está ou o Admin (mesma regra da Transferência). O balão do cliente mostra o nome do Contato cujo número bate com o do Atendimento (o Contato padrão desempata) e o CNPJ da empresa — ou "CNPJ não definido" quando o número não foi identificado ou é cliente novo; o balão do atendente mostra nome e Setor de quem escreveu. O cabeçalho avisa o dono quando a URA vai encerrar o Atendimento por inatividade dele (#73).
_Avoid_: Chat do funcionário, tela de atendimento (ambíguo com Atendimento).

**Aba Atendimento**:
A tela `/atendimento`, ao lado do Dashboard em todo Setor (#162), com duas abas sobrepostas: "Em espera" (os cards da espera do Setor, do mais antigo ao mais novo, assumidos por clique; o primeiro clique vence e o outro recebe "já assumido") e "Em atendimento" (os Atendimentos do usuário). O chat abre no centro, sem rota própria, com Serviços do cliente, Transferência e Encerrar; o Admin escolhe o Setor. Em tela estreita lista e chat alternam. Convive com o Dock e o Painel do Funcionário (`/atendimento/[id]`) até o corte; nela o Dock não mostra cartões.
_Avoid_: Fila de espera (como tela).

**Serviços do cliente**:
Os mesmos serviços do menu da URA (contrato social, alterações contratuais, guia de imposto, guia de parcelamento, CND) disparados pelo Funcionário com um clique, usando o Cliente já vinculado ao Atendimento, sem perguntar o CNPJ de novo. Cada serviço tem um botão no painel: o contrato social, a alteração (escolhida num seletor, por nº decrescente, identificada pelo nº) e as guias e a CND, buscadas no provedor fiscal como na URA (#42, #66). Guia sem autorização fiscal do Cliente ou provedor fora do ar devolvem o erro ao Funcionário, sem deixar Mensagem no Atendimento (a falha é auditada).

**Dock de Atendimentos**:
O cartão no canto inferior direito de toda tela autenticada com os Atendimentos em andamento do usuário, para ele trocar de tela sem perder o Atendimento. Mostra o Contato, a empresa e o começo da última mensagem; se o cliente escreveu por último, o cartão é destacado. Atualiza a cada 15 s: o cartão aparece com animação e toca um aviso sonoro quando surge um Atendimento ou o cliente escreve de novo. Some na própria conversa e nas telas de login e troca de senha.
_Avoid_: Notificação, bandeja.
### Jobs e alertas

**Lembrete de documento**:
Mensagem que o sistema envia nos dias 01, 05, 10 e 15 ao Contato padrão dos Clientes com documento obrigatório negativo, pedindo os documentos fiscais do mês (#52). Fora da janela de 24h usa o template aprovado; dentro, o formato próprio do sistema.
_Avoid_: Cobrança.

**Envio automático de DAS**:
Nos mesmos dias, a entrega da guia do DAS quando o DAS está pronto, pela forma de envio do Cliente (WhatsApp, e-mail ou os dois). O DAS só passa a enviado, com a data de envio e auditado com a URA como ator, depois de a entrega ser aceita (a entrega é reservada antes, sem mudar o DAS); se ela falha, o DAS segue pronto (#52). A edição manual do cadastro não define `enviado` nem a data de envio — só o sistema; um DAS já enviado continua exibido e a data some se o status volta a outro valor (#108). A opção do DAS na URA segue o mesmo processo, só muda o gatilho (#124): confere no banco se o DAS está pronto antes de chamar o provedor fiscal; não pronto, avisa que o escritório enviará quando estiver, sem provedor e sem alerta ao setor (só o job abre); pronto e ainda não enviado, o pedido adianta o envio, com a mesma reserva do job, e o DAS passa a enviado com a data e a URA como ator (o job do mês não o reenvia); já enviado, reenvia a guia guardada (cliente/das/AAAAMM do mês do envio) sem chamar o provedor; se o job ou outro pedido já está entregando (reserva ocupada), o Cliente é avisado de que o envio está em andamento. Um DAS enviado antes de a guia passar a ser guardada não tem PDF para reenviar e cai no aviso de guia indisponível.
_Avoid_: Disparo.

**Envio automático de guia de parcelamento**:
Nos dias 20, 22, 24, 26 e 28, a entrega das guias de parcelamento aos Clientes com Parcelamento em aberto sem registro de envio do mês: o comum pela forma de envio do Cliente, o interno ao WhatsApp do financeiro. O banco manda: sem Parcelamento em aberto o provedor fiscal não é chamado. Cada entrega aceita grava o registro de envio da parcela, auditado com a URA como ator, e desconta uma parcela restante (quita ao zerar); a falha de um Parcelamento não trava os outros e a rodada seguinte tenta de novo (#53, #126). Sem telefone do financeiro válido o interno não é enviado e segue pendente (#127). O Parcelamento PGFN entra no mesmo envio com as guias confirmadas à mão, com o PDF do banco (nunca do provedor fiscal), até a competência do mês corrente e da mais antiga para a mais nova; sem guia confirmada o job apenas pula, sem alerta. Na URA, pedido repetido reenvia o mesmo PDF sem novo registro nem desconto, e sem guia confirmada o Cliente recebe "ainda não disponível" (#186).
_Avoid_: Disparo.

**Alerta do setor**:
Registro que o job grava para o setor Simples Nacional quando algo pede ação humana: DAS pendente com o documento em dia (`das_pendente`), envio que falhou depois das tentativas (`falha_envio`), Cliente sem contato ou e-mail para a forma de envio (`contato_ausente`) e guia entregue por um canal só (`entrega_parcial`), Parcelamento pendente que o provedor não entregou ou que não casou com nenhuma guia (`parcelamento_sem_guia`, a mensagem lista os códigos) e telefone do financeiro ausente ou inválido, com Parcelamento interno pendente (`financeiro_ausente`). Há um alerta aberto por Cliente e tipo; o job o renova enquanto a condição existe e o resolve quando ela some, exceto `entrega_parcial`, que só uma pessoa resolve. Cada alerta tem a origem do job que o gerou (`lembretes` ou `parcelamento`): um job renova e resolve só os seus.
_Avoid_: Notificação, aviso (aviso é o de Inatividade).

### Auditoria

**Registro de auditoria**:
Evento imutável gravado quando uma ação muda estado no sistema — grava Ator, Setor, ação, alvo e resultado. Nunca registra leituras.
_Avoid_: Log de auditoria, histórico.

**Período**:
Um intervalo de datas sempre com início e fim definidos juntos; não existe Período com só uma ponta preenchida — isso é rejeitado, não interpretado como "a partir de" ou "até". Vale em qualquer filtro por data do sistema, não só no de auditoria.
_Avoid_: Intervalo aberto (não existe nesse domínio).
