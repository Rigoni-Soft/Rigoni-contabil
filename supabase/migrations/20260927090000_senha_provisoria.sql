-- Ticket #31: troca obrigatoria de senha no primeiro login.
-- senha_trocada_em nula = ainda esta na senha provisoria do #30.
-- senha_provisoria_expira_em: vencimento em 48h (decisao revisada no #19).
alter table public.perfis
  add column senha_trocada_em timestamptz,
  add column senha_provisoria_expira_em timestamptz not null default (now() + interval '48 hours');

-- Devolutiva tecnica PR #62, ponto 1: sem isso, todo perfil ja existente antes
-- desta migration (criado pelo #30, com senha ja definitiva na pratica) nasce
-- com senha_trocada_em = NULL e passa a ser tratado como primeiro acesso,
-- podendo ser bloqueado como "vencido" 48h depois. So existe uma janela entre
-- o ADD COLUMN acima e este UPDATE (mesma transacao de migration), entao ele
-- pega exatamente -- e so -- as linhas que ja existiam antes da regra do #31
-- comecar a valer; contas criadas depois deste ponto continuam nascendo com
-- NULL de verdade (criar-usuario.use-case.ts nunca passa essa coluna).
update public.perfis set senha_trocada_em = now() where senha_trocada_em is null;

-- Sem policy de UPDATE em perfis (nenhuma foi criada ate aqui): em vez de abrir
-- uma generica "dono pode atualizar o proprio perfil" (deixaria papel/setor
-- editaveis pelo proprio usuario), uma funcao SECURITY DEFINER estreita,
-- so pra esta coluna -- mesmo padrao de meu_papel()/meu_setor().
--
-- Devolutiva tecnica PR #62, ponto 2: a versao original aceitava EXECUTE de
-- `authenticated` e lia auth.uid() implicito -- qualquer sessao com senha
-- provisoria podia chamar a RPC direto (supabase-js no browser, sem passar
-- pelo app) e "finalizar" a troca sem de fato trocar a senha no Auth. Agora so
-- service_role executa (fronteira server-side, mesmo padrao do AuthAdminPort
-- em docs/adr/0001), e o id do usuario vem explicito como parametro porque uma
-- chamada via service_role nao carrega claim de auth.uid() -- quem autentica o
-- alvo antes de chamar é o caso de uso (TrocarSenha), nunca a propria RPC.
drop function if exists public.marcar_senha_trocada();

create or replace function public.marcar_senha_trocada(usuario_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.perfis set senha_trocada_em = now() where id = usuario_id;
$$;

revoke all on function public.marcar_senha_trocada(uuid) from public, anon, authenticated;
grant execute on function public.marcar_senha_trocada(uuid) to service_role;

-- Devolutiva tecnica PR #62, bloqueio 2: a expiracao de 48h so era checada no
-- app (ObterSessao) -- um JWT ainda valido (refresh token nao expirado)
-- continuava lendo/escrevendo direto via Data API/RPC do Supabase mesmo apos
-- o vencimento, porque meu_papel()/meu_setor() nunca olhavam pra
-- senha_provisoria_expira_em. Em vez de replicar o check em cada policy
-- (existente e futura) de cada modulo, o endurecimento entra nessas duas
-- funcoes, que toda policy de papel/setor do projeto ja reusa: com a senha
-- provisoria vencida, ambas passam a devolver NULL, e nenhuma comparacao
-- (`= 'admin'`, `= meu_setor()`) fecha como verdadeira -- RLS nega por padrao,
-- sem tocar em nenhuma policy individualmente.
create or replace function public.meu_papel()
returns public.papel
language sql
security definer
stable
set search_path = public
as $$
  select papel from public.perfis
  where id = auth.uid()
    and (senha_trocada_em is not null or senha_provisoria_expira_em > now());
$$;

create or replace function public.meu_setor()
returns public.setor_slug
language sql
security definer
stable
set search_path = public
as $$
  select setor from public.perfis
  where id = auth.uid()
    and (senha_trocada_em is not null or senha_provisoria_expira_em > now());
$$;
