import type { AlertaSetor } from "@/modules/atendimento/application/ports/out/alerta-setor.provider";
import type { ClienteComParcelamentoPgfn } from "@/modules/atendimento/application/ports/out/clientes-com-parcelamento-pgfn.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok, type Result } from "@/shared/kernel/result";

import { ExecutarLembretesParcelamentoPgfn } from "./executar-lembretes-parcelamento-pgfn.use-case";

// 10/10/2026 08:00 em São Paulo (sábado: o job roda também em fim de semana).
const diaDoJob = new Date("2026-10-10T11:00:00Z");

const cliente = (extra: Partial<ClienteComParcelamentoPgfn> = {}): ClienteComParcelamentoPgfn => ({
  clienteId: "c1",
  empresa: "3A Construções",
  pendencias: [{ codigo: "PARC-1", estado: "sem_guia" }],
  ...extra,
});

function montar(
  clientes: Result<ClienteComParcelamentoPgfn[], AppError>,
  opcoes: { agora?: Date; gravacao?: Result<void, AppError> } = {},
) {
  const alertas: AlertaSetor[] = [];
  const resolvidos: { desde: Date; ids: string[] }[] = [];
  const listar = jest.fn(async () => clientes);
  const job = new ExecutarLembretesParcelamentoPgfn(
    { listar },
    {
      alertar: async (alerta) => {
        alertas.push(alerta);
        return opcoes.gravacao ?? ok(undefined);
      },
      resolverNaoRenovados: async (desde, ids) => {
        resolvidos.push({ desde, ids });
        return ok(undefined);
      },
    },
    { agora: () => opcoes.agora ?? diaDoJob },
  );
  return { job, alertas, resolvidos, listar };
}

describe("ExecutarLembretesParcelamentoPgfn", () => {
  it.each([1, 10, 15])("age no dia %i, inclusive em fim de semana", async (dia) => {
    const agora = new Date(`2026-11-${String(dia).padStart(2, "0")}T11:00:00Z`);
    const { job, listar } = montar(ok([]), { agora });

    const resultado = await job.execute();

    expect(resultado).toEqual(ok(expect.objectContaining({ executado: true })));
    expect(listar).toHaveBeenCalled();
  });

  it("em qualquer outro dia não lê nem altera nada", async () => {
    const { job, listar, alertas, resolvidos } = montar(ok([cliente()]), {
      agora: new Date("2026-10-11T11:00:00Z"),
    });

    const resultado = await job.execute();

    expect(resultado).toEqual(ok({ executado: false, alertas: 0, falhas: 0 }));
    expect(listar).not.toHaveBeenCalled();
    expect(alertas).toEqual([]);
    expect(resolvidos).toEqual([]);
  });

  it("usa o dia de São Paulo: 01h UTC do dia 11 ainda é dia 10", async () => {
    const { job, listar } = montar(ok([]), { agora: new Date("2026-10-11T01:00:00Z") });

    await job.execute();

    expect(listar).toHaveBeenCalled();
  });

  it("cria um alerta por Cliente ao setor Simples Nacional, listando os Parcelamentos", async () => {
    const { job, alertas } = montar(
      ok([
        cliente({
          pendencias: [
            { codigo: "PARC-1", estado: "sem_guia" },
            { codigo: "PARC-2", estado: "sem_guia" },
          ],
        }),
        cliente({ clienteId: "c2", empresa: "Outra Ltda" }),
      ]),
    );

    const resultado = await job.execute();

    expect(alertas).toHaveLength(2);
    expect(alertas[0]).toMatchObject({
      setor: "simples_nacional",
      tipo: "guia_pgfn_pendente",
      clienteId: "c1",
    });
    expect(alertas[0].mensagem).toContain("10/2026");
    expect(alertas[0].mensagem).toContain("Falta anexar: PARC-1, PARC-2");
    expect(resultado).toEqual(ok({ executado: true, alertas: 2, falhas: 0 }));
  });

  it("distingue guia a confirmar de guia a anexar", async () => {
    const { job, alertas } = montar(
      ok([
        cliente({
          pendencias: [
            { codigo: "PARC-1", estado: "sem_guia" },
            { codigo: "PARC-2", estado: "a_confirmar" },
          ],
        }),
      ]),
    );

    await job.execute();

    expect(alertas[0].mensagem).toContain("Falta anexar: PARC-1");
    expect(alertas[0].mensagem).toContain("A confirmar: PARC-2");
  });

  it("só guia a confirmar mantém o alerta com texto próprio, sem falar em anexar", async () => {
    const { job, alertas } = montar(
      ok([cliente({ pendencias: [{ codigo: "PARC-2", estado: "a_confirmar" }] })]),
    );

    await job.execute();

    expect(alertas[0].mensagem).toContain("A confirmar: PARC-2");
    expect(alertas[0].mensagem).not.toContain("Falta anexar");
  });

  it("Cliente sem pendência não alerta e entra na resolução dos alertas não renovados", async () => {
    const { job, alertas, resolvidos } = montar(
      ok([cliente(), cliente({ clienteId: "c2", pendencias: [] })]),
    );

    await job.execute();

    expect(alertas.map((a) => a.clienteId)).toEqual(["c1"]);
    expect(resolvidos).toHaveLength(1);
    expect(resolvidos[0].ids).toEqual(["c1", "c2"]);
    expect(resolvidos[0].desde.getTime()).toBeLessThan(diaDoJob.getTime());
  });

  it("falha ao ler os Clientes devolve o erro sem gravar nem resolver", async () => {
    const { job, alertas, resolvidos } = montar(err(new ServicoExternoError("leitura")));

    const resultado = await job.execute();

    expect(resultado.ok).toBe(false);
    expect(alertas).toEqual([]);
    expect(resolvidos).toEqual([]);
  });

  it("alerta que não grava conta como falha e não resolve nada", async () => {
    const { job, resolvidos } = montar(ok([cliente()]), {
      gravacao: err(new ServicoExternoError("banco")),
    });

    const resultado = await job.execute();

    expect(resultado).toEqual(ok({ executado: true, alertas: 0, falhas: 1 }));
    expect(resolvidos).toEqual([]);
  });
});
