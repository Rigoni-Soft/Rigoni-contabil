# ADR 0011 — A foto do cartão de ponto só sai do servidor no fallback, sem retenção

**Status:** aceita (2026-11-12)

## Contexto

A foto do Cartão de ponto (#222) traz dado pessoal: o nome do empregado de um Cliente e a rotina dele (horários,
faltas, a anotação "atestado"). Ler a foto com um modelo de visão de terceiros manda esse dado para fora do
sistema, e cada leitura custa. A spec original lia sempre pela API; a decisão do escritório foi ler primeiro
por OCR local e só recorrer à API quando o OCR não servir, o que corta o custo e a exposição do dado.

## Decisão

- A leitura é uma cascata atrás da porta neutra `LeitorDeCartaoPort` (ADR 0004): **OCR local** (tesseract.js no
  próprio servidor, modelo `por` versionado em `assets/tessdata`, sem rede) e, só se ele não leu ou a leitura
  reprovou na validação do domínio, a **visão da API** (`LeitorDeCartaoVisaoGateway`). Os dois falharam:
  digitação manual, sem bloquear.
- Quem decide se uma leitura serve é o **domínio** (`validarLeitura`), não o leitor: nome legível, dias dentro
  da quinzena e sem repetição, horários válidos e em ordem crescente, no máximo 16 h por dia, ao menos um
  horário lido. O OCR também se recusa quando a confiança do nome ou de uma linha de dia fica abaixo de 80.
- **Só o fallback tira a foto do servidor.** Nele valem: retenção zero e contrato sem treino com o provedor (a
  chave só entra com o contrato nessas condições; sem a chave o modo `ocr_visao` não sobe, e o `ocr` nunca
  chama a API), HTTPS, e o envio só depois de a autorização do Responsável do RH ter passado.
- **A imagem nunca é guardada**: ela existe em memória durante a leitura e some; não vai a bucket, banco, log
  nem auditoria. Os registros técnicos levam só a origem e o motivo da reprovação, nunca nome ou horário.
- O que sai do leitor entra como dado comum do cartão (`salvarDia`, auditado pelo banco). Sem tela de
  confirmação: o Funcionário confere e corrige à mão.

## Consequências

- O custo da API cai ao que o OCR não lê. Cartão de letra à mão e carimbo desbotado quase nunca passa no OCR
  (medição em `docs/deploy/leitura-de-cartao.md`), então o ganho real depende da qualidade das fotos; a
  cascata deixa trocar a ordem ou desligar o OCR sem mexer no domínio.
- Um leitor errado que passa na validação grava horário errado até o Funcionário notar (risco já registrado
  na spec #212). A validação reduz, não elimina.
- Trocar de provedor de visão é um novo gateway de `LeitorDeCartaoPort`.
