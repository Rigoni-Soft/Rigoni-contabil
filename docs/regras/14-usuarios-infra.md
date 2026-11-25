# Usuários, infra e átomos/moléculas de UI: regras que viviam em comentários

## Fronteira service_role e RPCs
As RPCs de desativação e de finalizar a troca de senha não aceitam EXECUTE de `authenticated` nem `anon`: só um client service_role as chama, então a checagem "só Admin" fica no caso de uso. Antes, `grant execute ... to authenticated` deixava qualquer sessão (inclusive com senha provisória) trocar a senha sem passar pelo Auth.
Onde vive: src/modules/usuarios/infra/gateways/supabase-desativacao.gateway.ts, supabase-finalizar-troca-senha.gateway.ts (teste negativo em supabase-finalizar-troca-senha.gateway.test.ts). ADR 0001.

## Desativação e RLS sem depender do ban do Auth
Um JWT emitido antes da desativação segue válido no Auth; a RLS precisa negar sozinha. A desativação segura o perfil FOR UPDATE e o trigger de elegibilidade lê FOR SHARE: a atribuição concorrente de Responsável espera e reavalia. Promoção a Líder usa o mesmo mecanismo.
Onde vive: src/modules/usuarios/infra/gateways/supabase-desativacao-acesso.gateway.test.ts.

## Falha técnica do login não vira "credenciais inválidas"
Erro de Supabase (indisponibilidade, timeout) não pode virar mensagem de senha errada; só os códigos do GoTrue de credencial errada viram erro de credencial. O detalhe cru fica no log do servidor, porque login.actions devolve error.message ao navegador de um visitante não autenticado.
Onde vive: src/modules/usuarios/infra/gateways/supabase-sessao.gateway.ts.

## Reenvio da troca de senha
O Auth rejeita updateUser() com o mesmo código no reenvio legítimo (finalização falhou antes) e quando a nova senha é a provisória. O gateway devolve um erro próprio; quem decide é TrocarSenha.execute(), que conhece precisaTrocarSenha() do perfil.
Onde vive: supabase-sessao.gateway.ts (teste em supabase-sessao.gateway.test.ts).

## Repositório de perfil: erro técnico distinto de ausência
Erro do Postgres devolve falha, nunca null (null é "perfil inexistente" ou "oculto pela RLS"). Row DTO é validado por Zod e falha alto se o banco divergir (arquitetura.md 3.7); reconstrução de domínio inválida é falha esperada (3.8) e devolve Result.
Onde vive: src/modules/usuarios/infra/repositories/usuario.repository.ts.

## Fronteira do papel anon
Não existe acesso anônimo: a chave pública não alcança tabela nem RPC do schema public (42501 ou PGRST202), mesmo antes da RLS.
Onde vive: privilegios-anon.repository.test.ts.

## Avatar
A imagem chega em FormData (campo foto), já recortada e em WebP 256x256 do navegador; o caso de uso reconfere bytes e tamanho. /api/avatar serve só a foto do próprio usuário (sem id), com cache private e ?v= para renovar. ADR 0012.
Onde vive: avatar.schema.ts, avatar.presenter.ts, servir-avatar.webhook.ts.

## Criar usuário
Setor do schema é enum fechado (antes aceitava qualquer string e falhava no domínio depois da conta criada no Auth). Promise rejeitada na action não pode travar o botão em "Cadastrando…"/"Entrando…" (rede de segurança no container).
Onde vive: criar-usuario.schema.ts, criar-usuario.container.tsx, login.container.tsx.

## Acessibilidade dos átomos e moléculas
Alvo de toque de 44 px, aria-disabled em vez de disabled para não perder foco durante ação em curso, foco devolvido ao campo quando o botão some, ícone + texto + cor nunca só cor (DESIGN.md "Indicadores de estado" e "Foco do teclado depois da ação"). Lista com role explícito por causa do Safari/VoiceOver. Abas seguem WAI-ARIA (setas, Home, End).
Onde vive: src/presentation/components/atoms/* e molecules/* (aviso-de-status, botao-da-guia, botao-de-arquivo, caixa, abas-de-atendimento).

## Painel de prévia e imagem ampliável
HTML do Word fica em iframe sem script nem same-origin; a miniatura abre popover nativo com caixa de tamanho fixo (a imagem carregando não desloca a conversa).
Onde vive: painel-de-previa.component.tsx, imagem-ampliavel.component.tsx.

## Card de espera
Dirigido a outro usuário ou sem permissão, o card só informa; supervisor abre só leitura. O relógio do navegador difere do servidor de propósito (suppressHydrationWarning).
Onde vive: card-de-espera.component.tsx.
