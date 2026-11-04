/**
 * Integração infra ↔ Supabase: acompanhamento mensal do RH. RLS por setor (o Funcionário marca só
 * os seus clientes; Líder e Admin leem todos), serviço desativado que preserva os meses anteriores, Holerite
 * do sistema e auditoria na mesma transação. Requer `npx supabase start` com migrations + seed aplicados.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { removerClientesDeTeste } from "../../../../../test-support/clientes-de-teste";
import { primeiroDiaDoMesAtual } from "@/shared/kernel/mes-atual";
import { SupabaseAcompanhamentoRepository } from "./acompanhamento.repository";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const CNPJ_A = "11444777009811";
const CNPJ_B = "11444777009812";
const FUNCIONARIO_RH_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const FUNCIONARIO2_RH_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
const PREFIXO = "Teste214 ";

const erros = { registrar: () => undefined };
const servico = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function entrar(email: string, senha: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`Falha ao autenticar ${email}: ${error.message}`);
  return { supabase, repo: new SupabaseAcompanhamentoRepository(supabase, erros) };
}
const comoLiderRH = () => entrar("lider.rh@rigonicontabil.local", "lider123");
const comoFuncionarioRH = () => entrar("funcionario.rh@rigonicontabil.local", "func123");
const comoFuncionario2RH = () => entrar("funcionario2.rh@rigonicontabil.local", "func123");
const comoAdmin = () => entrar("admin@rigonicontabil.local", "admin123");
const comoFuncionarioSN = () => entrar("funcionario.sn@rigonicontabil.local", "func123");

let clienteA: string;
let clienteB: string;
let fgts: string;
let holerite: string;
const MES = primeiroDiaDoMesAtual();

async function apagarServicosDeTeste() {
  await servico.from("rh_servicos_acompanhamento").delete().like("nome", `${PREFIXO}%`);
}

const auditorias = async (acao: string, alvoLike: string) =>
  (await servico.from("registros_auditoria").select("ator, setor").eq("acao", acao).like("alvo", alvoLike)).data ?? [];

beforeAll(async () => {
  await removerClientesDeTeste([CNPJ_A, CNPJ_B]);
  await apagarServicosDeTeste();
  clienteA = crypto.randomUUID();
  clienteB = crypto.randomUUID();
  const clientes = await servico.from("clientes").insert([
    { id: clienteA, empresa: "Acomp A Ltda", cnpj: CNPJ_A, regime: "lucro_presumido" },
    { id: clienteB, empresa: "Acomp B Ltda", cnpj: CNPJ_B, regime: "lucro_presumido" },
  ]);
  if (clientes.error) throw clientes.error;
  const resp = await servico.from("cliente_responsaveis").insert([
    { cliente_id: clienteA, setor: "rh", responsavel_id: FUNCIONARIO_RH_ID },
    { cliente_id: clienteB, setor: "rh", responsavel_id: FUNCIONARIO2_RH_ID },
  ]);
  if (resp.error) throw resp.error;
  const servicos = await servico
    .from("rh_servicos_acompanhamento")
    .select("id, nome")
    .in("nome", ["FGTS", "Holerite"]);
  fgts = servicos.data!.find((s) => s.nome === "FGTS")!.id;
  holerite = servicos.data!.find((s) => s.nome === "Holerite")!.id;
});

afterAll(async () => {
  await removerClientesDeTeste([CNPJ_A, CNPJ_B]);
  await apagarServicosDeTeste();
  await servico.from("registros_auditoria").delete().like("alvo", `${PREFIXO}%`);
});

afterEach(async () => {
  await servico.from("rh_acompanhamento_marcacoes").delete().in("cliente_id", [clienteA, clienteB]);
  await servico.from("rh_cliente_servico_aplica").delete().in("cliente_id", [clienteA, clienteB]);
});

describe("Acompanhamento mensal do RH (integração)", () => {
  it("o mês começa pendente e traz os serviços de partida, o Holerite por último", async () => {
    const { repo } = await comoFuncionarioRH();

    const servicos = await repo.listarServicos(MES);
    const clientes = await repo.listarClientes(MES, FUNCIONARIO_RH_ID);

    expect(servicos.ok && servicos.value.slice(0, 6).map((s) => s.nome)).toEqual([
      "FGTS",
      "DCTFWeb",
      "NUTRI",
      "SIB",
      "Sindicato",
      "Holerite",
    ]);
    expect(servicos.ok && servicos.value[5].sistema).toBe(true);
    expect(clientes.ok && clientes.value.map((c) => [c.cnpj, c.concluidos, c.naoAplica])).toEqual([
      [CNPJ_A, [], []],
    ]);
  });

  it("o Funcionário marca e desmarca no seu cliente, com auditoria", async () => {
    const { repo } = await comoFuncionarioRH();

    const marcou = await repo.marcar(clienteA, fgts, MES, true, FUNCIONARIO_RH_ID);
    const repetiu = await repo.marcar(clienteA, fgts, MES, true, FUNCIONARIO_RH_ID);
    const depois = await repo.listarClientes(MES, FUNCIONARIO_RH_ID);
    const desmarcou = await repo.marcar(clienteA, fgts, MES, false, FUNCIONARIO_RH_ID);
    const fim = await repo.listarClientes(MES, FUNCIONARIO_RH_ID);

    expect(marcou.ok && repetiu.ok && desmarcou.ok).toBe(true);
    expect(depois.ok && depois.value[0].concluidos).toEqual([fgts]);
    expect(fim.ok && fim.value[0].concluidos).toEqual([]);
    const mes = MES.slice(0, 7);
    expect(await auditorias("rh.acompanhamento.marcar", `${CNPJ_A} FGTS ${mes}`)).toEqual([
      { ator: FUNCIONARIO_RH_ID, setor: "rh" },
    ]);
    expect(await auditorias("rh.acompanhamento.desmarcar", `${CNPJ_A} FGTS ${mes}`)).toHaveLength(1);
    await servico.from("registros_auditoria").delete().like("alvo", `${CNPJ_A} FGTS%`);
  });

  it("não marca no cliente de outro Responsável, nem como Líder, Admin ou outro setor", async () => {
    for (const entrarComo of [comoFuncionarioRH, comoLiderRH, comoAdmin, comoFuncionarioSN]) {
      const { repo, supabase } = await entrarComo();
      const { data } = await supabase.auth.getUser();

      const r = await repo.marcar(clienteB, fgts, MES, true, data.user!.id);

      expect(r.ok).toBe(false);
    }
    const linhas = await servico.from("rh_acompanhamento_marcacoes").select("*").eq("cliente_id", clienteB);
    expect(linhas.data).toEqual([]);
  });

  it("o Holerite (do sistema) não é marcado à mão, nem mês futuro", async () => {
    const { repo } = await comoFuncionarioRH();
    const proximoMes = new Date(`${MES}T12:00:00Z`);
    proximoMes.setUTCMonth(proximoMes.getUTCMonth() + 1);

    const hol = await repo.marcar(clienteA, holerite, MES, true, FUNCIONARIO_RH_ID);
    const futuro = await repo.marcar(
      clienteA,
      fgts,
      proximoMes.toISOString().slice(0, 10),
      true,
      FUNCIONARIO_RH_ID,
    );

    expect(!hol.ok && hol.error.code).toBe("VALIDATION_ERROR");
    expect(!futuro.ok && futuro.error.code).toBe("VALIDATION_ERROR");
  });

  it("serviço que não se aplica fica registrado, e voltar ao padrão apaga a exceção", async () => {
    const { repo } = await comoFuncionarioRH();

    await repo.definirAplica(clienteA, fgts, false);
    const nao = await repo.listarClientes(MES, FUNCIONARIO_RH_ID);
    await repo.definirAplica(clienteA, fgts, true);
    const sim = await repo.listarClientes(MES, FUNCIONARIO_RH_ID);

    expect(nao.ok && nao.value[0].naoAplica).toEqual([fgts]);
    expect(sim.ok && sim.value[0].naoAplica).toEqual([]);
    expect(await auditorias("rh.acompanhamento.nao-aplicar", `${CNPJ_A} FGTS`)).toHaveLength(1);
    expect(await auditorias("rh.acompanhamento.aplicar", `${CNPJ_A} FGTS`)).toHaveLength(1);
    await servico.from("registros_auditoria").delete().like("alvo", `${CNPJ_A} FGTS%`);
  });

  it("não define 'se aplica' do cliente de outro Responsável nem do Holerite", async () => {
    const { repo } = await comoFuncionarioRH();

    const outro = await repo.definirAplica(clienteB, fgts, false);
    const hol = await repo.definirAplica(clienteA, holerite, false);

    expect(outro.ok).toBe(false);
    expect(hol.ok).toBe(false);
  });

  it("o Líder e o Admin leem todos os clientes atribuídos; o Funcionário só os seus", async () => {
    await (await comoFuncionarioRH()).repo.marcar(clienteA, fgts, MES, true, FUNCIONARIO_RH_ID);

    for (const entrarComo of [comoLiderRH, comoAdmin]) {
      const { repo } = await entrarComo();
      const r = await repo.listarClientes(MES, null);
      const meus = r.ok ? r.value.filter((c) => [CNPJ_A, CNPJ_B].includes(c.cnpj)) : [];
      expect(meus.map((c) => c.cnpj)).toEqual([CNPJ_A, CNPJ_B]);
      expect(meus[0].concluidos).toEqual([fgts]);
    }

    const colega = await (await comoFuncionario2RH()).repo.listarClientes(MES, null);
    expect(colega.ok && colega.value.map((c) => c.cnpj)).toEqual([CNPJ_B]);
  });

  it("só o Líder do RH cadastra, renomeia e desativa serviços, com auditoria", async () => {
    const { repo } = await comoLiderRH();
    const nome = `${PREFIXO}eSocial`;

    const criou = await repo.criarServico(nome);
    const duplicou = await repo.criarServico(nome.toUpperCase());
    const { data } = await servico.from("rh_servicos_acompanhamento").select("id").eq("nome", nome).single();
    const renomeou = await repo.renomearServico(data!.id, `${PREFIXO}Folha`);
    const desativou = await repo.desativarServico(data!.id);

    expect(criou.ok && renomeou.ok && desativou.ok).toBe(true);
    expect(!duplicou.ok && duplicou.error.code).toBe("CONFLICT");
    expect(await auditorias("rh.servico.criar", nome)).toHaveLength(1);
    expect(await auditorias("rh.servico.renomear", `${PREFIXO}Folha`)).toHaveLength(1);
    expect(await auditorias("rh.servico.desativar", `${PREFIXO}Folha`)).toHaveLength(1);
  });

  it("Funcionário e Admin não mexem nos serviços; o do sistema nunca muda", async () => {
    const func = await comoFuncionarioRH();
    const admin = await comoAdmin();
    const lider = await comoLiderRH();

    const criarFunc = await func.repo.criarServico(`${PREFIXO}x`);
    const criarAdmin = await admin.repo.criarServico(`${PREFIXO}y`);
    const renomearSistema = await lider.repo.renomearServico(holerite, "Outro");
    const desativarSistema = await lider.repo.desativarServico(holerite);

    expect(criarFunc.ok || criarAdmin.ok || renomearSistema.ok || desativarSistema.ok).toBe(false);
    const hol = await servico.from("rh_servicos_acompanhamento").select("nome, desativado_em").eq("id", holerite).single();
    expect(hol.data).toEqual({ nome: "Holerite", desativado_em: null });
  });

  it("desativar um serviço mantém os meses anteriores e o tira dos seguintes", async () => {
    const { repo } = await comoLiderRH();
    const antigo = await servico
      .from("rh_servicos_acompanhamento")
      .insert({ nome: `${PREFIXO}Antigo`, ativo_desde: "2026-01-01" })
      .select("id")
      .single();
    const id = antigo.data!.id;

    const antes = await repo.listarServicos("2026-03-01");
    await repo.desativarServico(id);
    const mesPassado = await repo.listarServicos("2026-03-01");
    const mesAtualLista = await repo.listarServicos(MES);

    expect(antes.ok && antes.value.some((s) => s.id === id)).toBe(true);
    expect(mesPassado.ok && mesPassado.value.some((s) => s.id === id)).toBe(true);
    expect(mesAtualLista.ok && mesAtualLista.value.some((s) => s.id === id)).toBe(false);
  });

  it("a marcação de um mês passado sobrevive à desativação do serviço", async () => {
    const antigo = await servico
      .from("rh_servicos_acompanhamento")
      .insert({ nome: `${PREFIXO}Historico`, ativo_desde: "2026-01-01" })
      .select("id")
      .single();
    const id = antigo.data!.id;
    const func = await comoFuncionarioRH();
    const lider = await comoLiderRH();

    await func.repo.marcar(clienteA, id, "2026-03-01", true, FUNCIONARIO_RH_ID);
    await lider.repo.desativarServico(id);
    const marcado = await lider.repo.listarClientes("2026-03-01", null);
    const depois = await func.repo.marcar(clienteA, id, MES, true, FUNCIONARIO_RH_ID);

    expect(marcado.ok && marcado.value.find((c) => c.cnpj === CNPJ_A)?.concluidos).toEqual([id]);
    expect(depois.ok).toBe(false);
  });

  it("anon não lê nada das tabelas do acompanhamento", async () => {
    const anon: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    for (const tabela of [
      "rh_servicos_acompanhamento",
      "rh_cliente_servico_aplica",
      "rh_acompanhamento_marcacoes",
    ]) {
      const { error } = await anon.from(tabela).select("*").limit(1);
      expect(error?.code).toBe("42501");
    }
  });
});
