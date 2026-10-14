-- Áudio gravado pelo Funcionário (#80): o bucket passa a aceitar os formatos que o provedor entrega
-- (ogg com Opus e mp4/AAC; webm é convertido antes de guardar). Mesma lista de `src/shared/kernel/anexo.ts`.
update storage.buckets
set allowed_mime_types = allowed_mime_types || array['audio/ogg', 'audio/mp4']
where id = 'anexos-atendimento'
  and not allowed_mime_types @> array['audio/ogg', 'audio/mp4'];
