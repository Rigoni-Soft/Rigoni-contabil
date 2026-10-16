import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok } from "@/shared/kernel/result";

import { GuiasFiscaisGateway, type ObrigacoesFiscais } from "./guias-fiscais.gateway";

const PDF = { nomeArquivo: "x.pdf", pdfBase64: "JVBERi0=" };

function montar(
  autorizacao: "vigente" | "vencida" | "falha" = "vigente",
  regime = "simples_nacional",
) {
  const consultados: string[] = [];
  const obrigacoes: ObrigacoesFiscais = {
    buscarDas: async (c) => (consultados.push(`das:${c}`), ok(PDF)),
    buscarGuiaParcelamento: async (c, r) => (consultados.push(`parcelamento:${c}:${r}`), ok(PDF)),
    consultarAutorizacao: async () =>
      autorizacao === "falha"
        ? err(new ServicoExternoError("fora do ar"))
        : ok({ vigente: autorizacao === "vigente" }),
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
  it.each(["das", "parcelamento", "cnd"] as const)(
    "busca %s pelo CNPJ do cadastro do Cliente",
    async (tipo) => {
      const { guias, consultados } = montar();
      expect(await guias.buscar("c1", tipo)).toEqual({ ok: true, value: PDF });
      expect(consultados).toEqual([
        tipo === "parcelamento"
          ? "parcelamento:11222333000181:simples_nacional"
          : `${tipo}:11222333000181`,
      ]);
    },
  );

  it("parcelamento de Cliente fora do Simples/MEI é erro de validação, sem chamar o provedor", async () => {
    const { guias, consultados } = montar("vigente", "lucro_presumido");
    const r = await guias.buscar("c1", "parcelamento");
    expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
    expect(consultados).toEqual([]);
  });

  it("sem autorização vigente é ForbiddenError e não busca o PDF", async () => {
    const { guias, consultados } = montar("vencida");
    const r = await guias.buscar("c1", "das");
    expect(r).toEqual({ ok: false, error: expect.any(ForbiddenError) });
    expect(consultados).toEqual([]);
  });

  it("propaga a falha da consulta de autorização e a do cadastro", async () => {
    expect((await montar("falha").guias.buscar("c1", "cnd")).ok).toBe(false);
    expect((await montar().guias.buscar("outro", "cnd")).ok).toBe(false);
  });
});
