import type {
  DocumentoEnviado,
  TemplateEnviado,
} from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";

const JANELA_MS = 24 * 60 * 60 * 1000;

type Guia = { url: string; nomeArquivo: string };

// Comunicações proativas do sistema (seção 9 da spec); variáveis em docs/pesquisa/templates-whatsapp.md.
export type ComunicacaoProativa =
  | { tipo: "lembrete_documento_obrigatorio"; contato: string; empresa: string }
  | {
      tipo: "envio_guia_das";
      contato: string;
      empresa: string;
      competencia: string;
      vencimento: string;
      guia: Guia;
    }
  | {
      tipo: "envio_guia_parcelamento";
      contato: string;
      empresa: string;
      parcela: string;
      guia: Guia;
    };

// A janela de 24h conta da última mensagem recebida do contato.
export function janelaAberta(ultimaMensagemDoContatoEm: Date | null, agora: Date): boolean {
  return (
    ultimaMensagemDoContatoEm !== null &&
    agora.getTime() - ultimaMensagemDoContatoEm.getTime() < JANELA_MS
  );
}

export function montarTemplate(c: ComunicacaoProativa, telefone: string): TemplateEnviado {
  const base = { telefone, nome: c.tipo, idioma: "pt_BR" } as const;
  switch (c.tipo) {
    case "lembrete_documento_obrigatorio":
      return { ...base, variaveis: [c.contato, c.empresa] };
    case "envio_guia_das":
      return {
        ...base,
        variaveis: [c.contato, c.empresa, c.competencia, c.vencimento],
        documento: c.guia,
      };
    case "envio_guia_parcelamento":
      return { ...base, variaveis: [c.contato, c.empresa, c.parcela], documento: c.guia };
  }
}

// Formato próprio do sistema, usado com a janela aberta (sem custo de template).
export function montarMensagemLivre(
  c: ComunicacaoProativa,
  telefone: string,
): { texto: string; documento?: DocumentoEnviado } {
  switch (c.tipo) {
    case "lembrete_documento_obrigatorio":
      return {
        texto: `Olá, ${c.contato}! Ainda não recebemos os documentos fiscais de ${c.empresa} referentes a este mês. Poderia nos enviar assim que possível?`,
      };
    case "envio_guia_das":
      return {
        texto: `Olá, ${c.contato}! Segue a guia do DAS de ${c.empresa}, competência ${c.competencia}, com vencimento em ${c.vencimento}.`,
        documento: { telefone, ...c.guia },
      };
    case "envio_guia_parcelamento":
      return {
        texto: `Olá, ${c.contato}! Segue a guia de parcelamento de ${c.empresa}, referente à parcela de ${c.parcela}.`,
        documento: { telefone, ...c.guia },
      };
  }
}
