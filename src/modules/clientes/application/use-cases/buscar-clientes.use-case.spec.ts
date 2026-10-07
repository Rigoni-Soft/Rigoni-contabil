import type {
  CadastroOperacionalClienteDto,
  ClienteQueryPort,
  ResumoOperacionalRow,
  SugestaoClienteDto,
} from "@/modules/clientes/application/ports/out/cliente-query.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ok, type Result } from "@/shared/kernel/result";

import { BuscarClientes } from "./buscar-clientes.use-case";

const SUGESTOES: SugestaoClienteDto[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    empresa: "Padaria Pão Quente Ltda",
    cnpj: "11444777000161",
  },
];

class ClienteQueryPortFalso implements ClienteQueryPort {
  apenasSnMeiRecebido: boolean | null = null;
  constructor(private sugestoes: SugestaoClienteDto[]) {}
  async buscarCadastroOperacional(): Promise<
    Result<CadastroOperacionalClienteDto | null, AppError>
  > {
    return ok(null);
  }
  async buscarPorTermo(
    _termo: string,
    apenasSnMei: boolean,
  ): Promise<Result<SugestaoClienteDto[], AppError>> {
    this.apenasSnMeiRecebido = apenasSnMei;
    return ok(this.sugestoes);
  }
  async listarResumoOperacional(): Promise<Result<ResumoOperacionalRow[], AppError>> {
    return ok([]);
  }
  async listarResponsaveisElegiveis() {
    return ok([]);
  }
}

const COM_SESSAO: SessaoPort = {
  usuarioAtual: async () => ({ id: "u1", papel: "funcionario", setor: "simples_nacional" }),
};
const SEM_SESSAO: SessaoPort = { usuarioAtual: async () => null };

describe("BuscarClientes", () => {
  it("recusa sem sessão, sem consultar", async () => {
    const query = new ClienteQueryPortFalso(SUGESTOES);

    const resultado = await new BuscarClientes(SEM_SESSAO, query).execute("Pão", false);

    expect(!resultado.ok && resultado.error.code).toBe("FORBIDDEN");
    expect(query.apenasSnMeiRecebido).toBeNull();
  });

  it("devolve as sugestões encontradas pelo termo", async () => {
    const query = new ClienteQueryPortFalso(SUGESTOES);

    const resultado = await new BuscarClientes(COM_SESSAO, query).execute("Pão Quente", false);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value).toEqual(SUGESTOES);
  });

  it("devolve lista vazia quando nada casa com o termo", async () => {
    const query = new ClienteQueryPortFalso([]);

    const resultado = await new BuscarClientes(COM_SESSAO, query).execute("inexistente", false);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value).toEqual([]);
  });

  it("repassa apenasSnMei pra porta de query sem alterar", async () => {
    const query = new ClienteQueryPortFalso(SUGESTOES);

    await new BuscarClientes(COM_SESSAO, query).execute("Pão Quente", true);

    expect(query.apenasSnMeiRecebido).toBe(true);
  });
});
