-- Ticket #32: Lider de setor cadastra Funcionario do proprio Setor. Mesma
-- forma da policy do #30 (Admin), mas com o `with check` espelhando a regra
-- ja aplicada em CriarUsuario.podeCadastrar -- defesa em profundidade, nao
-- a unica linha de defesa: o app decide antes de tentar o insert.
create policy "perfis_insert_lider_proprio_setor"
  on public.perfis for insert
  with check (
    public.meu_papel() = 'lider_setor'
    and papel = 'funcionario'
    and setor = public.meu_setor()
  );
