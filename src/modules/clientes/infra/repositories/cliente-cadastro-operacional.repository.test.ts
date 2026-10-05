/**
 * Integração infra ↔ Supabase (testes.md, seção 3) para #34: Funcionário do
 * Simples Nacional edita cadastro operacional de Cliente. Requer
 * `npx supabase start` rodando localmente com migrations + seed aplicados.
 * Usa Admin, Funcionário SN e Funcionário Financeiro (outro Setor) de
 * `supabase/seed.sql` pra provar a matriz de RLS.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { Cliente } from "@/modules/clientes/domain/entities/cliente.entity";
import { SupabaseResponsavelClienteGateway } from "@/modules/clientes/infra/gateways/supabase-responsavel-cliente.gateway";
import { mesAtual } from "@/shared/kernel/mes-atual";

import { SupabaseClienteRepository } from "./cliente.repository";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

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
const comoLiderSN = () => clienteAutenticado("lider.sn@rigonicontabil.local", "lider123");
const comoFuncionario2SN = () =>
  clienteAutenticado("funcionario2.sn@rigonicontabil.local", "func123");

const FUNCIONARIO_SN_ID = "22222222-2222-2222-2222-222222222222";
const FUNCIONARIO_FINANCEIRO_ID = "33333333-3333-3333-3333-333333333333";

// #65: Funcionário SN só edita Cliente do qual é Responsável — quem atribui é o Líder.
async function atribuirComoLider(clienteId: string, responsavelId: string | null) {
  const lider = await comoLiderSN();
  const resultado = await new SupabaseResponsavelClienteGateway(lider).atribuir(
    clienteId,
    responsavelId,
  );
  if (!resultado.ok) throw new Error("falha ao atribuir: " + resultado.error.message);
}

async function criarClienteBase(admin: SupabaseClient, cnpj: string): Promise<Cliente> {
  const repositorio = new SupabaseClienteRepository(admin);
  const construido = Cliente.builder()
    .comId(crypto.randomUUID())
    .comEmpresa("Padaria Pão Quente Ltda")
    .comCnpj(cnpj)
    .comRegime("simples_nacional")
    .comContratoSocialCaminho(null)
    .comAlteracoesContratuais([])
    .build();
  if (!construido.ok) throw new Error("setup inválido");
  const salvo = await repositorio.criar(construido.value);
  if (!salvo.ok) throw new Error("falha ao criar cliente base: " + salvo.error.message);
  return construido.value;
}

function comCadastroOperacional(clienteBase: Cliente): Cliente {
  const reconstruido = Cliente.builder()
    .comId(clienteBase.id)
    .comEmpresa(clienteBase.empresa)
    .comCnpj(clienteBase.cnpj.valor)
    .comRegime(clienteBase.regime.valor)
    .comContratoSocialCaminho(clienteBase.contratoSocialCaminho)
    .comAlteracoesContratuais([])
    .comFormaEnvio("email")
    .comContatos([{ nome: "Maria", telefone: "11999990000", padrao: true }])
    .comDocumentoObrigatorio("positivo")
    .comDasStatus("pronto")
    .comDataEnvioDas(null)
    .comTemParcelamento(false)
    .comParcelamentoStatus(null)
    .comObservacoesGerais("Cliente pontual.")
    .comAtividadeMesAtual({
      anoMes: mesAtual(),
      industria: false,
      comercio: true,
      servico: false,
    })
    .build();
  if (!reconstruido.ok) throw new Error("setup inválido: " + JSON.stringify(reconstruido.error));
  return reconstruido.value;
}

describe("SupabaseClienteRepository — cadastro operacional (#34, integração)", () => {
  it("Funcionário SN edita e persiste o cadastro operacional (RPC editar_cadastro_operacional_cliente)", async () => {
    const admin = await comoAdmin();
    const clienteBase = await criarClienteBase(admin, "11444777000242");
    await atribuirComoLider(clienteBase.id, FUNCIONARIO_SN_ID);
    const funcionarioSN = await comoFuncionarioSN();
    const repositorio = new SupabaseClienteRepository(funcionarioSN);

    const resultado = await repositorio.atualizarOperacional(comCadastroOperacional(clienteBase));

    expect(resultado.ok).toBe(true);
    const { data: operacional } = await admin
      .from("cliente_cadastro_operacional_sn")
      .select("*")
      .eq("cliente_id", clienteBase.id)
      .maybeSingle();
    expect(operacional?.forma_envio).toBe("email");
    expect(operacional?.documento_obrigatorio).toBe("positivo");
    const { data: contatos } = await admin
      .from("cliente_contatos")
      .select("*")
      .eq("cliente_id", clienteBase.id);
    expect(contatos).toHaveLength(1);
    expect(contatos?.[0].padrao).toBe(true);
  });

  it("Funcionário de outro Setor NÃO pode editar o cadastro operacional (RLS)", async () => {
    const admin = await comoAdmin();
    const clienteBase = await criarClienteBase(admin, "11444777000323");
    const funcionarioFinanceiro = await comoFuncionarioFinanceiro();
    const repositorio = new SupabaseClienteRepository(funcionarioFinanceiro);

    const resultado = await repositorio.atualizarOperacional(comCadastroOperacional(clienteBase));

    expect(resultado.ok).toBe(false);
  });

  it("Funcionário de outro Setor CONSEGUE visualizar o cadastro básico (RLS de SELECT libera qualquer perfil)", async () => {
    const admin = await comoAdmin();
    const clienteBase = await criarClienteBase(admin, "11444777000404");
    await atribuirComoLider(clienteBase.id, FUNCIONARIO_SN_ID);
    const funcionarioSN = await comoFuncionarioSN();
    await new SupabaseClienteRepository(funcionarioSN).atualizarOperacional(
      comCadastroOperacional(clienteBase),
    );
    const funcionarioFinanceiro = await comoFuncionarioFinanceiro();
    const repositorio = new SupabaseClienteRepository(funcionarioFinanceiro);

    const resultado = await repositorio.buscarPorId(clienteBase.id);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value?.formaEnvio.valor).toBe("email");
  });

  it("buscarPorId reconstitui a entidade Cliente com os campos operacionais salvos", async () => {
    const admin = await comoAdmin();
    const clienteBase = await criarClienteBase(admin, "11444777000595");
    await atribuirComoLider(clienteBase.id, FUNCIONARIO_SN_ID);
    const funcionarioSN = await comoFuncionarioSN();
    const repositorio = new SupabaseClienteRepository(funcionarioSN);
    await repositorio.atualizarOperacional(comCadastroOperacional(clienteBase));

    const resultado = await repositorio.buscarPorId(clienteBase.id);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok || !resultado.value) throw new Error("cliente não encontrado");
    expect(resultado.value.documentoObrigatorio?.valor).toBe("positivo");
    expect(resultado.value.dasStatus?.valor).toBe("pronto");
    expect(resultado.value.contatos).toHaveLength(1);
    expect(resultado.value.atividadeMesAtual?.comercio).toBe(true);
  });

  describe("Responsável por Cliente (#65)", () => {
    it("Líder do SN atribui um Funcionário do SN; Funcionário não-Responsável não enxerga nem edita o Cliente", async () => {
      const admin = await comoAdmin();
      const clienteBase = await criarClienteBase(admin, "11444777000838");
      await atribuirComoLider(clienteBase.id, FUNCIONARIO_SN_ID);

      const outro = new SupabaseClienteRepository(await comoFuncionario2SN());
      const visto = await outro.buscarPorId(clienteBase.id);
      const edicao = await outro.atualizarOperacional(comCadastroOperacional(clienteBase));

      expect(visto.ok && visto.value).toBeNull();
      expect(edicao.ok).toBe(false);
      const responsavel = new SupabaseClienteRepository(await comoFuncionarioSN());
      const doResponsavel = await responsavel.buscarPorId(clienteBase.id);
      expect(doResponsavel.ok && doResponsavel.value?.id).toBe(clienteBase.id);
    });

    it("Funcionário NÃO consegue atribuir/alterar o Responsável nem por update direto (trigger)", async () => {
      const admin = await comoAdmin();
      const clienteBase = await criarClienteBase(admin, "11444777000919");
      await atribuirComoLider(clienteBase.id, FUNCIONARIO_SN_ID);
      const funcionarioSN = await comoFuncionarioSN();

      const direto = await funcionarioSN
        .from("cliente_cadastro_operacional_sn")
        .update({ responsavel_id: null })
        .eq("cliente_id", clienteBase.id);
      const viaGateway = await new SupabaseResponsavelClienteGateway(funcionarioSN).atribuir(
        clienteBase.id,
        null,
      );

      expect(direto.error).not.toBeNull();
      expect(viaGateway.ok).toBe(false);
    });

    it("Admin também NÃO atribui o Responsável (só o Líder do SN)", async () => {
      const admin = await comoAdmin();
      const clienteBase = await criarClienteBase(admin, "11444777001052");

      const resultado = await new SupabaseResponsavelClienteGateway(admin).atribuir(
        clienteBase.id,
        FUNCIONARIO_SN_ID,
      );

      expect(resultado.ok).toBe(false);
    });

    it("Líder não atribui Funcionário de outro Setor como Responsável", async () => {
      const admin = await comoAdmin();
      const clienteBase = await criarClienteBase(admin, "11444777001133");
      const lider = await comoLiderSN();

      const resultado = await new SupabaseResponsavelClienteGateway(lider).atribuir(
        clienteBase.id,
        FUNCIONARIO_FINANCEIRO_ID,
      );

      expect(resultado.ok).toBe(false);
    });

    it("Líder enxerga e edita qualquer Cliente do SN, e remover o Responsável deixa 'Sem responsável'", async () => {
      const admin = await comoAdmin();
      const clienteBase = await criarClienteBase(admin, "11444777001214");
      await atribuirComoLider(clienteBase.id, FUNCIONARIO_SN_ID);
      const repositorioLider = new SupabaseClienteRepository(await comoLiderSN());

      const edicao = await repositorioLider.atualizarOperacional(
        comCadastroOperacional(clienteBase),
      );
      await atribuirComoLider(clienteBase.id, null);

      expect(edicao.ok).toBe(true);
      const { data } = await admin
        .from("cliente_cadastro_operacional_sn")
        .select("responsavel_id")
        .eq("cliente_id", clienteBase.id)
        .single();
      expect(data?.responsavel_id).toBeNull();
    });
  });

  it("buscarPorId devolve null quando o Cliente não existe", async () => {
    const admin = await comoAdmin();
    const repositorio = new SupabaseClienteRepository(admin);

    const resultado = await repositorio.buscarPorId(crypto.randomUUID());

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value).toBeNull();
  });

  // Feedback de teste manual do #34: cadastrar um Cliente Simples Nacional/MEI
  // já cria a linha do cadastro SN (RPC criar_cliente), em vez de só nascer no
  // primeiro upsert de EditarCadastroOperacionalCliente.
  it("criar Cliente Simples Nacional já cria o cadastro operacional com os defaults negativos/pendentes", async () => {
    const admin = await comoAdmin();
    const clienteBase = await criarClienteBase(admin, "92773334000116");

    const { data: linha } = await admin
      .from("cliente_cadastro_operacional_sn")
      .select("*")
      .eq("cliente_id", clienteBase.id)
      .maybeSingle();

    expect(linha).toMatchObject({
      forma_envio: "whatsapp",
      documento_obrigatorio: "negativo",
      das_status: "pendente",
      tem_parcelamento: false,
      parcelamento_status: "pendente",
      observacoes_gerais: "",
    });
  });

  it("criar Cliente MEI também já cria o cadastro operacional", async () => {
    const admin = await comoAdmin();
    const repositorio = new SupabaseClienteRepository(admin);
    const construido = Cliente.builder()
      .comId(crypto.randomUUID())
      .comEmpresa("Oficina do Zé MEI")
      .comCnpj("92773111000159")
      .comRegime("mei")
      .comContratoSocialCaminho(null)
      .comAlteracoesContratuais([])
      .build();
    if (!construido.ok) throw new Error("setup inválido");
    await repositorio.criar(construido.value);

    const { data: linha } = await admin
      .from("cliente_cadastro_operacional_sn")
      .select("cliente_id")
      .eq("cliente_id", construido.value.id)
      .maybeSingle();

    expect(linha).not.toBeNull();
  });

  it("criar Cliente de outro Regime (Lucro Presumido) NÃO cria cadastro SN — não se aplica", async () => {
    const admin = await comoAdmin();
    const repositorio = new SupabaseClienteRepository(admin);
    const construido = Cliente.builder()
      .comId(crypto.randomUUID())
      .comEmpresa("Indústria Lucro Presumido Ltda")
      .comCnpj("92773222000165")
      .comRegime("lucro_presumido")
      .comContratoSocialCaminho(null)
      .comAlteracoesContratuais([])
      .build();
    if (!construido.ok) throw new Error("setup inválido");
    await repositorio.criar(construido.value);

    const { data: linha } = await admin
      .from("cliente_cadastro_operacional_sn")
      .select("cliente_id")
      .eq("cliente_id", construido.value.id)
      .maybeSingle();

    expect(linha).toBeNull();
  });
});
