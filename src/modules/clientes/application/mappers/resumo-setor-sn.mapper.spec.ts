import type { ResumoOperacionalRow } from "@/modules/clientes/application/ports/out/cliente-query.provider";

import { classificarResumoSetorSn } from "./resumo-setor-sn.mapper";

function linha(sobrescritas: Partial<ResumoOperacionalRow> = {}): ResumoOperacionalRow {
  return {
    clienteId: "cliente-1",
    empresa: "Empresa Teste Ltda",
    cnpj: "11444777000161",
    documentoObrigatorio: null,
    dasStatus: null,
    temParcelamento: false,
    parcelamentoStatus: null,
    atividadeMes: { industria: false, comercio: false, servico: false },
    responsavelId: null,
    responsavelNome: null,
    ...sobrescritas,
  };
}

function quantidade(cards: ReturnType<typeof classificarResumoSetorSn>, id: string) {
  return cards.find((c) => c.id === id)?.quantidade;
}

describe("classificarResumoSetorSn", () => {
  it("devolve os 9 cards da spec #24, mesmo com lista vazia", () => {
    const cards = classificarResumoSetorSn([]);

    expect(cards).toHaveLength(9);
    expect(cards.every((c) => c.quantidade === 0 && c.clientes.length === 0)).toBe(true);
    expect(cards.map((c) => c.id)).toEqual([
      "das_emitidas",
      "sem_documento",
      "das_pendente",
      "sem_movimento",
      "esperando_envio_das",
      "com_parcelamento",
      "parcelamento_pendente",
      "parcelamento_interno",
      "parcelamento_enviado",
    ]);
  });

  it("classifica DAS emitidas (enviado) e dá a cor em_dia", () => {
    const cards = classificarResumoSetorSn([linha({ dasStatus: "enviado" })]);
    const card = cards.find((c) => c.id === "das_emitidas")!;

    expect(card.quantidade).toBe(1);
    expect(card.cor).toBe("em_dia");
    expect(card.clientes).toEqual([
      { clienteId: "cliente-1", empresa: "Empresa Teste Ltda", cnpj: "11444777000161" },
    ]);
  });

  it("sem documento (atencao) conta documentoObrigatorio negativo, independente do DAS", () => {
    const cards = classificarResumoSetorSn([
      linha({ documentoObrigatorio: "negativo", dasStatus: "pendente" }),
    ]);

    expect(quantidade(cards, "sem_documento")).toBe(1);
    // Sem documento recebido, a DAS pendente não conta como "DAS pendente"
    // (ponto já coberto pelo card "Sem documento" — job #42 da spec #24).
    expect(quantidade(cards, "das_pendente")).toBe(0);
  });

  it("DAS pendente (urgente) só conta quando o documento já foi recebido", () => {
    const cards = classificarResumoSetorSn([
      linha({ dasStatus: "pendente", documentoObrigatorio: "positivo" }),
    ]);

    expect(quantidade(cards, "das_pendente")).toBe(1);
    const card = cards.find((c) => c.id === "das_pendente")!;
    expect(card.cor).toBe("urgente");
  });

  it("sem movimento e esperando envio mapeiam direto do das_status", () => {
    const cards = classificarResumoSetorSn([
      linha({ dasStatus: "sem_movimento" }),
      linha({ dasStatus: "pronto" }),
    ]);

    expect(quantidade(cards, "sem_movimento")).toBe(1);
    expect(quantidade(cards, "esperando_envio_das")).toBe(1);
  });

  it("parcelamento: com_parcelamento conta todo mundo com temParcelamento, os outros 3 só por status", () => {
    const cards = classificarResumoSetorSn([
      linha({ temParcelamento: true, parcelamentoStatus: "pendente" }),
      linha({ temParcelamento: true, parcelamentoStatus: "interno" }),
      linha({ temParcelamento: true, parcelamentoStatus: "enviado" }),
      linha({ temParcelamento: false }),
    ]);

    expect(quantidade(cards, "com_parcelamento")).toBe(3);
    expect(quantidade(cards, "parcelamento_pendente")).toBe(1);
    expect(quantidade(cards, "parcelamento_interno")).toBe(1);
    expect(quantidade(cards, "parcelamento_enviado")).toBe(1);
    expect(cards.find((c) => c.id === "parcelamento_pendente")!.cor).toBe("urgente");
    expect(cards.find((c) => c.id === "parcelamento_enviado")!.cor).toBe("em_dia");
  });

  it("parcelamentoStatus sem temParcelamento não conta nos buckets de parcelamento", () => {
    const cards = classificarResumoSetorSn([
      linha({ temParcelamento: false, parcelamentoStatus: "pendente" }),
    ]);

    expect(quantidade(cards, "parcelamento_pendente")).toBe(0);
    expect(quantidade(cards, "com_parcelamento")).toBe(0);
  });
});
