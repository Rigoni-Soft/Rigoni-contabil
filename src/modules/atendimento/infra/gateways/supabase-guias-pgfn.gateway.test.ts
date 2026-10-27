/**
 * Integração infra ↔ Supabase (testes.md, seção 3) do envio da guia PGFN ao Cliente (#186): leitura
 * dos Parcelamentos PGFN com as guias confirmadas, PDF vindo do Storage, regra de "pendente" do job
 * e registro de envio (um só por competência, quitação ao zerar). Destrutiva: só roda no Supabase
 * local e limpa pelos IDs da própria execução. Requer `npx supabase start`.
 */
import { criarAdminLocal } from "../../../../../test-support/admin-supabase-local";
import { SupabaseGuiasPgfnGateway } from "./supabase-guias-pgfn.gateway";
import { SupabaseParcelamentosDoClienteGateway } from "./supabase-parcelamentos-do-cliente.gateway";

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// O destino é validado antes de o client existir: remoto falha alto, sem tocar em dados alheios.
const admin = criarAdminLocal(SERVICE_KEY);
const guias = new SupabaseGuiasPgfnGateway(admin);
const parcelamentos = new SupabaseParcelamentosDoClienteGateway(admin);

const cnpj = `8${String(Date.now()).slice(-8)}00001`.slice(0, 14);
const clienteId = crypto.randomUUID();
const caminhosNoStorage: string[] = [];

async function ok<T>(consulta: PromiseLike<{ data: T; error: { message: string } | null }>) {
  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  return data as NonNullable<T>;
}

// AAAAMM do mês corrente em São Paulo.
const competenciaDoMes = async () =>
  String(await ok(admin.rpc("mes_corrente_sp")))
    .slice(0, 7)
    .replace("-", "");

async function criarParcelamento(restantes: number, origem: "pgfn" | "receita_federal" = "pgfn") {
  const id = crypto.randomUUID();
  await ok(
    admin.from("cliente_parcelamentos").insert({
      id,
      cliente_id: clienteId,
      codigo: `PGFN-${id.slice(0, 6)}`,
      parcelas_restantes: restantes,
      origem,
      arquivo_caminho: `${clienteId}/${id}.pdf`,
    }),
  );
  return id;
}

async function anexarGuia(
  parcelamentoId: string,
  competencia: string,
  estado: "a_confirmar" | "confirmada" = "confirmada",
) {
  const caminho = `${clienteId}/guias-pgfn/${parcelamentoId}/${competencia}-teste.pdf`;
  await ok(
    admin.from("cliente_parcelamento_guias").insert({
      parcelamento_id: parcelamentoId,
      competencia,
      conta_negociacao: "123",
      arquivo_caminho: caminho,
      estado,
    }),
  );
  return caminho;
}

const pendente = async () =>
  (await ok(
    admin.rpc("cliente_tem_parcelamento_pendente", { p_cliente_id: clienteId }),
  )) as unknown as boolean;

beforeEach(async () => {
  // Cada caso parte do Cliente sem parcelamentos (guias e envios saem em cascata).
  await admin.from("cliente_parcelamentos").delete().eq("cliente_id", clienteId);
});

beforeAll(async () => {
  await ok(
    admin.from("clientes").insert({
      id: clienteId,
      empresa: "Núcleo PGFN Ltda",
      cnpj,
      regime: "simples_nacional",
    }),
  );
});

afterAll(async () => {
  if (caminhosNoStorage.length > 0) {
    await admin.storage.from("parcelamentos-clientes").remove(caminhosNoStorage);
  }
  await admin.from("registros_auditoria").delete().eq("alvo", cnpj);
  await admin.from("clientes").delete().eq("id", clienteId);
});

