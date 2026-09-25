import type { RegistroAcaoDto } from "@/modules/auditoria/application/dtos/registro-acao.dto";
import type { RegistroAcaoRepository } from "@/modules/auditoria/application/ports/out/registro-acao.repository";
import type { RegistroAcao } from "@/modules/auditoria/domain/entities/registro-acao.entity";
import type { AppError } from "@/shared/errors/app.error";
import { ok, type Result } from "@/shared/kernel/result";

import { RegistrarAcao } from "./registrar-acao.use-case";

class RegistroAcaoRepositoryFalso implements RegistroAcaoRepository {
  salvo: RegistroAcao | null = null;

  async salvar(registro: RegistroAcao): Promise<Result<void, AppError>> {
    this.salvo = registro;
    return ok(undefined);
  }

  async listarRecentes(): Promise<RegistroAcaoDto[]> {
    return [];
  }
}

describe("RegistrarAcao", () => {
  it("grava ator, setor, ação, alvo e resultado, com data/hora atribuída", async () => {
    const repositorio = new RegistroAcaoRepositoryFalso();

    const resultado = await new RegistrarAcao(repositorio).execute({
      ator: "11111111-1111-1111-1111-111111111111",
      setor: "administrativo",
      acao: "usuario.criar",
      alvo: "usuário jessica@rigonicontabil.local",
      resultado: "sucesso",
    });

    expect(resultado.ok).toBe(true);
    expect(repositorio.salvo?.ator).toBe("11111111-1111-1111-1111-111111111111");
    expect(repositorio.salvo?.acao).toBe("usuario.criar");
    expect(repositorio.salvo?.resultado.ehSucesso()).toBe(true);
    expect(repositorio.salvo?.dataHora).toBeInstanceOf(Date);
  });

  it("devolve erro de validação sem chamar o repositório quando o alvo está vazio", async () => {
    const repositorio = new RegistroAcaoRepositoryFalso();

    const resultado = await new RegistrarAcao(repositorio).execute({
      ator: "11111111-1111-1111-1111-111111111111",
      setor: "administrativo",
      acao: "usuario.criar",
      alvo: "",
      resultado: "sucesso",
    });

    expect(resultado.ok).toBe(false);
    expect(repositorio.salvo).toBeNull();
  });
});
