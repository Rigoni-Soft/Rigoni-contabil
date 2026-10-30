import type { ClienteQueryPort } from "@/modules/clientes/application/ports/out/cliente-query.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import { ok } from "@/shared/kernel/result";

import { ConsultarResponsavelDoSetor } from "./consultar-responsavel-do-setor.use-case";

const ATUAL = { id: "f1", nome: "Funcionária Contábil" };
const consultados: unknown[][] = [];
const query = {
  buscarResponsavelDoSetor: async (...args: unknown[]) => {
    consultados.push(args);
    return ok(ATUAL);
  },
} as unknown as ClienteQueryPort;
const comoAtor = (papel: string, setor: string): SessaoPort => ({
  usuarioAtual: async () => ({ id: "u1", papel, setor }),
});

describe("ConsultarResponsavelDoSetor", () => {
  it("o Líder lê o Responsável do Cliente no próprio Setor", async () => {
    const caso = new ConsultarResponsavelDoSetor(comoAtor("lider_setor", "contabil"), query);

    const r = await caso.execute("c1");

    expect(r.ok && r.value).toEqual(ATUAL);
    expect(consultados.at(-1)).toEqual(["c1", "contabil"]);
  });

  it.each([
    ["funcionario", "contabil"],
    ["lider_setor", "recepcao"],
    ["admin", "administrativo"],
  ])("recusa %s do setor %s", async (papel, setor) => {
    const r = await new ConsultarResponsavelDoSetor(comoAtor(papel, setor), query).execute("c1");

    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
  });

  it("recusa sem sessão", async () => {
    const sessao: SessaoPort = { usuarioAtual: async () => null };

    const r = await new ConsultarResponsavelDoSetor(sessao, query).execute("c1");

    expect(r.ok).toBe(false);
  });
});
