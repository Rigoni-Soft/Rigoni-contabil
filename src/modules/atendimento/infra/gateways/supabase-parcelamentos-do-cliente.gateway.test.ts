/**
 * Integração infra ↔ Supabase (testes.md, seção 3) do núcleo de envio das guias de parcelamento:
 * leitura dos parcelamentos em aberto e registro de envio por parcela (desconto de uma parcela
 * restante uma vez só, quitação ao zerar, auditoria da URA). Destrutiva: só roda no Supabase local
 * e limpa pelos IDs da própria execução. Requer `npx supabase start`.
 */
import { URA_ATOR_ID } from "@/modules/atendimento/domain/services/inatividade.service";

import { criarAdminLocal } from "../../../../../test-support/admin-supabase-local";
import { SupabaseParcelamentosDoClienteGateway } from "./supabase-parcelamentos-do-cliente.gateway";

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// O destino é validado antes de o client existir: remoto falha alto, sem tocar em dados alheios.
const admin = criarAdminLocal(SERVICE_KEY);
const parcelamentos = new SupabaseParcelamentosDoClienteGateway(admin);

const cnpj = `7${String(Date.now()).slice(-8)}00001`.slice(0, 14);
const clienteId = crypto.randomUUID();

async function ok<T>(consulta: PromiseLike<{ data: T; error: { message: string } | null }>) {
  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  return data as NonNullable<T>;
}

async function criarParcelamento(extra: {
  codigo: string;
  restantes: number;
  interno?: boolean;
  valor?: number;
  situacao?: "em_aberto" | "quitado";
}) {
  const id = crypto.randomUUID();
  await ok(
    admin.from("cliente_parcelamentos").insert({
      id,
      cliente_id: clienteId,
      codigo: extra.codigo,
      parcelas_restantes: extra.restantes,
      interno: extra.interno ?? false,
      valor_parcela_centavos: extra.valor ?? null,
      situacao: extra.situacao ?? "em_aberto",
      arquivo_caminho: `${clienteId}/${extra.codigo}.pdf`,
    }),
  );
  return id;
}

async function dadosDoParcelamento(id: string) {
  return ok(
    admin.from("cliente_parcelamentos").select("parcelas_restantes, situacao").eq("id", id).single(),
  );
}

beforeAll(async () => {
  await ok(
    admin.from("clientes").insert({
      id: clienteId,
      empresa: "Núcleo Parcelamento Ltda",
      cnpj,
      regime: "simples_nacional",
    }),
  );
});

afterAll(async () => {
  // Parcelamentos e registros de envio saem em cascata com o Cliente.
  await admin.from("registros_auditoria").delete().eq("alvo", cnpj);
  await admin.from("clientes").delete().eq("id", clienteId);
});

describe("SupabaseParcelamentosDoClienteGateway", () => {
  it("lista só os em aberto com parcelas restantes, com valor, interno e parcelas enviadas", async () => {
    const aberto = await criarParcelamento({ codigo: "ABERTO", restantes: 3, valor: 12_345 });
    const interno = await criarParcelamento({ codigo: "INTERNO", restantes: 2, interno: true });
    await criarParcelamento({ codigo: "QUITADO", restantes: 0, situacao: "quitado" });
    await ok(
      admin.from("cliente_parcelamento_envios").insert({ parcelamento_id: aberto, parcela: "202609" }),
    );

    const lista = await parcelamentos.listarEmAberto(clienteId);

    expect(lista.ok && lista.value.map((p) => p.codigo).sort()).toEqual(["ABERTO", "INTERNO"]);
    expect(lista.ok && lista.value.find((p) => p.id === aberto)).toEqual({
      id: aberto,
      codigo: "ABERTO",
      interno: false,
      valorParcelaCentavos: 12_345,
      parcelasEnviadas: ["202609"],
    });
    expect(lista.ok && lista.value.find((p) => p.id === interno)?.valorParcelaCentavos).toBeNull();
  });

  it("registrar o envio grava a parcela, desconta uma restante e audita com a URA; repetir não tem efeito", async () => {
    const id = await criarParcelamento({ codigo: "DESCONTA", restantes: 3 });

    expect(await parcelamentos.registrarEnvio(id, "202610")).toEqual({ ok: true, value: true });
    expect(await parcelamentos.registrarEnvio(id, "202610")).toEqual({ ok: true, value: false });

    expect(await dadosDoParcelamento(id)).toEqual({ parcelas_restantes: 2, situacao: "em_aberto" });
    const envios = await ok(
      admin.from("cliente_parcelamento_envios").select("parcela").eq("parcelamento_id", id),
    );
    expect(envios).toEqual([{ parcela: "202610" }]);
    const auditoria = await ok(
      admin
        .from("registros_auditoria")
        .select("ator, acao, resultado")
        .eq("alvo", cnpj)
        .eq("acao", "cliente.enviar-parcelamento-automatico"),
    );
    expect(auditoria.length).toBeGreaterThanOrEqual(1);
    expect(auditoria[0]).toEqual({
      ator: URA_ATOR_ID,
      acao: "cliente.enviar-parcelamento-automatico",
      resultado: "sucesso",
    });
  });

  it("a última parcela quita o parcelamento, que sai da lista; depois de quitado nada mais é registrado", async () => {
    const id = await criarParcelamento({ codigo: "ULTIMA", restantes: 1 });

    expect(await parcelamentos.registrarEnvio(id, "202610")).toEqual({ ok: true, value: true });

    expect(await dadosDoParcelamento(id)).toEqual({ parcelas_restantes: 0, situacao: "quitado" });
    const lista = await parcelamentos.listarEmAberto(clienteId);
    expect(lista.ok && lista.value.map((p) => p.id)).not.toContain(id);

    expect(await parcelamentos.registrarEnvio(id, "202611")).toEqual({ ok: true, value: false });
    expect(await dadosDoParcelamento(id)).toEqual({ parcelas_restantes: 0, situacao: "quitado" });
  });
});
