# Regras do banco (migrations e seed)

Conhecimento que vivia em comentários SQL. As migrations ficam sem comentário; a justificativa mora aqui.

## Bucket de contratos
Limite por arquivo de 20 MB (era 10 MB): contratos e alterações digitalizados do escritório antigo chegam a ~18 MB.
Onde vive: supabase/migrations/20261030120000_setores_responsavel_e_parcelamento.sql

## Responsável do Cliente numa tabela só (ADR 0003 revista)
O Responsável do Simples Nacional passa de `cliente_cadastro_operacional_sn.responsavel_id` para `cliente_responsaveis`, como o dos demais Setores; some o ramo "SN ou demais". Na cópia dos dados os gatilhos ficam desligados (não é atribuição nova a auditar). O Responsável do SN é legível por quem vê o Cliente; o dos demais Setores, só pelo Admin, Líder do Setor e o próprio Responsável.
Onde vive: 20261030120000_setores_responsavel_e_parcelamento.sql (tabela cliente_responsaveis e suas policies)

## Desativação de usuário devolve Atendimentos
Desativar remove o Responsável de todo Setor, com auditoria; uma marca válida só na transação evita auditar duas vezes e permite distinguir a devolução da Transferência (aviso de inatividade). O Atendimento volta ao Responsável do Cliente ou, sem ele, ao Líder ativo; na Recepção ou sem destinatário fica sem dono. Quem estava sendo atendido entra atrás de quem já esperava.
Onde vive: 20261030120000_setores_responsavel_e_parcelamento.sql (função de desativação de usuário)

## Parcelamento por Setor
Cada Setor tem e vê os seus Parcelamentos; o Admin vê todos; a busca da guia para o Cliente (URA, job) lê a união pelo servidor. Os existentes passam a ser do SN, que é o único Setor com trava de Regime (SN e MEI); o Setor do Parcelamento não muda. No upsert, o UPDATE vem antes do INSERT porque o gatilho BEFORE INSERT avaliaria a linha proposta de um Parcelamento quitado antes do ON CONFLICT.
Onde vive: 20261030120000_setores_responsavel_e_parcelamento.sql

## Acompanhamento mensal do RH
Serviços do setor (lista do Líder), "se aplica" por Cliente e Serviço, concluído por Cliente, Serviço e competência. Sem linha = pendente / se aplica. Só o Responsável do RH marca; Líder do RH e Admin leem; cada escrita é auditada na mesma transação. O Holerite é serviço do sistema (derivado, nunca marcado nem editado). Desativar tira o serviço dos meses seguintes e preserva os anteriores; serviço desativado é histórico (nenhum UPDATE). "Não se aplica" (mês ou sempre) apaga a marcação do par, senão ela reapareceria concluída ao reativar. "Sempre" = competência NULL, com índice próprio porque UNIQUE trata NULL como distinto. Troca do "se aplica" é uma função transacional (p_escopo: aplica, mes, sempre).
Onde vive: 20261104100000_rh_ponto_convencao_e_alerta_por_setor.sql (tabelas rh_*, triggers de proteção e auditoria)

## Cadastro do Cliente no RH
Mesma tela do SN com dados do RH. Contatos valem para qualquer Regime; observações gerais são por Setor (cada um lê as suas, Admin lê todas). A edição do RH passa por função SECURITY DEFINER que só toca em observações do RH e contatos; quem pode: Líder do RH, Responsável do RH do Cliente e Admin. A trava de Regime dos contatos só é liberada por `app.cadastro_rh` ligado na própria transação (coalesce: variável nunca definida devolve NULL e a trava não dispararia). Documentos contratuais: RH só lê; anexar é do Admin.
Onde vive: 20261104100000_rh_ponto_convencao_e_alerta_por_setor.sql

## Alerta por Setor
A chave do alerta aberto é Cliente, tipo, origem e Setor; os existentes ficam no SN. Confirmar a guia resolve só o alerta do Setor do Parcelamento, e só quando esse Setor ficou sem pendência.
Onde vive: 20261104100000_rh_ponto_convencao_e_alerta_por_setor.sql

## Folha de ponto do RH
Quadro de funcionários, Cartão de ponto digitado (batidas, Extra, Abono) e "sem movimento". Nenhum outro dado do empregado: sem documento, motivo médico ou imagem; só a sinalização, nunca o motivo/CID. A Totalização é calculada no código, nunca gravada. Carga em minutos de domingo (1) a sábado (7). Empregado não troca de Cliente, dia de ponto não troca de data/empregado, cartão só de empregado ativo; empregado inativo não apaga cartões. A auditoria leva CNPJ e nome do empregado, nunca batidas. Leitura de feriados liberada ao RH.
Onde vive: 20261104100000_rh_ponto_convencao_e_alerta_por_setor.sql (rh_empregados, rh_ponto_dias, auditar_rh_ponto)

