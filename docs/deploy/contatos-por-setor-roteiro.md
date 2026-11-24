# Contatos por Setor: roteiro de deploy da frente (#298)

As quatro entregas da spec #283 vão **juntas** a produção: Dados (#290 a #292), Cadastro (#293, #294), Envios e
aviso (#295, #296) e Recepção (#297). A migration nunca vai sem o campo de contatos e sem os envios lendo os
Destinos: sem isso o cadastro de Destinos não existe na tela, e os envios automáticos deixam de usar o contato
padrão (que deixou de existir). Este roteiro vale para Homologação e depois Produção, nesta ordem.

Complementa [contatos-com-setores.md](./contatos-com-setores.md) (o que a migration faz com os Contatos que já
existem e as três consultas de pré-checagem) e [lembretes-cron.md](./lembretes-cron.md).

## 1. Antes do deploy

1. **Avisar o Líder do Simples Nacional**, por escrito, com pelo menos dois dias úteis de antecedência. Texto:

   > Depois do deploy de DD/MM/AAAA, o DAS, o lembrete de documento e as guias de parcelamento do Simples
   > Nacional só saem para o contato que o Setor cadastrar como Destino de envio do Cliente. O contato padrão
   > e a forma de envio do cadastro deixam de valer. Cliente sem Destino não recebe nada: o sistema avisa você
   > e o Responsável no sino ("Cliente sem meio de envio"). Cadastre os Destinos de todos os Clientes do Setor
   > antes de DD/MM/AAAA (data da primeira rodada, tabela abaixo). Passo a passo na seção 3 do roteiro.

   Preencha as duas datas com a linha da tabela da seção 4 que corresponde ao dia do deploy. A primeira data é a
   do deploy; a segunda é o "Prazo dos Destinos do SN" da linha. Exemplo, para um deploy em 01/12/2026:

   > Depois do deploy de 01/12/2026, o DAS, o lembrete de documento e as guias de parcelamento do Simples
   > Nacional só saem para o contato que o Setor cadastrar como Destino de envio do Cliente. O contato padrão
   > e a forma de envio do cadastro deixam de valer. Cliente sem Destino não recebe nada: o sistema avisa você
   > e o Responsável no sino ("Cliente sem meio de envio"). Cadastre os Destinos de todos os Clientes do Setor
   > antes de 04/12/2026 (a primeira rodada, de lembrete e DAS, é em 05/12/2026). Passo a passo na seção 3 do
   > roteiro.
2. **Pré-checagem dos Contatos** (somente leitura, em cópia dos dados de Homologação e depois no remoto): as três
   consultas de [contatos-com-setores.md](./contatos-com-setores.md). A primeira (Contato sem telefone com
   dígitos e sem e-mail) faz a migration abortar; corrija ou remova à mão antes.
3. **Conferir as migrations pendentes** no banco remoto de cada ambiente:

   ```
   supabase link --project-ref <ref-do-ambiente>
   supabase migration list
   ```

   O `project-ref` de cada ambiente está no painel do Supabase dele (Project Settings, General, Reference ID):
   Homologação e Produção têm refs diferentes. A coluna "Remote" vazia marca o que falta. Esta frente traz, nesta ordem (aplicar todas, o `db push` já
   respeita a ordem dos timestamps):

   | Migration | O que traz |
   | --- | --- |
   | `20261119100000_contato_com_setores_dono_e_id_estavel.sql` | Contato com e-mail, Setores e dono; id estável; sai o "contato padrão". **Mexe em dados.** |
   | `20261119110000_destinos_de_envio_e_resolucao.sql` | Destinos de envio, tipos de envio e a resolução "quem recebe" no banco |
   | `20261119120000_salvar_contato_do_cliente.sql` | "Salvar" de um contato só |
   | `20261119130000_tipos_de_envio_do_contato.sql` | Tipos de envio de um contato por Setor |
   | `20261119140000_canal_do_envio_do_contato.sql` | Canal (WhatsApp, e-mail ou os dois) do Destino |
   | `20261123100000_envios_leem_destinos.sql` | Jobs de lembrete, DAS e parcelamento leem os Destinos; aviso "sem meio de envio" no sino |
   | `20261124100000_cadastrar_contato_ura.sql` | Recepção cadastra o número do atendimento como contato URA |

   Se a lista do remoto também mostrar pendentes `20261117100000_avatar_bucket_e_coluna.sql` e
   `20261118100000_ura_sessao_etapa_setor.sql`, elas entram no mesmo `db push`, na ordem dos timestamps: são de
   outras frentes, mas estão antes das desta. Se algum ambiente já tiver aplicado uma versão **anterior**
   de `20261119100000` a `20261123100000` (de uma branch de revisão), a migration mudou depois: recrie ali as
   funções dela a partir do arquivo atual antes de seguir.
4. Os jobs só agem com `LEMBRETES_AUTOMATICOS=ligada` (e, em produção, `MENSAGERIA_MODO=real`). Se estiverem
   desligados, ligar só depois da seção 3, nunca antes.

## 2. Deploy

1. `supabase db push` no ambiente (as migrations da tabela acima).
2. Deploy do código da frente inteira (um só). Nunca a migration sem o código nem o código sem a migration.
3. Verificação pós-deploy, no SQL Editor do ambiente:

   ```sql
   -- As funções novas existem (esperado: 5 linhas).
   select proname from pg_proc
   where pronamespace = 'public'::regnamespace
     and proname in ('cadastrar_contato_ura', 'destinos_de_envio_resolvidos',
                     'destinos_de_envio_do_job', 'definir_tipos_de_envio_do_contato',
                     'salvar_contato_do_cliente')
   order by 1;

   -- Todo contato que já existia ficou com a URA (esperado: 0 linhas).
   select c.id from cliente_contatos c
   where not exists (select 1 from cliente_contato_setores s where s.contato_id = c.id and s.setor = 'ura');

   -- A migration não cria Destinos: no começo é 0, e é o SN quem vai enchendo.
   select count(*) from destinos_de_envio where setor = 'simples_nacional';
   ```

   Na tela: entrar como Funcionário do SN, abrir "editar cadastro" de um Cliente do SN e ver o campo de contatos
   e destinos; entrar como Funcionário da Recepção com um atendimento de número não vinculado e ver o botão
   "Cadastrar como contato deste Cliente".

## 3. O Simples Nacional cadastra os Destinos antes da primeira rodada

Quem: o Líder do SN distribui; cada Funcionário cadastra os Clientes pelos quais é Responsável (o Líder, os
sem Responsável). Para cada Cliente do SN:

1. Abrir o Cliente, "editar cadastro".
2. No campo de contatos do Simples Nacional, escolher o contato que recebe (ou "Novo contato": nome e
   WhatsApp ou e-mail).
3. Definir a forma de envio (WhatsApp, e-mail ou os dois) e o tipo de envio: "todos os envios do Setor" cobre o
   lembrete, o DAS e a guia de parcelamento; só detalhe por tipo se um deles for para outra pessoa.
4. Salvar.

**Como conferir que ficou pronto** (a lista abaixo tem de voltar vazia antes da data da primeira rodada):

```sql
-- Clientes do Simples Nacional ainda sem nenhum Destino do Setor.
select c.empresa, c.cnpj
from clientes c
join cliente_cadastro_operacional_sn o on o.cliente_id = c.id
where not exists (
  select 1 from destinos_de_envio d
  where d.cliente_id = c.id and d.setor = 'simples_nacional'
)
order by c.empresa;
```

Cliente que sobrar na lista (sem contato conhecido, por exemplo) fica sem envio automático e gera o aviso no sino
na rodada. O Líder decide: cadastrar o contato ou aceitar o aviso. Depois da rodada, "alertas abertos de Cliente
sem meio de envio" tem de cair para zero à medida que os Destinos entram (o alerta some sozinho):

```sql
select count(*) from alertas_setor where tipo = 'contato_ausente' and resolvido_em is null;
```

## 4. Data da primeira rodada depois do deploy

Os jobs rodam às 08h de São Paulo (`0 11 ... * *` em UTC), em dias fixos do mês (`vercel.json`):
lembrete de documento e DAS nos dias **01, 05, 10 e 15**; guias de parcelamento nos dias **20, 22, 24, 26 e
28**. A tabela vale para um deploy **depois das 08h** do dia indicado (antes das 08h, a rodada do próprio dia já
usa o código novo). Exemplo da regra: deploy em 04/12/2026 tem a primeira rodada de lembrete e DAS em
05/12/2026.

| Deploy em | 1ª rodada de lembrete e DAS | 1ª rodada de guias de parcelamento | Prazo dos Destinos do SN |
| --- | --- | --- | --- |
| 23/11/2026 | 01/12/2026 | 24/11/2026 | 23/11/2026 |
| 24/11/2026 a 25/11/2026 | 01/12/2026 | 26/11/2026 | 25/11/2026 |
| 26/11/2026 a 27/11/2026 | 01/12/2026 | 28/11/2026 | 27/11/2026 |
| 28/11/2026 a 30/11/2026 | 01/12/2026 | 20/12/2026 | 30/11/2026 |
| 01/12/2026 a 04/12/2026 | 05/12/2026 | 20/12/2026 | 04/12/2026 |
| 05/12/2026 a 09/12/2026 | 10/12/2026 | 20/12/2026 | 09/12/2026 |
| 10/12/2026 a 14/12/2026 | 15/12/2026 | 20/12/2026 | 14/12/2026 |
| 15/12/2026 a 19/12/2026 | 01/01/2027 | 20/12/2026 | 19/12/2026 |
| 20/12/2026 a 21/12/2026 | 01/01/2027 | 22/12/2026 | 21/12/2026 |
| 22/12/2026 a 23/12/2026 | 01/01/2027 | 24/12/2026 | 23/12/2026 |
| 24/12/2026 a 25/12/2026 | 01/01/2027 | 26/12/2026 | 25/12/2026 |
| 26/12/2026 a 27/12/2026 | 01/01/2027 | 28/12/2026 | 27/12/2026 |
| 28/12/2026 a 31/12/2026 | 01/01/2027 | 20/01/2027 | 31/12/2026 |

O prazo do SN para a seção 3 é o dia **anterior** à primeira rodada que vier primeiro, entre o lembrete e DAS e o
parcelamento. Depois de 31/12/2026 vale a mesma regra: o lembrete e DAS segue os dias 01, 05, 10 e 15, e o
parcelamento os dias 20, 22, 24, 26 e 28.

O cadastro de Destinos só existe na tela depois do deploy. No **último dia de cada linha** da tabela (o deploy
cai no dia anterior à rodada) o SN não tem tempo: mantenha `LEMBRETES_AUTOMATICOS` fora de `ligada` (seção 1,
item 4) até a conferência da seção 3 voltar vazia.

O job `lembretes-pgfn` (dias 01, 10 e 15) fica fora desta frente: ele só lembra a equipe do parcelamento PGFN,
não envia nada ao Cliente, então não lê Destinos e não pede cadastro.

## 5. Se algo sair errado

- **Job desligado como freio**: pôr `LEMBRETES_AUTOMATICOS` fora de `ligada` faz o job responder
  `200 { "ativa": false }` sem enviar nada. Use enquanto o SN termina a seção 3.
- **Cliente recebendo duas vezes ou pelo canal errado**: o canal é do Destino. Corrigir no "editar cadastro" do
  Cliente (forma de envio); não há dado a reverter no banco.
- **Rollback**: não há migration de volta; a frente é de ida. Se a migration `20261119100000` abortou, nada foi
  aplicado (a transação reverte): corrija os dados que ela listou e rode o `db push` de novo.
