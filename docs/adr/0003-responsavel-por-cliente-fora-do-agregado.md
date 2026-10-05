# Responsável por Cliente é gravado fora do agregado Cliente

`arquitetura.md` (seção 3.6) diz que escritas passam sempre pelo agregado. O ticket #65 (Responsável por Cliente) grava `responsavel_id` em `cliente_cadastro_operacional_sn` por um repositório próprio (`ResponsavelClienteRepository`), sem reconstruir o agregado `Cliente`.

**Decisão:** manter a exceção. O Responsável é uma coluna isolada, escrita por um ator diferente do resto do cadastro (só o Líder do Simples Nacional; o Funcionário edita as demais colunas da mesma linha). Reconstruir o agregado para mudar uma coluna exigiria carregar e regravar campos que o Líder nem enxerga como dele, abrindo corrida com a edição do Funcionário. A regra fica em duas camadas: caso de uso (`AtribuirResponsavelCliente`) e banco (RLS + trigger `proteger_responsavel_cliente`, que também valida que o Responsável é Funcionário do Simples Nacional, mesmo para `service_role`).

**Risco aceito:** uma escrita direta do Líder pela API do Supabase (a RLS permite) muda o Responsável sem registro de auditoria — o registro nasce no caso de uso, não no trigger. Mesmo padrão dos outros riscos aceitos em ADR 0002. A auditoria distingue `cliente.atribuir-responsavel`, `cliente.trocar-responsavel` e `cliente.remover-responsavel`.
