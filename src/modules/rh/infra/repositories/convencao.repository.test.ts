/**
 * Integração infra ↔ Supabase: Convenção coletiva do RH. RLS (sobe só o Líder do RH e o Admin; leem também o
 * Responsável do Cliente; o resto não vê), regras versionadas com formato garantido, a convenção nunca é
 * alterada nem apagada, interruptores e ponteiro do empregado só do Responsável, auditoria na mesma transação
 * e bucket privado. Requer `npx supabase start` com migrations + seed aplicados.
 */
import { createClient } from "@supabase/supabase-js";

import type { RegrasDaConvencao } from "@/shared/kernel/regras-da-convencao";

import { removerClientesDeTeste } from "../../../../../test-support/clientes-de-teste";
import { SupabaseArmazenamentoDeConvencaoGateway } from "../gateways/supabase-armazenamento-de-convencao.gateway";
import { SupabaseConvencaoRepository } from "./convencao.repository";
import { SupabaseFolhaDePontoRepository } from "./folha-de-ponto.repository";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const CNPJ_A = "11444777009831";
const CNPJ_B = "11444777009832";
const FUNCIONARIO_RH_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const FUNCIONARIO2_RH_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
const JORNADA = [0, 525, 525, 525, 525, 525, 240];
const REGRAS: RegrasDaConvencao = {
  versao: 1,
  aplicadas: [
    {
      chave: "extra_sabado",
      valor: 60,
      clausula: "Cláusula 12ª",
      trecho: "Horas extras aos sábados com adicional de 60%.",
    },
  ],
  rejeitadas: [{ chave: "intervalo_maximo", motivo: "fora_do_trecho" }],
};

const erros = { registrar: () => undefined };
const servico = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function entrar(email: string, senha: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`Falha ao autenticar ${email}: ${error.message}`);
  return {
    supabase,
    convencoes: new SupabaseConvencaoRepository(supabase, erros),
    folha: new SupabaseFolhaDePontoRepository(supabase, erros),
  };
}
const comoFuncionarioRH = () => entrar("funcionario.rh@rigonicontabil.local", "func123");
const comoFuncionario2RH = () => entrar("funcionario2.rh@rigonicontabil.local", "func123");
const comoLiderRH = () => entrar("lider.rh@rigonicontabil.local", "lider123");
const comoAdmin = () => entrar("admin@rigonicontabil.local", "admin123");
const comoFuncionarioSN = () => entrar("funcionario.sn@rigonicontabil.local", "func123");

let clienteA: string;
let clienteB: string;

const nova = (sindicato: string, inicio: string, fim: string, cliente = clienteA) => ({
  clienteId: cliente,
  sindicato,
  vigenciaInicio: inicio,
  vigenciaFim: fim,
  arquivoCaminho: `${cliente}/${crypto.randomUUID()}.pdf`,
  arquivoNome: "cct.pdf",
  regras: REGRAS,
});

const auditorias = async (acao: string) =>
  (
    await servico
      .from("registros_auditoria")
      .select("ator, setor, alvo")
      .eq("acao", acao)
      .like("alvo", `${CNPJ_A}%`)
  ).data ?? [];

