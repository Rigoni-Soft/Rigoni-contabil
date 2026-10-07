import type { ObrigacoesFiscaisPort } from "@/modules/clientes/application/ports/out/obrigacoes-fiscais.provider";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok } from "@/shared/kernel/result";

import { GuiasFiscaisViaClientes } from "./guias-fiscais.factory";

const PDF = { nomeArquivo: "x.pdf", pdfBase64: "JVBERi0=" };

function montar(autorizacao: "vigente" | "vencida" | "falha" = "vigente") {
  const consultados: string[] = [];
  const fontes: ObrigacoesFiscaisPort = {
    buscarDas: async (c) => (
      consultados.push(`das:${c}`),
      ok({ ...PDF, competencia: "2026-09", valorCentavos: 1, vencimento: "2026-10-20" })
    ),
    buscarGuiaParcelamento: async (c) => (
      consultados.push(`parcelamento:${c}`),
      ok({ ...PDF, parcela: "202609", valorCentavos: 1, vencimento: "2026-10-20" })
    ),
    buscarCnd: async (c) => (consultados.push(`cnd:${c}`), ok({ ...PDF, validade: "2027-04-01" })),
    consultarAutorizacao: async () =>
      autorizacao === "falha"
        ? err(new ServicoExternoError("fora do ar"))
        : ok(
            autorizacao === "vigente"
              ? { vigente: true as const, dataExpiracao: "2027-01-01" }
              : { vigente: false as const },
          ),
  };
  const cnpjDoCliente = async (id: string) =>
    id === "c1" ? ok("11222333000181") : err(new ServicoExternoError("sem cliente"));
  return { consultados, guias: new GuiasFiscaisViaClientes(cnpjDoCliente, fontes) };
}

describe("GuiasFiscaisViaClientes", () => {
  it.each(["das", "parcelamento", "cnd"] as const)(
    "busca %s pelo CNPJ do cadastro do Cliente",
    async (tipo) => {
      const { guias, consultados } = montar();
      const r = await guias.buscar("c1", tipo);
      expect(r.ok && r.value.pdfBase64).toBe("JVBERi0=");
      expect(consultados).toEqual([`${tipo}:11222333000181`]);
    },
  );

  it("sem autorização vigente é ValidationError e não busca o PDF", async () => {
    const { guias, consultados } = montar("vencida");
    const r = await guias.buscar("c1", "das");
    expect(r).toEqual({ ok: false, error: expect.any(ValidationError) });
    expect(consultados).toEqual([]);
  });

  it("propaga a falha da consulta de autorização e a do cadastro", async () => {
    expect((await montar("falha").guias.buscar("c1", "cnd")).ok).toBe(false);
    expect((await montar().guias.buscar("outro", "cnd")).ok).toBe(false);
  });
});
