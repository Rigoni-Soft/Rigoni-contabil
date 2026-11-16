import type { EmpregadoDaFolhaDto } from "@/modules/rh/application/dtos/folha-de-ponto.dto";
import type { ConvencaoRepository } from "@/modules/rh/application/ports/out/convencao.repository";
import type { FolhaDePontoRepository } from "@/modules/rh/application/ports/out/folha-de-ponto.repository";
import { ApuradorDeCartoes } from "@/modules/rh/application/services/apurador-de-cartoes.service";
import { Competencia } from "@/modules/rh/domain/value-objects/competencia.vo";
import { PersistenciaError } from "@/shared/errors/persistencia.error";
import { err, ok } from "@/shared/kernel/result";

const JORNADA: EmpregadoDaFolhaDto["jornada"] = [0, 525, 525, 525, 525, 525, 240];
const ANA: EmpregadoDaFolhaDto = {
  id: "e1",
  nome: "Ana",
  jornada: JORNADA,
  comissionado: false,
  ativo: true,
  semMovimento: false,
};
const BIA: EmpregadoDaFolhaDto = { ...ANA, id: "e2", nome: "Bia" };
const COMPETENCIA = (() => {
  const c = Competencia.criar("2026-11");
  if (!c.ok) throw new Error("competência de teste inválida");
  return c.value;
})();

function montar(sobrepor: Partial<Record<keyof FolhaDePontoRepository, unknown>> = {}) {
  const repositorio = {
    listarFeriados: jest.fn(async () => ok(["2026-11-02"])),
    buscarInterruptores: jest.fn(async () =>
      ok({ bancoDeHoras: false, trabalhoAosDomingos: false }),
    ),
    listarConvencaoDosEmpregados: jest.fn(async () => ok([])),
    listarDias: jest.fn(async (id: string) =>
      ok(
        id === "e1"
          ? [
              {
                data: "2026-11-03",
                batidas: [{ entrada: 480, saida: 1065 }],
                extra: null,
                abono: false,
              },
            ]
          : [],
      ),
    ),
    cartaoIniciado: jest.fn(async () => ok(false)),
    ...sobrepor,
  };
  const convencoes = { listar: jest.fn(async () => ok([])), inserir: jest.fn() };
  const apurador = new ApuradorDeCartoes(
    repositorio as unknown as FolhaDePontoRepository,
    convencoes as unknown as ConvencaoRepository,
  );
  return { apurador, repositorio, convencoes };
}

describe("ApuradorDeCartoes", () => {
  it("lê os insumos do Cliente uma vez e apura N empregados, um cartão por empregado", async () => {
    const { apurador, repositorio, convencoes } = montar();

    const r = await apurador.apurar("c1", [ANA, BIA], COMPETENCIA);

    expect(r.ok && r.value.map((c) => c.empregado.id)).toEqual(["e1", "e2"]);
    expect(repositorio.listarFeriados).toHaveBeenCalledTimes(1);
    expect(repositorio.buscarInterruptores).toHaveBeenCalledTimes(1);
    expect(repositorio.listarConvencaoDosEmpregados).toHaveBeenCalledTimes(1);
    expect(convencoes.listar).toHaveBeenCalledTimes(1);
    expect(repositorio.listarDias).toHaveBeenCalledTimes(2);
    expect(repositorio.cartaoIniciado).toHaveBeenCalledTimes(2);
  });

  it("apura os dias do mês: feriado marcado, trabalhado somado, dia sem lançamento vazio", async () => {
    const { apurador } = montar();

    const r = await apurador.apurar("c1", [ANA], COMPETENCIA);

    const dias = r.ok ? r.value[0].dias : [];
    expect(dias).toHaveLength(30);
    expect(dias[1]).toMatchObject({ data: "2026-11-02", feriado: true, diaDeTrabalho: false });
    expect(dias[2]).toMatchObject({ data: "2026-11-03", trabalhadoMin: 585 });
    expect(dias[3]).toMatchObject({ data: "2026-11-04", trabalhadoMin: 0, batidas: [] });
  });

  it("calcula o motivo sem PDF: com apontamento não há motivo; sem apontamento há", async () => {
    const { apurador } = montar();

    const r = await apurador.apurar("c1", [ANA, BIA], COMPETENCIA);

    expect(r.ok && r.value[0].motivoSemPdf).toBeUndefined();
    expect(r.ok && r.value[1].motivoSemPdf).toContain("Sem apontamentos");
  });

  it("sem convenção vigente só avisa quando há dia lançado ou feriado", async () => {
    const { apurador } = montar();

    const r = await apurador.apurar("c1", [ANA, BIA], COMPETENCIA);

    // Os dois têm o feriado do dia 2 sem convenção; Ana ainda tem o dia 3 lançado.
    expect(r.ok && r.value.map((c) => c.semConvencao)).toEqual([true, true]);
  });

  it("falha de qualquer leitura devolve o erro, sem cartão", async () => {
    const falha = err(new PersistenciaError("Falha de leitura."));
    const { apurador } = montar({ listarFeriados: jest.fn(async () => falha) });

    const r = await apurador.apurar("c1", [ANA], COMPETENCIA);

    expect(r.ok).toBe(false);
  });

  it("falha na leitura dos dias de um empregado devolve o erro", async () => {
    const falha = err(new PersistenciaError("Falha de leitura."));
    const { apurador } = montar({ listarDias: jest.fn(async () => falha) });

    const r = await apurador.apurar("c1", [ANA, BIA], COMPETENCIA);

    expect(r.ok).toBe(false);
  });
});
