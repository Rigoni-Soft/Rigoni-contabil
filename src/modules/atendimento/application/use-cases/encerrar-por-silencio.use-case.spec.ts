import type { AtendimentoRepositoryPort } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import { URA_ATOR_ID } from "@/modules/atendimento/domain/services/encerramento-automatico.service";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok } from "@/shared/kernel/result";

import { EncerrarPorSilencio } from "./encerrar-por-silencio.use-case";

// Repositório que guarda a última mensagem do cliente de cada Atendimento e encerra, como o banco,
// os que ela deixou para trás do corte.
function montar(agora: Date, ultimasDoCliente: Record<string, Date>) {
  const encerrados: string[] = [];
  const chamadas: { corte: Date; ator: string }[] = [];
  const repositorio = {
    encerrarSemRespostaDoCliente: async (corte: Date, ator: string) => {
      chamadas.push({ corte, ator });
      for (const [id, ultima] of Object.entries(ultimasDoCliente)) {
        if (ultima <= corte) encerrados.push(id);
      }
      return ok(encerrados.length);
    },
  } as unknown as AtendimentoRepositoryPort;
  const caso = new EncerrarPorSilencio(repositorio, { agora: () => agora });
  return { caso, encerrados, chamadas };
}

describe("EncerrarPorSilencio", () => {
  const agora = new Date("2026-10-08T12:00:00.000Z");
  const minutosAtras = (min: number) => new Date(agora.getTime() - min * 60_000);

  it("encerra quem passou de 23h50 sem o cliente escrever e deixa os outros", async () => {
    const { caso, encerrados } = montar(agora, {
      vencido: minutosAtras(23 * 60 + 51),
      noLimite: minutosAtras(23 * 60 + 50),
      recente: minutosAtras(23 * 60 + 49),
    });

    const resultado = await caso.execute();

    expect(encerrados).toEqual(["vencido", "noLimite"]);
    expect(resultado).toEqual(ok({ encerrados: 2 }));
  });

  it("roda com o relógio fora do expediente (madrugada de domingo) sem esperar a abertura", async () => {
    const domingo = new Date("2026-10-11T05:00:00.000Z");
    const { caso, chamadas } = montar(domingo, {});

    await caso.execute();

    expect(chamadas).toEqual([{ corte: new Date("2026-10-10T05:10:00.000Z"), ator: URA_ATOR_ID }]);
  });

  it("o ator da auditoria é o sistema (URA)", async () => {
    const { caso, chamadas } = montar(agora, {});

    await caso.execute();

    expect(chamadas[0]?.ator).toBe(URA_ATOR_ID);
  });

  it("repassa a falha do repositório", async () => {
    const falha = new ServicoExternoError("banco fora");
    const repositorio = {
      encerrarSemRespostaDoCliente: async () => err(falha),
    } as unknown as AtendimentoRepositoryPort;

    const resultado = await new EncerrarPorSilencio(repositorio, { agora: () => agora }).execute();

    expect(resultado).toEqual(err(falha));
  });
});
