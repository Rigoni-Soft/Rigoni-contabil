/**
 * Integração infra ↔ Supabase (testes.md, seção 3) do job de lembretes PGFN: leitura dos Clientes
 * com Parcelamento PGFN e do que falta da guia do mês, e o ciclo do alerta de origem própria
 * (abre, renova, resolve sem tocar nos alertas de outra origem). Destrutiva: só roda no Supabase
 * local e limpa pelos IDs da própria execução. Requer `npx supabase start`.
 */
import { ExecutarLembretesParcelamentoPgfn } from "@/modules/atendimento/application/use-cases/executar-lembretes-parcelamento-pgfn.use-case";
import { mesAtual } from "@/shared/kernel/mes-atual";

import { criarAdminLocal } from "../../../../../test-support/admin-supabase-local";
import { SupabaseAlertaSetorGateway } from "./supabase-alerta-setor.gateway";
import { SupabaseClientesComParcelamentoPgfnGateway } from "./supabase-clientes-com-parcelamento-pgfn.gateway";

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// O destino é validado antes de o client existir: remoto falha alto, sem tocar em dados alheios.
const admin = criarAdminLocal(SERVICE_KEY);
const clientes = new SupabaseClientesComParcelamentoPgfnGateway(admin);
const alertas = new SupabaseAlertaSetorGateway(admin, "lembrete_pgfn");
const alertasLembretes = new SupabaseAlertaSetorGateway(admin, "lembretes");

const sufixo = String(Date.now()).slice(-8);
const competenciaAtual = mesAtual().replace("-", "");
const competenciaAnterior = (() => {
  const [ano, mes] = mesAtual().split("-").map(Number);
  return mes === 1 ? `${ano - 1}12` : `${ano}${String(mes - 1).padStart(2, "0")}`;
})();

type Fixture = { id: string; cnpj: string };
const criados: Fixture[] = [];
let sequencia = 0;

async function ok<T>(consulta: PromiseLike<{ data: T; error: { message: string } | null }>) {
  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  return data as NonNullable<T>;
}

async function criarCliente(empresa: string): Promise<Fixture> {
  sequencia += 1;
  const fixture = {
    id: crypto.randomUUID(),
    cnpj: `7${sufixo}${String(sequencia).padStart(5, "0")}`.slice(0, 14),
  };
  await ok(
    admin
      .from("clientes")
      .insert({ id: fixture.id, empresa, cnpj: fixture.cnpj, regime: "simples_nacional" }),
  );
  criados.push(fixture);
  return fixture;
}

async function criarParcelamento(
  clienteId: string,
  codigo: string,
  extra: { origem?: "receita_federal" | "pgfn"; interno?: boolean; situacao?: string } = {},
) {
  const id = crypto.randomUUID();
  await ok(
    admin.from("cliente_parcelamentos").insert({
      id,
      cliente_id: clienteId,
      codigo,
      parcelas_restantes: 5,
      interno: extra.interno ?? false,
      origem: extra.origem ?? "pgfn",
      situacao: extra.situacao ?? "em_aberto",
      arquivo_caminho: `${clienteId}/${codigo}.pdf`,
    }),
  );
  return id;
}

async function anexarGuia(
  parcelamentoId: string,
  competencia: string,
  estado: "a_confirmar" | "confirmada",
) {
  await ok(
    admin.from("cliente_parcelamento_guias").insert({
      parcelamento_id: parcelamentoId,
      competencia,
      conta_negociacao: "123",
      arquivo_caminho: `x/guia-${crypto.randomUUID()}.pdf`,
      estado,
    }),
  );
}

async function pendenciasDe(cliente: Fixture) {
  const lista = await clientes.listar();
  if (!lista.ok) throw new Error(lista.error.message);
  return lista.value.find((c) => c.clienteId === cliente.id)?.pendencias;
}

afterAll(async () => {
  const ids = criados.map((c) => c.id);
  if (ids.length === 0) return;
  // Parcelamentos, guias e alertas saem em cascata com o Cliente.
  const { error } = await admin.from("clientes").delete().in("id", ids);
  expect(error).toBeNull();
});

describe("leitura dos Clientes com Parcelamento PGFN", () => {
  it("sem guia do mês: falta anexar; anexada e não confirmada: a confirmar; confirmada: sem pendência", async () => {
    const cliente = await criarCliente("PGFN Pendências Ltda");
    await criarParcelamento(cliente.id, "A-SEM");
    const aConfirmar = await criarParcelamento(cliente.id, "B-CONF");
    await anexarGuia(aConfirmar, competenciaAtual, "a_confirmar");
    const confirmada = await criarParcelamento(cliente.id, "C-OK");
    await anexarGuia(confirmada, competenciaAtual, "confirmada");

    expect(await pendenciasDe(cliente)).toEqual([
      { codigo: "A-SEM", estado: "sem_guia" },
      { codigo: "B-CONF", estado: "a_confirmar" },
    ]);
  });

  it("guia confirmada de competência atrasada não cobre a do mês", async () => {
    const cliente = await criarCliente("PGFN Atrasada Ltda");
    const id = await criarParcelamento(cliente.id, "ATRASO");
    await anexarGuia(id, competenciaAnterior, "confirmada");

    expect(await pendenciasDe(cliente)).toEqual([{ codigo: "ATRASO", estado: "sem_guia" }]);
  });

  it("inclui o Parcelamento interno e ignora os que não são PGFN ou não estão em aberto", async () => {
    const cliente = await criarCliente("PGFN Interno Ltda");
    await criarParcelamento(cliente.id, "INTERNO", { interno: true });
    await criarParcelamento(cliente.id, "RECEITA", { origem: "receita_federal" });
    const encerrado = await criarCliente("PGFN Encerrado Ltda");
    await criarParcelamento(encerrado.id, "FIM", { situacao: "quitado" });

    expect(await pendenciasDe(cliente)).toEqual([{ codigo: "INTERNO", estado: "sem_guia" }]);
    expect(await pendenciasDe(encerrado)).toBeUndefined();
  });
});

