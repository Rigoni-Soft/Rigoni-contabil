import type {
  ClienteQueryPort,
  ResponsavelOpcaoDto,
} from "@/modules/clientes/application/ports/out/cliente-query.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import { ok } from "@/shared/kernel/result";

import { ListarResponsaveisElegiveis } from "./listar-responsaveis-elegiveis.use-case";

const OPCOES: ResponsavelOpcaoDto[] = [{ id: "f1", nome: "Funcionário SN" }];
const query = {
  listarResponsaveisElegiveis: async () => ok(OPCOES),
} as unknown as ClienteQueryPort;

describe("ListarResponsaveisElegiveis", () => {
  it("devolve a lista com sessão válida", async () => {
    const sessao: SessaoPort = {
      usuarioAtual: async () => ({ id: "u1", papel: "lider_setor", setor: "simples_nacional" }),
    };

    const r = await new ListarResponsaveisElegiveis(sessao, query).execute();

    expect(r.ok && r.value).toEqual(OPCOES);
  });

  it.each([
    ["funcionario", "simples_nacional"],
    ["lider_setor", "financeiro"],
    ["admin", "administrativo"],
  ])("recusa %s do setor %s", async (papel, setor) => {
    const sessao: SessaoPort = { usuarioAtual: async () => ({ id: "u1", papel, setor }) };

    const r = await new ListarResponsaveisElegiveis(sessao, query).execute();

    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
  });

  it("recusa sem sessão", async () => {
    const sessao: SessaoPort = { usuarioAtual: async () => null };

    const r = await new ListarResponsaveisElegiveis(sessao, query).execute();

    expect(r.ok).toBe(false);
  });
});
