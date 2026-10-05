import type { ComunicacaoProativa } from "@/modules/atendimento/domain/comunicacao-proativa";
import { EnvioMensagemFalsoGateway } from "@/modules/atendimento/infra/gateways/envio-mensagem-falso.gateway";

import { EnviarComunicacaoProativa } from "./enviar-comunicacao-proativa.use-case";

const telefone = "5511912345678";
const agora = new Date("2026-10-05T12:00:00Z");
const horasAtras = (h: number) => new Date(agora.getTime() - h * 3_600_000);
const guia = { url: "https://storage.test/guia.pdf", nomeArquivo: "guia.pdf" };

const lembrete: ComunicacaoProativa = {
  tipo: "lembrete_documento_obrigatorio",
  contato: "Ângela",
  empresa: "3A Construções e Reformas LTDA",
};
const das: ComunicacaoProativa = {
  tipo: "envio_guia_das",
  contato: "Ângela",
  empresa: "3A",
  competencia: "09/2026",
  vencimento: "20/10/2026",
  guia,
};
const parcelamento: ComunicacaoProativa = {
  tipo: "envio_guia_parcelamento",
  contato: "Ângela",
  empresa: "3A",
  parcela: "parcela 4/12 — 09/2026",
  guia,
};

let envio: EnvioMensagemFalsoGateway;
beforeEach(() => {
  jest.spyOn(console, "info").mockImplementation(() => undefined);
  envio = new EnvioMensagemFalsoGateway();
});

const enviar = (comunicacao: ComunicacaoProativa, ultima: Date | null) =>
  new EnviarComunicacaoProativa(envio).execute({
    telefone,
    comunicacao,
    ultimaMensagemDoContatoEm: ultima,
    agora,
  });

describe("EnviarComunicacaoProativa", () => {
  it.each([
    ["sem mensagem do contato", null],
    ["24h exatas", horasAtras(24)],
    ["mais de 24h", horasAtras(30)],
  ])("janela fechada (%s): usa o template, nunca mensagem livre", async (_, ultima) => {
    expect((await enviar(lembrete, ultima)).ok).toBe(true);
    expect(envio.templatesEnviados).toHaveLength(1);
    expect(envio.enviadas).toHaveLength(0);
  });

  it("janela aberta: usa o formato próprio, nunca o template", async () => {
    expect((await enviar(lembrete, horasAtras(23))).ok).toBe(true);
    expect(envio.templatesEnviados).toHaveLength(0);
    expect(envio.enviadas).toHaveLength(1);
    expect(envio.enviadas[0].texto).toContain("3A Construções e Reformas LTDA");
  });

  it("janela aberta com guia: texto e depois o documento", async () => {
    await enviar(das, horasAtras(1));
    expect(envio.enviadas).toHaveLength(1);
    expect(envio.documentosEnviados).toEqual([{ telefone, ...guia }]);
    expect(envio.templatesEnviados).toHaveLength(0);
  });

  it("lembrete_documento_obrigatorio: nome, idioma e variáveis {{1}} contato e {{2}} empresa", async () => {
    await enviar(lembrete, null);
    expect(envio.templatesEnviados[0]).toEqual({
      telefone,
      nome: "lembrete_documento_obrigatorio",
      idioma: "pt_BR",
      variaveis: ["Ângela", "3A Construções e Reformas LTDA"],
    });
  });

  it("envio_guia_das: variáveis contato, empresa, competência, vencimento e PDF no cabeçalho", async () => {
    await enviar(das, null);
    expect(envio.templatesEnviados[0]).toEqual({
      telefone,
      nome: "envio_guia_das",
      idioma: "pt_BR",
      variaveis: ["Ângela", "3A", "09/2026", "20/10/2026"],
      documento: guia,
    });
    expect(envio.requisicoes[0]).toMatchObject({
      type: "template",
      template: {
        name: "envio_guia_das",
        language: { code: "pt_BR" },
        components: [
          { type: "header", parameters: [{ type: "document" }] },
          {
            type: "body",
            parameters: [
              { text: "Ângela" },
              { text: "3A" },
              { text: "09/2026" },
              { text: "20/10/2026" },
            ],
          },
        ],
      },
    });
  });

  it("envio_guia_parcelamento: variáveis contato, empresa, parcela e PDF no cabeçalho", async () => {
    await enviar(parcelamento, null);
    expect(envio.templatesEnviados[0]).toEqual({
      telefone,
      nome: "envio_guia_parcelamento",
      idioma: "pt_BR",
      variaveis: ["Ângela", "3A", "parcela 4/12 — 09/2026"],
      documento: guia,
    });
  });

  it("propaga a falha do envio sem enviar o documento", async () => {
    envio = new EnvioMensagemFalsoGateway({ [telefone]: 133010 });
    const r = await enviar(das, horasAtras(1));
    expect(r.ok).toBe(false);
    expect(envio.documentosEnviados).toHaveLength(0);
  });
});
