import type {
  AtendimentoAssumido,
  AtendimentoEmAndamento,
  AtendimentoRepositoryPort,
  ResultadoEncerramento,
} from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { AtorSessaoDto } from "@/modules/atendimento/application/ports/out/sessao.provider";
import { AVISO_ENCERRAMENTO_AO_CLIENTE } from "@/modules/atendimento/domain/services/aviso-fila.service";
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
  emAvisoDeInatividade: false,
};
const DONO: AtorSessaoDto = { id: "func-1", papel: "funcionario", setor: "contabil" };
const PROXIMO: AtendimentoAssumido = {
  id: "at-9",
  telefone: "5561977776666",
  chave: "61977776666",
  funcionarioNome: "Ana",
};

function montar(
  opcoes: {
    ator?: AtorSessaoDto | null;
    atendimento?: AtendimentoEmAndamento | null;
    encerramento?: ResultadoEncerramento;
    avisoFalha?: boolean;
  } = {},
) {
  const encerrados: unknown[][] = [];
  const avisos: { telefone: string; chave: string; texto: string }[] = [];
  const repo = {
    buscarEmAndamento: async () =>
      ok(opcoes.atendimento === undefined ? ATENDIMENTO : opcoes.atendimento),
    encerrar: async (...args: unknown[]) => {
      encerrados.push(args);
      return ok(opcoes.encerramento ?? { status: "encerrado" as const, proximo: null });
    },
  } as unknown as AtendimentoRepositoryPort;
  const caso = new EncerrarAtendimento(
    { usuarioAtual: async () => (opcoes.ator === undefined ? DONO : opcoes.ator) },
    repo,
    {
      execute: async (aviso) => {
        avisos.push(aviso);
        return opcoes.avisoFalha ? err(new ServicoExternoError("meta")) : ok(undefined);
      },
    },
  );
  return { caso, encerrados, avisos };
}

const INPUT = { atendimentoId: "at-1" };

describe("EncerrarAtendimento", () => {
  it("encerra, e o cliente da Fila que o Funcionário liberado assumiu é avisado", async () => {
    const { caso, encerrados, avisos } = montar({
      encerramento: { status: "encerrado", proximo: PROXIMO },
    });
    expect(await caso.execute(INPUT)).toEqual({ ok: true, value: { proximoDaFila: "at-9" } });
    expect(encerrados).toEqual([["at-1", "func-1", { id: "func-1", setor: "contabil" }]]);
    expect(avisos).toEqual([
      { telefone: "5561988887777", chave: "61988887777", texto: AVISO_ENCERRAMENTO_AO_CLIENTE },
      {
        telefone: "5561977776666",
        chave: "61977776666",
        texto: "Chegou a sua vez! Ana vai te atender agora.",
      },
    ]);
  });

  it("Fila vazia: encerra e avisa só o cliente de que o Atendimento foi encerrado", async () => {
    const { caso, avisos } = montar();
    expect(await caso.execute(INPUT)).toEqual({ ok: true, value: { proximoDaFila: null } });
    expect(avisos).toEqual([
      { telefone: "5561988887777", chave: "61988887777", texto: AVISO_ENCERRAMENTO_AO_CLIENTE },
    ]);
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

  it("Atendimento da Fila (sem dono) encerra pelo Líder, sem dono a liberar", async () => {
    const { caso, encerrados } = montar({
      ator: { id: "lider", papel: "lider_setor", setor: "contabil" },
      atendimento: { ...ATENDIMENTO, funcionarioId: null },
    });
    expect((await caso.execute(INPUT)).ok).toBe(true);
    expect(encerrados[0][1]).toBeNull();
  });

  it("sem sessão, inexistente ou já mudado: recusa", async () => {
    const semSessao = await montar({ ator: null }).caso.execute(INPUT);
    expect(!semSessao.ok && semSessao.error.code).toBe("FORBIDDEN");
    const inexistente = await montar({ atendimento: null }).caso.execute(INPUT);
    expect(!inexistente.ok && inexistente.error.code).toBe("NOT_FOUND");
    const mudou = await montar({ encerramento: { status: "inexistente" } }).caso.execute(INPUT);
    expect(!mudou.ok && mudou.error.code).toBe("NOT_FOUND");
  });

  it("falha ao avisar o cliente do encerramento: erro de estado, mas ainda avisa o da Fila", async () => {
    const { caso, avisos } = montar({
      encerramento: { status: "encerrado", proximo: PROXIMO },
      avisoFalha: true,
    });
    const r = await caso.execute(INPUT);
    expect(!r.ok && r.error.code).toBe("INCONSISTENT_STATE");
    expect(avisos).toHaveLength(2);
  });

  it("falha ao avisar o cliente da Fila: erro de estado, já encerrado e assumido", async () => {
    const { caso, encerrados } = montar({
      encerramento: { status: "encerrado", proximo: PROXIMO },
      avisoFalha: true,
    });
    const r = await caso.execute(INPUT);
    expect(!r.ok && r.error.code).toBe("INCONSISTENT_STATE");
    expect(encerrados).toHaveLength(1);
  });
});
