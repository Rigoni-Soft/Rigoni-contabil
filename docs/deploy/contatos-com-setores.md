# Contatos com Setores e Destinos de envio: aplicar a migration nos remotos

A migration `20261119100000_contato_com_setores_dono_e_id_estavel.sql` mexe em dados que já existem. Antes de
aplicar em homologação e em produção, confira o que ela vai encontrar.

## O que a migration faz com os Contatos existentes

| Situação encontrada | O que acontece |
| --- | --- |
| Telefone sem nenhum dígito (`-`, `()`) | Vira "sem telefone" (nulo). |
| Contato que fica sem telefone e sem e-mail | A migration **aborta** e lista nome e Cliente; corrija ou remova à mão e aplique de novo. |
| Mesmo número (com ou sem máscara, com ou sem 55) em dois Contatos do mesmo Cliente | Vira **um** Contato: fica o mais antigo e ganha os Setores donos dos repetidos. Nada é apagado além do repetido. |
| Número sem DDD já gravado | Continua como está; só é recusado quando o número for editado ou um contato novo for cadastrado (10 ou 11 dígitos). |

## Pré-checagem (somente leitura)

```sql
-- Contatos que vão abortar a migration (sem telefone com dígitos e sem e-mail).
select id, cliente_id, nome, telefone
from cliente_contatos
where regexp_replace(coalesce(telefone, ''), '\D', '', 'g') = '';

-- Números que vão se juntar (mesmo Cliente, mesmo número sem máscara e sem o 55).
select cliente_id,
       regexp_replace(regexp_replace(telefone, '\D', '', 'g'), '^55(?=\d{10,11}$)', '') as numero,
       count(*) as contatos, string_agg(nome, ', ') as nomes
from cliente_contatos
where regexp_replace(coalesce(telefone, ''), '\D', '', 'g') <> ''
group by 1, 2
having count(*) > 1;

-- Números sem DDD (continuam gravados, mas serão recusados numa edição).
select cliente_id, nome, telefone
from cliente_contatos
where length(regexp_replace(regexp_replace(coalesce(telefone, ''), '\D', '', 'g'), '^55(?=\d{10,11}$)', '')) not in (0, 10, 11);
```

Rode as três numa cópia dos dados de homologação antes de aplicar em produção.
