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
