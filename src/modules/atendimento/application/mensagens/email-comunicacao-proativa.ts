import type { ComunicacaoProativa } from "@/modules/atendimento/application/mensagens/comunicacao-proativa";

const COR_FUNDO = "#f4f1e8";
const COR_CARTAO = "#faf8f1";
const COR_TEXTO = "#16231f";
const COR_MARCA = "#0d3b36";
const COR_TEXTO_SOBRE_MARCA = "#f4f1e8";
const COR_BORDA = "#d9d2bd";
const COR_TEXTO_SECUNDARIO = "#5b5a4f";

type Detalhe = { rotulo: string; valor: string };
type Conteudo = {
  titulo: string;
  paragrafos: string[];
  detalhes: Detalhe[];
  anexo: boolean;
};

export function escaparHtml(texto: string): string {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function conteudoDe(c: ComunicacaoProativa): Conteudo {
  switch (c.tipo) {
    case "lembrete_documento_obrigatorio":
      return {
        titulo: "Documentos fiscais pendentes",
        paragrafos: [
          `Ainda não recebemos os documentos fiscais de ${c.empresa} referentes a este mês.`,
          "Poderia nos enviar assim que possível, para não atrasarmos a apuração do Simples Nacional?",
        ],
        detalhes: [{ rotulo: "Empresa", valor: c.empresa }],
        anexo: false,
      };
    case "envio_guia_das":
      return {
        titulo: "Guia do DAS",
        paragrafos: [
          `Segue em anexo a guia do DAS de ${c.empresa}, referente à competência ${c.competencia}.`,
        ],
        detalhes: [
          { rotulo: "Empresa", valor: c.empresa },
          { rotulo: "Competência", valor: c.competencia },
          { rotulo: "Vencimento", valor: c.vencimento },
        ],
        anexo: true,
      };
    case "envio_guia_parcelamento":
      return {
        titulo: "Guia de parcelamento",
        paragrafos: [`Segue em anexo a guia de parcelamento de ${c.empresa}.`],
        detalhes: [
          { rotulo: "Empresa", valor: c.empresa },
          { rotulo: "Parcela", valor: c.parcela },
        ],
        anexo: true,
      };
  }
}

function linhaDeDetalhe({ rotulo, valor }: Detalhe): string {
  return `<tr>
<td style="padding:6px 0;color:${COR_TEXTO_SECUNDARIO};font-size:14px;width:120px;vertical-align:top;">${escaparHtml(rotulo)}</td>
<td style="padding:6px 0;color:${COR_TEXTO};font-size:14px;font-weight:600;">${escaparHtml(valor)}</td>
</tr>`;
}

export function montarEmailHtml(comunicacao: ComunicacaoProativa): string {
  const { titulo, paragrafos, detalhes, anexo } = conteudoDe(comunicacao);
  const corpo = paragrafos
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;">${escaparHtml(p)}</p>`)
    .join("\n");
  const aviso = anexo
    ? `<p style="margin:16px 0 0;font-size:14px;color:${COR_TEXTO_SECUNDARIO};">A guia está anexada a este e-mail em PDF.</p>`
    : "";
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escaparHtml(titulo)}</title>
</head>
<body style="margin:0;padding:0;background:${COR_FUNDO};color:${COR_TEXTO};font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COR_FUNDO};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${COR_CARTAO};border:1px solid ${COR_BORDA};border-radius:8px;">
<tr><td style="background:${COR_MARCA};color:${COR_TEXTO_SOBRE_MARCA};padding:20px 24px;border-radius:8px 8px 0 0;font-size:18px;font-weight:700;">Rigoni Contábil</td></tr>
<tr><td style="padding:24px;">
<h1 style="margin:0 0 16px;font-size:20px;color:${COR_MARCA};">${escaparHtml(titulo)}</h1>
<p style="margin:0 0 16px;font-size:16px;line-height:1.5;">Olá, ${escaparHtml(comunicacao.contato)}!</p>
${corpo}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${COR_BORDA};border-bottom:1px solid ${COR_BORDA};margin-top:8px;">
${detalhes.map(linhaDeDetalhe).join("\n")}
</table>
${aviso}
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid ${COR_BORDA};font-size:12px;line-height:1.5;color:${COR_TEXTO_SECUNDARIO};">Rigoni Contábil · Simples Nacional<br>Esta é uma mensagem automática. Por favor, não responda este e-mail.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
