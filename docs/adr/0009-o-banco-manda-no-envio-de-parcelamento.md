# ADR 0009 — O banco manda no envio de parcelamento, e o envio é registrado por parcela

**Status:** aceita (2026-10-23) — ticket #126

## Contexto

O job de parcelamento (#53) decidia por Cliente: tinha "parcelamento pendente"? Então buscava uma
guia no provedor fiscal e, ao concluir, marcava o Cliente como enviado. Com vários Parcelamentos por
Cliente (#122) e o provedor entregando as guias por CNPJ, sem dizer de qual Parcelamento é cada uma
(#123), a decisão passa a ser por Parcelamento e por parcela, e cada emissão do provedor é cobrada.

## Decisão

- **O banco manda.** Quem decide se há guia a enviar é o estado gravado: Parcelamento em aberto, com
  parcelas restantes, não interno e sem registro de envio do mês. Sem isso o provedor fiscal não é
  chamado. O provedor nunca diz que o Parcelamento acabou: `quitado` no provedor com o Parcelamento
  em aberto aqui não o quita, vira alerta `parcelamento_sem_guia` (divergência é decisão humana).
- **O registro de envio é a unidade do envio.** `registrar_envio_parcelamento(parcelamento, AAAAMM)`
  grava o registro, desconta uma parcela restante e quita ao zerar, tudo na mesma transação e só na
  primeira vez para aquela parcela (idempotente: repetir devolve `false`). Quitar não consulta o
  provedor. O status do mês deriva do registro, então o reset mensal é automático.
- **O registro é gravado guia a guia, depois do aceite da entrega.** Uma queda entre o aceite e o
  registro reenvia a guia na rodada seguinte (pelo menos uma vez); o contrário (registrar sem
  entregar) nunca acontece. A reserva do Cliente continua evitando entregas simultâneas e só é
  fechada ao concluir.
- **Atribuição falha fechado.** As guias do CNPJ são atribuídas por referência e valor; sem candidato
  a guia não é enviada e o setor é avisado, em vez de pagar o Parcelamento errado.
- **Um núcleo para os dois gatilhos.** `EnviarGuiasParcelamento` serve o job e a URA; quem chama só
  decide o que fazer com o `Andamento` devolvido.

## Consequências

- Os alertas `parcelamento_sem_guia` e `financeiro_ausente` entram em `tipo_alerta_setor` (o segundo é
  usado quando o Parcelamento interno for roteado ao financeiro).
- A atribuição por valor é inferência não confirmada contra o Serpro real: ligar primeiro para um CNPJ
  em produção.
- A guia fica em `guias-fiscais` por cliente/parcelamento/AAAAMM, o mesmo caminho a cada tentativa.
