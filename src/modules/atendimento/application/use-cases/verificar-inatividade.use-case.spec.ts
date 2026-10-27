import type {
  AtendimentoParaInatividade,
  AtendimentoRepositoryPort,
  EncerramentoPendente,
  ResultadoEncerramentoPorInatividade,
} from "@/modules/atendimento/application/ports/out/atendimento.repository";
import {
  AVISO_ENCERRAMENTO_AO_CLIENTE,
  URA_ATOR_ID,
} from "@/modules/atendimento/domain/services/inatividade.service";
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
    avisoEntregue: false,
    ...extra,
  };
}

// Aviso ao cliente já marcado e entregue (ou ao Funcionário, que nasce entregue).
const avisado = (de: "contato" | "funcionario", extra: Partial<AtendimentoParaInatividade> = {}) =>
  atendimento({ aviso: { em: AVISO_EM, de }, avisoEntregue: true, ...extra });

function montar(
  atendimentos: AtendimentoParaInatividade[],
  agora: Date,
  opcoes: {
    reservaNegada?: boolean;
    envioFalha?: boolean;
    envioFalhaDe?: string;
    encerramento?: ResultadoEncerramentoPorInatividade;
    pendentes?: EncerramentoPendente[];
    feriadosFalha?: boolean;
  } = {},
) {
  // Ordem real das chamadas: a reserva tem de vir antes do envio.
  const chamadas: string[] = [];
  const marcados: unknown[] = [];
  const limpos: string[] = [];
  const entregues: string[] = [];
  const encerrados: unknown[] = [];
  const confirmadosEncerramento: string[] = [];
  const liberados: string[] = [];
  const enviados: { telefone: string; texto: string; registrar?: boolean }[] = [];
  const repo = {
    paraInatividade: async () => ok(atendimentos),
    marcarAvisoInatividade: async (id: string, de: string, vistoAte: Date) => {
      chamadas.push("marcar");
      if (opcoes.reservaNegada) return ok(false);
      marcados.push([id, de, vistoAte]);
      return ok(true);
    },
    confirmarAvisoEntregue: async (id: string) => {
      chamadas.push("confirmar-aviso");
      entregues.push(id);
      return ok(true);
    },
    limparAvisoInatividade: async (id: string) => {
      chamadas.push("limpar");
      limpos.push(id);
      return ok(undefined);
    },
    encerrarPorInatividade: async (...args: unknown[]) => {
      encerrados.push(args);
      return ok(
        opcoes.encerramento ?? {
          status: "encerrado" as const,
          reivindicacao: "tok-1",
        },
      );
    },
    reivindicarEncerramentosPendentes: async () => ok(opcoes.pendentes ?? []),
    liberarEncerramentoPendente: async (id: string, reivindicacao: string) => {
      liberados.push(`${id}:${reivindicacao}`);
      return ok(undefined);
    },
    confirmarEncerramentoEntregue: async (id: string, reivindicacao: string) => {
      confirmadosEncerramento.push(`${id}:${reivindicacao}`);
      return ok(true);
    },
  } as unknown as AtendimentoRepositoryPort;
  const caso = new VerificarInatividade(
    repo,
    {
      execute: async (i) => {
        chamadas.push("enviar");
        if (opcoes.envioFalha || opcoes.envioFalhaDe === i.telefone) {
          return err(new ServicoExternoError("meta"));
        }
        enviados.push({ telefone: i.telefone, texto: i.texto, registrar: i.registrar });
        return ok(undefined);
      },
    },
    { agora: () => agora },
    {
      listarDatas: async () =>
        opcoes.feriadosFalha ? err(new ServicoExternoError("banco")) : ok([]),
    },
  );
  return {
    caso,
    chamadas,
    marcados,
    limpos,
    entregues,
    encerrados,
    confirmadosEncerramento,
    liberados,
    enviados,
  };
}

const ZERO = { avisados: 0, cancelados: 0, encerrados: 0, reentregues: 0, falhas: 0 };