beforeAll(async () => {
  await removerClientesDeTeste([CNPJ_A, CNPJ_B]);
  clienteA = crypto.randomUUID();
  clienteB = crypto.randomUUID();
  const clientes = await servico.from("clientes").insert([
    { id: clienteA, empresa: "Convenção A Ltda", cnpj: CNPJ_A, regime: "lucro_presumido" },
    { id: clienteB, empresa: "Convenção B Ltda", cnpj: CNPJ_B, regime: "lucro_presumido" },
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
  await servico.from("rh_convencoes").delete().in("cliente_id", [clienteA, clienteB]);
  await servico.from("rh_cliente_interruptores").delete().in("cliente_id", [clienteA, clienteB]);
  await servico.from("registros_auditoria").delete().like("alvo", `${CNPJ_A}%`);
});

describe("Convenção coletiva do RH (integração)", () => {
  it("o Líder do RH sobe, renova e lista o histórico (vigência mais recente primeiro), com auditoria", async () => {
    const { convencoes } = await comoLiderRH();

    const antiga = await convencoes.inserir(nova("Comércio", "2025-05-01", "2026-04-30"));
    const atual = await convencoes.inserir(nova("Comércio", "2026-05-01", "2027-04-30"));
    const lista = await convencoes.listar(clienteA);

    expect(antiga.ok && atual.ok).toBe(true);
    expect(lista.ok && lista.value.map((c) => c.vigenciaInicio)).toEqual([
      "2026-05-01",
      "2025-05-01",
    ]);
    expect(lista.ok && lista.value[0]).toMatchObject({
      sindicato: "Comércio",
      vigenciaFim: "2027-04-30",
      arquivoNome: "cct.pdf",
      regras: REGRAS,
    });
    const audit = await auditorias("rh.convencao.enviar");
    expect(audit).toHaveLength(2);
    expect(audit[0]).toMatchObject({ setor: "rh", alvo: expect.stringContaining(CNPJ_A) });
  });

  it("o Admin também sobe, e um Cliente pode ter mais de uma convenção", async () => {
    const { convencoes } = await comoAdmin();

    const a = await convencoes.inserir(nova("Comércio", "2026-05-01", "2027-04-30"));
    const b = await convencoes.inserir(nova("Escritórios", "2026-03-01", "2027-02-28"));
    const lista = await convencoes.listar(clienteA);

    expect(a.ok && b.ok).toBe(true);
    expect(lista.ok && lista.value.map((c) => c.sindicato).sort()).toEqual([
      "Comércio",
      "Escritórios",
    ]);
  });

  it("o Responsável do RH do Cliente lê, mas não sobe; o de outro Cliente e o do SN não veem", async () => {
    const { convencoes: lider } = await comoLiderRH();
    await lider.inserir(nova("Comércio", "2026-05-01", "2027-04-30"));

    const { convencoes: responsavel } = await comoFuncionarioRH();
    const { convencoes: outro } = await comoFuncionario2RH();
    const { convencoes: sn } = await comoFuncionarioSN();
    const leu = await responsavel.listar(clienteA);
    const subiu = await responsavel.inserir(nova("Outro", "2026-05-01", "2027-04-30"));

    expect(leu.ok && leu.value).toHaveLength(1);
    expect(!subiu.ok && subiu.error.code).toBe("FORBIDDEN");
    const doOutro = await outro.listar(clienteA);
    const doSn = await sn.listar(clienteA);
    expect(doOutro.ok && doOutro.value).toEqual([]);
    expect(doSn.ok && doSn.value).toEqual([]);
  });

  it("recusa regras fora do formato e vigência invertida", async () => {
    const { supabase } = await comoLiderRH();
    const { convencoes } = await comoLiderRH();

    const semForma = await supabase.from("rh_convencoes").insert({
      cliente_id: clienteA,
      sindicato: "X",
      vigencia_inicio: "2026-05-01",
      vigencia_fim: "2027-04-30",
      arquivo_caminho: "x.pdf",
      arquivo_nome: "x.pdf",
      regras: { versao: 1 },
    });
    const invertida = await convencoes.inserir(nova("X", "2027-05-01", "2026-04-30"));

    expect(semForma.error?.code).toBe("23514");
    expect(!invertida.ok && invertida.error.code).toBe("VALIDATION_ERROR");
  });

  it("a convenção nunca é alterada nem apagada pelo usuário", async () => {
    const { supabase, convencoes } = await comoLiderRH();
    await convencoes.inserir(nova("Comércio", "2026-05-01", "2027-04-30"));

    const altera = await supabase
      .from("rh_convencoes")
      .update({ sindicato: "Outro" })
      .eq("cliente_id", clienteA)
      .select("id");
    const apaga = await supabase
      .from("rh_convencoes")
      .delete()
      .eq("cliente_id", clienteA)
      .select("id");

    expect(altera.error?.code).toBe("42501");
    expect(apaga.error?.code).toBe("42501");
    const lista = await convencoes.listar(clienteA);
    expect(lista.ok && lista.value[0]?.sindicato).toBe("Comércio");
  });

  it("o anon não lê nem grava", async () => {
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const leu = await anon.from("rh_convencoes").select("id");
    const interruptores = await anon.from("rh_cliente_interruptores").select("cliente_id");

    expect(leu.error?.code).toBe("42501");
    expect(interruptores.error?.code).toBe("42501");
  });
});

describe("Interruptores e ponteiro do empregado (integração)", () => {
  it("nascem desligados; o Responsável os liga, com auditoria; o Líder só lê", async () => {
    const { folha } = await comoFuncionarioRH();
    const { folha: lider } = await comoLiderRH();

    const inicial = await folha.buscarInterruptores(clienteA);
    const ligou = await folha.definirInterruptores(clienteA, {
      bancoDeHoras: true,
      trabalhoAosDomingos: false,
    });
    const lido = await lider.buscarInterruptores(clienteA);
    const liderGrava = await lider.definirInterruptores(clienteA, {
      bancoDeHoras: false,
      trabalhoAosDomingos: true,
    });

    expect(inicial.ok && inicial.value).toEqual({
      bancoDeHoras: false,
      trabalhoAosDomingos: false,
    });
    expect(ligou.ok).toBe(true);
    expect(lido.ok && lido.value).toEqual({ bancoDeHoras: true, trabalhoAosDomingos: false });
    expect(!liderGrava.ok && liderGrava.error.code).toBe("FORBIDDEN");
    const audit = await auditorias("rh.cliente.interruptores");
    expect(audit).toHaveLength(1);
    expect(audit[0].alvo).toBe(`${CNPJ_A} banco=sim domingos=nao`);
  });

  it("o empregado aponta só para o sindicato de uma convenção que o Cliente tem; nulo sempre vale", async () => {
    const { convencoes: lider } = await comoLiderRH();
    await lider.inserir(nova("Comércio", "2026-05-01", "2027-04-30"));
    const { folha } = await comoFuncionarioRH();
    await folha.cadastrarEmpregado(clienteA, {
      nome: "Ana",
      jornada: JORNADA,
      comissionado: false,
    });
    const quadro = await folha.listarEmpregados(clienteA);
    const id = quadro.ok ? quadro.value[0].id : "";

    const inexistente = await folha.definirConvencaoDoEmpregado(id, "Escritórios");
    const existente = await folha.definirConvencaoDoEmpregado(id, "Comércio");
    const ponteiros = await folha.listarConvencaoDosEmpregados(clienteA);
    const limpou = await folha.definirConvencaoDoEmpregado(id, null);

    expect(!inexistente.ok && inexistente.error.code).toBe("VALIDATION_ERROR");
    expect(existente.ok).toBe(true);
    expect(ponteiros.ok && ponteiros.value).toEqual([{ empregadoId: id, sindicato: "Comércio" }]);
    expect(limpou.ok).toBe(true);
  });

  it("quem não é o Responsável não muda o ponteiro", async () => {
    const { folha } = await comoFuncionarioRH();
    await folha.cadastrarEmpregado(clienteA, {
      nome: "Ana",
      jornada: JORNADA,
      comissionado: false,
    });
    const quadro = await folha.listarEmpregados(clienteA);
    const id = quadro.ok ? quadro.value[0].id : "";

    const { folha: outro } = await comoFuncionario2RH();
    const r = await outro.definirConvencaoDoEmpregado(id, null);

    expect(r.ok).toBe(false);
  });
});

describe("Armazenamento da convenção (integração)", () => {
  it("o Líder guarda e remove o PDF solto", async () => {
    const { supabase } = await comoLiderRH();
    const gateway = new SupabaseArmazenamentoDeConvencaoGateway(supabase);
    const caminho = `${clienteA}/${crypto.randomUUID()}.pdf`;
    const pdf = Uint8Array.from(Buffer.from("%PDF-1.7 teste"));

    const enviou = await gateway.enviar(caminho, pdf);
    const removeu = await gateway.remover(caminho);

    expect(enviou.ok).toBe(true);
    expect(removeu.ok).toBe(true);
  });

  it("o Funcionário do RH não sobe PDF, e o PDF de uma convenção gravada não se remove", async () => {
    const pdf = Uint8Array.from(Buffer.from("%PDF-1.7 teste"));
    const { supabase: func } = await comoFuncionarioRH();
    const subiu = await new SupabaseArmazenamentoDeConvencaoGateway(func).enviar(
      `${clienteA}/${crypto.randomUUID()}.pdf`,
      pdf,
    );

    const { supabase, convencoes } = await comoLiderRH();
    const gateway = new SupabaseArmazenamentoDeConvencaoGateway(supabase);
    const dados = nova("Comércio", "2026-05-01", "2027-04-30");
    await gateway.enviar(dados.arquivoCaminho, pdf);
    await convencoes.inserir(dados);
    const removeu = await gateway.remover(dados.arquivoCaminho);
    const lista = await supabase.storage.from("convencoes-coletivas").list(clienteA);
    const baixa = await supabase.storage
      .from("convencoes-coletivas")
      .download(dados.arquivoCaminho);
    const aindaLa = await servico.storage.from("convencoes-coletivas").list(clienteA);

    expect(subiu.ok).toBe(false);
    expect(removeu.ok).toBe(false);
    expect(lista.data ?? []).toEqual([]);
    expect(baixa.error).not.toBeNull();
    expect(aindaLa.data?.map((o) => `${clienteA}/${o.name}`)).toContain(dados.arquivoCaminho);
    await servico.storage.from("convencoes-coletivas").remove([dados.arquivoCaminho]);
  });

  it("recusa o que não é PDF no bucket", async () => {
    const r = await servico.storage
      .from("convencoes-coletivas")
      .upload(`${clienteA}/${crypto.randomUUID()}.txt`, Buffer.from("oi"), {
        contentType: "text/plain",
      });

    expect(r.error).not.toBeNull();
  });
});
