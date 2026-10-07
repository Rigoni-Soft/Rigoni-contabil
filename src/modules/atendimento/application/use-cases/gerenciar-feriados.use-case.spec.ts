import type {
  FeriadoDto,
  FeriadoRepositoryPort,
} from "@/modules/atendimento/application/ports/out/feriado.repository";
import type { AtorSessaoDto } from "@/modules/atendimento/application/ports/out/sessao.provider";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { ok } from "@/shared/kernel/result";

import { CadastrarFeriado } from "./cadastrar-feriado.use-case";
import { ListarFeriados } from "./listar-feriados.use-case";
import { RemoverFeriado } from "./remover-feriado.use-case";

const ADMIN: AtorSessaoDto = { id: "a1", papel: "admin", setor: "recepcao" };
const FUNCIONARIO: AtorSessaoDto = { id: "f1", papel: "funcionario", setor: "recepcao" };
const LIDER: AtorSessaoDto = { id: "l1", papel: "lider_setor", setor: "recepcao" };

function montar(ator: AtorSessaoDto | null) {
  const chamadas: string[] = [];
  const repo: FeriadoRepositoryPort = {
    listar: async () => {
      chamadas.push("listar");
      return ok([{ data: "2026-10-08", descricao: "Aniversário da cidade" }] as FeriadoDto[]);
    },
    cadastrar: async (f) => {
      chamadas.push(`cadastrar ${f.data} ${f.descricao}`);
      return ok(undefined);
    },
    remover: async (d) => {
      chamadas.push(`remover ${d}`);
      return ok(undefined);
    },
  };
  const sessao = { usuarioAtual: async () => ator };
  return {
    chamadas,
    listar: new ListarFeriados(sessao, repo),
    cadastrar: new CadastrarFeriado(sessao, repo),
    remover: new RemoverFeriado(sessao, repo),
  };
}

describe("feriados do Admin", () => {
  it("Admin lista, cadastra (descrição aparada) e remove", async () => {
    const { chamadas, listar, cadastrar, remover } = montar(ADMIN);
    expect((await listar.execute()).ok).toBe(true);
    expect((await cadastrar.execute({ data: "2026-10-08", descricao: "  Padroeira  " })).ok).toBe(
      true,
    );
    expect((await remover.execute({ data: "2026-10-08" })).ok).toBe(true);
    expect(chamadas).toEqual(["listar", "cadastrar 2026-10-08 Padroeira", "remover 2026-10-08"]);
  });

  it.each([
    ["funcionário", FUNCIONARIO],
    ["líder", LIDER],
    ["sem sessão", null],
  ])("%s não lista, cadastra nem remove", async (_nome, ator) => {
    const { chamadas, listar, cadastrar, remover } = montar(ator);
    const rs = [
      await listar.execute(),
      await cadastrar.execute({ data: "2026-10-08", descricao: "X" }),
      await remover.execute({ data: "2026-10-08" }),
    ];
    for (const r of rs) expect(r).toEqual({ ok: false, error: expect.any(ForbiddenError) });
    expect(chamadas).toEqual([]);
  });

  it.each([
    ["31/12/2026", "X"],
    ["2026-02-30", "X"],
    ["2026-10-08", "   "],
    ["2026-10-08", "x".repeat(201)],
  ])("rejeita data %p / descrição inválida", async (data, descricao) => {
    const { chamadas, cadastrar } = montar(ADMIN);
    const r = await cadastrar.execute({ data, descricao });
    expect(r).toEqual({ ok: false, error: expect.any(ValidationError) });
    expect(chamadas).toEqual([]);
  });
});
