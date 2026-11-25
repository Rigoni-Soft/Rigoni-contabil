import { validarRegrasDaConvencao } from "@/modules/rh/domain/services/validar-regras-da-convencao.service";

import { ExtratorDeRegrasFalsoGateway } from "./extrator-de-regras-falso.gateway";
import { ExtratorDeRegrasIndisponivelGateway } from "./extrator-de-regras-indisponivel.gateway";

const pdf = (texto: string) => Uint8Array.from(Buffer.from(`%PDF-1.7 ${texto}`));

describe("ExtratorDeRegrasFalsoGateway", () => {
  it("a convenção de exemplo vira cinco regras aplicadas e uma rejeitada", async () => {
    const extracao = await new ExtratorDeRegrasFalsoGateway().extrair(pdf("cct"));

    expect(extracao.lido).toBe(true);
    const regras = validarRegrasDaConvencao(extracao.lido ? extracao.candidatas : []);

    expect(regras.aplicadas.map((r) => r.chave)).toEqual([
      "jornada_semanal",
      "jornada_diaria",
      "limite_extras_dia",
      "extra_sabado",
      "datas_especiais",
    ]);
    expect(regras.aplicadas.every((r) => r.clausula !== "" && r.trecho !== "")).toBe(true);
    expect(regras.rejeitadas).toEqual([{ chave: "intervalo_maximo", motivo: "fora_do_trecho" }]);
  });

  it("lê o sindicato e a vigência do texto do PDF", async () => {
    const extracao = await new ExtratorDeRegrasFalsoGateway().extrair(
      pdf("Sindicato: Comércio de Cascavel\nVigência: 01/05/2025 a 30/04/2026\n"),
    );

    expect(extracao).toMatchObject({
      lido: true,
      sindicato: "Comércio de Cascavel",
      vigenciaInicio: "2025-05-01",
      vigenciaFim: "2026-04-30",
    });
  });

  it("sem sindicato nem vigência no texto, devolve os da convenção de exemplo", async () => {
    const extracao = await new ExtratorDeRegrasFalsoGateway().extrair(pdf("cct"));

    expect(extracao).toMatchObject({
      sindicato: "Comércio",
      vigenciaInicio: "2026-05-01",
      vigenciaFim: "2027-04-30",
    });
  });

  it("o marcador [extrator:falha] simula a leitura que não deu certo", async () => {
    const extracao = await new ExtratorDeRegrasFalsoGateway().extrair(pdf("[extrator:falha]"));

    expect(extracao).toEqual({ lido: false });
  });
});

describe("ExtratorDeRegrasIndisponivelGateway", () => {
  it("nunca lê: o envio é recusado em vez de gravar regras inventadas", async () => {
    expect(await new ExtratorDeRegrasIndisponivelGateway().extrair()).toEqual({ lido: false });
  });
});