## Holerite derivado e cartão iniciado
A contagem por Cliente (empregados ativos, "sem movimento", cartões salvos) roda SECURITY INVOKER, então a RLS recorta por Cliente; quem decide "concluído" é o código. Cartão iniciado = marca (empregado + mês) de que o RH salvou o cartão; dali em diante dia útil sem batida é falta. Função de gatilho não é chamável por RPC; o REVOKE só alinha com o baseline.
Onde vive: 20261104100000_rh_ponto_convencao_e_alerta_por_setor.sql (rh_cartoes_iniciados)

## Gravação do cartão e abono lidos de foto/atestado
Funções SECURITY INVOKER transacionais (antes eram N chamadas em série e uma falha deixava parcial). Ler só preenche: dia que já tem linha não é tocado (janela de até 45 s) e dia sem batida/Extra/Abono não grava. O abono só seta Abono, não toca a marca de cartão iniciado e pode cruzar dois meses. Nunca imagem, nome lido, CID ou documento.
Onde vive: 20261104100000_rh_ponto_convencao_e_alerta_por_setor.sql

## Convenção coletiva (RH)
PDF no bucket privado, vigência, sindicato e regras extraídas (jsonb versionado). Nunca se edita nem apaga: renovar é subir outra; Cliente pode ter várias e o empregado aponta a sua pelo sindicato (sem ponteiro vale a única). Sobe Líder do RH ou Admin; leem Admin, Líder e Responsável do RH. O CHECK espelha src/shared/kernel/regras-da-convencao.ts (forma, chave, citação, tipo); piso da lei e número no trecho citado ficam só no validador do domínio. INSERT só nas colunas que o app envia (autoria e ordem não se forjam). O empregado só aponta sindicato de convenção que o Cliente tem. Interruptores do Cliente: banco de horas (desligado) e trabalho aos domingos.
Onde vive: 20261104100000_rh_ponto_convencao_e_alerta_por_setor.sql; src/shared/kernel/regras-da-convencao.ts

## Storage da convenção
Bucket privado; o PDF sobe com a sessão do usuário (sem service_role). INSERT só para Líder do RH e Admin e só no nome <cliente>/<id>.pdf (o do CHECK de arquivo_caminho), senão o objeto ficaria solto e legível por qualquer gestor. Arquivo de convenção gravada não sai pelo usuário; só o ainda solto é visível e removível (o Storage lê antes de apagar: compensação de envio que falhou depois do upload). O arquivo mora na pasta do Cliente e a leitura é liberada por ele.
Onde vive: 20261104100000_rh_ponto_convencao_e_alerta_por_setor.sql (policies de storage.objects)

## Grants explícitos
Em toda tabela nova o anon não recebe nada e o authenticated só o que as policies usam; o que nunca se apaga (empregado, convenção, marca de cartão) não recebe DELETE.
Onde vive: todas as migrations de tabela; feedback do repo "grants em create table"

## Avatar do usuário (ADR 0012 e ADR 0008)
Bucket privado `avatares`: um objeto por usuário, nome = `{usuario_id}`, só WebP, até 256 KB; `perfis.avatar_atualizado_em` marca a gravação (nulo = sem foto). Sem policy em storage.objects para authenticated/anon: com RLS ligado a ausência nega tudo e a foto sai só pela rota do servidor. Só o sistema grava: gatilho dá erro 23514 para qualquer sessão com usuário (Admin inclusive) que grave a coluna; sem `auth.uid()` (service_role, seed, migration) passa. REVOKE de coluna não vale enquanto há grant de tabela, por isso o gatilho.
Onde vive: 20261117100000_avatar_bucket_e_coluna.sql; ADR 0012, ADR 0008

## Contato do Cliente (ADR 0013)
Contato com e-mail, Setores, Setor dono e id estável; sem "contato padrão". Telefone opcional (basta um canal); telefone só com símbolos vira "sem telefone". Caminho único `salvar_contatos_do_cliente` (cria, atualiza e remove por id); a regra "contato cujo número bate neste Cliente" vive em `contato_por_telefone_no_cliente` e a normalização (só dígitos, sem DDI 55) em `chave_telefone`. O mesmo WhatsApp ou e-mail não repete no Cliente (repete entre Clientes); duplicidade é recusada apontando o existente (id no HINT). Contatos antigos ficam só com a URA; repetidos viram um (fica o mais antigo, soma os Setores). Quem edita: o dono (Líder e Responsável no Setor) e o Admin; dono nulo = só o Admin. O que é de outro Setor volta inalterado; alterar ou remover é recusado. Limite conhecido: trocar números entre dois contatos do mesmo lote dá duplicidade (só quem sai libera o número); troca em duas etapas. WhatsApp sem DDD é recusado, mas o já gravado só é cobrado ao trocar o número. Excluir pelo dono com outro Setor ainda usando como Destino: o Contato passa à URA (sem dono) e os Destinos do ex-dono saem; Contato da URA ou do Admin em uso não se exclui.
Onde vive: 20261118100000_ura_contatos_por_setor_e_destinos_de_envio.sql

