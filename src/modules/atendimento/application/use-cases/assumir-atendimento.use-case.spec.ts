import type {
  AtendimentoRepositoryPort,
  ResultadoAssuncao,
} from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { AtorSessaoDto } from "@/modules/atendimento/application/ports/out/sessao.provider";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok } from "@/shared/kernel/result";

import { AssumirAtendimento } from "./assumir-atendimento.use-case";

const ATOR: AtorSessaoDto = { id: "func-1", papel: "funcionario", setor: "contabil" };

function montar(
  opcoes: { ator?: AtorSessaoDto | null; assuncao?: ResultadoAssuncao; falha?: boolean } = {},
) {
  const chamadas: unknown[][] = [];
  const repo = {
    assumir: async (...args: unknown[]) => {
      chamadas.push(args);
      return opcoes.falha
        ? err(new ServicoExternoError("banco"))
        : ok(opcoes.assuncao ?? { status: "assumido" as const });
    },
  } as unknown as AtendimentoRepositoryPort;
  const caso = new AssumirAtendimento(
    { usuarioAtual: async () => (opcoes.ator === undefined ? ATOR : opcoes.ator) },
    repo,
  );
  return { caso, chamadas };
}

const INPUT = { atendimentoId: "at-1" };

describe("AssumirAtendimento", () => {
  it("assume em nome do usuário logado", async () => {
    const { caso, chamadas } = montar();
    const r = await caso.execute(INPUT);
    expect(r.ok).toBe(true);
    expect(chamadas).toEqual([["at-1", "func-1"]]);
  });

  it("exige login e não toca o repositório sem ele", async () => {
    const { caso, chamadas } = montar({ ator: null });
    const r = await caso.execute(INPUT);
    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
    expect(chamadas).toEqual([]);
  });

  it("quem perde a corrida recebe 'já assumido'", async () => {
    const { caso } = montar({ assuncao: { status: "ja_assumido" } });
    const r = await caso.execute(INPUT);
    expect(!r.ok && r.error.code).toBe("CONFLICT");
    expect(!r.ok && r.error.message).toMatch(/já assumido/i);
  });

  it("usuário desativado ou de outro Setor não assume", async () => {
    const { caso } = montar({ assuncao: { status: "inelegivel" } });
    const r = await caso.execute(INPUT);
    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
  });

  it("Atendimento que não existe mais é não encontrado", async () => {
    const { caso } = montar({ assuncao: { status: "inexistente" } });
    const r = await caso.execute(INPUT);
    expect(!r.ok && r.error.code).toBe("NOT_FOUND");
  });

  it("repassa a falha do repositório", async () => {
    const { caso } = montar({ falha: true });
    const r = await caso.execute(INPUT);
    expect(r.ok).toBe(false);
  });
});