describe("SupabaseGuiasPgfnGateway (#186)", () => {
  it("lista só o PGFN em aberto, com as guias confirmadas e as parcelas já enviadas", async () => {
    const id = await criarParcelamento(3);
    await criarParcelamento(2, "receita_federal");
    const caminho = await anexarGuia(id, "202610");
    await anexarGuia(id, "202611", "a_confirmar");
    await ok(
      admin
        .from("cliente_parcelamento_envios")
        .insert({ parcelamento_id: id, parcela: "202609", caminho: "c/entregue.pdf" }),
    );

    const lista = await guias.listarEmAberto(clienteId);

    expect(lista.ok && lista.value.map((p) => p.id)).toEqual([id]);
    expect(lista.ok && lista.value[0]).toMatchObject({
      parcelasRestantes: 3,
      parcelasEnviadas: ["202609"],
      guias: [{ competencia: "202610", caminho }],
      entregues: [{ competencia: "202609", caminho: "c/entregue.pdf" }],
    });
  });

  it("lê o PDF do bucket e recusa o caminho de outro Cliente", async () => {
    const id = await criarParcelamento(1);
    const caminho = `${clienteId}/guias-pgfn/${id}/ler.pdf`;
    caminhosNoStorage.push(caminho);
    await ok(
      admin.storage.from("parcelamentos-clientes").upload(caminho, Buffer.from("%PDF-1.4"), {
        contentType: "application/pdf",
      }),
    );

    const lido = await guias.ler(clienteId, caminho);
    const alheio = await guias.ler("00000000-0000-0000-0000-000000000000", caminho);

    expect(lido.ok && Buffer.from(lido.value, "base64").toString()).toBe("%PDF-1.4");
    expect(alheio.ok).toBe(false);
  });

  it("o envio da guia PGFN não entra nas guias entregues da Receita", async () => {
    const id = await criarParcelamento(2);
    await parcelamentos.registrarEnvio(id, "202511", "202511:", "c/x.pdf");

    const entregues = await parcelamentos.guiasEntregues(clienteId);

    expect(entregues.ok && entregues.value.some((e) => e.parcelamentoId === id)).toBe(false);
  });
});

describe("Pendente do job e registro de envio da guia PGFN (#186)", () => {
  it("só com guia confirmada até o mês corrente e ainda sem registro de envio", async () => {
    const mes = await competenciaDoMes();
    const id = await criarParcelamento(2);
    expect(await pendente()).toBe(false);

    await anexarGuia(id, "209912");
    await anexarGuia(id, "202512", "a_confirmar");
    expect(await pendente()).toBe(false);

    await ok(
      admin
        .from("cliente_parcelamento_guias")
        .update({ estado: "confirmada" })
        .eq("parcelamento_id", id)
        .eq("competencia", "202512"),
    );
    expect(await pendente()).toBe(true);

    await anexarGuia(id, mes);
    await parcelamentos.registrarEnvio(id, "202512", "202512:", "c/a.pdf");
    expect(await pendente()).toBe(true);
    // A última entrega aceita quita: o acordo sai do job.
    await parcelamentos.registrarEnvio(id, mes, `${mes}:`, "c/b.pdf");
    expect(await pendente()).toBe(false);
  });

  it("reenvio da competência não grava novo registro nem desconta outra parcela; a última quita", async () => {
    const id = await criarParcelamento(2);
    const dados = () =>
      ok(
        admin
          .from("cliente_parcelamentos")
          .select("parcelas_restantes, situacao")
          .eq("id", id)
          .single(),
      );

    expect(await parcelamentos.registrarEnvio(id, "202601", "202601:", "c/1.pdf")).toEqual({
      ok: true,
      value: "registrado",
    });
    expect(await parcelamentos.registrarEnvio(id, "202601", "202601:", "c/1.pdf")).toEqual({
      ok: true,
      value: "ja_registrado",
    });
    expect(await dados()).toEqual({ parcelas_restantes: 1, situacao: "em_aberto" });

    await parcelamentos.registrarEnvio(id, "202602", "202602:", "c/2.pdf");
    expect(await dados()).toEqual({ parcelas_restantes: 0, situacao: "quitado" });
  });
});
