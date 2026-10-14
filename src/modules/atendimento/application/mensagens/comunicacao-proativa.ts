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

export function montarTemplate(
  comunicacao: ComunicacaoProativa,
  telefone: string,
): TemplateEnviado {
  const base = { telefone, nome: comunicacao.tipo, idioma: "pt_BR" } as const;
  switch (comunicacao.tipo) {
    case "lembrete_documento_obrigatorio":
      return { ...base, variaveis: [comunicacao.contato, comunicacao.empresa] };
    case "envio_guia_das":
      return {
        ...base,
        variaveis: [
          comunicacao.contato,
          comunicacao.empresa,
          comunicacao.competencia,
          comunicacao.vencimento,
        ],
        documento: comunicacao.guia,
      };
    case "envio_guia_parcelamento":
      return {
        ...base,
        variaveis: [comunicacao.contato, comunicacao.empresa, comunicacao.parcela],
        documento: comunicacao.guia,
      };
  }
}

const ASSUNTO_EMAIL: Record<ComunicacaoProativa["tipo"], string> = {
  lembrete_documento_obrigatorio: "Documentos fiscais pendentes",
  envio_guia_das: "Guia do DAS",
  envio_guia_parcelamento: "Guia de parcelamento",
};

export const montarAssuntoEmail = (c: ComunicacaoProativa): string => ASSUNTO_EMAIL[c.tipo];

// Texto no formato próprio do sistema, usado com a janela aberta (sem custo de template) e no
// e-mail.
export function montarTextoLivre(comunicacao: ComunicacaoProativa): string {
  switch (comunicacao.tipo) {
    case "lembrete_documento_obrigatorio":
      return `Olá, ${comunicacao.contato}! Ainda não recebemos os documentos fiscais de ${comunicacao.empresa} referentes a este mês. Poderia nos enviar assim que possível?`;
    case "envio_guia_das":
      return `Olá, ${comunicacao.contato}! Segue a guia do DAS de ${comunicacao.empresa}, competência ${comunicacao.competencia}, com vencimento em ${comunicacao.vencimento}.`;
    case "envio_guia_parcelamento":
      return `Olá, ${comunicacao.contato}! Segue a guia de parcelamento de ${comunicacao.empresa}, referente à parcela de ${comunicacao.parcela}.`;
  }
}

export function montarMensagemLivre(
  comunicacao: ComunicacaoProativa,
  telefone: string,
): { texto: string; documento?: DocumentoEnviado } {
  const texto = montarTextoLivre(comunicacao);
  return "guia" in comunicacao
    ? { texto, documento: { telefone, ...comunicacao.guia } }
    : { texto };
}
