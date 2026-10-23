import type { ResumoOperacionalRow } from "@/modules/clientes/application/ports/out/cliente-query.provider";

import { calcularComparativosSn } from "./comparativos-sn.mapper";

function linha(sobrescritas: Partial<ResumoOperacionalRow> = {}): ResumoOperacionalRow {
  return {
    clienteId: "c",
    empresa: "Empresa",
    cnpj: "1",
    documentoObrigatorio: null,
    dasStatus: null,
    parcelamentos: [],
    atividadeMes: { industria: false, comercio: false, servico: false },
    responsavelId: null,
    responsavelNome: null,
    ...sobrescritas,
  };
}

const qtd = (fatias: { id: string; quantidade: number }[]) =>
  Object.fromEntries(fatias.map((f) => [f.id, f.quantidade]));

describe("calcularComparativosSn", () => {
  it("devolve todas as fatias zeradas, na ordem, com lista vazia", () => {
    const c = calcularComparativosSn([]);

    expect(c.das.map((f) => f.id)).toEqual(["enviado", "pendente", "sem_movimento", "pronto"]);
    expect(c.parcelamento.map((f) => f.id)).toEqual(["enviado", "pendente", "interno"]);
    expect(c.atividade.map((f) => f.id)).toEqual(["industria", "comercio", "servico"]);
    expect([...c.das, ...c.parcelamento, ...c.atividade].every((f) => f.quantidade === 0)).toBe(
      true,
    );
  });

  it("conta o status bruto do DAS (sem os buckets compostos dos cards) e ignora nulo", () => {
    const c = calcularComparativosSn([
      linha({ dasStatus: "enviado" }),
      linha({ dasStatus: "enviado", documentoObrigatorio: "negativo" }),
      linha({ dasStatus: "pendente" }),
      linha({ dasStatus: "pronto" }),
      linha({ dasStatus: null }),
    ]);

    expect(qtd(c.das)).toEqual({ enviado: 2, pendente: 1, sem_movimento: 0, pronto: 1 });
  });

  it("conta parcelamento por Cliente com as mesmas definições dos cards (não exclusivo; quitado não conta)", () => {
    const p = (o: object = {}) => ({
      codigo: "P",
      interno: false,
      quitado: false,
      enviadoNoMes: false,
      ...o,
    });
    const c = calcularComparativosSn([
      linha({ parcelamentos: [p({ interno: true, enviadoNoMes: true }), p({ codigo: "Q" })] }),
      linha({ parcelamentos: [p({ enviadoNoMes: true })] }),
      linha({ parcelamentos: [p({ quitado: true, interno: true })] }),
      linha({ parcelamentos: [] }),
    ]);

    // 1º Cliente: pendente (Q sem envio) e interno; 2º: enviado; 3º (só quitado) e 4º: nenhum.
    expect(qtd(c.parcelamento)).toEqual({ enviado: 1, pendente: 1, interno: 1 });
  });

  it("compara Responsáveis pela quantidade de DAS enviada (mais Sem responsável)", () => {
    const c = calcularComparativosSn([
      linha({ responsavelId: "a", responsavelNome: "Ana", dasStatus: "enviado" }),
      linha({ responsavelId: "a", responsavelNome: "Ana", dasStatus: "enviado" }),
      linha({ responsavelId: "b", responsavelNome: "Bia", dasStatus: "enviado" }),
      linha({ responsavelId: "b", responsavelNome: "Bia", dasStatus: "pronto" }),
      linha({ responsavelId: null, dasStatus: "enviado" }),
      linha({ responsavelId: "c", responsavelNome: "Caio", dasStatus: "pendente" }),
    ]);

    expect(c.responsaveis.map((f) => [f.rotulo, f.quantidade])).toEqual([
      ["Ana", 2],
      ["Bia", 1],
      ["Sem responsável", 1],
      ["Caio", 0],
    ]);
  });

  it("atividade do mês não é mutuamente exclusiva", () => {
    const c = calcularComparativosSn([
      linha({ atividadeMes: { industria: true, comercio: true, servico: false } }),
      linha({ atividadeMes: { industria: false, comercio: true, servico: true } }),
    ]);

    expect(qtd(c.atividade)).toEqual({ industria: 1, comercio: 2, servico: 1 });
  });
});
