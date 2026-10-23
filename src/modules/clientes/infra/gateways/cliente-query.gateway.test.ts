/**
 * Integração infra ↔ Supabase (testes.md, seção 3) para o read model do cadastro operacional.
 * Requer `npx supabase start` local com migrations + seed aplicados.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { Cliente } from "@/modules/clientes/domain/entities/cliente.entity";
import { SupabaseClienteRepository } from "@/modules/clientes/infra/repositories/cliente.repository";
import { mesAtual, primeiroDiaDoMesAtual } from "@/shared/kernel/mes-atual";

import { removerClientesDeTeste } from "../../../../../test-support/clientes-de-teste";
import { SupabaseClienteQueryGateway } from "./cliente-query.gateway";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

async function clienteAutenticado(email: string, senha: string): Promise<SupabaseClient> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`Falha ao autenticar ${email}: ${error.message}`);
  return supabase;
}

const comoAdmin = () => clienteAutenticado("admin@rigonicontabil.local", "admin123");
const comoLiderSN = () => clienteAutenticado("lider.sn@rigonicontabil.local", "lider123");
const comoFuncionario2SN = () =>
  clienteAutenticado("funcionario2.sn@rigonicontabil.local", "func123");

const FUNCIONARIO_SN_ID = "22222222-2222-2222-2222-222222222222";

// CNPJ único e válido (timestamp + contador, dígitos verificadores mod 11)
// — evita colisão de unique constraint quando mais de um teste cria cliente.
const PESOS_PRIMEIRO_DIGITO = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_SEGUNDO_DIGITO = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
let contadorCnpj = 0;

function digitoVerificador(base: string, pesos: number[]): string {
  const soma = base
    .split("")
    .reduce((acumulado, digito, indice) => acumulado + Number(digito) * pesos[indice], 0);
  const resto = soma % 11;
  return String(resto < 2 ? 0 : 11 - resto);
}

function cnpjUnico(): string {
  contadorCnpj += 1;
  const raiz = `${Date.now()}`.slice(-8) + String(contadorCnpj).padStart(4, "0");
  const d1 = digitoVerificador(raiz, PESOS_PRIMEIRO_DIGITO);
  const d2 = digitoVerificador(raiz + d1, PESOS_SEGUNDO_DIGITO);
  return raiz + d1 + d2;
}

async function criarClienteComContratoSocial(
  admin: SupabaseClient,
  empresa = "Padaria Pão Quente Ltda",
  cnpj = "11444777000676",
  regime = "simples_nacional",
): Promise<Cliente> {
  const repositorio = new SupabaseClienteRepository(admin);
  const construido = Cliente.builder()
    .comId(crypto.randomUUID())
    .comEmpresa(empresa)
    .comCnpj(cnpj)
    .comRegime(regime)
    .comContratoSocialCaminho("clientes/x/contrato-social/doc.pdf")
    .comAlteracoesContratuais([])
    .build();
  if (!construido.ok) throw new Error("setup inválido");
  const salvo = await repositorio.criar(construido.value);
  if (!salvo.ok) throw new Error("falha ao criar cliente base: " + salvo.error.message);
  return construido.value;
}

// CNPJs fixos desta suíte, reservados para teste: removidos antes e depois (nunca um DELETE amplo).
const CNPJS_DA_SUITE = ["11444777000676"] as const;
beforeAll(() => removerClientesDeTeste(CNPJS_DA_SUITE));
afterAll(() => removerClientesDeTeste(CNPJS_DA_SUITE));

describe("SupabaseClienteQueryGateway (#34, integração)", () => {
  it("devolve o cadastro operacional sem contrato social/alterações, mesmo o cliente tendo contrato social salvo", async () => {
    const admin = await comoAdmin();
    const cliente = await criarClienteComContratoSocial(admin);
    const gateway = new SupabaseClienteQueryGateway(admin);

    const resultado = await gateway.buscarCadastroOperacional(cliente.id);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok || !resultado.value) throw new Error("cliente não encontrado");
    expect(resultado.value.empresa).toBe("Padaria Pão Quente Ltda");
    expect(resultado.value).not.toHaveProperty("contratoSocialCaminho");
    expect(resultado.value).not.toHaveProperty("alteracoesContratuais");
  });

  it("devolve null quando o Cliente não existe", async () => {
    const admin = await comoAdmin();
    const gateway = new SupabaseClienteQueryGateway(admin);

    const resultado = await gateway.buscarCadastroOperacional(crypto.randomUUID());

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value).toBeNull();
  });
});

describe("SupabaseClienteQueryGateway.buscarPorTermo (#35, integração)", () => {
  it("encontra o cliente por um trecho do CNPJ e por um trecho do nome da empresa", async () => {
    const admin = await comoAdmin();
    const cliente = await criarClienteComContratoSocial(
      admin,
      "Padaria Pão Quente Busca Ltda",
      cnpjUnico(),
    );
    const gateway = new SupabaseClienteQueryGateway(admin);

    const porCnpj = await gateway.buscarPorTermo(cliente.cnpj.valor.slice(0, 6), true);
    const porNome = await gateway.buscarPorTermo("Pão Quente", true);

    expect(porCnpj.ok).toBe(true);
    if (porCnpj.ok) expect(porCnpj.value.some((s) => s.id === cliente.id)).toBe(true);

    expect(porNome.ok).toBe(true);
    if (porNome.ok) expect(porNome.value.some((s) => s.id === cliente.id)).toBe(true);
  });

  it("Líder do SN (não-Admin) também encontra o cliente, pela view sem contrato social", async () => {
    const admin = await comoAdmin();
    const cliente = await criarClienteComContratoSocial(
      admin,
      "Padaria Busca Funcionario Ltda",
      cnpjUnico(),
    );
    const gateway = new SupabaseClienteQueryGateway(await comoLiderSN());

    const resultado = await gateway.buscarPorTermo("Busca Funcionario", false);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value.some((s) => s.id === cliente.id)).toBe(true);
  });

  it("devolve lista vazia quando o termo não casa com nenhum cliente", async () => {
    const admin = await comoAdmin();
    const gateway = new SupabaseClienteQueryGateway(admin);

    const resultado = await gateway.buscarPorTermo("termo-sem-match-nenhum-xyz", true);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value).toEqual([]);
  });

  it("trata vírgula no termo como texto literal, sem quebrar a sintaxe do filtro", async () => {
    const admin = await comoAdmin();
    const cliente = await criarClienteComContratoSocial(
      admin,
      "Pão, Quente e Companhia Ltda",
      cnpjUnico(),
    );
    const gateway = new SupabaseClienteQueryGateway(admin);

    const resultado = await gateway.buscarPorTermo("Pão, Quente", true);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value.some((s) => s.id === cliente.id)).toBe(true);
  });

  it("com apenasSnMei=true, nunca traz Cliente de Lucro Presumido/Real — esta é a busca embutida no dashboard do SN, só Simples Nacional/MEI têm cadastro operacional", async () => {
    const admin = await comoAdmin();
    const empresa = "Padaria Busca Presumido Ltda";
    await criarClienteComContratoSocial(admin, empresa, cnpjUnico(), "lucro_presumido");
    const gateway = new SupabaseClienteQueryGateway(admin);

    const resultado = await gateway.buscarPorTermo("Busca Presumido", true);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value).toEqual([]);
  });

  it("encontra Cliente MEI normalmente com apenasSnMei=true", async () => {
    const admin = await comoAdmin();
    const empresa = "Oficina Busca MEI Ltda";
    const cliente = await criarClienteComContratoSocial(admin, empresa, cnpjUnico(), "mei");
    const gateway = new SupabaseClienteQueryGateway(admin);

    const resultado = await gateway.buscarPorTermo("Busca MEI", true);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value.some((s) => s.id === cliente.id)).toBe(true);
  });

  // Admin (ou qualquer busca fora do dashboard do SN) precisa achar Cliente de qualquer Regime.
  it("com apenasSnMei=false, encontra Cliente de Lucro Presumido/Real também", async () => {
    const admin = await comoAdmin();
    const empresa = "Padaria Busca Geral Presumido Ltda";
    const cliente = await criarClienteComContratoSocial(
      admin,
      empresa,
      cnpjUnico(),
      "lucro_presumido",
    );
    const gateway = new SupabaseClienteQueryGateway(admin);

    const resultado = await gateway.buscarPorTermo("Busca Geral Presumido", false);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value.some((s) => s.id === cliente.id)).toBe(true);
  });
});

describe("SupabaseClienteQueryGateway.listarResumoOperacional (#36, integração)", () => {
  it("inclui o cliente recém-criado com os campos operacionais ainda nulos (cadastro automático do #34 sem edição)", async () => {
    const admin = await comoAdmin();
    const empresa = "Padaria Resumo Setor Ltda";
    const cliente = await criarClienteComContratoSocial(admin, empresa, cnpjUnico());
    const gateway = new SupabaseClienteQueryGateway(admin);

    const resultado = await gateway.listarResumoOperacional();

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    const linha = resultado.value.find((l) => l.clienteId === cliente.id);
    expect(linha).toBeDefined();
    expect(linha).toMatchObject({
      empresa,
      documentoObrigatorio: "negativo",
      dasStatus: "pendente",
      parcelamentos: [],
    });
  });

  it("traz os parcelamentos do Cliente com marca interno, quitado e envio do mês corrente", async () => {
    const admin = await comoAdmin();
    const cliente = await criarClienteComContratoSocial(
      admin,
      "Resumo Parcelamentos Ltda",
      cnpjUnico(),
    );
    const servidor = createClient(
      SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const ids = {
      enviado: crypto.randomUUID(),
      interno: crypto.randomUUID(),
      quitado: crypto.randomUUID(),
    };
    const novo = (id: string, codigo: string, extra: object) => ({
      id,
      cliente_id: cliente.id,
      codigo,
      parcelas_restantes: 3,
      interno: false,
      situacao: "em_aberto",
      arquivo_caminho: `${cliente.id}/${id}-acordo.pdf`,
      ...extra,
    });
    const { error } = await servidor
      .from("cliente_parcelamentos")
      .insert([
        novo(ids.enviado, "A-ENVIADO", {}),
        novo(ids.interno, "B-INTERNO", { interno: true }),
        novo(ids.quitado, "C-QUITADO", { parcelas_restantes: 0, situacao: "quitado" }),
      ]);
    expect(error).toBeNull();
    const envios = await servidor.from("cliente_parcelamento_envios").insert([
      { parcelamento_id: ids.enviado, parcela: mesAtual().replace("-", "") },
      { parcelamento_id: ids.interno, parcela: "200001" }, // parcela de outro mês não conta
    ]);
    expect(envios.error).toBeNull();

    const resultado = await new SupabaseClienteQueryGateway(admin).listarResumoOperacional();

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    const porCodigo = (
      resultado.value.find((l) => l.clienteId === cliente.id)?.parcelamentos ?? []
    ).sort((a, b) => a.codigo.localeCompare(b.codigo));
    expect(porCodigo).toEqual([
      { codigo: "A-ENVIADO", interno: false, quitado: false, enviadoNoMes: true },
      { codigo: "B-INTERNO", interno: true, quitado: false, enviadoNoMes: false },
      { codigo: "C-QUITADO", interno: false, quitado: true, enviadoNoMes: false },
    ]);
  });

  it("traz a atividade do mês corrente (e tudo false sem registro)", async () => {
    const admin = await comoAdmin();
    const comAtividade = await criarClienteComContratoSocial(
      admin,
      "Resumo Atividade Ltda",
      cnpjUnico(),
    );
    const semAtividade = await criarClienteComContratoSocial(
      admin,
      "Resumo Sem Atividade Ltda",
      cnpjUnico(),
    );
    // Mesma fonte de verdade do produto (America/Sao_Paulo): UTC erra o mês nas últimas horas do dia 1.
    const anoMes = primeiroDiaDoMesAtual();
    const { error } = await admin.from("cliente_atividades_mensais").insert({
      id: crypto.randomUUID(),
      cliente_id: comAtividade.id,
      ano_mes: anoMes,
      industria: true,
      comercio: true,
      servico: false,
    });
    expect(error).toBeNull();

    const resultado = await new SupabaseClienteQueryGateway(admin).listarResumoOperacional();

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.value.find((l) => l.clienteId === comAtividade.id)?.atividadeMes).toEqual({
      industria: true,
      comercio: true,
      servico: false,
    });
    expect(resultado.value.find((l) => l.clienteId === semAtividade.id)?.atividadeMes).toEqual({
      industria: false,
      comercio: false,
      servico: false,
    });
  });

  it("nunca traz Cliente de Lucro Presumido/Real", async () => {
    const admin = await comoAdmin();
    const empresa = "Padaria Resumo Presumido Ltda";
    await criarClienteComContratoSocial(admin, empresa, cnpjUnico(), "lucro_presumido");
    const gateway = new SupabaseClienteQueryGateway(admin);

    const resultado = await gateway.listarResumoOperacional();

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value.some((l) => l.empresa === empresa)).toBe(false);
  });

  it("Líder do SN (não-Admin) também lista o resumo, pela view sem contrato social", async () => {
    const admin = await comoAdmin();
    const cliente = await criarClienteComContratoSocial(
      admin,
      "Padaria Resumo Funcionario Ltda",
      cnpjUnico(),
    );
    const gateway = new SupabaseClienteQueryGateway(await comoLiderSN());

    const resultado = await gateway.listarResumoOperacional();

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value.some((l) => l.clienteId === cliente.id)).toBe(true);
  });

  it("lista os Funcionários do SN como Responsáveis elegíveis (nunca Líder nem outro Setor)", async () => {
    const lider = await comoLiderSN();

    const resultado = await new SupabaseClienteQueryGateway(lider).listarResponsaveisElegiveis();

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    const ids = resultado.value.map((r) => r.id);
    expect(ids).toContain(FUNCIONARIO_SN_ID);
    expect(ids).not.toContain("33333333-3333-3333-3333-333333333333");
    expect(ids).not.toContain("88888888-8888-8888-8888-888888888888");
  });

  it("não lista como Responsável elegível um Funcionário do SN desativado", async () => {
    const servidor = createClient(
      SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const email = `inativo-${crypto.randomUUID()}@rigonicontabil.local`;
    const { data } = await servidor.auth.admin.createUser({
      email,
      password: "senha-de-teste-123",
      email_confirm: true,
    });
    const id = data.user!.id;
    await servidor.from("perfis").insert({
      id,
      nome: "Inativo",
      email,
      papel: "funcionario",
      setor: "simples_nacional",
      desativado_em: new Date().toISOString(),
    });

    const resultado = await new SupabaseClienteQueryGateway(
      await comoLiderSN(),
    ).listarResponsaveisElegiveis();

    await servidor.from("perfis").delete().eq("id", id);
    expect(resultado.ok && resultado.value.map((r) => r.id)).not.toContain(id);
    expect(resultado.ok && resultado.value.length).toBeGreaterThan(0);
  });

  it("traz o Responsável (id e nome) no cadastro operacional e no resumo; Funcionário só vê o que é dele", async () => {
    const admin = await comoAdmin();
    const cliente = await criarClienteComContratoSocial(admin, "Resp Query Ltda", cnpjUnico());
    const lider = await comoLiderSN();
    await lider
      .from("cliente_cadastro_operacional_sn")
      .update({ responsavel_id: FUNCIONARIO_SN_ID })
      .eq("cliente_id", cliente.id);

    const comoLider = new SupabaseClienteQueryGateway(lider);
    const cadastro = await comoLider.buscarCadastroOperacional(cliente.id);
    const resumo = await comoLider.listarResumoOperacional();
    const doOutro = await new SupabaseClienteQueryGateway(
      await comoFuncionario2SN(),
    ).listarResumoOperacional();

    expect(cadastro.ok && cadastro.value?.responsavelId).toBe(FUNCIONARIO_SN_ID);
    expect(cadastro.ok && cadastro.value?.responsavelNome).toBe("Funcionário Simples Nacional");
    expect(resumo.ok && resumo.value.find((l) => l.clienteId === cliente.id)?.responsavelId).toBe(
      FUNCIONARIO_SN_ID,
    );
    expect(doOutro.ok && doOutro.value.some((l) => l.clienteId === cliente.id)).toBe(false);
  });
});
