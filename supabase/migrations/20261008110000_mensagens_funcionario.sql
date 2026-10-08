-- #49: quem escreveu a Mensagem do Funcionário, para o balão mostrar nome e Setor. Só Mensagem de
-- Funcionário tem autor; as do contato e da URA ficam sem.
alter table public.mensagens add column funcionario_id uuid references public.perfis (id);
alter table public.mensagens add constraint mensagens_funcionario_so_do_funcionario
  check (autor = 'funcionario' or funcionario_id is null);
