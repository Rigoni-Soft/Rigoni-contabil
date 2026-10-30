/**
 * Integração infra ↔ Supabase para os gatilhos dos Avisos de cadastro.
 * Requer `npx supabase start` local com migrations + seed aplicados. `service_role` só monta cenário.
 */
import { criarAdminLocal } from "../../../../../test-support/admin-supabase-local";
import {
  criarClienteDeTeste,
  removerClientesDeTeste,
} from "../../../../../test-support/clientes-de-teste";

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const servico = criarAdminLocal(SERVICE_KEY);

const ADMIN_ID = "11111111-1111-1111-1111-111111111111";
const LIDER_SN_ID = "88888888-8888-8888-8888-888888888888";
const FUNCIONARIO_SN_ID = "22222222-2222-2222-2222-222222222222";
const CNPJ_SN = "11222333000181";
const CNPJ_LUCRO = "11444777000161";
const CNPJS = [CNPJ_SN, CNPJ_LUCRO];

async function avisosDoCliente(clienteId: string) {
  const { data, error } = await servico
    .from("avisos_cadastro")
    .select("destinatario_id, tipo, cliente_id, alteracao_id, alteracao_numero, visto_em")
    .eq("cliente_id", clienteId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function anexarAlteracao(clienteId: string, numero: number): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await servico.from("cliente_alteracoes_contratuais").insert({
    id,
    cliente_id: clienteId,
    numero,
    data: "2025-03-10",
    arquivo_caminho: `${clienteId}/alteracoes-contratuais/${numero}-a.pdf`,
  });
  if (error) throw new Error(error.message);
  return id;
}

async function atribuirResponsavel(clienteId: string, responsavelId: string | null) {
  const { error } = await servico
    .from("cliente_cadastro_operacional_sn")
    .update({ responsavel_id: responsavelId })
    .eq("cliente_id", clienteId);
  if (error) throw new Error(error.message);
}

async function atualizarPerfil(id: string, campos: Record<string, unknown>) {
  const { error } = await servico.from("perfis").update(campos).eq("id", id);
  if (error) throw new Error(error.message);
}

async function destinatarios(clienteId: string, tipo: string): Promise<string[]> {
  return (await avisosDoCliente(clienteId))
    .filter((a) => a.tipo === tipo)
    .map((a) => a.destinatario_id)
    .sort();
}

async function definirDesativadoLider(desativado: boolean) {
  const { error } = await servico
    .from("perfis")
    .update({ desativado_em: desativado ? new Date().toISOString() : null })
    .eq("id", LIDER_SN_ID);
  if (error) throw new Error(error.message);
}

beforeAll(() => removerClientesDeTeste(CNPJS));
afterEach(async () => {
  await definirDesativadoLider(false);
  await atualizarPerfil(FUNCIONARIO_SN_ID, { papel: "funcionario", desativado_em: null });
  await atualizarPerfil(LIDER_SN_ID, { papel: "lider_setor" });
  await removerClientesDeTeste(CNPJS);
});
afterAll(() => removerClientesDeTeste(CNPJS));

describe("Aviso de cadastro: gatilho novo cliente (#142, S2a)", () => {
  it("Cadastro operacional SN novo gera uma linha para o Líder ativo do Setor SN", async () => {
    const clienteId = await criarClienteDeTeste(CNPJ_SN, "simples_nacional");

    const avisos = await avisosDoCliente(clienteId);

    expect(avisos).toEqual([
      {
        destinatario_id: LIDER_SN_ID,
        tipo: "novo_cliente",
        cliente_id: clienteId,
        alteracao_id: null,
        alteracao_numero: null,
        visto_em: null,
      },
    ]);
  });

  it("sem Líder ativo no Setor SN, nenhuma linha (e nada para o Admin)", async () => {
    await definirDesativadoLider(true);

    const clienteId = await criarClienteDeTeste(CNPJ_SN, "mei");

    expect(await avisosDoCliente(clienteId)).toEqual([]);
  });

  it("o Admin não recebe aviso", async () => {
    const clienteId = await criarClienteDeTeste(CNPJ_SN, "simples_nacional");

    const avisos = await avisosDoCliente(clienteId);

    expect(avisos.map((a) => a.destinatario_id)).not.toContain(ADMIN_ID);
  });

  it("Cliente de outro regime (sem Cadastro operacional SN) não gera aviso", async () => {
    const clienteId = await criarClienteDeTeste(CNPJ_LUCRO, "lucro_presumido");

    expect(await avisosDoCliente(clienteId)).toEqual([]);
  });
});

describe("Aviso de cadastro: gatilho nova alteração (#142, S2b)", () => {
  it("anexar alteração avisa o Líder e o Responsável (2 linhas)", async () => {
    const clienteId = await criarClienteDeTeste(CNPJ_SN, "simples_nacional");
    await atribuirResponsavel(clienteId, FUNCIONARIO_SN_ID);

    const alteracaoId = await anexarAlteracao(clienteId, 1);

    expect(await destinatarios(clienteId, "nova_alteracao")).toEqual(
      [LIDER_SN_ID, FUNCIONARIO_SN_ID].sort(),
    );
    const avisos = await avisosDoCliente(clienteId);
    expect(
      avisos
        .filter((a) => a.tipo === "nova_alteracao")
        .every((a) => a.alteracao_id === alteracaoId),
    ).toBe(true);
  });

  it("cada aviso leva o nº da alteração que o gerou, para quem não lê a tabela (#144)", async () => {
    const clienteId = await criarClienteDeTeste(CNPJ_SN, "simples_nacional");
    await atribuirResponsavel(clienteId, FUNCIONARIO_SN_ID);

    const id2 = await anexarAlteracao(clienteId, 2);
    const id7 = await anexarAlteracao(clienteId, 7);

    const porAlteracao = (await avisosDoCliente(clienteId))
      .filter((a) => a.tipo === "nova_alteracao")
      .map((a) => `${a.alteracao_id}:${a.alteracao_numero}`)
      .sort();
    expect(porAlteracao).toEqual([`${id2}:2`, `${id2}:2`, `${id7}:7`, `${id7}:7`].sort());
  });

  it("Líder que também é o Responsável recebe uma linha só", async () => {
    const clienteId = await criarClienteDeTeste(CNPJ_SN, "simples_nacional");
    await atribuirResponsavel(clienteId, FUNCIONARIO_SN_ID);
    await atualizarPerfil(LIDER_SN_ID, { papel: "funcionario" });
    await atualizarPerfil(FUNCIONARIO_SN_ID, { papel: "lider_setor" });

    await anexarAlteracao(clienteId, 1);

    expect(await destinatarios(clienteId, "nova_alteracao")).toEqual([FUNCIONARIO_SN_ID]);
  });

  it("Responsável desativado: só o Líder", async () => {
    const clienteId = await criarClienteDeTeste(CNPJ_SN, "simples_nacional");
    await atribuirResponsavel(clienteId, FUNCIONARIO_SN_ID);
    await atualizarPerfil(FUNCIONARIO_SN_ID, { desativado_em: new Date().toISOString() });

    await anexarAlteracao(clienteId, 1);

    expect(await destinatarios(clienteId, "nova_alteracao")).toEqual([LIDER_SN_ID]);
  });

  it("sem Responsável: só o Líder", async () => {
    const clienteId = await criarClienteDeTeste(CNPJ_SN, "simples_nacional");

    await anexarAlteracao(clienteId, 1);

    expect(await destinatarios(clienteId, "nova_alteracao")).toEqual([LIDER_SN_ID]);
  });

  it("Cliente sem Cadastro operacional SN: nenhum aviso", async () => {
    const clienteId = await criarClienteDeTeste(CNPJ_LUCRO, "lucro_presumido");

    await anexarAlteracao(clienteId, 1);

    expect(await avisosDoCliente(clienteId)).toEqual([]);
  });

  it("alteração criada junto com o Cliente: só o aviso de novo cliente", async () => {
    const id = await criarClienteDeTeste(CNPJ_SN, "simples_nacional", [
      { numero: 1, data: "2024-01-10" },
      { numero: 2, data: "2025-01-10" },
    ]);

    expect((await avisosDoCliente(id)).map((a) => a.tipo)).toEqual(["novo_cliente"]);
  });
});

describe("Aviso de cadastro: destinatário congelado (#142, S2c)", () => {
  it("trocar o Líder depois não muda os avisos já emitidos; o novo aviso vai ao novo Líder", async () => {
    const clienteId = await criarClienteDeTeste(CNPJ_SN, "simples_nacional");
    await atualizarPerfil(LIDER_SN_ID, { papel: "funcionario" });
    await atualizarPerfil(FUNCIONARIO_SN_ID, { papel: "lider_setor" });

    await anexarAlteracao(clienteId, 1);

    expect(await destinatarios(clienteId, "novo_cliente")).toEqual([LIDER_SN_ID]);
    expect(await destinatarios(clienteId, "nova_alteracao")).toEqual([FUNCIONARIO_SN_ID]);
  });
});
