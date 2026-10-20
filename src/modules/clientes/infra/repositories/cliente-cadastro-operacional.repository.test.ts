/**
 * Integração infra ↔ Supabase (testes.md, seção 3): Funcionário do
 * Simples Nacional edita cadastro operacional de Cliente. Requer
 * `npx supabase start` rodando localmente com migrations + seed aplicados.
 * Usa Admin, Funcionário SN e Funcionário Financeiro (outro Setor) de
 * `supabase/seed.sql` pra provar a matriz de RLS.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { Cliente } from "@/modules/clientes/domain/entities/cliente.entity";
import { SupabaseResponsavelClienteRepository } from "@/modules/clientes/infra/repositories/responsavel-cliente.repository";
import { mesAtual } from "@/shared/kernel/mes-atual";

import { removerClientesDeTeste } from "../../../../../test-support/clientes-de-teste";
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

const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const FUNCIONARIO_SN_ID = "22222222-2222-2222-2222-222222222222";
const LIDER_SN_ID = "88888888-8888-8888-8888-888888888888";
const FUNCIONARIO_2_SN_ID = "99999999-9999-9999-9999-999999999999";
const FUNCIONARIO_FINANCEIRO_ID = "33333333-3333-3333-3333-333333333333";

// Funcionário SN só edita Cliente do qual é Responsável — quem atribui é o Líder.
async function atribuirComoLider(clienteId: string, responsavelId: string | null) {
  const lider = await comoLiderSN();
  const resultado = await new SupabaseResponsavelClienteRepository(lider).atribuir(
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

function comCadastroOperacional(
  clienteBase: Cliente,
  das: { status: string; data: string | null } = { status: "pronto", data: null },
): Cliente {
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
    .comDasStatus(das.status as "pronto")
    .comDataEnvioDas(das.data ? new Date(das.data) : null)
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

// CNPJs fixos desta suíte, reservados para teste: removidos antes e depois (nunca um DELETE amplo).
const CNPJS_DA_SUITE = [
  "11444777000242",
  "11444777000323",
  "11444777000404",
  "11444777000595",
  "11444777000838",
  "11444777000919",
  "11444777001052",
  "11444777001133",
  "11444777001214",
  "11444777001303",
  "62785037000120",
  "62785037000200",
  "62785037000391",
  "92773111000159",
  "92773222000165",
  "92773334000116",
  "62785037000472",
  "62785037000553",
  "62785037000634",
  "62785037000715",
] as const;
beforeAll(() => removerClientesDeTeste(CNPJS_DA_SUITE));
afterAll(() => removerClientesDeTeste(CNPJS_DA_SUITE));

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

  describe("DAS enviado só pelo sistema (#108)", () => {
    async function prepararFuncionarioSN(cnpj: string) {
      const admin = await comoAdmin();
      const clienteBase = await criarClienteBase(admin, cnpj);
      await atribuirComoLider(clienteBase.id, FUNCIONARIO_SN_ID);
      const repositorio = new SupabaseClienteRepository(await comoFuncionarioSN());
      return { admin, clienteBase, repositorio };
    }
    // O sistema (job de envio) grava `enviado` sem sessão de usuário: service_role.
    const comoSistema = () =>
      createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const sistemaMarcaEnviado = (clienteId: string, data: string) =>
      comoSistema()
        .from("cliente_cadastro_operacional_sn")
        .update({ das_status: "enviado", data_envio_das: data })
        .eq("cliente_id", clienteId);
    const lerDas = async (admin: SupabaseClient, clienteId: string) =>
      (
        await admin
          .from("cliente_cadastro_operacional_sn")
          .select("das_status, data_envio_das")
          .eq("cliente_id", clienteId)
          .single()
      ).data;

    it("edição manual não consegue definir `enviado`", async () => {
      const { admin, clienteBase, repositorio } = await prepararFuncionarioSN("62785037000472");

      const resultado = await repositorio.atualizarOperacional(
        comCadastroOperacional(clienteBase, { status: "enviado", data: "2026-10-01" }),
      );

      expect(resultado.ok).toBe(false);
      expect(await lerDas(admin, clienteBase.id)).toEqual({
        das_status: "pendente",
        data_envio_das: null,
      });
    });

    it("salvar com DAS já `enviado` pelo sistema preserva status e data, ignorando a data enviada", async () => {
      const { admin, clienteBase, repositorio } = await prepararFuncionarioSN("62785037000553");
      await repositorio.atualizarOperacional(comCadastroOperacional(clienteBase));
      await sistemaMarcaEnviado(clienteBase.id, "2026-10-05");

      const resultado = await repositorio.atualizarOperacional(
        comCadastroOperacional(clienteBase, { status: "enviado", data: "2020-01-01" }),
      );

      expect(resultado.ok).toBe(true);
      expect(await lerDas(admin, clienteBase.id)).toEqual({
        das_status: "enviado",
        data_envio_das: "2026-10-05",
      });
    });

    it("DML direto pela Data API também não define `enviado` nem altera a data (gatilho)", async () => {
      const { admin, clienteBase, repositorio } = await prepararFuncionarioSN("62785037000715");
      await repositorio.atualizarOperacional(comCadastroOperacional(clienteBase));
      const funcionarioSN = await comoFuncionarioSN();

      const marcar = await funcionarioSN
        .from("cliente_cadastro_operacional_sn")
        .update({ das_status: "enviado" })
        .eq("cliente_id", clienteBase.id);
      expect(marcar.error?.code).toBe("23514");

      await sistemaMarcaEnviado(clienteBase.id, "2026-10-05");
      const adulterar = await funcionarioSN
        .from("cliente_cadastro_operacional_sn")
        .update({ data_envio_das: "2020-01-01" })
        .eq("cliente_id", clienteBase.id);
      expect(adulterar.error).toBeNull();
      expect(await lerDas(admin, clienteBase.id)).toEqual({
        das_status: "enviado",
        data_envio_das: "2026-10-05",
      });
    });

    it("sair de `enviado` limpa a data de envio", async () => {
      const { admin, clienteBase, repositorio } = await prepararFuncionarioSN("62785037000634");
      await repositorio.atualizarOperacional(comCadastroOperacional(clienteBase));
      await sistemaMarcaEnviado(clienteBase.id, "2026-10-05");

      const resultado = await repositorio.atualizarOperacional(
        comCadastroOperacional(clienteBase, { status: "pendente", data: "2026-10-05" }),
      );

      expect(resultado.ok).toBe(true);
      expect(await lerDas(admin, clienteBase.id)).toEqual({
        das_status: "pendente",
        data_envio_das: null,
      });
    });
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
      const viaGateway = await new SupabaseResponsavelClienteRepository(funcionarioSN).atribuir(
        clienteBase.id,
        null,
      );

      expect(direto.error).not.toBeNull();
      expect(viaGateway.ok).toBe(false);
    });

    it("Admin também NÃO atribui o Responsável (só o Líder do SN)", async () => {
      const admin = await comoAdmin();
      const clienteBase = await criarClienteBase(admin, "11444777001052");

      const resultado = await new SupabaseResponsavelClienteRepository(admin).atribuir(
        clienteBase.id,
        FUNCIONARIO_SN_ID,
      );

      expect(resultado.ok).toBe(false);
    });

    it("Líder não atribui Funcionário de outro Setor como Responsável", async () => {
      const admin = await comoAdmin();
      const clienteBase = await criarClienteBase(admin, "11444777001133");
      const lider = await comoLiderSN();

      const resultado = await new SupabaseResponsavelClienteRepository(lider).atribuir(
        clienteBase.id,
        FUNCIONARIO_FINANCEIRO_ID,
      );

      expect(resultado.ok).toBe(false);
    });

    it("excluir o Funcionário Responsável deixa o Cliente 'Sem responsável' (ON DELETE SET NULL)", async () => {
      const servico = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const email = `resp-excluido-${Date.now()}@rigonicontabil.local`;
      const { data: conta, error } = await servico.auth.admin.createUser({
        email,
        password: "Senha-temporaria-123",
        email_confirm: true,
      });
      if (error || !conta.user) throw new Error("falha ao criar conta de teste");
      await servico.from("perfis").insert({
        id: conta.user.id,
        nome: "Funcionário Temporário",
        email,
        papel: "funcionario",
        setor: "simples_nacional",
      });
      const admin = await comoAdmin();
      const clienteBase = await criarClienteBase(admin, "11444777001303");
      await atribuirComoLider(clienteBase.id, conta.user.id);

      await servico.auth.admin.deleteUser(conta.user.id);

      const { data } = await admin
        .from("cliente_cadastro_operacional_sn")
        .select("responsavel_id")
        .eq("cliente_id", clienteBase.id)
        .single();
      expect(data?.responsavel_id).toBeNull();
    });

    // O evento nasce no banco, na transação da escrita.
    describe("auditoria atômica do Responsável", () => {
      const eventosDoResponsavel = async (cnpj: string) => {
        const servico = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { data } = await servico
          .from("registros_auditoria")
          .select("acao, ator, resultado")
          .eq("alvo", cnpj)
          .like("acao", "cliente.%-responsavel")
          .order("criado_em");
        return data ?? [];
      };

      it("atribuir, trocar e remover pela application geram um evento cada, com o ator da sessão", async () => {
        const admin = await comoAdmin();
        const clienteBase = await criarClienteBase(admin, "62785037000120");
        await atribuirComoLider(clienteBase.id, FUNCIONARIO_SN_ID);
        await atribuirComoLider(clienteBase.id, FUNCIONARIO_2_SN_ID);
        await atribuirComoLider(clienteBase.id, null);

        const eventos = await eventosDoResponsavel("62785037000120");
        expect(eventos.map((e) => e.acao)).toEqual([
          "cliente.atribuir-responsavel",
          "cliente.trocar-responsavel",
          "cliente.remover-responsavel",
        ]);
        expect(eventos.every((e) => e.ator === LIDER_SN_ID && e.resultado === "sucesso")).toBe(
          true,
        );
      });

      it("update direto do Líder pela Data API gera exatamente um evento", async () => {
        const admin = await comoAdmin();
        const clienteBase = await criarClienteBase(admin, "62785037000200");
        const lider = await comoLiderSN();

        const direto = await lider
          .from("cliente_cadastro_operacional_sn")
          .update({ responsavel_id: FUNCIONARIO_SN_ID })
          .eq("cliente_id", clienteBase.id);

        expect(direto.error).toBeNull();
        expect((await eventosDoResponsavel("62785037000200")).map((e) => e.acao)).toEqual([
          "cliente.atribuir-responsavel",
        ]);
      });

      it("regravar o mesmo Responsável não gera evento", async () => {
        const admin = await comoAdmin();
        const clienteBase = await criarClienteBase(admin, "62785037000391");
        await atribuirComoLider(clienteBase.id, FUNCIONARIO_SN_ID);
        const lider = await comoLiderSN();

        await lider
          .from("cliente_cadastro_operacional_sn")
          .update({ responsavel_id: FUNCIONARIO_SN_ID })
          .eq("cliente_id", clienteBase.id);

        expect(await eventosDoResponsavel("62785037000391")).toHaveLength(1);
      });
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

  // Cadastrar um Cliente Simples Nacional/MEI já cria a linha do cadastro SN (RPC criar_cliente),
  // em vez de só nascer no primeiro upsert de EditarCadastroOperacionalCliente.
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
