-- Bucket dos contratos: limite por arquivo de 10 MB para 20 MB. Contratos e alterações digitalizados do escritório
-- antigo passam de 10 MB (até ~18 MB), e a carga inicial dos Clientes não conseguia gravá-los.
update storage.buckets
set file_size_limit = 20971520
where id = 'documentos-clientes';