describe("ciclo do alerta", () => {
  // O relógio injetado só precisa cair num dia do job (10) e no mês corrente.
  const diaDoJob = new Date();
  diaDoJob.setUTCDate(10);
  diaDoJob.setUTCHours(12);
  const relogio = { agora: () => diaDoJob };

  // O banco grava `criado_em` com o relógio real; o do job é injetado. Envelhece o alerta para ele
  // contar como "não renovado" na rodada seguinte (a renovação regrava `criado_em` com o agora real).
  const envelhecer = (clienteId: string) =>
    ok(
      admin
        .from("alertas_setor")
        .update({ criado_em: new Date(diaDoJob.getTime() - 60 * 60 * 1000).toISOString() })
        .eq("cliente_id", clienteId)
        .eq("origem", "lembrete_pgfn"),
    );

  const abertos = async (clienteId: string, origem: string) =>
    ok(
      admin
        .from("alertas_setor")
        .select("tipo, mensagem")
        .eq("cliente_id", clienteId)
        .eq("origem", origem)
        .is("resolvido_em", null),
    );

  it("abre o alerta, e some quando a guia confirmada do mês entra, sem tocar nos de outra origem", async () => {
    const cliente = await criarCliente("PGFN Ciclo Ltda");
    const parcelamento = await criarParcelamento(cliente.id, "CICLO-1");
    await alertasLembretes.alertar({
      setor: "simples_nacional",
      tipo: "das_pendente",
      clienteId: cliente.id,
      mensagem: "DAS pendente",
    });
    const job = new ExecutarLembretesParcelamentoPgfn(clientes, alertas, relogio);

    await job.execute();
    const aberto = await abertos(cliente.id, "lembrete_pgfn");
    expect(aberto).toHaveLength(1);
    expect(aberto[0].tipo).toBe("guia_pgfn_pendente");
    expect(aberto[0].mensagem).toContain("Falta anexar: CICLO-1");

    await envelhecer(cliente.id);
    await anexarGuia(parcelamento, competenciaAtual, "a_confirmar");
    await job.execute();
    const renovado = await abertos(cliente.id, "lembrete_pgfn");
    expect(renovado).toHaveLength(1);
    expect(renovado[0].mensagem).toContain("A confirmar: CICLO-1");

    await ok(
      admin
        .from("cliente_parcelamento_guias")
        .update({ estado: "confirmada" })
        .eq("parcelamento_id", parcelamento),
    );
    await envelhecer(cliente.id);
    await job.execute();
    expect(await abertos(cliente.id, "lembrete_pgfn")).toHaveLength(0);
    expect(await abertos(cliente.id, "lembretes")).toHaveLength(1);
  });

  it("confirmar a última guia pendente resolve o alerta na hora, sem esperar o job", async () => {
    const cliente = await criarCliente("PGFN Confirma Ltda");
    const a = await criarParcelamento(cliente.id, "CONF-A");
    const b = await criarParcelamento(cliente.id, "CONF-B");
    await new ExecutarLembretesParcelamentoPgfn(clientes, alertas, relogio).execute();
    expect(await abertos(cliente.id, "lembrete_pgfn")).toHaveLength(1);

    await anexarGuia(a, competenciaAtual, "confirmada");
    expect(await abertos(cliente.id, "lembrete_pgfn")).toHaveLength(1);

    await anexarGuia(b, competenciaAtual, "confirmada");
    expect(await abertos(cliente.id, "lembrete_pgfn")).toHaveLength(0);
  });

  it("Parcelamento que sai de aberto com alerta pendente também resolve o alerta", async () => {
    const cliente = await criarCliente("PGFN Quitou Ltda");
    const parcelamento = await criarParcelamento(cliente.id, "QUITA-1");
    const job = new ExecutarLembretesParcelamentoPgfn(clientes, alertas, relogio);
    await job.execute();
    expect(await abertos(cliente.id, "lembrete_pgfn")).toHaveLength(1);

    await ok(
      admin.from("cliente_parcelamentos").update({ situacao: "quitado" }).eq("id", parcelamento),
    );
    await envelhecer(cliente.id);
    await job.execute();

    expect(await abertos(cliente.id, "lembrete_pgfn")).toHaveLength(0);
  });
});
