import type { AlertaSetor } from "@/modules/atendimento/application/ports/out/alerta-setor.provider";
import { ok } from "@/shared/kernel/result";

import { comOcorrencia, executarRodada, noSetor } from "./alertas-da-rodada";

function alertasEmMemoria() {
  const gravados: AlertaSetor[] = [];
  return {
    gravados,
    porta: {
      alertar: async (a: AlertaSetor) => {
        gravados.push(a);
        return ok(undefined);
      },
      resolverNaoRenovados: async () => ok(undefined),
    },
  };
}

describe("executarRodada: alertas por Setor", () => {
  it("ocorrência sem setor vai ao Simples Nacional", async () => {
    const { gravados, porta } = alertasEmMemoria();

    await executarRodada(porta, new Date(), [{ clienteId: "c1" }], async () => [
      comOcorrencia("falha_envio", "x"),
    ]);

    expect(gravados).toEqual([
      { setor: "simples_nacional", tipo: "falha_envio", clienteId: "c1", mensagem: "x" },
    ]);
  });

  it("o mesmo tipo em setores diferentes gera um alerta por setor; no mesmo setor, as mensagens se juntam", async () => {
    const { gravados, porta } = alertasEmMemoria();

    await executarRodada(porta, new Date(), [{ clienteId: "c1" }], async () => [
      noSetor(comOcorrencia("parcelamento_sem_guia", "a"), "simples_nacional"),
      noSetor(comOcorrencia("parcelamento_sem_guia", "b"), "rh"),
      noSetor(comOcorrencia("parcelamento_sem_guia", "c"), "rh"),
    ]);

    expect(gravados).toEqual([
      { setor: "simples_nacional", tipo: "parcelamento_sem_guia", clienteId: "c1", mensagem: "a" },
      { setor: "rh", tipo: "parcelamento_sem_guia", clienteId: "c1", mensagem: "b | c" },
    ]);
  });

  it("noSetor mantém o setor que a ocorrência já tem", () => {
    const andamento = noSetor(
      { enviado: false, ocorrencias: [{ tipo: "falha_envio", mensagem: "x", setor: "rh" }] },
      "simples_nacional",
    );

    expect(andamento.ocorrencias[0].setor).toBe("rh");
  });
});
