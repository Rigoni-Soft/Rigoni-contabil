import type {
  AtendimentoEmAndamento,
  AtendimentoRepositoryPort,
} from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { AtorSessaoDto } from "@/modules/atendimento/application/ports/out/sessao.provider";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok } from "@/shared/kernel/result";

import { EncerrarAtendimento } from "./encerrar-atendimento.use-case";

const ATENDIMENTO: AtendimentoEmAndamento = {
  id: "at-1",
  clienteId: "cli-1",
  setor: "contabil",
  funcionarioId: "func-1",
  telefone: "5561988887777",
  chave: "61988887777",
};
const DONO: AtorSessaoDto = { id: "func-1", papel: "funcionario", setor: "contabil" };

function montar(
  opcoes: {
    ator?: AtorSessaoDto | null;
    atendimento?: AtendimentoEmAndamento | null;
    encerrado?: boolean;
    proximo?: string | null;
    promocaoFalha?: boolean;
  } = {},
) {
  const encerrados: unknown[][] = [];
  const promovidos: unknown[] = [];
  const repo = {
    buscarEmAndamento: async () =>
      ok(opcoes.atendimento === undefined ? ATENDIMENTO : opcoes.atendimento),
    encerrar: async (...args: unknown[]) => {
      encerrados.push(args);
      return ok(opcoes.encerrado ?? true);
    },
  } as unknown as AtendimentoRepositoryPort;
  const caso = new EncerrarAtendimento(
    { usuarioAtual: async () => (opcoes.ator === undefined ? DONO : opcoes.ator) },
    repo,
    {
      execute: async (p) => {
        promovidos.push(p);
        if (opcoes.promocaoFalha) return err(new ServicoExternoError("banco"));
        return ok(opcoes.proximo ? { atendimentoId: opcoes.proximo } : null);
      },
    },
  );
  return { caso, encerrados, promovidos };
}

const INPUT = { atendimentoId: "at-1" };

describe("EncerrarAtendimento", () => {
  it("encerra e o Funcionário liberado assume o próximo da Fila do Setor", async () => {
    const { caso, encerrados, promovidos } = montar({ proximo: "at-9" });
    const r = await caso.execute(INPUT);
    expect(r).toEqual({ ok: true, value: { proximoDaFila: "at-9" } });
    expect(encerrados).toEqual([["at-1", "func-1", { id: "func-1", setor: "contabil" }]]);
    expect(promovidos).toEqual([{ funcionarioId: "func-1", setor: "contabil" }]);
  });

  it("Fila vazia: encerra e não há próximo", async () => {
    const { caso } = montar();
    expect(await caso.execute(INPUT)).toEqual({ ok: true, value: { proximoDaFila: null } });
  });

  it("Líder do Setor e Admin encerram; outro Funcionário e outro Setor não", async () => {
    for (const ator of [
      { id: "lider", papel: "lider_setor" as const, setor: "contabil" as const },
      { id: "adm", papel: "admin" as const, setor: "administrativo" as const },
    ]) {
      expect((await montar({ ator }).caso.execute(INPUT)).ok).toBe(true);
    }
    for (const ator of [
      { id: "func-2", papel: "funcionario" as const, setor: "contabil" as const },
      { id: "lider-x", papel: "lider_setor" as const, setor: "tributario" as const },
    ]) {
      const negado = montar({ ator });
      const r = await negado.caso.execute(INPUT);
      expect(!r.ok && r.error.code).toBe("FORBIDDEN");
      expect(negado.encerrados).toEqual([]);
    }
  });

  it("Atendimento da Fila (sem dono) encerra sem liberar ninguém", async () => {
    const { caso, promovidos } = montar({
      ator: { id: "lider", papel: "lider_setor", setor: "contabil" },
      atendimento: { ...ATENDIMENTO, funcionarioId: null },
    });
    expect((await caso.execute(INPUT)).ok).toBe(true);
    expect(promovidos).toEqual([]);
  });

  it("sem sessão, inexistente ou já mudado: recusa sem promover", async () => {
    const semSessao = await montar({ ator: null }).caso.execute(INPUT);
    expect(!semSessao.ok && semSessao.error.code).toBe("FORBIDDEN");
    const inexistente = await montar({ atendimento: null }).caso.execute(INPUT);
    expect(!inexistente.ok && inexistente.error.code).toBe("NOT_FOUND");
    const mudou = montar({ encerrado: false });
    const r = await mudou.caso.execute(INPUT);
    expect(!r.ok && r.error.code).toBe("NOT_FOUND");
    expect(mudou.promovidos).toEqual([]);
  });

  it("falha ao promover o próximo da Fila devolve o erro (já encerrado)", async () => {
    const { caso, encerrados } = montar({ promocaoFalha: true });
    expect((await caso.execute(INPUT)).ok).toBe(false);
    expect(encerrados).toHaveLength(1);
  });
});
