# ADR 0011 — A foto do cartão de ponto vai a um serviço de visão externo, sem retenção

**Status:** aceita (2026-11-12)

## Contexto

A foto do Cartão de ponto (#222) traz dado pessoal: o nome do empregado de um Cliente e a rotina dele (horários,
faltas, a anotação "atestado"). Lê-la com um modelo de visão de terceiros manda esse dado para fora do sistema,
e cada leitura custa. Testamos antes um OCR local (tesseract.js) como primeiro leitor, com a API só de reserva:
nos 18 cartões de exemplo (letra à mão, carimbo desbotado) ele não passou na validação em nenhum, então não
reduziria custo e só somaria uma dependência e um modelo de 2 MB no deploy. A decisão é só a visão.

## Decisão

- A leitura é feita por um modelo de visão atrás da porta neutra `LeitorDeCartaoPort` (ADR 0004): devolve JSON
  por esquema (nome, dias, batidas, coluna Extra, anotação "faltou" ou "atestado"), ainda não confiável.
- Quem decide se a leitura serve é o **domínio** (`validarLeitura`): nome legível, dias dentro da quinzena e sem
  repetição, horários válidos e em ordem crescente, no máximo 16 h por dia, ao menos um horário lido. Leitura
  reprovada, falha do serviço ou ausência de leitor = digitação manual, sem bloquear.
- **Dado pessoal sai do servidor**: retenção zero e contrato sem treino com o provedor são condição para ligar
  o modo `visao` (sem a chave o app não sobe nesse modo); HTTPS; o envio só ocorre depois de a autorização do
  Responsável do RH passar; no ambiente de teste e na Preview vale o leitor falso, que não envia nada.
- **A imagem nunca é guardada**: existe em memória durante a leitura e some; não vai a bucket, banco, log nem
  auditoria. Os registros técnicos levam só o motivo da reprovação, nunca nome ou horário.
- O que sai do leitor entra como dado comum do cartão (`salvarDia`, auditado pelo banco). Sem tela de
  confirmação: o Funcionário confere e corrige à mão.

## Consequências

- Todo cartão lido tem custo da API; o volume e o gasto estão em `docs/deploy/leitura-de-cartao.md`.
- Um leitor errado que passa na validação grava horário errado até o Funcionário notar (risco já registrado na
  spec #212). A validação reduz, não elimina.
- Trocar de provedor de visão é um novo gateway de `LeitorDeCartaoPort`.
