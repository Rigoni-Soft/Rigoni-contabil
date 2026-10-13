import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok } from "@/shared/kernel/result";

import { GuiasFiscaisGateway, type ObrigacoesFiscais } from "./guias-fiscais.gateway";

const PDF = { nomeArquivo: "x.pdf", pdfBase64: "JVBERi0=" };

function montar(autorizacao: "vigente" | "vencida" | "falha" = "vigente") {
  const consultados: string[] = [];
  const obrigacoes: ObrigacoesFiscais = {
    buscarDas: async (c) => (consultados.push(`das:${c}`), ok(PDF)),
    buscarGuiaParcelamento: async (c) => (consultados.push(`parcelamento:${c}`), ok(PDF)),
    buscarCnd: async (c) => (consultados.push(`cnd:${c}`), ok(PDF)),
    consultarAutorizacao: async () =>
      autorizacao === "falha"
        ? err(new ServicoExternoError("fora do ar"))
        : ok({ vigente: autorizacao === "vigente" }),
  };
  const clientes = {
    cnpjDoCliente: async (id: string) =>
      id === "c1" ? ok("11222333000181") : err(new ServicoExternoError("sem cliente")),
  };
  return { consultados, guias: new GuiasFiscaisGateway(clientes, obrigacoes) };
}

describe("GuiasFiscaisGateway", () => {
  it.each(["das", "parcelamento", "cnd"] as const)(
    "busca %s pelo CNPJ do cadastro do Cliente",
    async (tipo) => {
      const { guias, consultados } = montar();
      expect(await guias.buscar("c1", tipo)).toEqual({ ok: true, value: PDF });
      expect(consultados).toEqual([`${tipo}:11222333000181`]);
    },
  );

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
