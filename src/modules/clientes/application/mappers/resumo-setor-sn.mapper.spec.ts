import type { ResumoOperacionalRow } from "@/modules/clientes/application/ports/out/cliente-query.provider";

import { classificarResumoSetorSn } from "./resumo-setor-sn.mapper";

function linha(sobrescritas: Partial<ResumoOperacionalRow> = {}): ResumoOperacionalRow {
  return {
    clienteId: "cliente-1",
    empresa: "Empresa Teste Ltda",
    cnpj: "11444777000161",
    documentoObrigatorio: null,
    dasStatus: null,
    parcelamentos: [],
    atividadeMes: { industria: false, comercio: false, servico: false },
    responsavelId: null,
    responsavelNome: null,
    ...sobrescritas,
  };
}

type Parcelamento = ResumoOperacionalRow["parcelamentos"][number];

function parcelamento(sobrescritas: Partial<Parcelamento> = {}): Parcelamento {
  return { codigo: "P1", interno: false, quitado: false, enviadoNoMes: false, ...sobrescritas };
}

function quantidade(cards: ReturnType<typeof classificarResumoSetorSn>, id: string) {
  return cards.find((c) => c.id === id)?.quantidade;
}

// 2026-10-28 e 2026-10-29, meio-dia em São Paulo: antes e depois da última rodada do job.
const DIA_28 = new Date("2026-10-28T15:00:00Z");
const DIA_29 = new Date("2026-10-29T15:00:00Z");

describe("classificarResumoSetorSn", () => {
  it("devolve os 11 cards (5 de DAS + 6 de parcelamento), mesmo com lista vazia", () => {
    const cards = classificarResumoSetorSn([]);

    expect(cards).toHaveLength(11);
    expect(cards.every((c) => c.quantidade === 0 && c.clientes.length === 0)).toBe(true);
    expect(cards.map((c) => c.id)).toEqual([
      "das_emitidas",
      "sem_documento",
      "das_pendente",
      "sem_movimento",
      "esperando_envio_das",
      "com_parcelamento",
      "parcelamento_em_aberto",
      "parcelamento_pendente",
      "parcelamento_pendente_atraso",
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
    // (já coberto pelo card "Sem documento").
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

  describe("grupo Parcelamento (conta Clientes, cards não exclusivos)", () => {
    it("com parcelamento conta quem tem algum cadastrado (inclusive quitado); em aberto só quem tem algum não quitado", () => {
      const cards = classificarResumoSetorSn([
        linha({ clienteId: "a", parcelamentos: [parcelamento()] }),
        linha({ clienteId: "b", parcelamentos: [parcelamento({ quitado: true })] }),
        linha({ clienteId: "c", parcelamentos: [] }),
      ]);

      expect(quantidade(cards, "com_parcelamento")).toBe(2);
      expect(quantidade(cards, "parcelamento_em_aberto")).toBe(1);
    });

    it("conta o Cliente uma vez por card, mesmo com vários parcelamentos", () => {
      const cards = classificarResumoSetorSn([
        linha({
          parcelamentos: [
            parcelamento({ codigo: "P1" }),
            parcelamento({ codigo: "P2" }),
            parcelamento({ codigo: "P3", interno: true }),
          ],
        }),
      ]);

      expect(quantidade(cards, "com_parcelamento")).toBe(1);
      expect(quantidade(cards, "parcelamento_em_aberto")).toBe(1);
      expect(quantidade(cards, "parcelamento_pendente")).toBe(1);
      expect(quantidade(cards, "parcelamento_interno")).toBe(1);
    });

    it("pendente: algum em aberto sem envio no mês; enviado: todos os em aberto enviados", () => {
      const cards = classificarResumoSetorSn([
        linha({
          clienteId: "pendente",
          parcelamentos: [parcelamento({ enviadoNoMes: true }), parcelamento({ codigo: "P2" })],
        }),
        linha({
          clienteId: "enviado",
          parcelamentos: [
            parcelamento({ enviadoNoMes: true }),
            parcelamento({ codigo: "P2", enviadoNoMes: true }),
          ],
        }),
        linha({
          // o quitado sem envio não segura o Cliente em "enviado"
          clienteId: "enviado-com-quitado",
          parcelamentos: [
            parcelamento({ enviadoNoMes: true }),
            parcelamento({ codigo: "P2", quitado: true }),
          ],
        }),
        linha({ clienteId: "so-quitado", parcelamentos: [parcelamento({ quitado: true })] }),
      ]);

      const ids = (id: string) => cards.find((c) => c.id === id)!.clientes.map((c) => c.clienteId);
      expect(ids("parcelamento_pendente")).toEqual(["pendente"]);
      expect(ids("parcelamento_enviado")).toEqual(["enviado", "enviado-com-quitado"]);
    });

    it("interno: algum interno em aberto (interno quitado não conta)", () => {
      const cards = classificarResumoSetorSn([
        linha({ clienteId: "a", parcelamentos: [parcelamento({ interno: true })] }),
        linha({ clienteId: "b", parcelamentos: [parcelamento({ interno: true, quitado: true })] }),
        linha({ clienteId: "c", parcelamentos: [parcelamento()] }),
      ]);

      expect(
        cards.find((c) => c.id === "parcelamento_interno")!.clientes.map((c) => c.clienteId),
      ).toEqual(["a"]);
    });

    it("pendente em atraso: pendente só a partir do dia 29 (depois da última rodada do job)", () => {
      const linhas = [linha({ parcelamentos: [parcelamento()] })];

      expect(
        quantidade(classificarResumoSetorSn(linhas, DIA_28), "parcelamento_pendente_atraso"),
      ).toBe(0);
      expect(
        quantidade(classificarResumoSetorSn(linhas, DIA_29), "parcelamento_pendente_atraso"),
      ).toBe(1);
      expect(quantidade(classificarResumoSetorSn(linhas, DIA_29), "parcelamento_pendente")).toBe(1);
    });

    it("pendente em atraso não conta quem já está enviado", () => {
      const cards = classificarResumoSetorSn(
        [linha({ parcelamentos: [parcelamento({ enviadoNoMes: true })] })],
        DIA_29,
      );

      expect(quantidade(cards, "parcelamento_pendente_atraso")).toBe(0);
    });

    it("a lista dos cards de parcelamento traz a marca interno e o status do mês por parcelamento", () => {
      const cards = classificarResumoSetorSn([
        linha({
          parcelamentos: [
            parcelamento({ codigo: "P1", enviadoNoMes: true }),
            parcelamento({ codigo: "P2", interno: true }),
            parcelamento({ codigo: "P3", quitado: true }),
          ],
        }),
      ]);

      const cliente = cards.find((c) => c.id === "parcelamento_pendente")!.clientes[0];
      expect(cliente.parcelamentos).toEqual([
        { codigo: "P1", interno: false, status: "enviado" },
        { codigo: "P2", interno: true, status: "pendente" },
        { codigo: "P3", interno: false, status: "quitado" },
      ]);
    });

    it("os cards de DAS não carregam parcelamentos na lista", () => {
      const cards = classificarResumoSetorSn([
        linha({ dasStatus: "enviado", parcelamentos: [parcelamento()] }),
      ]);

      expect(cards.find((c) => c.id === "das_emitidas")!.clientes[0]).not.toHaveProperty(
        "parcelamentos",
      );
    });
  });
});
