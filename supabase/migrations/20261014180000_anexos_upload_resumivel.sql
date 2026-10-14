-- Upload resumível (TUS) do navegador direto ao Storage (#80): o arquivo sobe em pedaços, sem passar
-- pelo corpo da Server Action. O bucket continua privado e sem policy de leitura (o arquivo só sai
-- por link temporário, docs/adr/0001); só a gravação é aberta, e só na pasta de um Atendimento em
-- andamento do qual o usuário pode agir (mesma regra de `podeTransferir`). O caso de uso confere
-- tipo e tamanho do objeto de novo antes de entregar (docs/adr/0007).
-- O Chrome/Edge grava webm, que o bucket precisa aceitar para o navegador subir; o servidor o
-- converte para ogg e remove o original antes de entregar (docs/adr/0006).
update storage.buckets
set allowed_mime_types = allowed_mime_types || array['audio/webm']
where id = 'anexos-atendimento'
  and not allowed_mime_types @> array['audio/webm'];

create or replace function public.pode_anexar_ao_atendimento(p_atendimento text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.atendimentos a
    join public.perfis p on p.id = auth.uid()
    where a.id::text = p_atendimento
      and a.status = 'em_andamento'
      and p.desativado_em is null
      and p.banido_em is null
      and (
        p.papel = 'admin'
        or (p.papel = 'lider_setor' and p.setor = a.setor)
        or a.funcionario_id = p.id
      )
  );
$$;

revoke all on function public.pode_anexar_ao_atendimento(text) from public;
grant execute on function public.pode_anexar_ao_atendimento(text) to authenticated;

create policy anexos_atendimento_envio_do_funcionario
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'anexos-atendimento'
  and public.pode_anexar_ao_atendimento((storage.foldername(name))[1])
);
