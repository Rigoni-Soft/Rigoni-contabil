/**
 * Integração infra ↔ Supabase: guia anexada da parcela PGFN (`cliente_parcelamento_guias`, #183).
 * Requer `npx supabase start` com migrations + seed aplicados. Prova a RLS por papel, as travas dos
 * gatilhos (só PGFN, um anexo por competência, competência já enviada, só a->confirmada), os grants
 * (UPDATE só de estado, arquivo, conta e motivo, DELETE da guia não enviada, anon nada), a troca e a
 * remoção da guia ainda não enviada e os campos fixos do Parcelamento PGFN e a auditoria de quem anexou e quem confirmou.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { Cliente } from "@/modules/clientes/domain/entities/cliente.entity";
import { SupabaseResponsavelClienteRepository } from "@/modules/clientes/infra/repositories/responsavel-cliente.repository";

import { removerClientesDeTeste } from "../../../../../test-support/clientes-de-teste";
import { SupabaseClienteParcelamentoRepository } from "./cliente-parcelamento.repository";
import { SupabaseClienteRepository } from "./cliente.repository";
import { SupabaseGuiaParcelaPgfnRepository } from "./guia-parcela-pgfn.repository";

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
  "77330001000129",
  "77330002000173",
  "77330003000118",
  "77330004000162",
  "77330005000107",
  "77330006000151",
  "77330007000104",
  "77330008000140",
  "77330009000195",
  "77330010000110",
  "77330011000164",
  "77330099000114",
  "77330012000109",
  "77330013000153",
  "77330014000106",
  "77330015000142",
  "77330016000197",
  "77330017000131",
  "77330018000186",
] as const;
beforeAll(() => removerClientesDeTeste(CNPJS_DA_SUITE));
afterAll(() => removerClientesDeTeste(CNPJS_DA_SUITE));

async function criarClienteResponsavelFuncionarioSN(cnpj: string): Promise<string> {
  const construido = Cliente.builder()
    .comId(crypto.randomUUID())
    .comEmpresa("Padaria Guiada Ltda")
    .comCnpj(cnpj)
    .comRegime("simples_nacional")
    .comAlteracoesContratuais([])
    .build();
  if (!construido.ok) throw new Error("setup inválido");
  const criado = await new SupabaseClienteRepository(await comoAdmin()).criar(construido.value);
  if (!criado.ok) throw new Error("falha ao criar cliente: " + criado.error.message);
  const atribuido = await new SupabaseResponsavelClienteRepository(await comoLiderSN()).atribuir(
    construido.value.id,
    FUNCIONARIO_SN_ID,
  );
  if (!atribuido.ok) throw new Error("falha ao atribuir: " + atribuido.error.message);
  return construido.value.id;
}

async function criarParcelamento(clienteId: string, origem: "pgfn" | "receita_federal" = "pgfn") {
  const id = crypto.randomUUID();
  const salvo = await new SupabaseClienteParcelamentoRepository(await comoFuncionarioSN()).salvar(
    clienteId,
    [
      {
        id,
        codigo: `${origem}-1`,
        parcelasRestantes: 12,
        interno: false,
        arquivoCaminho: `${clienteId}/${id}-acordo.pdf`,
        acordo: {
          origem,
          totalDeParcelas: 12,
          valorDaParcelaCentavos: 10000,
          dataDeAdesao: "2026-01-27",
        },
      },
    ],
  );
  if (!salvo.ok) throw new Error("falha ao criar parcelamento: " + salvo.error.message);
  return id;
}

const guia = (competencia = "202610") => ({
  competencia,
  contaNegociacao: "123456",
  arquivoCaminho: `c/guias-pgfn/p/${competencia}-${crypto.randomUUID()}.pdf`,
});

describe("guia anexada da parcela PGFN", () => {
  it("o motivo de ficar a confirmar é gravado, listado e apagado ao confirmar", async () => {
    const clienteId = await criarClienteResponsavelFuncionarioSN("77330011000164");
    const parcelamentoId = await criarParcelamento(clienteId);
    const repo = new SupabaseGuiaParcelaPgfnRepository(await comoFuncionarioSN());

    expect((await repo.anexar(parcelamentoId, guia(), "Conferir a conta.")).ok).toBe(true);
    let lista = await repo.listar(parcelamentoId);
    expect(lista.ok && lista.value[0]).toMatchObject({
      estado: "a_confirmar",
      motivo: "Conferir a conta.",
    });

    expect((await repo.confirmar(parcelamentoId, "202610")).ok).toBe(true);
    lista = await repo.listar(parcelamentoId);
    expect(lista.ok && lista.value[0]).toEqual({
      competencia: "202610",
      contaNegociacao: "123456",
      estado: "confirmada",
      enviada: false,
    });
  });

  it("o Funcionário SN responsável lê o CNPJ e a conta do Parcelamento para conferir o PDF", async () => {
    const clienteId = await criarClienteResponsavelFuncionarioSN("77330099000114");
    const parcelamentoId = await criarParcelamento(clienteId);
    const repo = new SupabaseGuiaParcelaPgfnRepository(await comoFuncionarioSN());

    const lido = await repo.parcelamento(parcelamentoId);

    expect(lido.ok && lido.value).toEqual({
      clienteId,
      origem: "pgfn",
      codigo: "pgfn-1",
      cnpj: "77330099000114",
    });
  });

  it("o Funcionário SN responsável anexa (a confirmar) e confirma; lista reflete", async () => {
    const clienteId = await criarClienteResponsavelFuncionarioSN("77330001000129");
    const parcelamentoId = await criarParcelamento(clienteId);
    const repo = new SupabaseGuiaParcelaPgfnRepository(await comoFuncionarioSN());

    expect((await repo.anexar(parcelamentoId, guia(), null)).ok).toBe(true);
    let lista = await repo.listar(parcelamentoId);
    expect(lista.ok && lista.value).toEqual([
      { competencia: "202610", contaNegociacao: "123456", estado: "a_confirmar", enviada: false },
    ]);

    expect((await repo.confirmar(parcelamentoId, "202610")).ok).toBe(true);
    lista = await repo.listar(parcelamentoId);
    expect(lista.ok && lista.value[0].estado).toBe("confirmada");
  });

  it("registra quem anexou, quem confirmou e quando; o valor mandado pelo chamador é descartado", async () => {
    const clienteId = await criarClienteResponsavelFuncionarioSN("77330002000173");
    const parcelamentoId = await criarParcelamento(clienteId);
    const funcionario = await comoFuncionarioSN();
    const outroAtor = "99999999-9999-4999-8999-999999999999";

    await funcionario.from("cliente_parcelamento_guias").insert({
      parcelamento_id: parcelamentoId,
      ...{ competencia: "202611", conta_negociacao: "1", arquivo_caminho: "x.pdf" },
      estado: "confirmada",
      anexado_por: outroAtor,
      confirmado_por: outroAtor,
    });
    await new SupabaseGuiaParcelaPgfnRepository(await comoLiderSN()).confirmar(
      parcelamentoId,
      "202611",
    );

    const { data } = await servico()
      .from("cliente_parcelamento_guias")
      .select("estado, anexado_por, anexado_em, confirmado_por, confirmado_em")
      .eq("parcelamento_id", parcelamentoId)
      .single();
    expect(data).toMatchObject({ estado: "confirmada", anexado_por: FUNCIONARIO_SN_ID });
    expect(data?.anexado_em).toBeTruthy();
    expect(data?.confirmado_por).not.toBe(FUNCIONARIO_SN_ID);
    expect(data?.confirmado_por).not.toBe(outroAtor);
    expect(data?.confirmado_em).toBeTruthy();

    const eventos = await servico()
      .from("registros_auditoria")
      .select("acao, resultado")
      .like("alvo", "77330002000173%")
      .in("acao", ["parcelamento.anexar-guia", "parcelamento.confirmar-guia"])
      .order("criado_em");
    expect(eventos.data).toEqual([
      { acao: "parcelamento.anexar-guia", resultado: "sucesso" },
      { acao: "parcelamento.confirmar-guia", resultado: "sucesso" },
    ]);
  });

  it("segundo anexo na mesma competência é recusado; outra competência passa", async () => {
    const clienteId = await criarClienteResponsavelFuncionarioSN("77330003000118");
    const parcelamentoId = await criarParcelamento(clienteId);
    const repo = new SupabaseGuiaParcelaPgfnRepository(await comoFuncionarioSN());

    expect((await repo.anexar(parcelamentoId, guia("202610"), null)).ok).toBe(true);
    const repetido = await repo.anexar(parcelamentoId, guia("202610"), null);
    expect(repetido).toMatchObject({
      ok: false,
      error: { message: "Já existe guia anexada para esta competência." },
    });
    expect((await repo.anexar(parcelamentoId, guia("202611"), null)).ok).toBe(true);
  });

  it("competência com registro de envio não aceita anexo", async () => {
    const clienteId = await criarClienteResponsavelFuncionarioSN("77330004000162");
    const parcelamentoId = await criarParcelamento(clienteId);
    await servico()
      .from("cliente_parcelamento_envios")
      .insert({ parcelamento_id: parcelamentoId, parcela: "202610" });
    const repo = new SupabaseGuiaParcelaPgfnRepository(await comoFuncionarioSN());

    const recusado = await repo.anexar(parcelamentoId, guia("202610"), null);

    expect(recusado).toMatchObject({
      ok: false,
      error: { message: "Competência já enviada: não aceita guia nova nem alteração." },
    });
    expect((await repo.anexar(parcelamentoId, guia("202611"), null)).ok).toBe(true);
  });

  it("só Parcelamento da PGFN recebe guia", async () => {
    const clienteId = await criarClienteResponsavelFuncionarioSN("77330005000107");
    const parcelamentoId = await criarParcelamento(clienteId, "receita_federal");
    const repo = new SupabaseGuiaParcelaPgfnRepository(await comoFuncionarioSN());

    expect(await repo.anexar(parcelamentoId, guia(), null)).toMatchObject({
      ok: false,
      error: { message: "Só Parcelamento da PGFN recebe guia anexada." },
    });
  });

  it("guia confirmada não volta atrás nem muda; confirmar de novo é recusado", async () => {
    const clienteId = await criarClienteResponsavelFuncionarioSN("77330006000151");
    const parcelamentoId = await criarParcelamento(clienteId);
    const funcionario = await comoFuncionarioSN();
    const repo = new SupabaseGuiaParcelaPgfnRepository(funcionario);
    await repo.anexar(parcelamentoId, guia(), null);
    await repo.confirmar(parcelamentoId, "202610");

    expect((await repo.confirmar(parcelamentoId, "202610")).ok).toBe(false);
    const voltar = await funcionario
      .from("cliente_parcelamento_guias")
      .update({ estado: "a_confirmar" })
      .eq("parcelamento_id", parcelamentoId);
    expect(voltar.error).not.toBeNull();
  });

  it("grants: sessão não edita a competência nem quem anexou", async () => {
    const clienteId = await criarClienteResponsavelFuncionarioSN("77330007000104");
    const parcelamentoId = await criarParcelamento(clienteId);
    const funcionario = await comoFuncionarioSN();
    await new SupabaseGuiaParcelaPgfnRepository(funcionario).anexar(parcelamentoId, guia(), null);

    for (const mudanca of [{ competencia: "202611" }, { anexado_por: FUNCIONARIO_SN_ID }]) {
      const recusada = await funcionario
        .from("cliente_parcelamento_guias")
        .update(mudanca)
        .eq("parcelamento_id", parcelamentoId);
      expect(recusada.error).not.toBeNull();
    }
  });

  it("Líder SN e Admin anexam e confirmam em qualquer Cliente do setor; outro Funcionário, outro Setor e anon não", async () => {
    const clienteId = await criarClienteResponsavelFuncionarioSN("77330008000140");
    const parcelamentoId = await criarParcelamento(clienteId);

    const lider = new SupabaseGuiaParcelaPgfnRepository(await comoLiderSN());
    expect((await lider.anexar(parcelamentoId, guia("202610"), null)).ok).toBe(true);
    const admin = new SupabaseGuiaParcelaPgfnRepository(await comoAdmin());
    expect((await admin.anexar(parcelamentoId, guia("202611"), null)).ok).toBe(true);
    expect((await admin.confirmar(parcelamentoId, "202610")).ok).toBe(true);

    for (const sessao of [await comoFuncionario2SN(), await comoFuncionarioFinanceiro()]) {
      const repo = new SupabaseGuiaParcelaPgfnRepository(sessao);
      expect((await repo.anexar(parcelamentoId, guia("202612"), null)).ok).toBe(false);
      expect((await repo.confirmar(parcelamentoId, "202611")).ok).toBe(false);
    }

    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    expect(
      (await anon.from("cliente_parcelamento_guias").select("competencia")).error,
    ).not.toBeNull();
  });

  it("mesma visibilidade do Parcelamento: outro Setor lê a lista (e só lê)", async () => {
    const clienteId = await criarClienteResponsavelFuncionarioSN("77330009000195");
    const parcelamentoId = await criarParcelamento(clienteId);
    await new SupabaseGuiaParcelaPgfnRepository(await comoFuncionarioSN()).anexar(
      parcelamentoId,
      guia(),
      null,
    );

    const financeiro = await comoFuncionarioFinanceiro();
    const lista = await new SupabaseGuiaParcelaPgfnRepository(financeiro).listar(parcelamentoId);

    expect(lista.ok && lista.value).toHaveLength(1);
  });

  it("remover o Parcelamento leva as guias junto (cascata)", async () => {
    const clienteId = await criarClienteResponsavelFuncionarioSN("77330010000110");
    const parcelamentoId = await criarParcelamento(clienteId);
    await new SupabaseGuiaParcelaPgfnRepository(await comoFuncionarioSN()).anexar(
      parcelamentoId,
      guia(),
      null,
    );

    await new SupabaseClienteParcelamentoRepository(await comoFuncionarioSN()).salvar(
      clienteId,
      [],
    );

    const restou = await servico()
      .from("cliente_parcelamento_guias")
      .select("competencia")
      .eq("parcelamento_id", parcelamentoId);
    expect(restou.data).toEqual([]);
  });

  describe("trocar e remover (#184)", () => {
    it("troca o PDF da guia: volta a confirmar, renova quem anexou e audita", async () => {
      const clienteId = await criarClienteResponsavelFuncionarioSN("77330012000109");
      const parcelamentoId = await criarParcelamento(clienteId);
      const repo = new SupabaseGuiaParcelaPgfnRepository(await comoFuncionarioSN());
      await repo.anexar(parcelamentoId, guia("202610"), null);
      await repo.confirmar(parcelamentoId, "202610");
      const nova = guia("202610");

      const trocada = await repo.substituir(
        parcelamentoId,
        "202610",
        { contaNegociacao: "999", arquivoCaminho: nova.arquivoCaminho },
        "Conferir a conta.",
      );

      expect(trocada.ok).toBe(true);
      expect(await repo.arquivo(parcelamentoId, "202610")).toEqual({
        ok: true,
        value: nova.arquivoCaminho,
      });
      const lista = await repo.listar(parcelamentoId);
      expect(lista.ok && lista.value).toEqual([
        {
          competencia: "202610",
          contaNegociacao: "999",
          estado: "a_confirmar",
          motivo: "Conferir a conta.",
          enviada: false,
        },
      ]);
      const linha = await servico()
        .from("cliente_parcelamento_guias")
        .select("anexado_por, confirmado_por, confirmado_em")
        .eq("parcelamento_id", parcelamentoId)
        .single();
      expect(linha.data).toEqual({
        anexado_por: FUNCIONARIO_SN_ID,
        confirmado_por: null,
        confirmado_em: null,
      });
      const auditoria = await servico()
        .from("registros_auditoria")
        .select("acao, ator")
        .eq("acao", "parcelamento.trocar-guia")
        .like("alvo", "%77330012000109%");
      expect(auditoria.data).toEqual([
        { acao: "parcelamento.trocar-guia", ator: FUNCIONARIO_SN_ID },
      ]);
    });

    it("mexer na conta sem trocar o PDF não vale (só a troca de PDF devolve a guia a confirmar)", async () => {
      const clienteId = await criarClienteResponsavelFuncionarioSN("77330013000153");
      const parcelamentoId = await criarParcelamento(clienteId);
      const funcionario = await comoFuncionarioSN();
      await new SupabaseGuiaParcelaPgfnRepository(funcionario).anexar(
        parcelamentoId,
        guia("202610"),
        null,
      );

      const mexer = await funcionario
        .from("cliente_parcelamento_guias")
        .update({ conta_negociacao: "outra" })
        .eq("parcelamento_id", parcelamentoId);

      expect(mexer.error).not.toBeNull();
    });

    it("guia de competência já enviada não troca nem remove", async () => {
      const clienteId = await criarClienteResponsavelFuncionarioSN("77330014000106");
      const parcelamentoId = await criarParcelamento(clienteId);
      const repo = new SupabaseGuiaParcelaPgfnRepository(await comoFuncionarioSN());
      const original = guia("202610");
      await repo.anexar(parcelamentoId, original, null);
      await servico()
        .from("cliente_parcelamento_envios")
        .insert({ parcelamento_id: parcelamentoId, parcela: "202610" });

      const trocada = await repo.substituir(
        parcelamentoId,
        "202610",
        { contaNegociacao: "123456", arquivoCaminho: guia("202610").arquivoCaminho },
        null,
      );
      const removida = await repo.remover(parcelamentoId, "202610");

      const enviada = "Competência já enviada: não aceita guia nova nem alteração.";
      expect(trocada).toMatchObject({ ok: false, error: { message: enviada } });
      expect(removida).toMatchObject({ ok: false, error: { message: enviada } });
      expect(await repo.arquivo(parcelamentoId, "202610")).toEqual({
        ok: true,
        value: original.arquivoCaminho,
      });
    });

    it("remove a guia não enviada e audita; a competência pode ser anexada de novo", async () => {
      const clienteId = await criarClienteResponsavelFuncionarioSN("77330015000142");
      const parcelamentoId = await criarParcelamento(clienteId);
      const repo = new SupabaseGuiaParcelaPgfnRepository(await comoFuncionarioSN());
      await repo.anexar(parcelamentoId, guia("202610"), null);

      expect((await repo.remover(parcelamentoId, "202610")).ok).toBe(true);

      expect(await repo.arquivo(parcelamentoId, "202610")).toEqual({ ok: true, value: null });
      expect((await repo.anexar(parcelamentoId, guia("202610"), null)).ok).toBe(true);
      const auditoria = await servico()
        .from("registros_auditoria")
        .select("acao")
        .eq("acao", "parcelamento.remover-guia")
        .like("alvo", "%77330015000142%");
      expect(auditoria.data).toEqual([{ acao: "parcelamento.remover-guia" }]);
    });

    it("quem não edita o cadastro operacional não troca nem remove; guia inexistente é não encontrada", async () => {
      const clienteId = await criarClienteResponsavelFuncionarioSN("77330016000197");
      const parcelamentoId = await criarParcelamento(clienteId);
      await new SupabaseGuiaParcelaPgfnRepository(await comoFuncionarioSN()).anexar(
        parcelamentoId,
        guia("202610"),
        null,
      );

      for (const sessao of [await comoFuncionario2SN(), await comoFuncionarioFinanceiro()]) {
        const repo = new SupabaseGuiaParcelaPgfnRepository(sessao);
        const trocada = await repo.substituir(
          parcelamentoId,
          "202610",
          { contaNegociacao: "1", arquivoCaminho: guia("202610").arquivoCaminho },
          null,
        );
        expect(trocada.ok).toBe(false);
        expect((await repo.remover(parcelamentoId, "202610")).ok).toBe(false);
      }
      const lider = new SupabaseGuiaParcelaPgfnRepository(await comoLiderSN());
      expect(await lider.remover(parcelamentoId, "209912")).toMatchObject({ ok: false });
      expect((await lider.remover(parcelamentoId, "202610")).ok).toBe(true);
    });
  });

  describe("Parcelamento PGFN cadastrado só ganha guias (#184)", () => {
    it("a sessão não muda código, origem, interno nem restantes de um PGFN; o sistema desconta a parcela", async () => {
      const clienteId = await criarClienteResponsavelFuncionarioSN("77330017000131");
      const parcelamentoId = await criarParcelamento(clienteId);
      const funcionario = await comoFuncionarioSN();

      for (const mudanca of [
        { codigo: "OUTRO" },
        { interno: true },
        { parcelas_restantes: 5 },
        { origem: "receita_federal" },
      ]) {
        const direto = await funcionario
          .from("cliente_parcelamentos")
          .update(mudanca)
          .eq("id", parcelamentoId)
          .select("id");
        expect(direto.error).not.toBeNull();
      }
      const porRpc = await new SupabaseClienteParcelamentoRepository(funcionario).salvar(
        clienteId,
        [
          {
            id: parcelamentoId,
            codigo: "OUTRO",
            parcelasRestantes: 5,
            interno: true,
            arquivoCaminho: `${clienteId}/${parcelamentoId}-acordo.pdf`,
          },
        ],
      );
      expect(porRpc.ok).toBe(false);

      const sistema = await servico()
        .from("cliente_parcelamentos")
        .update({ parcelas_restantes: 11 })
        .eq("id", parcelamentoId)
        .select("parcelas_restantes");
      expect(sistema.data).toEqual([{ parcelas_restantes: 11 }]);
    });

    it("o Parcelamento da Receita continua editável", async () => {
      const clienteId = await criarClienteResponsavelFuncionarioSN("77330018000186");
      const parcelamentoId = await criarParcelamento(clienteId, "receita_federal");

      const editado = await (
        await comoFuncionarioSN()
      )
        .from("cliente_parcelamentos")
        .update({ codigo: "NOVO", interno: true })
        .eq("id", parcelamentoId)
        .select("id");

      expect(editado.error).toBeNull();
      expect(editado.data).toHaveLength(1);
    });
  });
});