describe("VerificarInatividade", () => {
  it("sem resposta do Funcionário em 2h: marca o aviso a ele e não escreve ao cliente", async () => {
    const { caso, marcados, enviados } = montar([atendimento()], sp("2026-10-07T12:00:00"));
    const r = await caso.execute();
    expect(r).toEqual({ ok: true, value: { ...ZERO, avisados: 1 } });
    // A reserva leva a última Mensagem lida (a do contato, 10h): só vale se nada entrou depois.
    expect(marcados).toEqual([["a1", "funcionario", T0]]);
    expect(enviados).toEqual([]);
  });

  it("sem resposta do cliente em 2h: reserva, avisa e só então confirma a entrega", async () => {
    const a = atendimento({ ultimaDoContato: sp("2026-10-07T09:00:00"), ultimaDoFuncionario: T0 });
    const { caso, chamadas, marcados, enviados, entregues } = montar(
      [a],
      sp("2026-10-07T12:00:00"),
    );

    await caso.execute();

    expect(marcados).toEqual([["a1", "contato", T0]]);
    expect(enviados).toHaveLength(1);
    expect(enviados[0].telefone).toBe("5561988887777");
    expect(chamadas).toEqual(["marcar", "enviar", "confirmar-aviso"]);
    expect(entregues).toEqual(["a1"]);
  });

  it("reserva negada (outra execução ou Mensagem nova) não envia nem conta", async () => {
    const a = atendimento({ ultimaDoContato: sp("2026-10-07T09:00:00"), ultimaDoFuncionario: T0 });
    const { caso, enviados } = montar([a], sp("2026-10-07T12:00:00"), { reservaNegada: true });

    const r = await caso.execute();

    expect(r).toEqual({ ok: true, value: ZERO });
    expect(enviados).toEqual([]);
  });

  it("1h59 não faz nada", async () => {
    const { caso, marcados } = montar([atendimento()], sp("2026-10-07T11:59:00"));
    expect(await caso.execute()).toEqual({ ok: true, value: ZERO });
    expect(marcados).toEqual([]);
  });

  it("job repetido não reenvia o aviso ao cliente já avisado", async () => {
    const a = avisado("contato", {
      ultimaDoContato: sp("2026-10-07T09:00:00"),
      ultimaDoFuncionario: T0,
    });
    const { caso, enviados } = montar([a], sp("2026-10-07T12:05:00"));
    await caso.execute();
    expect(enviados).toEqual([]);
  });

  it("aviso ao cliente que falha desfaz a reserva, para a próxima rodada reavaliar", async () => {
    const a = atendimento({ ultimaDoContato: sp("2026-10-07T09:00:00"), ultimaDoFuncionario: T0 });
    const { caso, limpos, entregues } = montar([a], sp("2026-10-07T12:00:00"), {
      envioFalha: true,
    });
    const r = await caso.execute();
    expect(r.ok && r.value).toMatchObject({ avisados: 0, falhas: 1 });
    expect(limpos).toEqual(["a1"]);
    expect(entregues).toEqual([]);
  });

  it("ação de quem estava inativo dentro dos 10 minutos cancela o encerramento", async () => {
    const a = avisado("funcionario", { ultimaDoFuncionario: sp("2026-10-07T12:05:00") });
    const { caso, limpos, encerrados } = montar([a], sp("2026-10-07T12:10:00"));
    const r = await caso.execute();
    expect(r.ok && r.value.cancelados).toBe(1);
    expect(limpos).toEqual(["a1"]);
    expect(encerrados).toEqual([]);
  });

  it("9m59 depois do aviso não encerra; 10m00 encerra como URA com a mensagem final e avisa o cliente", async () => {
    const a = avisado("funcionario");
    const antes = montar([a], sp("2026-10-07T12:09:59"));
    await antes.caso.execute();
    expect(antes.encerrados).toEqual([]);

    const { caso, encerrados, enviados, confirmadosEncerramento } = montar(
      [a],
      sp("2026-10-07T12:10:00"),
    );
    const r = await caso.execute();
    expect(r.ok && r.value.encerrados).toBe(1);
    expect(encerrados).toEqual([
      ["a1", "f1", { id: URA_ATOR_ID, setor: "societario" }, AVISO_ENCERRAMENTO_AO_CLIENTE],
    ]);
    // A mensagem final já está no histórico (gravada na transação): o envio não a registra de novo.
    expect(enviados.map((e) => [e.telefone, e.registrar])).toEqual([["5561988887777", false]]);
    // Confirma com o token que o próprio encerramento reivindicou.
    expect(confirmadosEncerramento).toEqual(["a1:tok-1"]);
  });

  it("aviso ao cliente reservado e nunca entregue não encerra: limpa e recomeça o ciclo", async () => {
    const a = atendimento({ aviso: { em: AVISO_EM, de: "contato" }, avisoEntregue: false });
    const { caso, limpos, encerrados } = montar([a], sp("2026-10-07T12:10:00"));

    const r = await caso.execute();

    expect(encerrados).toEqual([]);
    expect(limpos).toEqual(["a1"]);
    expect(r.ok && r.value.encerrados).toBe(0);
  });

  it("encerramento que já aconteceu por outro caminho (ou Mensagem entrou) não conta nem avisa", async () => {
    const a = avisado("contato", { ultimaDoContato: T0 });
    const { caso, enviados } = montar([a], sp("2026-10-07T12:10:00"), {
      encerramento: { status: "inexistente" },
    });
    const r = await caso.execute();
    expect(r.ok && r.value.encerrados).toBe(0);
    expect(enviados).toEqual([]);
  });

  it("mensagem final que falha ao sair deixa o encerramento pendente e conta a falha", async () => {
    const a = avisado("funcionario");
    const { caso, confirmadosEncerramento } = montar([a], sp("2026-10-07T12:10:00"), {
      envioFalhaDe: "5561988887777",
    });

    const r = await caso.execute();

    expect(r.ok && r.value.falhas).toBe(1);
    expect(confirmadosEncerramento).toEqual([]);
  });

  it("reenvia a mensagem final de encerramento pendente, mesmo com o Atendimento encerrado", async () => {
    const pendente = {
      atendimentoId: "a9",
      telefone: "5561900000000",
      texto: "Encerrado.",
      reivindicacao: "tok-9",
    };
    const { caso, enviados, confirmadosEncerramento } = montar([], sp("2026-10-07T12:00:00"), {
      pendentes: [pendente],
    });

    const r = await caso.execute();

    expect(r).toEqual({ ok: true, value: { ...ZERO, reentregues: 1 } });
    expect(enviados).toEqual([
      { telefone: "5561900000000", texto: "Encerrado.", registrar: false },
    ]);
    expect(confirmadosEncerramento).toEqual(["a9:tok-9"]);
  });

  it("falha ao reenviar o pendente conta falha e mantém pendente", async () => {
    const pendente = {
      atendimentoId: "a9",
      telefone: "5561900000000",
      texto: "Encerrado.",
      reivindicacao: "tok-9",
    };
    const { caso, confirmadosEncerramento, liberados } = montar([], sp("2026-10-07T12:00:00"), {
      pendentes: [pendente],
      envioFalha: true,
    });

    const r = await caso.execute();

    expect(r.ok && r.value).toMatchObject({ reentregues: 0, falhas: 1 });
    expect(confirmadosEncerramento).toEqual([]);
    // A reivindicação volta para a próxima rodada, sem esperar o lease, com o token de quem a detém.
    expect(liberados).toEqual(["a9:tok-9"]);
  });

  it("Atendimento fora do expediente não é tocado", async () => {
    const { caso, marcados, encerrados } = montar(
      [atendimento(), avisado("funcionario", { id: "a2" })],
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