## URA com etapa "setor"
A sessão guarda só a posição (etapa, página, respostas inválidas); modo/pagina/lista seguem exclusivos da etapa "alteracao", e a página passa a existir também em "setor". A URA localiza o Cliente pelo número em todos os Contatos; mais de uma linha = número ambíguo (a Recepção atende, sem documento).
Onde vive: 20261118100000_ura_contatos_por_setor_e_destinos_de_envio.sql

## Destinos de envio por Setor (ADR 0013)
(Cliente, Setor, Tipo de envio, Contato, canal). Tipo nulo = "todos os envios do Setor"; tipo do catálogo vale para aquele tipo e, sem ele, valem os "todos". Canal sempre gravado explícito (WhatsApp, e-mail ou os dois) e precisa existir no Contato ao gravar; com um canal só o p_canal é ignorado, com os dois é obrigatório. O Destino aponta Contato do mesmo Cliente (FK composta, sem revelar nome de outro Cliente). `destinos_de_envio_resolvidos`: `valido` falso quando o canal sumiu do Contato (`motivo`); quem consome entrega os válidos e reporta os inválidos; `telefone_envio` já vem com DDI 55. O Setor vem do perfil, nunca do chamador; Admin não tem Setor e não define Destinos. Gravar usa lock por contato (duplo clique passaria junto no insert ... where not exists), confere a permissão (a RLS barra o insert, mas lista vazia daria falso sucesso) e limita o tamanho da lista (catálogo curto). A migration não cria Destinos.
Onde vive: 20261118100000_ura_contatos_por_setor_e_destinos_de_envio.sql

## Jobs de envio leem Destinos
Lembrete de documento, DAS e guias de parcelamento leem `destinos_de_envio_do_job` (resolvidos + janela de 24h por telefone: última Mensagem do Contato em qualquer Atendimento do telefone). As funções de job são só do service_role: o baseline concede EXECUTE a authenticated por default privileges, então REVOKE de PUBLIC não basta. O índice extra em `atendimentos` existe porque o da chave é parcial (em andamento).
Onde vive: 20261118100000_ura_contatos_por_setor_e_destinos_de_envio.sql

## Aviso de contato ausente
Alerta `contato_ausente` que se abre (inserção; renovar é UPDATE e não avisa) avisa no sino o Líder do Setor e o Responsável do Cliente nele (sem Responsável ativo, só o Líder); nunca o Admin. Reaberto = novo aviso. Os já abertos avisam uma vez na migration. O aviso leva o texto do alerta.
Onde vive: 20261118100000_ura_contatos_por_setor_e_destinos_de_envio.sql

## Recepção cadastra Contato no Atendimento (ADR 0013)
Permissão só de criar UM Contato do Cliente com o WhatsApp do atendimento, setor URA e Recepção como dona. Quem chama: Funcionário ou Líder da Recepção dono do atendimento em andamento (conferido na função, pois a Recepção não gerencia contatos em geral). Devolve resultado em vez de erro: criado | existente | em_outro_cliente | email_em_uso. Atendimento sem Cliente aceita o Cliente confirmado pela Recepção; já ligado, só aquele. Número de outro Cliente não cria (ambíguo para a URA). Corrida entre checagem e insert: devolve o que a outra chamada criou. A auditoria é desta ação; o gatilho genérico não registra de novo.
Onde vive: 20261118100000_ura_contatos_por_setor_e_destinos_de_envio.sql

## Seed local
Usuários de Setores e papéis distintos para provar isolamento por RLS (testes.md §3); senhas só locais, nunca em homolog/produção. A identidade por provider é exigida pelo GoTrue; `senha_trocada_em = now()` evita cair em /trocar-senha nos e2e. Os ids repetidos (1111…, 2222…) são referenciados pelos testes: não renumerar. A Recepção tem 2 Funcionários porque a espera dela é a única comum (disputa de clique). Clientes de exemplo: um por card do Resumo do setor SN (DAS emitidas, Sem documento, DAS pendente, Sem movimento, Esperando envio, Parcelamento pendente/interno/enviado), com uuid v4 válido, CNPJs válidos e o Funcionário SN como Responsável de todos. Parcelamentos sem PDF real (caminho só referência). Exemplos de auditoria: um sucesso e uma falha para os filtros.
Onde vive: supabase/seed.sql
