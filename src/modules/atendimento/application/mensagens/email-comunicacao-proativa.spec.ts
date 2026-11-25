import type { ComunicacaoProativa } from "@/modules/atendimento/application/mensagens/comunicacao-proativa";
import {
  escaparHtml,
  montarEmailHtml,
} from "@/modules/atendimento/application/mensagens/email-comunicacao-proativa";

const GUIA = { url: "https://storage.test/guia.pdf", nomeArquivo: "guia.pdf" };

describe("montarEmailHtml", () => {
  it("lembrete de documento: saudação, empresa e sem aviso de anexo", () => {
    const html = montarEmailHtml({
      tipo: "lembrete_documento_obrigatorio",
      contato: "Ângela",
      empresa: "3A Construções LTDA",
    });

    expect(html).toContain("Olá, Ângela!");
    expect(html).toContain("Documentos fiscais pendentes");
    expect(html).toContain("3A Construções LTDA");
    expect(html).not.toContain("anexada a este e-mail");
  });

  it("guia do DAS: competência, vencimento e aviso de anexo", () => {
    const html = montarEmailHtml({
      tipo: "envio_guia_das",
      contato: "Ângela",
      empresa: "3A Construções LTDA",
      competencia: "09/2026",
      vencimento: "20/10/2026",
      guia: GUIA,
    });

    expect(html).toContain("Guia do DAS");
    expect(html).toContain("09/2026");
    expect(html).toContain("20/10/2026");
    expect(html).toContain("anexada a este e-mail");
  });

  it("guia de parcelamento: parcela e aviso de anexo", () => {
    const html = montarEmailHtml({
      tipo: "envio_guia_parcelamento",
      contato: "Ângela",
      empresa: "3A Construções LTDA",
      parcela: "parcela 4/12 — 09/2026",
      guia: GUIA,
    });

    expect(html).toContain("Guia de parcelamento");
    expect(html).toContain("parcela 4/12 — 09/2026");
    expect(html).toContain("anexada a este e-mail");
  });

  it("escapa HTML vindo de nome de contato e empresa", () => {
    const comunicacao: ComunicacaoProativa = {
      tipo: "lembrete_documento_obrigatorio",
      contato: "<script>x</script>",
      empresa: 'A & "B"',
    };

    const html = montarEmailHtml(comunicacao);

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(html).toContain("A &amp; &quot;B&quot;");
  });

  it("escaparHtml troca os cinco caracteres especiais", () => {
    expect(escaparHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});
