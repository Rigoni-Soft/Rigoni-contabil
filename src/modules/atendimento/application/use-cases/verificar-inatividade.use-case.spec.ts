import type {
  AtendimentoParaInatividade,
  AtendimentoRepositoryPort,
  ResultadoEncerramento,
} from "@/modules/atendimento/application/ports/out/atendimento.repository";
import { URA_ATOR_ID } from "@/modules/atendimento/domain/services/inatividade.service";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok } from "@/shared/kernel/result";

import { VerificarInatividade } from "./verificar-inatividade.use-case";

const sp = (iso: string) => new Date(`${iso}-03:00`);
const T0 = sp("2026-10-07T10:00:00");
const AVISO_EM = sp("2026-10-07T12:00:00");

function atendimento(extra: Partial<AtendimentoParaInatividade> = {}): AtendimentoParaInatividade {
  return {
    id: "a1",
    setor: "societario",
    funcionarioId: "f1",
    telefone: "5561988887777",
    chave: "61988887777",
    ultimaDoContato: T0,
    ultimaDoFuncionario: sp("2026-10-07T09:00:00"),
    aviso: null,
    ...extra,
  };
}

function montar(
  atendimentos: AtendimentoParaInatividade[],
  agora: Date,
  opcoes: {
    jaMarcado?: boolean;
    envioFalha?: boolean;
    encerramento?: ResultadoEncerramento;
    feriadosFalha?: boolean;
  } = {},
) {
  const marcados: string[] = [];
  const limpos: string[] = [];
  const encerrados: unknown[] = [];
  const enviados: { telefone: string; texto: string }[] = [];
  const repo = {
    paraInatividade: async () => ok(atendimentos),
    marcarAvisoInatividade: async (id: string, de: string) => {
      if (opcoes.jaMarcado) return ok(false);
      marcados.push(`${id}:${de}`);
      return ok(true);
    },
    limparAvisoInatividade: async (id: string) => {
      limpos.push(id);
      return ok(undefined);
    },
    encerrarPorInatividade: async (...args: unknown[]) => {
      encerrados.push(args);
      return ok(opcoes.encerramento ?? { status: "encerrado" as const, proximo: null });
    },
  } as unknown as AtendimentoRepositoryPort;
  const caso = new VerificarInatividade(
    repo,
    {
      execute: async (i) => {
        if (opcoes.envioFalha) return err(new ServicoExternoError("meta"));
        enviados.push({ telefone: i.telefone, texto: i.texto });
        return ok(undefined);
      },
    },
    { agora: () => agora },
    {
      listarDatas: async () =>
        opcoes.feriadosFalha ? err(new ServicoExternoError("banco")) : ok([]),
    },
  );
  return { caso, marcados, limpos, encerrados, enviados };
}

