import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok } from "@/shared/kernel/result";

import { GuiasFiscaisGateway, type ObrigacoesFiscais } from "./guias-fiscais.gateway";

const PDF = { nomeArquivo: "x.pdf", pdfBase64: "JVBERi0=" };
const PARCELA_1 = { ...PDF, parcela: "202608", valorCentavos: 100 };
const PARCELA_2 = { ...PDF, parcela: "202609", valorCentavos: 200 };

function montar(
  autorizacao: "vigente" | "vencida" | "falha" = "vigente",
  regime = "simples_nacional",
) {
  const consultados: string[] = [];
  const obrigacoes: ObrigacoesFiscais = {
    buscarDas: async (c) => (consultados.push(`das:${c}`), ok(PDF)),
    buscarGuiasParcelamento: async (c, p) => (
      consultados.push(`parcelamentos:${c}:${p.regime}:${p.ignorar.join("+")}`),
      ok([PARCELA_1, PARCELA_2].filter((g) => !p.ignorar.includes(g.parcela)))
    ),
    consultarAutorizacao: async () => (
      consultados.push("autorizacao"),
      autorizacao === "falha"
        ? err(new ServicoExternoError("fora do ar"))
        : ok({ vigente: autorizacao === "vigente" })
    ),
  };
  const clientes = {
    cadastroFiscalDoCliente: async (id: string) =>
      id === "c1"
        ? ok({ cnpj: "11222333000181", regime })
        : err(new ServicoExternoError("sem cliente")),
  };
  return {
    consultados,
    guias: new GuiasFiscaisGateway(clientes, obrigacoes, {
      buscarCnd: async (c) => (consultados.push(`cnd:${c}`), ok(PDF)),
    }),
  };
}

describe("GuiasFiscaisGateway", () => {
  it.each(["das", "cnd"] as const)("busca %s pelo CNPJ do cadastro do Cliente", async (tipo) => {
    const { guias, consultados } = montar();
    expect(await guias.buscar("c1", tipo)).toEqual({ ok: true, value: PDF });
    expect(consultados.filter((c) => c !== "autorizacao")).toEqual([`${tipo}:11222333000181`]);
  });

  describe("guias de parcelamento", () => {
    it("devolve todas as guias do CNPJ do cadastro, direto, sem pré-consulta de autorização", async () => {
      const { guias, consultados } = montar();

      const r = await guias.buscarGuiasParcelamento("c1", []);

      expect(r).toEqual({ ok: true, value: [PARCELA_1, PARCELA_2] });
      expect(consultados).toEqual(["parcelamentos:11222333000181:simples_nacional:"]);
    });

    it("repassa as parcelas já entregues, que o provedor não emite de novo", async () => {
      const { guias, consultados } = montar("vigente", "mei");

      const r = await guias.buscarGuiasParcelamento("c1", ["202608"]);

      expect(r).toEqual({ ok: true, value: [PARCELA_2] });
      expect(consultados).toEqual(["parcelamentos:11222333000181:mei:202608"]);
    });

    it("Cliente fora do Simples/MEI é erro de validação, sem chamar o provedor", async () => {
      const { guias, consultados } = montar("vigente", "lucro_presumido");

      const r = await guias.buscarGuiasParcelamento("c1", []);

      expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
      expect(consultados).toEqual([]);
    });

    it("propaga a falha do cadastro", async () => {
      expect((await montar().guias.buscarGuiasParcelamento("outro", [])).ok).toBe(false);
    });

    it("a guia única de parcelamento não existe mais: `buscar` recusa o tipo", async () => {
      const { guias, consultados } = montar();

      const r = await guias.buscar("c1", "parcelamento");

      expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
      expect(consultados).toEqual([]);
    });
  });

  it("sem autorização vigente é ForbiddenError e não busca o PDF", async () => {
    const { guias, consultados } = montar("vencida");
    const r = await guias.buscar("c1", "das");
    expect(r).toEqual({ ok: false, error: expect.any(ForbiddenError) });
    expect(consultados).toEqual(["autorizacao"]);
  });

  it("propaga a falha da consulta de autorização e a do cadastro", async () => {
    expect((await montar("falha").guias.buscar("c1", "cnd")).ok).toBe(false);
    expect((await montar().guias.buscar("outro", "cnd")).ok).toBe(false);
  });
});
