import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { GuiaParcelamentoIndisponivelError } from "@/shared/errors/guia-parcelamento-indisponivel.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok } from "@/shared/kernel/result";

import { GuiasFiscaisGateway, type ObrigacoesFiscais } from "./guias-fiscais.gateway";

const PARCELAMENTO = { codigo: "PARC-AB12CD34", emAbertoDaReceita: 1 };
const PDF = { nomeArquivo: "x.pdf", pdfBase64: "JVBERi0=" };

function montar(
  autorizacao: "vigente" | "vencida" | "falha" = "vigente",
  regime = "simples_nacional",
) {
  const consultados: string[] = [];
  const obrigacoes: ObrigacoesFiscais = {
    buscarDas: async (c) => (consultados.push(`das:${c}`), ok(PDF)),
    buscarGuiaParcelamento: async (c, p) =>
      p.codigo === "QUITADO"
        ? err(new GuiaParcelamentoIndisponivelError("quitado"))
        : (consultados.push(`parcelamento:${c}:${p.regime}:${p.codigo}:${p.emAbertoDaReceita}`),
          ok(PDF)),
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
  it.each(["das", "parcelamento", "cnd"] as const)(
    "busca %s pelo CNPJ do cadastro do Cliente",
    async (tipo) => {
      const { guias, consultados } = montar();
      expect(await guias.buscar("c1", tipo, PARCELAMENTO)).toEqual({ ok: true, value: PDF });
      expect(consultados.filter((c) => c !== "autorizacao")).toEqual([
        tipo === "parcelamento"
          ? "parcelamento:11222333000181:simples_nacional:PARC-AB12CD34:1"
          : `${tipo}:11222333000181`,
      ]);
    },
  );

  it("guia de parcelamento vai direto ao provedor, sem pré-consulta de autorização", async () => {
    const { guias, consultados } = montar();

    await guias.buscar("c1", "parcelamento", PARCELAMENTO);

    expect(consultados).not.toContain("autorizacao");
  });

  it("parcelamento sem o código do parcelamento é erro de validação, sem chamar o provedor", async () => {
    const { guias, consultados } = montar();

    const r = await guias.buscar("c1", "parcelamento");

    expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
    expect(consultados).toEqual([]);
  });

  it("repassa o motivo tipado de o provedor não emitir a guia", async () => {
    const { guias } = montar();

    const r = await guias.buscar("c1", "parcelamento", { ...PARCELAMENTO, codigo: "QUITADO" });

    expect(!r.ok && r.error).toBeInstanceOf(GuiaParcelamentoIndisponivelError);
  });

  it("parcelamento de Cliente fora do Simples/MEI é erro de validação, sem chamar o provedor", async () => {
    const { guias, consultados } = montar("vigente", "lucro_presumido");
    const r = await guias.buscar("c1", "parcelamento", PARCELAMENTO);
    expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
    expect(consultados).toEqual([]);
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
