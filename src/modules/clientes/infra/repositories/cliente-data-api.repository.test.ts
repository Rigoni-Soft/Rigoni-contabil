/**
 * Integração direto pela Data API (PostgREST), sem passar por nenhum repositório
 * — prova o que o banco entrega a quem ignora a aplicação.
 * Requer `npx supabase start` com migrations + seed.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { Cliente } from "@/modules/clientes/domain/entities/cliente.entity";
import { primeiroDiaDoMesAtual } from "@/shared/kernel/mes-atual";

import { removerClientesDeTeste } from "../../../../../test-support/clientes-de-teste";
import { SupabaseClienteRepository } from "./cliente.repository";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const FUNCIONARIO_SN_ID = "22222222-2222-2222-2222-222222222222";

async function clienteAutenticado(email: string, senha: string): Promise<SupabaseClient> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`Falha ao autenticar ${email}: ${error.message}`);
  return supabase;
}

const comoAdmin = () => clienteAutenticado("admin@rigonicontabil.local", "admin123");
const comoFuncionarioSN = () =>
  clienteAutenticado("funcionario.sn@rigonicontabil.local", "func123");
const comoFuncionarioFinanceiro = () =>
  clienteAutenticado("funcionario.financeiro@rigonicontabil.local", "func123");

const serviceRole = () =>
  createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

async function criarClienteComContrato(cnpj: string): Promise<Cliente> {
  const admin = await comoAdmin();
  const construido = Cliente.builder()
    .comId(crypto.randomUUID())
    .comEmpresa("Padaria Pão Quente Ltda")
    .comCnpj(cnpj)
    .comRegime("simples_nacional")
    .comContratoSocialCaminho("clientes/x/contrato-social/doc.pdf")
    .comAlteracoesContratuais([{ data: "2026-01-10", arquivoCaminho: "clientes/x/alt/1.pdf" }])
    .build();
  if (!construido.ok) throw new Error("setup inválido");
  const salvo = await new SupabaseClienteRepository(admin).criar(construido.value);
  if (!salvo.ok) throw new Error("falha ao criar cliente: " + salvo.error.message);
  return construido.value;
}

// Conta com senha provisória AINDA válida (dentro das 48h) e primeiro acesso
// não finalizado — o caso que meu_papel()/meu_setor() sozinhos deixavam passar.
async function criarContaEmPrimeiroAcesso(): Promise<{ id: string; email: string; senha: string }> {
  const admin = serviceRole();
  const email = `teste-primeiro-acesso-${crypto.randomUUID()}@rigonicontabil.local`;
  const senha = "senha-provisoria-123";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`Falha ao criar conta de teste: ${error?.message}`);
  const { error: erroPerfil } = await admin.from("perfis").insert({
    id: data.user.id,
    nome: "Funcionário Primeiro Acesso",
    email,
    papel: "funcionario",
    setor: "simples_nacional",
    senha_trocada_em: null,
    senha_provisoria_expira_em: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
  });
  if (erroPerfil) throw new Error(`Falha ao salvar perfil de teste: ${erroPerfil.message}`);
  return { id: data.user.id, email, senha };
}

// Funcionário SN só vê/edita Cliente do qual é Responsável. service_role
// atribui direto (sem auth.uid() o gatilho confia no servidor).
async function tornarResponsavel(clienteId: string, perfilId: string): Promise<void> {
  const { error } = await serviceRole()
    .from("cliente_cadastro_operacional_sn")
    .update({ responsavel_id: perfilId })
    .eq("cliente_id", clienteId);
  if (error) throw new Error(`Falha ao atribuir Responsável: ${error.message}`);
}

const paramsEdicao = (clienteId: string) => ({
  p_cliente_id: clienteId,
  p_forma_envio: "email",
  p_documento_obrigatorio: "positivo",
  p_das_status: "pronto",
  p_data_envio_das: null,
  p_tem_parcelamento: false,
  p_parcelamento_status: null,
  p_observacoes_gerais: "teste",
  p_contatos: [{ id: crypto.randomUUID(), nome: "Maria", telefone: "11999990000", padrao: true }],
  p_ano_mes: primeiroDiaDoMesAtual(),
  p_industria: false,
  p_comercio: true,
  p_servico: false,
});

// CNPJs fixos desta suíte, reservados para teste: removidos antes e depois (nunca um DELETE amplo).
const CNPJS_DA_SUITE = [
  "11444777001486",
  "11444777001567",
  "11444777001648",
  "11444777001729",
  "11444777001800",
  "11444777001990",
  "11444777002024",
  "11444777002105",
  "11444777002296",
  "45723174000110",
  "45723174000200",
  "45723174000382",
  "45723174000463",
  "45723174000544",
  "45723174000625",
] as const;
beforeAll(() => removerClientesDeTeste(CNPJS_DA_SUITE));
afterAll(() => removerClientesDeTeste(CNPJS_DA_SUITE));

describe("Data API — confidencialidade dos documentos jurídicos (PR #69, ponto 1)", () => {
  it("Funcionário SN e de outro Setor não leem clientes nem alterações contratuais direto; a projeção segura vale pra quem pode ver o Cliente", async () => {
    const cliente = await criarClienteComContrato("45723174000110");
    await tornarResponsavel(cliente.id, FUNCIONARIO_SN_ID);

    for (const supabase of [await comoFuncionarioSN(), await comoFuncionarioFinanceiro()]) {
      const direto = await supabase.from("clientes").select("*").eq("id", cliente.id);
      expect(direto.data).toEqual([]);

      const alteracoes = await supabase
        .from("cliente_alteracoes_contratuais")
        .select("*")
        .eq("cliente_id", cliente.id);
      expect(alteracoes.data).toEqual([]);

      const projecao = await supabase.from("clientes_basico").select("*").eq("id", cliente.id);
      expect(projecao.data).toEqual([
        {
          id: cliente.id,
          empresa: "Padaria Pão Quente Ltda",
          cnpj: "45723174000110",
          regime: "simples_nacional",
          email: null,
        },
      ]);

      const contrato = await supabase.from("clientes_basico").select("contrato_social_caminho");
      expect(contrato.error).not.toBeNull();
    }
  });

  it("Funcionário SN que não é Responsável não vê o Cliente nem pela projeção (#65)", async () => {
    const cliente = await criarClienteComContrato("45723174000200");
    const supabase = await comoFuncionarioSN();

    const projecao = await supabase.from("clientes_basico").select("*").eq("id", cliente.id);

    expect(projecao.data).toEqual([]);
  });

  it("Admin continua lendo o contrato social em clientes", async () => {
    const cliente = await criarClienteComContrato("45723174000625");
    const admin = await comoAdmin();

    const { data } = await admin
      .from("clientes")
      .select("contrato_social_caminho")
      .eq("id", cliente.id)
      .single();

    expect(data?.contrato_social_caminho).toBe("clientes/x/contrato-social/doc.pdf");
  });
});

describe("Data API — primeiro acesso não finalizado (PR #69, ponto 2)", () => {
  it("conta com senha provisória não lê nem edita dados de negócio; depois da troca, passa a ter o acesso normal", async () => {
    const cliente = await criarClienteComContrato("45723174000382");
    const conta = await criarContaEmPrimeiroAcesso();
    await tornarResponsavel(cliente.id, conta.id);
    const supabase = await clienteAutenticado(conta.email, conta.senha);

    const leitura = await supabase.from("clientes_basico").select("*").eq("id", cliente.id);
    expect(leitura.data).toEqual([]);
    const operacional = await supabase
      .from("cliente_cadastro_operacional_sn")
      .select("*")
      .eq("cliente_id", cliente.id);
    expect(operacional.data).toEqual([]);

    const edicao = await supabase.rpc(
      "editar_cadastro_operacional_cliente",
      paramsEdicao(cliente.id),
    );
    expect(edicao.error?.message).toMatch(/row-level security/i);

    // o próprio perfil segue legível pro fluxo de troca de senha
    const proprio = await supabase.from("perfis").select("id").eq("id", conta.id);
    expect(proprio.data).toHaveLength(1);

    await serviceRole()
      .from("perfis")
      .update({ senha_trocada_em: new Date().toISOString() })
      .eq("id", conta.id);

    const depois = await supabase.from("clientes_basico").select("*").eq("id", cliente.id);
    expect(depois.data).toHaveLength(1);
    const edicaoDepois = await supabase.rpc(
      "editar_cadastro_operacional_cliente",
      paramsEdicao(cliente.id),
    );
    expect(edicaoDepois.error).toBeNull();
  });
});

describe("Auditoria atômica da edição (PR #69, ponto 3)", () => {
  async function eventosDeEdicao(cnpj: string): Promise<number> {
    const { data, error } = await serviceRole()
      .from("registros_auditoria")
      .select("id")
      .eq("acao", "cliente.editar-operacional")
      .eq("alvo", cnpj);
    if (error) throw new Error(error.message);
    return data.length;
  }

  it("cada edição gera exatamente um evento de sucesso, com ator e setor da sessão", async () => {
    const cnpj = "45723174000463";
    const cliente = await criarClienteComContrato(cnpj);
    await tornarResponsavel(cliente.id, FUNCIONARIO_SN_ID);
    const supabase = await comoFuncionarioSN();

    expect(await eventosDeEdicao(cnpj)).toBe(0);
    const primeira = await supabase.rpc(
      "editar_cadastro_operacional_cliente",
      paramsEdicao(cliente.id),
    );
    expect(primeira.error).toBeNull();
    expect(await eventosDeEdicao(cnpj)).toBe(1);
    const segunda = await supabase.rpc(
      "editar_cadastro_operacional_cliente",
      paramsEdicao(cliente.id),
    );
    expect(segunda.error).toBeNull();
    expect(await eventosDeEdicao(cnpj)).toBe(2);

    const { data } = await serviceRole()
      .from("registros_auditoria")
      .select("ator, setor, resultado")
      .eq("alvo", cnpj)
      .eq("acao", "cliente.editar-operacional")
      .limit(1)
      .single();
    expect(data).toEqual({
      ator: FUNCIONARIO_SN_ID,
      setor: "simples_nacional",
      resultado: "sucesso",
    });
  });

  it("edição que falha (contato inválido) não deixa evento de sucesso", async () => {
    const cnpj = "45723174000544";
    const cliente = await criarClienteComContrato(cnpj);
    await tornarResponsavel(cliente.id, FUNCIONARIO_SN_ID);
    const supabase = await comoFuncionarioSN();

    const { error } = await supabase.rpc("editar_cadastro_operacional_cliente", {
      ...paramsEdicao(cliente.id),
      p_contatos: [{ nome: null, telefone: "1", padrao: true }],
    });

    expect(error).not.toBeNull();
    expect(await eventosDeEdicao(cnpj)).toBe(0);
  });
});

describe("Data API — revalidação da PR #69 (B1, B2, I1, I2)", () => {
  const eventos = async (cnpj: string): Promise<number> => {
    const { data, error } = await serviceRole()
      .from("registros_auditoria")
      .select("id")
      .eq("acao", "cliente.editar-operacional")
      .eq("alvo", cnpj);
    if (error) throw new Error(error.message);
    return data.length;
  };

  it("B1: clientes_basico é só leitura — INSERT, UPDATE e DELETE falham para qualquer Funcionário e o Cliente fica intacto", async () => {
    const cliente = await criarClienteComContrato("11444777001486");
    await tornarResponsavel(cliente.id, FUNCIONARIO_SN_ID);

    for (const supabase of [await comoFuncionarioSN(), await comoFuncionarioFinanceiro()]) {
      const insercao = await supabase
        .from("clientes_basico")
        .insert({ id: crypto.randomUUID(), empresa: "X", cnpj: "11444777001567", regime: "mei" });
      expect(insercao.error).not.toBeNull();

      const alteracao = await supabase
        .from("clientes_basico")
        .update({ empresa: "Alterada" })
        .eq("id", cliente.id);
      expect(alteracao.error).not.toBeNull();

      const exclusao = await supabase.from("clientes_basico").delete().eq("id", cliente.id);
      expect(exclusao.error).not.toBeNull();

      const leitura = await supabase.from("clientes_basico").select("empresa").eq("id", cliente.id);
      expect(leitura.data).toEqual([{ empresa: "Padaria Pão Quente Ltda" }]);
    }

    const { data } = await serviceRole().from("clientes").select("empresa").eq("id", cliente.id);
    expect(data).toEqual([{ empresa: "Padaria Pão Quente Ltda" }]);
  });

  it("B2: escrita direta nas tabelas operacionais também gera o evento, e o cadastro do Cliente não gera evento de edição", async () => {
    const cnpj = "11444777001648";
    const cliente = await criarClienteComContrato(cnpj);
    await tornarResponsavel(cliente.id, FUNCIONARIO_SN_ID);
    const supabase = await comoFuncionarioSN();
    expect(await eventos(cnpj)).toBe(0);

    const observacao = await supabase
      .from("cliente_cadastro_operacional_sn")
      .update({ observacoes_gerais: "direto" })
      .eq("cliente_id", cliente.id);
    expect(observacao.error).toBeNull();
    expect(await eventos(cnpj)).toBe(1);

    const formaEnvio = await supabase
      .from("cliente_cadastro_operacional_sn")
      .update({ forma_envio: "email" })
      .eq("cliente_id", cliente.id);
    expect(formaEnvio.error).toBeNull();
    expect(await eventos(cnpj)).toBe(2);

    const contatoId = crypto.randomUUID();
    const inserirContato = await supabase.from("cliente_contatos").insert({
      id: contatoId,
      cliente_id: cliente.id,
      nome: "Direto",
      telefone: "11988887777",
      padrao: true,
    });
    expect(inserirContato.error).toBeNull();
    expect(await eventos(cnpj)).toBe(3);

    const removerContato = await supabase.from("cliente_contatos").delete().eq("id", contatoId);
    expect(removerContato.error).toBeNull();
    expect(await eventos(cnpj)).toBe(4);
  });

  it("B2: coluna que não é edição operacional (servidor, sem sessão) não gera este evento", async () => {
    const cnpj = "11444777001729";
    const cliente = await criarClienteComContrato(cnpj);

    const { error } = await serviceRole()
      .from("cliente_cadastro_operacional_sn")
      .update({ observacoes_gerais: "servidor" })
      .eq("cliente_id", cliente.id);

    expect(error).toBeNull();
    expect(await eventos(cnpj)).toBe(0);
  });

  it("I1: RPC e DML direto rejeitam mês passado/futuro; a atividade histórica não é alterada nem movida, mas continua legível", async () => {
    const cnpj = "11444777001800";
    const cliente = await criarClienteComContrato(cnpj);
    await tornarResponsavel(cliente.id, FUNCIONARIO_SN_ID);
    const supabase = await comoFuncionarioSN();
    const mesCorrente = primeiroDiaDoMesAtual();
    const passado = "2020-01-01";
    const futuro = "2099-01-01";

    for (const mes of [passado, futuro]) {
      const rpc = await supabase.rpc("editar_cadastro_operacional_cliente", {
        ...paramsEdicao(cliente.id),
        p_ano_mes: mes,
      });
      expect(rpc.error?.message).toMatch(/mês corrente/);

      const insercao = await supabase.from("cliente_atividades_mensais").insert({
        id: crypto.randomUUID(),
        cliente_id: cliente.id,
        ano_mes: mes,
      });
      expect(insercao.error?.message).toMatch(/mês corrente/);
    }

    const historica = crypto.randomUUID();
    const semente = await serviceRole()
      .from("cliente_atividades_mensais")
      .insert({ id: historica, cliente_id: cliente.id, ano_mes: passado, comercio: true });
    expect(semente.error).toBeNull();

    const alterar = await supabase
      .from("cliente_atividades_mensais")
      .update({ comercio: false })
      .eq("id", historica);
    expect(alterar.error?.message).toMatch(/mês corrente/);

    const edicao = await supabase.rpc(
      "editar_cadastro_operacional_cliente",
      paramsEdicao(cliente.id),
    );
    expect(edicao.error).toBeNull();
    const mover = await supabase
      .from("cliente_atividades_mensais")
      .update({ ano_mes: passado })
      .eq("cliente_id", cliente.id)
      .eq("ano_mes", mesCorrente);
    expect(mover.error?.message).toMatch(/mês corrente/);

    const leitura = await supabase
      .from("cliente_atividades_mensais")
      .select("comercio")
      .eq("id", historica);
    expect(leitura.data).toEqual([{ comercio: true }]);
  });

  it("I1: o mês corrente do banco respeita a virada UTC x São Paulo", async () => {
    const mes = async (agora: string) =>
      (await serviceRole().rpc("mes_corrente_sp", { p_agora: agora })).data;

    // 02:00 UTC de 01/10 ainda é 23:00 de 30/09 em São Paulo.
    expect(await mes("2026-10-01T02:00:00Z")).toBe("2026-09-01");
    expect(await mes("2026-10-01T03:00:00Z")).toBe("2026-10-01");
  });

  it.each([
    ["lucro_presumido", "11444777001990", false],
    ["lucro_real", "11444777002024", false],
    ["mei", "11444777002105", true],
    ["simples_nacional", "11444777002296", true],
  ])(
    "I2: Regime %s (%s) edita o Cadastro operacional SN = %s, pela aplicação e pela API",
    async (regime, cnpj, aplica) => {
      const admin = await comoAdmin();
      const construido = Cliente.builder()
        .comId(crypto.randomUUID())
        .comEmpresa("Regime Teste Ltda")
        .comCnpj(cnpj)
        .comRegime(regime)
        .comContratoSocialCaminho(null)
        .comAlteracoesContratuais([])
        .build();
      if (!construido.ok) throw new Error("setup inválido");
      const salvo = await new SupabaseClienteRepository(admin).criar(construido.value);
      expect(salvo.ok).toBe(true);
      const id = construido.value.id;
      if (aplica) await tornarResponsavel(id, FUNCIONARIO_SN_ID);

      // criação automática só para MEI/Simples Nacional
      const automatico = await serviceRole()
        .from("cliente_cadastro_operacional_sn")
        .select("cliente_id")
        .eq("cliente_id", id);
      expect(automatico.data).toHaveLength(aplica ? 1 : 0);

      const funcionario = await comoFuncionarioSN();
      const contatoDireto = (contatoId: string) => ({
        id: contatoId,
        cliente_id: id,
        nome: "Contato Direto",
        telefone: "61999990000",
        padrao: false,
      });
      const existente = crypto.randomUUID();
      const semente = await serviceRole().from("cliente_contatos").insert(contatoDireto(existente));
      expect(semente.error).toBeNull();
      const contatosDoCliente = async () =>
        (await serviceRole().from("cliente_contatos").select("id").eq("cliente_id", id)).data ?? [];

      if (aplica) {
        // Contato direto (INSERT/DELETE) continua permitido a Admin e Funcionário SN, com auditoria.
        for (const supabase of [admin, funcionario]) {
          const novo = crypto.randomUUID();
          expect(
            (await supabase.from("cliente_contatos").insert(contatoDireto(novo))).error,
          ).toBeNull();
          expect(
            (await supabase.from("cliente_contatos").delete().eq("id", novo)).error,
          ).toBeNull();
        }
        expect(await eventos(cnpj)).toBeGreaterThan(0);
        const rpcOk = await funcionario.rpc(
          "editar_cadastro_operacional_cliente",
          paramsEdicao(id),
        );
        expect(rpcOk.error).toBeNull();
        return;
      }
      const rpc = await funcionario.rpc("editar_cadastro_operacional_cliente", paramsEdicao(id));
      expect(rpc.error?.message).toMatch(/não se aplica/);

      // Contato também é Cadastro operacional SN: INSERT e DELETE diretos são negados
      for (const supabase of [admin, funcionario]) {
        const insercao = await supabase
          .from("cliente_contatos")
          .insert(contatoDireto(crypto.randomUUID()));
        expect(insercao.error?.message).toMatch(/não se aplica/);
        // Sem erro ou com erro conforme a RLS do Setor enxergue a linha: o que vale é nada ser removido.
        await supabase.from("cliente_contatos").delete().eq("id", existente);
      }
      expect((await contatosDoCliente()).map((c) => c.id)).toEqual([existente]);

      // DML direto de Admin e de Funcionário SN também não cria o cadastro
      for (const supabase of [admin, funcionario]) {
        const direto = await supabase
          .from("cliente_cadastro_operacional_sn")
          .insert({ cliente_id: id });
        expect(direto.error).not.toBeNull();
      }
      const semLinha = await serviceRole()
        .from("cliente_cadastro_operacional_sn")
        .select("cliente_id")
        .eq("cliente_id", id);
      expect(semLinha.data).toEqual([]);
    },
  );
});