describe("VerificarInatividade", () => {
  it("sem resposta do Funcionário em 2h: marca o aviso a ele e não escreve ao cliente", async () => {
    const { caso, marcados, enviados } = montar([atendimento()], sp("2026-10-07T12:00:00"));
    const r = await caso.execute();
    expect(r).toEqual({
      ok: true,
      value: { avisados: 1, cancelados: 0, encerrados: 0, falhas: 0 },
    });
    expect(marcados).toEqual(["a1:funcionario"]);
    expect(enviados).toEqual([]);
  });

  it("sem resposta do cliente em 2h: marca e avisa o cliente", async () => {
    const a = atendimento({ ultimaDoContato: sp("2026-10-07T09:00:00"), ultimaDoFuncionario: T0 });
    const { caso, marcados, enviados } = montar([a], sp("2026-10-07T12:00:00"));
    await caso.execute();
    expect(marcados).toEqual(["a1:contato"]);
    expect(enviados).toHaveLength(1);
    expect(enviados[0].telefone).toBe("5561988887777");
  });

  it("1h59 não faz nada", async () => {
    const { caso, marcados } = montar([atendimento()], sp("2026-10-07T11:59:00"));
    expect(await caso.execute()).toEqual({
      ok: true,
      value: { avisados: 0, cancelados: 0, encerrados: 0, falhas: 0 },
    });
    expect(marcados).toEqual([]);
  });

  it("job repetido não reenvia o aviso ao cliente", async () => {
    const a = atendimento({ ultimaDoContato: sp("2026-10-07T09:00:00"), ultimaDoFuncionario: T0 });
    const { caso, enviados } = montar([a], sp("2026-10-07T12:00:00"), { jaMarcado: true });
    await caso.execute();
    expect(enviados).toEqual([]);
  });

  it("aviso ao cliente que falha desfaz a marca para a próxima rodada tentar", async () => {
    const a = atendimento({ ultimaDoContato: sp("2026-10-07T09:00:00"), ultimaDoFuncionario: T0 });
    const { caso, limpos } = montar([a], sp("2026-10-07T12:00:00"), { envioFalha: true });
    const r = await caso.execute();
    expect(r.ok && r.value).toMatchObject({ avisados: 0, falhas: 1 });
    expect(limpos).toEqual(["a1"]);
  });

  it("ação de quem estava inativo dentro dos 10 minutos cancela o encerramento", async () => {
    const a = atendimento({
      aviso: { em: AVISO_EM, de: "funcionario" },
      ultimaDoFuncionario: sp("2026-10-07T12:05:00"),
    });
    const { caso, limpos, encerrados } = montar([a], sp("2026-10-07T12:10:00"));
    const r = await caso.execute();
    expect(r.ok && r.value.cancelados).toBe(1);
    expect(limpos).toEqual(["a1"]);
    expect(encerrados).toEqual([]);
  });

  it("9m59 depois do aviso não encerra; 10m00 encerra como URA e avisa o cliente e o próximo da Fila", async () => {
    const a = atendimento({ aviso: { em: AVISO_EM, de: "funcionario" } });
    const antes = montar([a], sp("2026-10-07T12:09:59"));
    await antes.caso.execute();
    expect(antes.encerrados).toEqual([]);

    const proximo = {
      id: "a2",
      telefone: "5561911112222",
      chave: "61911112222",
      funcionarioNome: "Ana",
    };
    const { caso, encerrados, enviados } = montar([a], sp("2026-10-07T12:10:00"), {
      encerramento: { status: "encerrado", proximo },
    });
    const r = await caso.execute();
    expect(r.ok && r.value.encerrados).toBe(1);
    expect(encerrados).toEqual([["a1", "f1", { id: URA_ATOR_ID, setor: "societario" }]]);
    expect(enviados.map((e) => e.telefone)).toEqual(["5561988887777", "5561911112222"]);
  });

  it("encerramento que já aconteceu por outro caminho não conta nem avisa", async () => {
    const a = atendimento({ aviso: { em: AVISO_EM, de: "contato" }, ultimaDoContato: T0 });
    const { caso, enviados } = montar([a], sp("2026-10-07T12:10:00"), {
      encerramento: { status: "inexistente" },
    });
    const r = await caso.execute();
    expect(r.ok && r.value.encerrados).toBe(1);
    expect(enviados).toEqual([]);
  });

  it("Atendimento fora do expediente não é tocado", async () => {
    const { caso, marcados, encerrados } = montar(
      [atendimento(), atendimento({ id: "a2", aviso: { em: AVISO_EM, de: "funcionario" } })],
      sp("2026-10-07T18:30:00"),
    );
    await caso.execute();
    expect([marcados, encerrados]).toEqual([[], []]);
  });

  it("falha ao ler os feriados interrompe a rodada", async () => {
    const { caso, marcados } = montar([atendimento()], sp("2026-10-07T12:00:00"), {
      feriadosFalha: true,
    });
    expect((await caso.execute()).ok).toBe(false);
    expect(marcados).toEqual([]);
  });
});
