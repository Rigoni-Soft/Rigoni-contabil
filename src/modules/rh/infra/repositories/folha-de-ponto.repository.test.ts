/**
 * Integração infra ↔ Supabase: Folha de ponto do RH. RLS por setor (o Funcionário escreve só nos seus
 * clientes; Líder e Admin leem), cartão só de empregado ativo, dado mínimo (só nome, Jornada, batidas, marca e
 * Abono) e auditoria na mesma transação. Requer `npx supabase start` com migrations + seed aplicados.
 */
import { createClient } from "@supabase/supabase-js";

import { removerClientesDeTeste } from "../../../../../test-support/clientes-de-teste";
import { SupabaseFolhaDePontoRepository } from "./folha-de-ponto.repository";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const CNPJ_A = "11444777009821";
const CNPJ_B = "11444777009822";
const FUNCIONARIO_RH_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const FUNCIONARIO2_RH_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
const JORNADA = [0, 525, 525, 525, 525, 525, 240];
const PAR = { entrada: 480, saida: 720 };

const erros = { registrar: () => undefined };
const servico = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function entrar(email: string, senha: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`Falha ao autenticar ${email}: ${error.message}`);
  return { supabase, repo: new SupabaseFolhaDePontoRepository(supabase, erros) };
}
const comoFuncionarioRH = () => entrar("funcionario.rh@rigonicontabil.local", "func123");
const comoLiderRH = () => entrar("lider.rh@rigonicontabil.local", "lider123");
const comoAdmin = () => entrar("admin@rigonicontabil.local", "admin123");
const comoFuncionarioSN = () => entrar("funcionario.sn@rigonicontabil.local", "func123");
const comoFuncionario2RH = () => entrar("funcionario2.rh@rigonicontabil.local", "func123");

let clienteA: string;
let clienteB: string;

const auditorias = async (acao: string, alvoLike: string) =>
  (
    await servico
      .from("registros_auditoria")
      .select("ator, setor")
      .eq("acao", acao)
      .like("alvo", alvoLike)
  ).data ?? [];

