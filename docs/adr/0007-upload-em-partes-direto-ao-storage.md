# ADR 0007 — Upload em partes (TUS) direto ao Storage, com policy de INSERT

**Status:** aceita (2026-10-14) — revisa em parte o ADR 0005

## Contexto

O áudio gravado pelo Funcionário (#80), e depois vídeo, chega ao servidor num único corpo de Server
Action (até 11 MB, `serverActions.bodySizeLimit`). Em rede ruim o envio inteiro recomeça do zero, e o
limite do corpo trava arquivos maiores. A reprodução já é em partes: o `<audio>`/`<video>` pede o
arquivo por HTTP Range no link temporário do Storage.

## Decisão

- O navegador sobe o arquivo em partes de 6 MB, pelo protocolo TUS do Storage do Supabase
  (`tus-js-client`), com a sessão do usuário. Retoma de onde parou se a conexão cair.
- Isso exige uma policy de INSERT em `storage.objects` (a URL de upload assinada não vale para a
  TUS): `anexos_atendimento_envio_do_funcionario`, que só deixa gravar em `anexos-atendimento/{atendimento}/…`
  quando `pode_anexar_ao_atendimento` confirma que o usuário (ativo) é o dono do Atendimento em
  andamento, Líder do setor dele ou Admin — a mesma regra de `podeTransferir`.
- O bucket continua sem policy de leitura e de remoção: o arquivo só sai por link temporário e só o
  servidor (service_role) remove. Tipo e tamanho também são barrados pelo bucket (415/413).
- O servidor continua sendo quem decide: a Server Action recebe só o caminho; `EnviarAnexoAoCliente`
  confere a pasta, relê tipo e tamanho **do Storage**, converte webm para ogg (ADR 0006), entrega e
  registra. Objeto recusado é removido.
- Arquitetura: porta OUT `UploadDeAnexoPort`, gateway `infra/gateways/tus-upload-de-anexo.gateway.ts`,
  composição em `main/client/` e consumo em `*.upload.ts` (como o Realtime, só esse sufixo importa
  `main/client`).

## Consequências

- A regra de quem pode anexar existe em dois lugares (SQL e `podeTransferir`); a do servidor é a que
  decide, a do SQL é a trava de quem escreve direto no Storage.
- Objeto subido e nunca finalizado (aba fechada antes de a Server Action rodar) fica órfão no bucket;
  uma limpeza por data entra se o volume justificar.
- O bucket aceita `audio/webm` só de passagem (o servidor converte e remove).
- Imagens e arquivos seguem pela Server Action (cabem no limite); migram para o mesmo caminho se
  passarem do limite ou junto com o vídeo.
