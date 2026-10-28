/**
 * Integração infra ↔ Supabase: Parcelamentos do Cliente (tabela filha `cliente_parcelamentos`) e o
 * registro de envio por parcela. Requer `npx supabase start` com migrations + seed aplicados.
 * Prova a matriz de RLS por papel, os gatilhos BEFORE (ADR 0008), a imutabilidade do `cliente_id`,
 * a remoção bloqueada por envio, a auditoria e o bucket privado.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { Cliente } from "@/modules/clientes/domain/entities/cliente.entity";
import { SupabaseResponsavelClienteRepository } from "@/modules/clientes/infra/repositories/responsavel-cliente.repository";
import { ResultadoIncertoError } from "@/shared/errors/resultado-incerto.error";
import { mesAtual } from "@/shared/kernel/mes-atual";

import { removerClientesDeTeste } from "../../../../../test-support/clientes-de-teste";
import { SupabaseClienteParcelamentoRepository } from "./cliente-parcelamento.repository";
import { SupabaseClienteRepository } from "./cliente.repository";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

async function clienteAutenticado(email: string, senha: string): Promise<SupabaseClient> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`Falha ao autenticar ${email}: ${error.message}`);
  return supabase;
}

const comoAdmin = () => clienteAutenticado("admin@rigonicontabil.local", "admin123");
const comoFuncionarioSN = () =>
  clienteAutenticado("funcionario.sn@rigonicontabil.local", "func123");
const comoFuncionario2SN = () =>
  clienteAutenticado("funcionario2.sn@rigonicontabil.local", "func123");
const comoFuncionarioFinanceiro = () =>
  clienteAutenticado("funcionario.financeiro@rigonicontabil.local", "func123");
const comoLiderSN = () => clienteAutenticado("lider.sn@rigonicontabil.local", "lider123");
const servico = () =>
  createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const FUNCIONARIO_SN_ID = "22222222-2222-2222-2222-222222222222";

const CNPJS_DA_SUITE = [
  "77310001000167",
  "77310002000101",
  "77310003000156",
  "77310004000109",
  "77310005000145",
  "77310006000190",
  "77310007000134",
  "77310008000189",
  "77310009000123",
  "77310010000158",
  "77310011000100",
  "77310012000147",
] as const;
beforeAll(() => removerClientesDeTeste(CNPJS_DA_SUITE));
afterAll(() => removerClientesDeTeste(CNPJS_DA_SUITE));

async function criarClienteResponsavelFuncionarioSN(cnpj: string): Promise<string> {
  const construido = Cliente.builder()
    .comId(crypto.randomUUID())
    .comEmpresa("Padaria Parcelada Ltda")
    .comCnpj(cnpj)
    .comRegime("simples_nacional")
    .comAlteracoesContratuais([])
    .build();
  if (!construido.ok) throw new Error("setup inválido");
  const admin = await comoAdmin();
  const criado = await new SupabaseClienteRepository(admin).criar(construido.value);
  if (!criado.ok) throw new Error("falha ao criar cliente: " + criado.error.message);
  const lider = await comoLiderSN();
  const atribuido = await new SupabaseResponsavelClienteRepository(lider).atribuir(
    construido.value.id,
    FUNCIONARIO_SN_ID,
  );
  if (!atribuido.ok) throw new Error("falha ao atribuir: " + atribuido.error.message);
  return construido.value.id;
}

// O anexo pertence ao Parcelamento: `<cliente>/<id>-<nome>` (gatilho de criação).
const parcelamento = (clienteId: string, sobrescrever: Partial<Record<string, unknown>> = {}) => {
  const id = crypto.randomUUID();
  return {
    id,
    codigo: "PARC-001",
    parcelasRestantes: 12,
    interno: false,
    arquivoCaminho: `${clienteId}/${id}-acordo.pdf`,
    ...sobrescrever,
  };
};

const AAAAMM = mesAtual().replace("-", "");

describe("Parcelamentos do Cliente", () => {
  it("o Funcionário SN responsável adiciona, edita e remove, e a lista reflete", async () => {
    const clienteId = await criarClienteResponsavelFuncionarioSN("77310001000167");
    const repo = new SupabaseClienteParcelamentoRepository(await comoFuncionarioSN());
    const a = parcelamento(clienteId, { codigo: "A-1" });
    const b = parcelamento(clienteId, { codigo: "B-2", interno: true });

    expect((await repo.salvar(clienteId, [a, b])).ok).toBe(true);
    const lista = await repo.listar(clienteId);
    expect(lista.ok && lista.value.map((p) => [p.codigo, p.parcelasRestantes, p.interno])).toEqual(
      expect.arrayContaining([
        ["A-1", 12, false],
        ["B-2", 12, true],
      ]),
    );

    // editar mantém o anexo; remover é "ausente da lista"
    expect(
      (await repo.salvar(clienteId, [{ ...a, parcelasRestantes: 5, arquivoCaminho: "outro.pdf" }]))
        .ok,
    ).toBe(true);
    const depois = await repo.listar(clienteId);
    expect(depois.ok && depois.value).toHaveLength(1);
    expect(depois.ok && depois.value[0]).toMatchObject({
      codigo: "A-1",
      parcelasRestantes: 5,
      arquivoCaminho: a.arquivoCaminho,
      quitado: false,
      temEnvio: false,
      enviadoNoMes: false,
    });
  });

  it("grava os dados do acordo lidos do PDF só na criação; a edição não os altera", async () => {
    const clienteId = await criarClienteResponsavelFuncionarioSN("77310009000123");
    const repo = new SupabaseClienteParcelamentoRepository(await comoFuncionarioSN());
    const acordo = {
      origem: "pgfn",
      totalDeParcelas: 5,
      valorDaParcelaCentavos: 26289,
      dataDeAdesao: "2026-01-27",
    } as const;
    const a = parcelamento(clienteId, { codigo: "PGFN-1", acordo });

    expect((await repo.salvar(clienteId, [a])).ok).toBe(true);
    const salvo = await repo.listar(clienteId);
    expect(salvo.ok && salvo.value[0].acordo).toEqual(acordo);

    // Editar as parcelas restantes devolve o mesmo acordo; o que vier de novo é ignorado.
    await repo.salvar(clienteId, [
      { ...a, parcelasRestantes: 3, acordo: { ...acordo, totalDeParcelas: 99 } },
    ]);
    const depois = await repo.listar(clienteId);
    expect(depois.ok && depois.value[0].acordo).toEqual(acordo);
  });

  it("Parcelamento sem acordo (digitado à mão) volta com os dados do acordo nulos", async () => {
    const clienteId = await criarClienteResponsavelFuncionarioSN("77310010000158");
    const repo = new SupabaseClienteParcelamentoRepository(await comoFuncionarioSN());

    await repo.salvar(clienteId, [parcelamento(clienteId, { codigo: "MAO-1" })]);

    const lista = await repo.listar(clienteId);
    expect(lista.ok && lista.value[0].acordo).toEqual({
      origem: null,
      totalDeParcelas: null,
      valorDaParcelaCentavos: null,
      dataDeAdesao: null,
    });
  });

  it("Líder SN e Admin gravam em qualquer Cliente; Funcionário não responsável e outro Setor não", async () => {
    const clienteId = await criarClienteResponsavelFuncionarioSN("77310002000101");

    expect(
      (
        await new SupabaseClienteParcelamentoRepository(await comoLiderSN()).salvar(clienteId, [
          parcelamento(clienteId, { codigo: "L-1" }),
        ])
      ).ok,
    ).toBe(true);
    expect(
      (
        await new SupabaseClienteParcelamentoRepository(await comoAdmin()).salvar(clienteId, [
          parcelamento(clienteId, { codigo: "A-1" }),
        ])
      ).ok,
    ).toBe(true);
    expect(
      (
        await new SupabaseClienteParcelamentoRepository(await comoFuncionario2SN()).salvar(
          clienteId,
          [parcelamento(clienteId, { codigo: "X-1" })],
        )
      ).ok,
    ).toBe(false);
    expect(
      (
        await new SupabaseClienteParcelamentoRepository(await comoFuncionarioFinanceiro()).salvar(
          clienteId,
          [parcelamento(clienteId, { codigo: "F-1" })],
        )
      ).ok,
    ).toBe(false);

    // outro Setor lê (como lê o resto do cadastro), mas não grava; o Funcionário SN não responsável nem lê
    const doOutroSetor = await new SupabaseClienteParcelamentoRepository(
      await comoFuncionarioFinanceiro(),
    ).listar(clienteId);
    expect(doOutroSetor.ok && doOutroSetor.value).toHaveLength(1);
    const doNaoResponsavel = await new SupabaseClienteParcelamentoRepository(
      await comoFuncionario2SN(),
    ).listar(clienteId);
    expect(doNaoResponsavel.ok && doNaoResponsavel.value).toEqual([]);
  });

  it("anon não acessa a tabela nem o registro de envio", async () => {
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    expect((await anon.from("cliente_parcelamentos").select("id")).error).not.toBeNull();
    expect((await anon.from("cliente_parcelamento_envios").select("parcela")).error).not.toBeNull();
  });

  describe("campos só do sistema (gatilho BEFORE)", () => {
    it("sessão não grava parcelas restantes em zero, nem quitação, nem troca o anexo ou o Cliente", async () => {
      const clienteId = await criarClienteResponsavelFuncionarioSN("77310003000156");
      const outroCliente = await criarClienteResponsavelFuncionarioSN("77310004000109");
      const admin = await comoAdmin();
      const repo = new SupabaseClienteParcelamentoRepository(admin);
      const p = parcelamento(clienteId);
      expect((await repo.salvar(clienteId, [p])).ok).toBe(true);

      expect((await repo.salvar(clienteId, [{ ...p, parcelasRestantes: 0 }])).ok).toBe(false);
      expect(
        (
          await repo.salvar(clienteId, [
            parcelamento(clienteId, { codigo: "Z", parcelasRestantes: 0 }),
          ])
        ).ok,
      ).toBe(false);

      const direto = (campos: Record<string, unknown>) =>
        admin.from("cliente_parcelamentos").update(campos).eq("id", p.id).select("id");
      expect((await direto({ situacao: "quitado" })).error).not.toBeNull();
      expect((await direto({ arquivo_caminho: "troca.pdf" })).error).not.toBeNull();
      expect((await direto({ cliente_id: outroCliente })).error).not.toBeNull();

      const idNova = crypto.randomUUID();
      const nova = await admin.from("cliente_parcelamentos").insert({
        id: idNova,
        cliente_id: clienteId,
        codigo: "Q-1",
        parcelas_restantes: 3,
        arquivo_caminho: `${clienteId}/${idNova}-q.pdf`,
        situacao: "quitado",
      });
      expect(nova.error).not.toBeNull();
    });

    it("parcelamento quitado pelo sistema não pode ser editado por sessão, mas segue listado como Quitado", async () => {
      const clienteId = await criarClienteResponsavelFuncionarioSN("77310005000145");
      const repo = new SupabaseClienteParcelamentoRepository(await comoFuncionarioSN());
      const p = parcelamento(clienteId, { parcelasRestantes: 1 });
      expect((await repo.salvar(clienteId, [p])).ok).toBe(true);
      // o sistema (sem sessão) entrega a última parcela e zera
      const zerou = await servico()
        .from("cliente_parcelamentos")
        .update({ parcelas_restantes: 0, situacao: "quitado" })
        .eq("id", p.id);
      expect(zerou.error).toBeNull();

      const lista = await repo.listar(clienteId);
      expect(lista.ok && lista.value[0]).toMatchObject({ parcelasRestantes: 0, quitado: true });
      // reenviar o mesmo valor (o formulário reenvia a lista inteira) passa; mudar, não
      expect((await repo.salvar(clienteId, [{ ...p, parcelasRestantes: 0 }])).ok).toBe(true);
      expect((await repo.salvar(clienteId, [{ ...p, parcelasRestantes: 4 }])).ok).toBe(false);
    });
  });

  describe("anexo pertence ao Parcelamento (F2)", () => {
    it("sessão não cria Parcelamento apontando ao PDF de outro, nem a caminho de outro Cliente", async () => {
      const clienteId = await criarClienteResponsavelFuncionarioSN("77310011000100");
      const repo = new SupabaseClienteParcelamentoRepository(await comoFuncionarioSN());
      const a = parcelamento(clienteId, { codigo: "A" });
      expect((await repo.salvar(clienteId, [a])).ok).toBe(true);

      const roubaDeA = parcelamento(clienteId, { codigo: "B", arquivoCaminho: a.arquivoCaminho });
      expect((await repo.salvar(clienteId, [a, roubaDeA])).ok).toBe(false);
      const deOutroCliente = parcelamento(clienteId, {
        codigo: "C",
        arquivoCaminho: `${crypto.randomUUID()}/${crypto.randomUUID()}-x.pdf`,
      });
      expect((await repo.salvar(clienteId, [a, deOutroCliente])).ok).toBe(false);

      const lista = await repo.listar(clienteId);
      expect(lista.ok && lista.value.map((p) => p.codigo)).toEqual(["A"]);
    });
  });

  describe("PGFN fora do envio automático (F3)", () => {
    it("acordo da PGFN não deixa o Cliente com Parcelamento pendente para o job", async () => {
      const clienteId = await criarClienteResponsavelFuncionarioSN("77310012000147");
      const repo = new SupabaseClienteParcelamentoRepository(await comoFuncionarioSN());
      const acordo = {
        origem: "pgfn",
        totalDeParcelas: 5,
        valorDaParcelaCentavos: 100,
        dataDeAdesao: "2026-01-27",
      } as const;
      expect((await repo.salvar(clienteId, [parcelamento(clienteId, { acordo })])).ok).toBe(true);
      const pendente = () =>
        servico().rpc("cliente_tem_parcelamento_pendente", { p_cliente_id: clienteId });
      expect((await pendente()).data).toBe(false);

      const receita = parcelamento(clienteId, {
        codigo: "R-1",
        acordo: { ...acordo, origem: "receita_federal" },
      });
      const atuais = await repo.listar(clienteId);
      if (!atuais.ok) throw new Error("lista");
      expect((await repo.salvar(clienteId, [...atuais.value, receita])).ok).toBe(true);
      expect((await pendente()).data).toBe(true);
    });
  });

  describe("registro de envio", () => {
    it("só o sistema grava; um por parcelamento e parcela; bloqueia a remoção e aparece como enviado no mês", async () => {
      const clienteId = await criarClienteResponsavelFuncionarioSN("77310006000190");
      const sessao = await comoFuncionarioSN();
      const repo = new SupabaseClienteParcelamentoRepository(sessao);
      const p = parcelamento(clienteId);
      expect((await repo.salvar(clienteId, [p])).ok).toBe(true);

      // nenhuma sessão grava, nem o Admin
      for (const quem of [sessao, await comoAdmin(), await comoLiderSN()]) {
        const r = await quem
          .from("cliente_parcelamento_envios")
          .insert({ parcelamento_id: p.id, parcela: AAAAMM });
        expect(r.error).not.toBeNull();
      }

      const sistema = servico();
      expect(
        (
          await sistema
            .from("cliente_parcelamento_envios")
            .insert({ parcelamento_id: p.id, parcela: AAAAMM })
        ).error,
      ).toBeNull();
      expect(
        (
          await sistema
            .from("cliente_parcelamento_envios")
            .insert({ parcelamento_id: p.id, parcela: AAAAMM })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await sistema
            .from("cliente_parcelamento_envios")
            .insert({ parcelamento_id: p.id, parcela: "2026-10" })
        ).error,
      ).not.toBeNull();

      const lista = await repo.listar(clienteId);
      expect(lista.ok && lista.value[0]).toMatchObject({ temEnvio: true, enviadoNoMes: true });

      // a sessão lê o registro (RLS pelo Cliente) mas não o apaga
      const lido = await sessao
        .from("cliente_parcelamento_envios")
        .select("parcela")
        .eq("parcelamento_id", p.id);
      expect(lido.data).toEqual([{ parcela: AAAAMM }]);
      await sessao.from("cliente_parcelamento_envios").delete().eq("parcelamento_id", p.id);
      const restou = await sistema
        .from("cliente_parcelamento_envios")
        .select("parcela")
        .eq("parcelamento_id", p.id);
      expect(restou.data).toHaveLength(1);

      // remoção bloqueada, pela RPC e pelo DML direto
      const removido = await repo.salvar(clienteId, []);
      expect(removido.ok).toBe(false);
      expect(
        (await sessao.from("cliente_parcelamentos").delete().eq("id", p.id).select("id")).error,
      ).not.toBeNull();
      const aindaLa = await repo.listar(clienteId);
      expect(aindaLa.ok && aindaLa.value).toHaveLength(1);
    });

    it("o envio de uma parcela de outro mês não marca o mês corrente", async () => {
      const clienteId = await criarClienteResponsavelFuncionarioSN("77310007000134");
      const repo = new SupabaseClienteParcelamentoRepository(await comoFuncionarioSN());
      const p = parcelamento(clienteId);
      expect((await repo.salvar(clienteId, [p])).ok).toBe(true);
      await servico()
        .from("cliente_parcelamento_envios")
        .insert({ parcelamento_id: p.id, parcela: "200001" });
      const lista = await repo.listar(clienteId);
      expect(lista.ok && lista.value[0]).toMatchObject({ temEnvio: true, enviadoNoMes: false });
    });
  });

  it("audita a edição como um evento por transação, com o ator da sessão", async () => {
    const cnpj = "77310008000189";
    const clienteId = await criarClienteResponsavelFuncionarioSN(cnpj);
    const repo = new SupabaseClienteParcelamentoRepository(await comoFuncionarioSN());
    expect(
      (
        await repo.salvar(clienteId, [
          parcelamento(clienteId, { codigo: "A" }),
          parcelamento(clienteId, { codigo: "B" }),
        ])
      ).ok,
    ).toBe(true);

    const eventos = await servico()
      .from("registros_auditoria")
      .select("acao, ator, resultado")
      .eq("alvo", cnpj)
      .eq("acao", "cliente.editar-operacional");
    expect(eventos.data).toEqual([
      { acao: "cliente.editar-operacional", ator: FUNCIONARIO_SN_ID, resultado: "sucesso" },
    ]);
  });
});

describe("resposta sem desfecho conhecido", () => {
  it.each([0, 502, 504])(
    "status %s vira ResultadoIncertoError, não erro definitivo",
    async (status) => {
      const supabase = { rpc: async () => ({ error: { message: "gateway" }, status }) };
      const repo = new SupabaseClienteParcelamentoRepository(supabase as never);

      const r = await repo.salvar(crypto.randomUUID(), []);

      expect(!r.ok && r.error).toBeInstanceOf(ResultadoIncertoError);
    },
  );

  it("erro do banco (status 4xx) segue definitivo", async () => {
    const supabase = { rpc: async () => ({ error: { message: "x", code: "42501" }, status: 403 }) };
    const repo = new SupabaseClienteParcelamentoRepository(supabase as never);

    const r = await repo.salvar(crypto.randomUUID(), []);

    expect(!r.ok && r.error).not.toBeInstanceOf(ResultadoIncertoError);
  });
});

describe("bucket parcelamentos-clientes", () => {
  it("é privado, só PDF, 10 MiB, e nenhuma sessão de usuário lê ou grava", async () => {
    const { data: bucket } = await servico().storage.getBucket("parcelamentos-clientes");
    expect(bucket).toMatchObject({
      public: false,
      file_size_limit: 10485760,
      allowed_mime_types: ["application/pdf"],
    });

    const sistema = servico();
    const caminho = `teste-${crypto.randomUUID()}.pdf`;
    const pdf = new Blob(["%PDF-1.4"], { type: "application/pdf" });
    expect(
      (await sistema.storage.from("parcelamentos-clientes").upload(caminho, pdf)).error,
    ).toBeNull();

    for (const quem of [await comoAdmin(), await comoLiderSN(), await comoFuncionarioSN()]) {
      const bucketDoUsuario = quem.storage.from("parcelamentos-clientes");
      expect((await bucketDoUsuario.download(caminho)).error).not.toBeNull();
      expect((await bucketDoUsuario.upload(`u-${caminho}`, pdf)).error).not.toBeNull();
    }
    await sistema.storage.from("parcelamentos-clientes").remove([caminho]);
  });
});
