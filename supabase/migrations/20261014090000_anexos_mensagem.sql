-- #79: o Funcionário envia imagem ou arquivo ao cliente. O anexo é da Mensagem; `texto` continua
-- guardando a legenda (vazia quando não há). `audio` entra aqui só para a #80/#81 não precisarem
-- mexer na coluna. Os quatro campos nascem juntos ou nenhum.
alter table public.mensagens
  add column anexo_tipo text,
  add column anexo_nome text,
  add column anexo_caminho text,
  add column anexo_tamanho integer;

alter table public.mensagens add constraint mensagens_anexo_completo check (
  (anexo_tipo is null and anexo_nome is null and anexo_caminho is null and anexo_tamanho is null)
  or (
    anexo_tipo in ('imagem', 'audio', 'documento')
    and anexo_nome is not null and length(btrim(anexo_nome)) > 0
    and anexo_caminho is not null and length(btrim(anexo_caminho)) > 0
    and anexo_tamanho is not null and anexo_tamanho > 0
  )
);

-- Bucket privado próprio, separado de `documentos-clientes` (que só o Admin lê). Sem policy: só o
-- service_role (docs/adr/0001) escreve e gera link temporário. Tipo e tamanho também aqui, para
-- nada contornar a validação da aplicação (mesma lista de `src/shared/kernel/anexo.ts`).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'anexos-atendimento', 'anexos-atendimento', false, 10485760,
  array[
    'image/jpeg', 'image/png', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv',
    'application/zip', 'application/x-zip-compressed'
  ]
)
on conflict (id) do nothing;
