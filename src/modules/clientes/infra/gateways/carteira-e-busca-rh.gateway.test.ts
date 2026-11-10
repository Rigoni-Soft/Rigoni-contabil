/**
 * Integração infra ↔ Supabase: o Líder do RH e o Admin acham todo Cliente; o Funcionário do RH só o que é
 * atribuído a ele; só o Líder do RH atribui o Responsável do RH (com auditoria). Requer
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
const comoAdmin = () => entrar("admin@rigonicontabil.local", "admin123");
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

// Cada teste parte sem Responsável do RH: nenhum depende do vínculo deixado por outro.
afterEach(async () => {
  await servico
    .from("cliente_responsaveis")
    .delete()
    .in("cliente_id", [clienteSnId, clientePresumidoId])
    .eq("setor", "rh");
});

describe("RH: busca por atribuição e Responsável do RH (integração)", () => {
  it("o Líder do RH e o Admin acham Cliente de todo Regime, sem ser Responsável", async () => {
    for (const entrarComo of [comoLiderRH, comoAdmin]) {
      const cnpjs = await buscar(await entrarComo(), "RH Busca");
      expect(cnpjs.sort()).toEqual([CNPJ_SN, CNPJ_PRESUMIDO]);
    }
  });

  it("o Funcionário do RH só acha o Cliente atribuído a ele", async () => {
    expect(await buscar(await comoFuncionarioRH(), "RH Busca")).toEqual([]);

    await servico.from("cliente_responsaveis").insert({
      cliente_id: clientePresumidoId,
      setor: "rh",
      responsavel_id: FUNCIONARIO_RH_ID,
    });
    const proprio = await buscar(await comoFuncionarioRH(), "RH Busca");
    const colega = await buscar(await comoFuncionario2RH(), "RH Busca");
    await servico
      .from("cliente_responsaveis")
      .delete()
      .eq("cliente_id", clientePresumidoId)
      .eq("setor", "rh");

    expect(proprio).toEqual([CNPJ_PRESUMIDO]);
    expect(colega).toEqual([]);
  });

  it("quem não é do RH segue sem ver o Cliente de que não é Responsável", async () => {
    expect(await buscar(await comoFuncionarioFinanceiro(), "RH Busca")).toEqual([]);
  });

  it("o Funcionário do RH não lê nada de um Cliente que não é dele: nem dados básicos, cadastro ou contatos", async () => {
    const rh = await comoFuncionarioRH();
    const basico = await rh.from("clientes_basico").select("id").eq("id", clienteSnId);
    const operacional = await rh
      .from("cliente_cadastro_operacional_sn")
      .select("cliente_id")
      .eq("cliente_id", clienteSnId);
    const contatos = await rh.from("cliente_contatos").select("id").eq("cliente_id", clienteSnId);
    const clientes = await rh.from("clientes").select("id").eq("id", clienteSnId);
    expect(basico.data).toEqual([]);
    expect(operacional.data).toEqual([]);
    expect(contatos.data).toEqual([]);
    expect(clientes.data).toEqual([]);
  });

  it("o cadastro do RH vem com empresa, CNPJ, contatos e observações do RH (sem o Regime), de qualquer Regime, para o Líder do RH", async () => {
    const gateway = new SupabaseClienteQueryGateway(await comoLiderRH());

    const sn = await gateway.buscarCadastroRh(clienteSnId);
    const presumido = await gateway.buscarCadastroRh(clientePresumidoId);

    expect(sn.ok && sn.value).toEqual({
      id: clienteSnId,
      empresa: "RH Busca SN Ltda",
      cnpj: CNPJ_SN,
      contatos: [],
      observacoes: "",
    });
    expect(presumido.ok && presumido.value?.empresa).toBeDefined();
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

  // Isolamento entre cadastros operacionais de Setores diferentes: o do RH, quando existir, terá o próprio teste de edição.
  it("o RH não edita o que é do SN: nem o Funcionário Responsável do RH do Cliente, nem o Líder", async () => {
    await servico.from("cliente_responsaveis").upsert({
      cliente_id: clienteSnId,
      setor: "rh",
      responsavel_id: FUNCIONARIO_RH_ID,
    });

    for (const entrarComo of [comoFuncionarioRH, comoLiderRH]) {
      const rh = await entrarComo();
      const contato = await rh.from("cliente_contatos").insert({
        cliente_id: clienteSnId,
        nome: "Intruso",
        telefone: "5545999990000",
        padrao: true,
      });
      const cadastro = await rh
        .from("cliente_cadastro_operacional_sn")
        .update({ observacoes_gerais: "alterado pelo RH" })
        .eq("cliente_id", clienteSnId)
        .select();

      expect(contato.error).not.toBeNull();
      expect(cadastro.data ?? []).toEqual([]);
    }
    const gravados = await servico
      .from("cliente_contatos")
      .select("id")
      .eq("cliente_id", clienteSnId);
    expect(gravados.data).toEqual([]);
    await servico
      .from("cliente_responsaveis")
      .delete()
      .eq("cliente_id", clienteSnId)
      .eq("setor", "rh");
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

  it("a carteira vem inteira mesmo quando o servidor devolve menos do que a página pedida", async () => {
    const lider = await comoLiderRH();
    const inteira = await new SupabaseCarteiraDoSetorGateway(lider).listar("rh");
    // Páginas pedidas de 1000 e `max_rows` simulado em 1: o corte não pode passar por "última página".
    const comMaxRows1 = {
      from: (tabela: string) => ({
        select: (colunas: string) => {
          const q = lider.from(tabela).select(colunas);
          const range = q.range.bind(q);
          q.range = (de: number) => range(de, de);
          return q;
        },
      }),
    } as unknown as typeof lider;
    const r = await new SupabaseCarteiraDoSetorGateway(comMaxRows1).listar("rh");

    expect(r.ok && inteira.ok && r.value).toEqual(inteira.ok && inteira.value);
  });

  it("a carteira falha em vez de girar sem fim quando o servidor ignora o range", async () => {
    const lider = await comoLiderRH();
    const ignoraRange = {
      from: (tabela: string) => ({
        select: (colunas: string) => {
          const q = lider.from(tabela).select(colunas);
          const range = q.range.bind(q);
          q.range = () => range(0, 0);
          return q;
        },
      }),
    } as unknown as typeof lider;

    const r = await new SupabaseCarteiraDoSetorGateway(ignoraRange).listar("rh");

    expect(r.ok).toBe(false);
  });

  it("a carteira falha em vez de ler sem limite quando passa do teto de páginas", async () => {
    const lider = await comoLiderRH();

    const r = await new SupabaseCarteiraDoSetorGateway(lider, 0).listar("rh");

    expect(r.ok).toBe(false);
  });

  it("a carteira que cabe exatamente no teto de páginas é lida inteira", async () => {
    const lider = await comoLiderRH();

    const r = await new SupabaseCarteiraDoSetorGateway(lider, 1).listar("rh");

    expect(r.ok).toBe(true);
  });

  it("o Funcionário do RH atribuído lê o seu vínculo e não o do colega", async () => {
    const lider = await comoLiderRH();
    const atribuido = await lider.from("cliente_responsaveis").insert({
      cliente_id: clientePresumidoId,
      setor: "rh",
      responsavel_id: FUNCIONARIO_RH_ID,
    });
    expect(atribuido.error).toBeNull();

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
