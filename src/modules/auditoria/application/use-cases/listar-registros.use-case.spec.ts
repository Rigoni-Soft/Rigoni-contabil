import type { RegistroAcaoDto } from "@/modules/auditoria/application/dtos/registro-acao.dto";
import type {
  RegistroAcaoFiltro,
  RegistroAcaoRepository,
} from "@/modules/auditoria/application/ports/out/registro-acao.repository";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/auditoria/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ok, type Result } from "@/shared/kernel/result";

import { ListarRegistros } from "./listar-registros.use-case";

class SessaoFalsa implements SessaoPort {
  ator: AtorSessaoDto | null = { id: "admin-1", papel: "admin" };
  async usuarioAtual(): Promise<AtorSessaoDto | null> {
    return this.ator;
  }
}

class RegistroAcaoRepositoryFalso implements RegistroAcaoRepository {
  registros: RegistroAcaoDto[] = [];
  filtroRecebido?: RegistroAcaoFiltro;

  async salvar(): Promise<Result<void, AppError>> {
    return ok(undefined);
  }
  async listar(filtro: RegistroAcaoFiltro): Promise<Result<RegistroAcaoDto[], AppError>> {
    this.filtroRecebido = filtro;
    return ok(this.registros);
  }
}

const REGISTRO_FALSO: RegistroAcaoDto = {
  id: "1",
  ator: "admin-1",
  setor: "administrativo",
  acao: "usuario.criar",
  alvo: "usuário x",
  resultado: "sucesso",
  dataHora: new Date().toISOString(),
};

describe("ListarRegistros", () => {
  it("devolve os registros para um Admin", async () => {
    const sessao = new SessaoFalsa();
    const repositorio = new RegistroAcaoRepositoryFalso();
    repositorio.registros = [REGISTRO_FALSO];

    const resultado = await new ListarRegistros(repositorio, sessao).execute();

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value).toEqual([REGISTRO_FALSO]);
  });

  it("nega acesso para quem não é Admin", async () => {
    const sessao = new SessaoFalsa();
    sessao.ator = { id: "func-1", papel: "funcionario" };
    const repositorio = new RegistroAcaoRepositoryFalso();

    const resultado = await new ListarRegistros(repositorio, sessao).execute();

    expect(resultado.ok).toBe(false);
  });

  it("nega acesso sem sessão", async () => {
    const sessao = new SessaoFalsa();
    sessao.ator = null;
    const repositorio = new RegistroAcaoRepositoryFalso();

    const resultado = await new ListarRegistros(repositorio, sessao).execute();

    expect(resultado.ok).toBe(false);
  });

  it("repassa setor, ator, ação, alvo e resultado ao repositório", async () => {
    const sessao = new SessaoFalsa();
    const repositorio = new RegistroAcaoRepositoryFalso();

    await new ListarRegistros(repositorio, sessao).execute({
      setor: "administrativo",
      ator: "admin-1",
      acao: "usuario.criar",
      alvo: "jessica",
      resultado: "sucesso",
    });

    expect(repositorio.filtroRecebido).toMatchObject({
      setor: "administrativo",
      ator: "admin-1",
      acao: "usuario.criar",
      alvo: "jessica",
      resultado: "sucesso",
    });
  });

  it("converte o período (yyyy-mm-dd) no dia inteiro, início e fim inclusive", async () => {
    const sessao = new SessaoFalsa();
    const repositorio = new RegistroAcaoRepositoryFalso();

    await new ListarRegistros(repositorio, sessao).execute({
      dataInicio: "2026-09-01",
      dataFim: "2026-09-22",
    });

    expect(repositorio.filtroRecebido?.dataInicio).toBe("2026-09-01T00:00:00.000Z");
    expect(repositorio.filtroRecebido?.dataFim).toBe("2026-09-22T23:59:59.999Z");
  });

  it("sem período informado, não filtra por data", async () => {
    const sessao = new SessaoFalsa();
    const repositorio = new RegistroAcaoRepositoryFalso();

    await new ListarRegistros(repositorio, sessao).execute();

    expect(repositorio.filtroRecebido?.dataInicio).toBeUndefined();
    expect(repositorio.filtroRecebido?.dataFim).toBeUndefined();
  });
});
