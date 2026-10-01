import type {
  CadastroOperacionalClienteDto,
  ClienteQueryPort,
  ResumoOperacionalRow,
  SugestaoClienteDto,
} from "@/modules/clientes/application/ports/out/cliente-query.provider";
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
}

describe("BuscarClientes", () => {
  it("devolve as sugestões encontradas pelo termo", async () => {
    const query = new ClienteQueryPortFalso(SUGESTOES);

    const resultado = await new BuscarClientes(query).execute("Pão Quente", false);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value).toEqual(SUGESTOES);
  });

  it("devolve lista vazia quando nada casa com o termo", async () => {
    const query = new ClienteQueryPortFalso([]);

    const resultado = await new BuscarClientes(query).execute("inexistente", false);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value).toEqual([]);
  });

  it("repassa apenasSnMei pra porta de query sem alterar", async () => {
    const query = new ClienteQueryPortFalso(SUGESTOES);

    await new BuscarClientes(query).execute("Pão Quente", true);

    expect(query.apenasSnMeiRecebido).toBe(true);
  });
});
