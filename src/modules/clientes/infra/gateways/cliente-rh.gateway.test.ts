/**
 * Integração infra ↔ Supabase: o RH acha qualquer Cliente e lê os dados básicos; o que é de outro Setor
 * segue escondido, e só o Líder do RH atribui o Responsável do RH (com auditoria). Requer
 * `npx supabase start` com migrations + seed aplicados.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { removerClientesDeTeste } from "../../../../../test-support/clientes-de-teste";
import { SupabaseCarteiraDoSetorGateway } from "./carteira-do-setor.gateway";
import { SupabaseClienteQueryGateway } from "./cliente-query.gateway";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const CNPJ_SN = "11444777009801";
const CNPJ_PRESUMIDO = "11444777009802";
const FUNCIONARIO_SN_ID = "22222222-2222-2222-2222-222222222222";
const FUNCIONARIO_RH_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const FUNCIONARIO2_RH_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";

async function entrar(email: string, senha: string): Promise<SupabaseClient> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`Falha ao autenticar ${email}: ${error.message}`);
  return supabase;
}

const servico = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const comoLiderRH = () => entrar("lider.rh@rigonicontabil.local", "lider123");
const comoFuncionarioRH = () => entrar("funcionario.rh@rigonicontabil.local", "func123");
const comoFuncionario2RH = () => entrar("funcionario2.rh@rigonicontabil.local", "func123");
const comoLiderSN = () => entrar("lider.sn@rigonicontabil.local", "lider123");
const comoFuncionarioFinanceiro = () =>
  entrar("funcionario.financeiro@rigonicontabil.local", "func123");

let clienteSnId: string;
let clientePresumidoId: string;

const buscar = async (supabase: SupabaseClient, termo: string) => {
  const resultado = await new SupabaseClienteQueryGateway(supabase).buscarPorTermo(termo, false);
  if (!resultado.ok) throw resultado.error;
  return resultado.value.map((s) => s.cnpj);
};

beforeAll(async () => {
  await removerClientesDeTeste([CNPJ_SN, CNPJ_PRESUMIDO]);
  clienteSnId = crypto.randomUUID();
  clientePresumidoId = crypto.randomUUID();
  const clientes = await servico.from("clientes").insert([
    { id: clienteSnId, empresa: "RH Busca SN Ltda", cnpj: CNPJ_SN, regime: "simples_nacional" },
    {
      id: clientePresumidoId,
      empresa: "RH Busca Presumido Ltda",
      cnpj: CNPJ_PRESUMIDO,
      regime: "lucro_presumido",
    },
  ]);
  if (clientes.error) throw clientes.error;
  // O Responsável do SN é outro Funcionário: o RH não vira Responsável por isso.
  const sn = await servico.from("cliente_responsaveis").insert({
    cliente_id: clienteSnId,
    setor: "simples_nacional",
    responsavel_id: FUNCIONARIO_SN_ID,
  });
  if (sn.error) throw sn.error;
});

afterAll(async () => {
  await removerClientesDeTeste([CNPJ_SN, CNPJ_PRESUMIDO]);
});

describe("RH: leitura ampla e Responsável do RH (integração)", () => {
  it("o Funcionário e o Líder do RH acham Cliente de qualquer Regime, sem ser Responsável", async () => {
    for (const entrarComo of [comoFuncionarioRH, comoLiderRH]) {
      const cnpjs = await buscar(await entrarComo(), "RH Busca");
      expect(cnpjs.sort()).toEqual([CNPJ_SN, CNPJ_PRESUMIDO]);
    }
  });

  it("quem não é do RH segue sem ver o Cliente de que não é Responsável", async () => {
    expect(await buscar(await comoFuncionarioFinanceiro(), "RH Busca")).toEqual([]);
  });

  it("o Funcionário do RH lê só os dados básicos: nada do cadastro do SN nem dos contatos", async () => {
    const rh = await comoFuncionarioRH();
    const operacional = await rh
      .from("cliente_cadastro_operacional_sn")
      .select("cliente_id")
      .eq("cliente_id", clienteSnId);
    const contatos = await rh.from("cliente_contatos").select("id").eq("cliente_id", clienteSnId);
    const clientes = await rh.from("clientes").select("id").eq("id", clienteSnId);
    expect(operacional.data).toEqual([]);
    expect(contatos.data).toEqual([]);
    expect(clientes.data).toEqual([]);
  });

  it("o Líder do RH atribui, troca e remove o Responsável do RH, com auditoria, sem tocar no do SN", async () => {
    const lider = await comoLiderRH();
    const linha = (responsavelId: string) => ({
      cliente_id: clientePresumidoId,
      setor: "rh",
      responsavel_id: responsavelId,
    });

    const atribuido = await lider.from("cliente_responsaveis").insert(linha(FUNCIONARIO_RH_ID));
    expect(atribuido.error).toBeNull();
    const trocado = await lider
      .from("cliente_responsaveis")
      .update({ responsavel_id: FUNCIONARIO2_RH_ID })
      .eq("cliente_id", clientePresumidoId)
      .eq("setor", "rh");
    expect(trocado.error).toBeNull();
    const removido = await lider
      .from("cliente_responsaveis")
      .delete()
      .eq("cliente_id", clientePresumidoId)
      .eq("setor", "rh");
    expect(removido.error).toBeNull();

    const auditoria = await servico
      .from("registros_auditoria")
      .select("acao, setor")
      .eq("alvo", CNPJ_PRESUMIDO)
      .in("acao", [
        "cliente.atribuir-responsavel",
        "cliente.trocar-responsavel",
        "cliente.remover-responsavel",
      ]);
    expect((auditoria.data ?? []).map((a) => a.acao).sort()).toEqual([
      "cliente.atribuir-responsavel",
      "cliente.remover-responsavel",
      "cliente.trocar-responsavel",
    ]);
    expect((auditoria.data ?? []).every((a) => a.setor === "rh")).toBe(true);

    const doSn = await servico
      .from("cliente_responsaveis")
      .select("responsavel_id")
      .eq("cliente_id", clienteSnId)
      .eq("setor", "simples_nacional");
    expect(doSn.data).toEqual([{ responsavel_id: FUNCIONARIO_SN_ID }]);
  });

  it("só o Líder do RH atribui o Responsável do RH: Funcionário do RH e Líder de outro Setor não", async () => {
    const linha = {
      cliente_id: clientePresumidoId,
      setor: "rh",
      responsavel_id: FUNCIONARIO_RH_ID,
    };
    for (const entrarComo of [comoFuncionarioRH, comoLiderSN]) {
      const tentativa = await (await entrarComo()).from("cliente_responsaveis").insert(linha);
      expect(tentativa.error).not.toBeNull();
    }
    const gravadas = await servico
      .from("cliente_responsaveis")
      .select("cliente_id")
      .eq("cliente_id", clientePresumidoId)
      .eq("setor", "rh");
    expect(gravadas.data).toEqual([]);
  });

  it("a carteira do RH: o Líder lê todos os Clientes com o Responsável; o Funcionário, só o vínculo dele", async () => {
    await servico.from("cliente_responsaveis").upsert({
      cliente_id: clientePresumidoId,
      setor: "rh",
      responsavel_id: FUNCIONARIO_RH_ID,
    });
    const listar = async (supabase: SupabaseClient) => {
      const r = await new SupabaseCarteiraDoSetorGateway(supabase).listar("rh");
      if (!r.ok) throw r.error;
      return r.value.filter((l) => [CNPJ_SN, CNPJ_PRESUMIDO].includes(l.cnpj));
    };

    const doLider = await listar(await comoLiderRH());
    const doFuncionario = await listar(await comoFuncionarioRH());
    const doColega = await listar(await comoFuncionario2RH());

    expect(doLider.map((l) => [l.cnpj, l.responsavelId, l.responsavelNome])).toEqual([
      [CNPJ_PRESUMIDO, FUNCIONARIO_RH_ID, "Funcionário RH"],
      [CNPJ_SN, null, null],
    ]);
    expect(doFuncionario.filter((l) => l.responsavelId === FUNCIONARIO_RH_ID)).toHaveLength(1);
    expect(doColega.filter((l) => l.responsavelId !== null)).toEqual([]);
  });

  it("o Funcionário do RH atribuído lê o seu vínculo e não o do colega", async () => {
    const lider = await comoLiderRH();
    await lider.from("cliente_responsaveis").insert({
      cliente_id: clientePresumidoId,
      setor: "rh",
      responsavel_id: FUNCIONARIO_RH_ID,
    });

    const proprio = await (
      await comoFuncionarioRH()
    )
      .from("cliente_responsaveis")
      .select("responsavel_id")
      .eq("cliente_id", clientePresumidoId)
      .eq("setor", "rh");
    const colega = await (
      await comoFuncionario2RH()
    )
      .from("cliente_responsaveis")
      .select("responsavel_id")
      .eq("cliente_id", clientePresumidoId)
      .eq("setor", "rh");
    expect(proprio.data).toEqual([{ responsavel_id: FUNCIONARIO_RH_ID }]);
    expect(colega.data).toEqual([]);
  });
});