async function novoEmpregado(nome: string, cliente = clienteA): Promise<string> {
  const { data, error } = await servico
    .from("rh_empregados")
    .insert({ cliente_id: cliente, nome, jornada: JORNADA })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

beforeAll(async () => {
  await removerClientesDeTeste([CNPJ_A, CNPJ_B]);
  clienteA = crypto.randomUUID();
  clienteB = crypto.randomUUID();
  const clientes = await servico.from("clientes").insert([
    { id: clienteA, empresa: "Ponto A Ltda", cnpj: CNPJ_A, regime: "lucro_presumido" },
    { id: clienteB, empresa: "Ponto B Ltda", cnpj: CNPJ_B, regime: "lucro_presumido" },
  ]);
  if (clientes.error) throw clientes.error;
  const resp = await servico.from("cliente_responsaveis").insert([
    { cliente_id: clienteA, setor: "rh", responsavel_id: FUNCIONARIO_RH_ID },
    { cliente_id: clienteB, setor: "rh", responsavel_id: FUNCIONARIO2_RH_ID },
  ]);
  if (resp.error) throw resp.error;
});

afterAll(async () => {
  await removerClientesDeTeste([CNPJ_A, CNPJ_B]);
  await servico.from("registros_auditoria").delete().like("alvo", `${CNPJ_A}%`);
});

afterEach(async () => {
  await servico.from("rh_empregados").delete().in("cliente_id", [clienteA, clienteB]);
  await servico.from("rh_ponto_padroes").delete().in("cliente_id", [clienteA, clienteB]);
  await servico.from("registros_auditoria").delete().like("alvo", `${CNPJ_A}%`);
});

describe("Folha de ponto do RH (integração)", () => {
  it("o Responsável cadastra, corrige e inativa o empregado, com auditoria", async () => {
    const { repo } = await comoFuncionarioRH();

    const cadastrou = await repo.cadastrarEmpregado(clienteA, {
      nome: "Ana Souza",
      jornada: JORNADA,
      comissionado: false,
    });
    const lista = await repo.listarEmpregados(clienteA);
    const id = lista.ok ? lista.value[0].id : "";
    const corrigiu = await repo.corrigirEmpregado(id, {
      nome: "Ana S. Souza",
      jornada: [0, 480, 480, 480, 480, 480, 0],
      comissionado: true,
    });
    const inativou = await repo.definirAtivo(id, false);
    const fim = await repo.listarEmpregados(clienteA);

    expect(cadastrou.ok && corrigiu.ok && inativou.ok).toBe(true);
    expect(fim.ok && fim.value).toEqual([
      {
        id,
        nome: "Ana S. Souza",
        jornada: [0, 480, 480, 480, 480, 480, 0],
        comissionado: true,
        ativo: false,
      },
    ]);
    for (const acao of ["cadastrar", "corrigir", "inativar"]) {
      expect(await auditorias(`rh.empregado.${acao}`, `${CNPJ_A} Ana%`)).toHaveLength(1);
    }
  });

  it("o banco recusa jornada com elemento nulo", async () => {
    const { error } = await servico
      .from("rh_empregados")
      .insert({ cliente_id: clienteA, nome: "Nula", jornada: [null, 480, 480, 480, 480, 480, 0] });

    expect(error?.code).toBe("23514");
  });

  it("salva o dia do cartão e apaga a linha quando fica vazio", async () => {
    const { repo } = await comoFuncionarioRH();
    const id = await novoEmpregado("Bia");

    const salvou = await repo.salvarDia(id, {
      data: "2026-11-16",
      batidas: [PAR, { entrada: 780, saida: 1065 }],
      extra: { entrada: 1080, saida: 1140 },
      abono: false,
    });
    const abono = await repo.salvarDia(id, {
      data: "2026-11-17",
      batidas: [],
      extra: null,
      abono: true,
    });
    const lido = await repo.listarDias(id, "2026-11-16", "2026-11-30");
    const limpou = await repo.salvarDia(id, {
      data: "2026-11-17",
      batidas: [],
      extra: null,
      abono: false,
    });
    const depois = await repo.listarDias(id, "2026-11-16", "2026-11-30");

    expect(salvou.ok && abono.ok && limpou.ok).toBe(true);
    expect(lido.ok && lido.value).toEqual([
      {
        data: "2026-11-16",
        batidas: [PAR, { entrada: 780, saida: 1065 }],
        extra: { entrada: 1080, saida: 1140 },
        abono: false,
      },
      { data: "2026-11-17", batidas: [], extra: null, abono: true },
    ]);
    expect(depois.ok && depois.value.map((d) => d.data)).toEqual(["2026-11-16"]);
    expect(await auditorias("rh.ponto.salvar", `${CNPJ_A} Bia 2026-11-16`)).toHaveLength(1);
    expect(await auditorias("rh.ponto.limpar", `${CNPJ_A} Bia 2026-11-17`)).toHaveLength(1);
  });

  it("o dia de ponto não troca de empregado nem de data pela Data API (#218)", async () => {
    const { repo, supabase } = await comoFuncionarioRH();
    const ana = await novoEmpregado("Ana");
    const bia = await novoEmpregado("Bia");
    await repo.salvarDia(ana, { data: "2026-11-16", batidas: [PAR], extra: null, abono: false });

    const trocaEmpregado = await supabase
      .from("rh_ponto_dias")
      .update({ empregado_id: bia })
      .eq("empregado_id", ana);
    const trocaData = await supabase
      .from("rh_ponto_dias")
      .update({ data: "2026-11-17" })
      .eq("empregado_id", ana);
    const doBia = await repo.listarDias(bia, "2026-11-01", "2026-11-30");

    expect(trocaEmpregado.error?.message).toContain("rh_ponto_dia_imutavel");
    expect(trocaData.error?.message).toContain("rh_ponto_dia_imutavel");
    expect(doBia.ok && doBia.value).toEqual([]);
  });

  it("o banco recusa horário fora do dia e lista com mais de 4 pares", async () => {
    const id = await novoEmpregado("Caio");
    const fora = await servico.from("rh_ponto_dias").insert({
      empregado_id: id,
      data: "2026-11-16",
      batidas: [{ entrada: 480, saida: 1440 }],
    });
    const muitos = await servico.from("rh_ponto_dias").insert({
      empregado_id: id,
      data: "2026-11-16",
      batidas: Array(5).fill(PAR),
    });
    const extraComCid = await servico.from("rh_ponto_dias").insert({
      empregado_id: id,
      data: "2026-11-16",
      batidas: [{ entrada: 480, saida: 720, cid: "J11" }],
    });
    expect(fora.error?.code).toBe("23514");
    expect(muitos.error?.code).toBe("23514");
    expect(extraComCid.error?.code).toBe("23514");
  });

  it("empregado inativo não recebe cartão", async () => {
    const { repo } = await comoFuncionarioRH();
    const id = await novoEmpregado("Dani");
    await repo.definirAtivo(id, false);
    const r = await repo.salvarDia(id, {
      data: "2026-11-16",
      batidas: [PAR],
      extra: null,
      abono: false,
    });
    expect(r.ok).toBe(false);
  });

  it("cartão iniciado: nasce novo, marca ao salvar (idempotente) e a marca é do mês", async () => {
    const { repo } = await comoFuncionarioRH();
    const id = await novoEmpregado("Hugo");
    const antes = await repo.cartaoIniciado(id, "2026-11-01");
    const marcou = await repo.iniciarCartao(id, "2026-11-01");
    const repetiu = await repo.iniciarCartao(id, "2026-11-01");
    const depois = await repo.cartaoIniciado(id, "2026-11-01");
    const outroMes = await repo.cartaoIniciado(id, "2026-10-01");

    expect(antes.ok && antes.value).toBe(false);
    expect([marcou.ok, repetiu.ok]).toEqual([true, true]);
    expect(depois.ok && depois.value).toBe(true);
    expect(outroMes.ok && outroMes.value).toBe(false);
    // Só uma marca e uma auditoria (a repetição não escreve de novo).
    expect(await auditorias("rh.ponto.iniciar-cartao", `${CNPJ_A} Hugo 2026-11`)).toHaveLength(1);
  });

  it("cartão iniciado: o Líder lê mas não marca; empregado inativo não ganha marca", async () => {
    const { repo: dono } = await comoFuncionarioRH();
    const id = await novoEmpregado("Iara");
    await dono.iniciarCartao(id, "2026-11-01");
    const { repo: lider } = await comoLiderRH();

    const lido = await lider.cartaoIniciado(id, "2026-11-01");
    const marcou = await lider.iniciarCartao(id, "2026-10-01");

    expect(lido.ok && lido.value).toBe(true);
    expect(marcou.ok).toBe(false);

    const inativo = await novoEmpregado("Jonas");
    await servico.from("rh_empregados").update({ ativo: false }).eq("id", inativo);
    expect((await dono.iniciarCartao(inativo, "2026-11-01")).ok).toBe(false);
  });

  it("gravarCartao: marca o cartão e grava os dias numa chamada só, com auditoria, e é idempotente", async () => {
    const { repo } = await comoFuncionarioRH();
    const id = await novoEmpregado("Kelly");
    const dias = [
      { data: "2026-11-02", batidas: [PAR], extra: null, abono: false },
      { data: "2026-11-03", batidas: [], extra: null, abono: true },
    ];

    const gravou = await repo.gravarCartao(id, "2026-11-01", dias);
    const repetiu = await repo.gravarCartao(id, "2026-11-01", dias);

    expect([gravou.ok, repetiu.ok]).toEqual([true, true]);
    const iniciado = await repo.cartaoIniciado(id, "2026-11-01");
    expect(iniciado.ok && iniciado.value).toBe(true);
    const lidos = await repo.listarDias(id, "2026-11-01", "2026-11-30");
    expect(lidos.ok && lidos.value).toEqual(dias);
    expect(await auditorias("rh.ponto.iniciar-cartao", `${CNPJ_A} Kelly 2026-11`)).toHaveLength(1);
  });

  it("gravarCartao: o dia que o banco recusa desfaz a quinzena inteira, sem cartão parcial nem marca", async () => {
    const { repo } = await comoFuncionarioRH();
    const id = await novoEmpregado("Lucas");

    const falhou = await repo.gravarCartao(id, "2026-11-01", [
      { data: "2026-11-02", batidas: [PAR], extra: null, abono: false },
      // Saída fora do dia: o CHECK recusa e a transação volta atrás.
      { data: "2026-11-03", batidas: [{ entrada: 480, saida: 2000 }], extra: null, abono: false },
    ]);

    expect(falhou.ok).toBe(false);
    const lidos = await repo.listarDias(id, "2026-11-01", "2026-11-30");
    expect(lidos.ok && lidos.value).toEqual([]);
    const iniciado = await repo.cartaoIniciado(id, "2026-11-01");
    expect(iniciado.ok && iniciado.value).toBe(false);
  });

  it("gravarCartao: só o Responsável grava; o Líder e o empregado inativo são recusados sem deixar nada", async () => {
    const id = await novoEmpregado("Marta");
    const dias = [{ data: "2026-11-02", batidas: [PAR], extra: null, abono: false }];
    const { repo: lider } = await comoLiderRH();

    expect((await lider.gravarCartao(id, "2026-11-01", dias)).ok).toBe(false);

    const inativo = await novoEmpregado("Nilo");
    await servico.from("rh_empregados").update({ ativo: false }).eq("id", inativo);
    const { repo: dono } = await comoFuncionarioRH();
    expect((await dono.gravarCartao(inativo, "2026-11-01", dias)).ok).toBe(false);

    const { data } = await servico
      .from("rh_ponto_dias")
      .select("data")
      .in("empregado_id", [id, inativo]);
    expect(data).toEqual([]);
  });

  it("ler o cartão depois do atestado: o abono do atestado sobrevive ao preenchimento", async () => {
    const { repo } = await comoFuncionarioRH();
    const id = await novoEmpregado("Olga");
    await repo.gravarCartao(id, "2026-11-01", [
      { data: "2026-11-02", batidas: [], extra: null, abono: true },
    ]);

    // O que a leitura faz: lista o que existe e grava só os dias que ainda não têm dado.
    const existentes = await repo.listarDias(id, "2026-11-02", "2026-11-03");
    const comDado = new Set(existentes.ok ? existentes.value.map((d) => d.data) : []);
    const lidos = [
      { data: "2026-11-02", batidas: [PAR], extra: null, abono: false },
      { data: "2026-11-03", batidas: [PAR], extra: null, abono: false },
    ];
    await repo.gravarCartao(
      id,
      "2026-11-01",
      lidos.filter((d) => !comDado.has(d.data)),
    );

    const depois = await repo.listarDias(id, "2026-11-01", "2026-11-30");
    expect(depois.ok && depois.value).toEqual([
      { data: "2026-11-02", batidas: [], extra: null, abono: true },
      { data: "2026-11-03", batidas: [PAR], extra: null, abono: false },
    ]);
  });

  it("gravarCartao: dia que o RH preencheu depois da leitura não é sobrescrito nem apagado", async () => {
    const { repo } = await comoFuncionarioRH();
    const id = await novoEmpregado("Paulo");
    const digitado = { data: "2026-11-02", batidas: [PAR], extra: null, abono: false };
    await repo.salvarDia(id, digitado);

    // A leitura listou o dia como vazio, o RH digitou na janela, e a gravação chega depois.
    const gravou = await repo.gravarCartao(id, "2026-11-01", [
      { data: "2026-11-02", batidas: [], extra: null, abono: true },
      { data: "2026-11-03", batidas: [PAR], extra: null, abono: false },
      { data: "2026-11-04", batidas: [], extra: null, abono: false },
    ]);

    expect(gravou.ok).toBe(true);
    const lidos = await repo.listarDias(id, "2026-11-01", "2026-11-30");
    expect(lidos.ok && lidos.value).toEqual([
      digitado,
      { data: "2026-11-03", batidas: [PAR], extra: null, abono: false },
    ]);
  });

  it("abonarDias: abona em lote, preserva batida e Extra, e não inicia o cartão", async () => {
    const { repo } = await comoFuncionarioRH();
    const id = await novoEmpregado("Quirino");
    await repo.salvarDia(id, { data: "2026-11-03", batidas: [PAR], extra: null, abono: false });

    const abonou = await repo.abonarDias(id, ["2026-11-02", "2026-11-03"]);
    const repetiu = await repo.abonarDias(id, ["2026-11-02"]);

    expect([abonou.ok, repetiu.ok]).toEqual([true, true]);
    const lidos = await repo.listarDias(id, "2026-11-01", "2026-11-30");
    expect(lidos.ok && lidos.value).toEqual([
      { data: "2026-11-02", batidas: [], extra: null, abono: true },
      { data: "2026-11-03", batidas: [PAR], extra: null, abono: true },
    ]);
    const iniciado = await repo.cartaoIniciado(id, "2026-11-01");
    expect(iniciado.ok && iniciado.value).toBe(false);
  });

  it("abonarDias: a data inválida desfaz o lote inteiro", async () => {
    const { repo } = await comoFuncionarioRH();
    const id = await novoEmpregado("Renato");

    const falhou = await repo.abonarDias(id, ["2026-11-02", "2026-13-45"]);

    expect(falhou.ok).toBe(false);
    const lidos = await repo.listarDias(id, "2026-11-01", "2026-11-30");
    expect(lidos.ok && lidos.value).toEqual([]);
  });

  it("abonarDias: o Líder e o empregado inativo são recusados sem deixar nada", async () => {
    const id = await novoEmpregado("Sonia");
    const { repo: lider } = await comoLiderRH();
    expect((await lider.abonarDias(id, ["2026-11-02"])).ok).toBe(false);

    const inativo = await novoEmpregado("Tiago");
    await servico.from("rh_empregados").update({ ativo: false }).eq("id", inativo);
    const { repo: dono } = await comoFuncionarioRH();
    expect((await dono.abonarDias(inativo, ["2026-11-02"])).ok).toBe(false);

    const { data } = await servico
      .from("rh_ponto_dias")
      .select("data")
      .in("empregado_id", [id, inativo]);
    expect(data).toEqual([]);
  });

  it("sem movimento no mês: marca, lê e desmarca", async () => {
    const { repo } = await comoFuncionarioRH();
    const id = await novoEmpregado("Edu");
    const marcou = await repo.definirSemMovimento(id, "2026-11-01", true);
    const repetiu = await repo.definirSemMovimento(id, "2026-11-01", true);
    const lido = await repo.listarSemMovimento(clienteA, "2026-11-01");
    const outroMes = await repo.listarSemMovimento(clienteA, "2026-10-01");
    await repo.definirSemMovimento(id, "2026-11-01", false);
    const fim = await repo.listarSemMovimento(clienteA, "2026-11-01");

    expect([marcou, repetiu]).toEqual([
      expect.objectContaining({ ok: true }),
      expect.objectContaining({ ok: true }),
    ]);
    expect(lido.ok && lido.value).toEqual([id]);
    expect(outroMes.ok && outroMes.value).toEqual([]);
    expect(fim.ok && fim.value).toEqual([]);
    expect(await auditorias("rh.ponto.sem-movimento", `${CNPJ_A} Edu 2026-11`)).toHaveLength(1);
    expect(await auditorias("rh.ponto.com-movimento", `${CNPJ_A} Edu 2026-11`)).toHaveLength(1);
  });

  it("o padrão de comissionados do Cliente é gravado e lido", async () => {
    const { repo } = await comoFuncionarioRH();
    const antes = await repo.buscarPadraoComissionados(clienteA);
    const liga = await repo.definirPadraoComissionados(clienteA, true);
    const depois = await repo.buscarPadraoComissionados(clienteA);
    expect(antes.ok && antes.value).toBe(false);
    expect(liga.ok && depois.ok && depois.value).toBe(true);
  });

  it("o Líder, o Admin e o Responsável leem; só o Responsável escreve", async () => {
    const id = await novoEmpregado("Fabi");
    await servico
      .from("rh_ponto_dias")
      .insert({ empregado_id: id, data: "2026-11-16", batidas: [PAR] });

    for (const entrarComo of [comoLiderRH, comoAdmin, comoFuncionarioRH]) {
      const { repo } = await entrarComo();
      const lista = await repo.listarEmpregados(clienteA);
      const dias = await repo.listarDias(id, "2026-11-01", "2026-11-30");
      expect(lista.ok && lista.value.map((e) => e.nome)).toEqual(["Fabi"]);
      expect(dias.ok && dias.value).toHaveLength(1);
    }

    for (const entrarComo of [comoLiderRH, comoAdmin, comoFuncionario2RH, comoFuncionarioSN]) {
      const { repo } = await entrarComo();
      const dia = { data: "2026-11-17", batidas: [PAR], extra: null, abono: false };
      expect(
        (
          await repo.cadastrarEmpregado(clienteA, {
            nome: "X",
            jornada: JORNADA,
            comissionado: false,
          })
        ).ok,
      ).toBe(false);
      expect((await repo.salvarDia(id, dia)).ok).toBe(false);
      expect(
        (await repo.corrigirEmpregado(id, { nome: "Y", jornada: JORNADA, comissionado: false })).ok,
      ).toBe(false);
      expect((await repo.definirAtivo(id, false)).ok).toBe(false);
      expect((await repo.definirSemMovimento(id, "2026-11-01", true)).ok).toBe(false);
      expect((await repo.definirPadraoComissionados(clienteA, true)).ok).toBe(false);
    }
    const intacto = await servico.from("rh_empregados").select("nome, ativo").eq("id", id).single();
    expect(intacto.data).toEqual({ nome: "Fabi", ativo: true });
  });

  it("o outro Funcionário do RH e o do SN não enxergam o quadro do Cliente", async () => {
    await novoEmpregado("Gabi");
    for (const entrarComo of [comoFuncionario2RH, comoFuncionarioSN]) {
      const { repo } = await entrarComo();
      const lista = await repo.listarEmpregados(clienteA);
      expect(lista.ok && lista.value).toEqual([]);
    }
  });

  it("busca um empregado do Cliente; outro Cliente, id inexistente e fora da vista dão null", async () => {
    await novoEmpregado("Hugo");
    const { repo } = await comoLiderRH();
    const lista = await repo.listarEmpregados(clienteA);
    const id = lista.ok ? lista.value[0].id : "";

    const achado = await repo.buscarEmpregado(clienteA, id);
    const outroCliente = await repo.buscarEmpregado("00000000-0000-4000-8000-000000000000", id);
    const foraDaVista = await (await comoFuncionarioSN()).repo.buscarEmpregado(clienteA, id);

    expect(achado.ok && achado.value?.nome).toBe("Hugo");
    expect(outroCliente.ok && outroCliente.value).toBeNull();
    expect(foraDaVista.ok && foraDaVista.value).toBeNull();
  });

  it("o RH lê os feriados; o SN não", async () => {
    await servico.from("feriados").upsert({ data: "2026-11-20", descricao: "Teste218" });
    try {
      const rh = await (await comoFuncionarioRH()).repo.listarFeriados("2026-11-01", "2026-11-30");
      const sn = await (await comoFuncionarioSN()).repo.listarFeriados("2026-11-01", "2026-11-30");
      expect(rh.ok && rh.value).toContain("2026-11-20");
      expect(sn.ok && sn.value).toEqual([]);
    } finally {
      await servico.from("feriados").delete().eq("descricao", "Teste218");
    }
  });
});
