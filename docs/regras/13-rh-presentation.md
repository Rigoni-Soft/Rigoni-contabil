# Regras de RH presentation e Usuários (conhecimento de comentários removidos)

## Foto e PDF chegam como File na Server Action
O PDF/foto vem como File no FormData; o caso de uso recebe só os bytes (a porta não conhece a web). A foto do cartão/atestado não é guardada. O tipo sai da assinatura do arquivo, não do File.type. Corpo de Server Action na Vercel não passa de 4,5 MB (PDF até 4 MB, ADR 0007). O servidor repete a conferência do navegador.
Onde vive: src/modules/rh/presentation/view-models/folha-de-ponto/folha-de-ponto.actions.ts, convencao/convencao.actions.ts, convencao.schema.ts, folha-de-ponto.schema.ts

## Cartão de ponto novo versus iniciado
Cartão sem dado salvo (mês ou empregado novo) abre com linhas editáveis e dia útil vazio é "em branco", não falta. Salvar uma vez, mesmo sem horário, inicia o cartão; dali em diante dia útil vazio é falta. Abono sem batida só vale em dia de trabalho (domingo/feriado segue folga).
Onde vive: folha-de-ponto.presenter.ts (situação do dia), cartao-de-ponto.container.tsx

## Foco após ação e acessibilidade
Quando o botão clicado some (Desligar, Readmitir, Abonar, Limpar), o foco vai ao aviso do resultado ou ao botão que permanece, para teclado e leitor de tela. Erro do PDF da convenção foca o campo do PDF.
Onde vive: cartao-de-ponto.container.tsx, quadro-de-funcionarios.container.tsx, envio-de-convencao.container.tsx

## Jornada padrão de empregado novo
Empregados novos gravam jornada do comércio (8h45 seg-sex, 4h sábado) até a Totalização deduzir da convenção. TODO(#235). Afirmada pelo teste "JORNADA_PADRAO do empregado novo".
Onde vive: folha-de-ponto.presenter.ts:JORNADA_PADRAO (e folha-de-ponto.presenter.spec.ts)

## Escritas do quadro e leitura de foto
Só o sucesso limpa o formulário/foto; a recusa preserva o digitado. Leitura de atestado mantém a modal aberta durante a leitura e em falha. PDF baixado perde o aviso após nova ação. Empregado desligado não recebe cartão.
Onde vive: quadro-de-funcionarios.container.tsx, leitura-de-cartao.container.tsx, leitura-de-atestado.container.tsx

## IDs guid e não uuid
Ids do seed não são v4 válidos; schemas usam guid. Limites do cartão: minuto do dia 0..1439, jornada de 7 dias, até 4 batidas por dia.
Onde vive: convencao.schema.ts, folha-de-ponto.schema.ts:MINUTOS_NO_DIA, DIAS_DA_SEMANA, BATIDAS_POR_DIA_MAXIMAS

## Resumo RH
Acompanhamento conta clientes com Responsável; Holerite sai dos cartões; só o Líder mantém os serviços do acompanhamento.
Onde vive: resumo-rh.presenter.ts

## Fronteira privilegiada service_role (ADR 0001)
RPCs de troca de papel, desativação, finalização de troca de senha e criação de conta só aceitam service_role; autorização ("só Admin", "é a foto do próprio usuário") é do caso de uso. Senha provisória gerada na infra (crypto) em base32 sem 0/O/1/I; ban do Auth dura ~100 anos porque só aceita duração. Registro de erros recebe só a mensagem, nunca o objeto (pode ter CNPJ).
Onde vive: usuarios/application/ports/out/*.provider.ts, infra/gateways/supabase-auth-admin.gateway.ts:ALFABETO_SENHA_SEM_CARACTERES_AMBIGUOS, BYTES_DA_SENHA_PROVISORIA, BANIMENTO_SEM_FIM

## Um Líder ativo por Setor
A promoção é em dois passos explícitos; a corrida com outra promoção é fechada por índice único parcial e a RPC devolve ValidationError.
Onde vive: alterar-papel-usuario.use-case.ts, alteracao-papel.provider.ts

## Sessão e perfil
O JWT de quem foi desativado vale até expirar; o perfil é a fonte da verdade. Erro técnico propaga o AppError original, nunca vira "sem permissão". Senha provisória vencida bloqueia login (ADR 0002) e sessão aberta antes do vencimento vira "sem sessão" em obter-sessao. Falha após updateUser() vira EstadoInconsistenteError, recuperável por retry (finalizar é idempotente). same_password em primeiro acesso sem prova de Auth alterado é recusado.
Onde vive: exigir-admin/exigir-usuario-ativo/login/obter-sessao/trocar-senha.use-case.ts e specs

## Criação com compensação
Falha depois da conta Auth criada a remove (perfis.id cascade). Auditoria de sucesso não é best-effort; a de falha é. Falha da compensação vira EstadoInconsistenteError e auditoria falha_compensacao, para reconciliação manual.
Onde vive: criar-usuario.use-case.ts

## Desativação e avatar (ADR 0012, ADR 0008)
Marca+audita numa transação idempotente; ban no Auth e apagar da foto rodam sempre, uma falha não impede a outra; pendência fica na lista (banido_em, avatar_atualizado_em). Objeto do bucket primeiro, coluna depois; apagar é idempotente. Só service_role escreve bucket e coluna (gatilho perfis_proteger_avatar). Limite do bucket avatares: webp até 256 KB.
Onde vive: desativar-usuario/enviar-avatar/remover-avatar.use-case.ts, imagem-avatar.vo.ts:LIMITE_AVATAR_BYTES e ASSINATURA_DO_FORMATO_WEBP, avatar-storage-politica.gateway.test.ts
