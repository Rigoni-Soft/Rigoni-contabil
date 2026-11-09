/**
 * Integração infra ↔ Supabase: o cadastro do Cliente no RH. O Responsável do RH, o Líder do RH e o Admin
 * gravam observações do RH e contatos (de qualquer Regime) pela função `editar_cadastro_rh_cliente`;
 * quem não é do RH ou não é o Responsável do Cliente é recusado; as observações de um Setor não vazam
 * para outro. Requer `npx supabase start` com migrations + seed aplicados.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { removerClientesDeTeste } from "../../../../../test-support/clientes-de-teste";
import { SupabaseClienteQueryGateway } from "../gateways/cliente-query.gateway";
import { SupabaseCadastroRhRepository } from "./cadastro-rh.repository";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const CNPJ = "11444777009811";
const FUNCIONARIO_RH_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";

async function entrar(email: string, senha: string): Promise<SupabaseClient> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`Falha ao autenticar ${email}: ${error.message}`);
  return supabase;
}

const servico = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const comoLiderRH = () => entrar("lider.rh@rigonicontabil.local", "lider123");
const comoFuncionarioRH = () => entrar("funcionario.rh@rigonicontabil.local", "func123");
const comoFuncionario2RH = () => entrar("funcionario2.rh@rigonicontabil.local", "func123");
const comoFuncionarioSN = () => entrar("funcionario.sn@rigonicontabil.local", "func123");

let clienteId: string;
const CONTATOS = [{ nome: "Maria", telefone: "11999990000", padrao: true }];

const salvar = (supabase: SupabaseClient, observacoes = "Folha no 5º dia útil.") =>
  new SupabaseCadastroRhRepository(supabase).atualizar(clienteId, observacoes, CONTATOS);

beforeAll(async () => {
  await removerClientesDeTeste([CNPJ]);
  clienteId = crypto.randomUUID();
  // Lucro presumido: sem cadastro operacional do SN; contatos e observações do RH valem do mesmo jeito.
  const cliente = await servico
    .from("clientes")
    .insert({ id: clienteId, empresa: "RH Cadastro Ltda", cnpj: CNPJ, regime: "lucro_presumido" });
  if (cliente.error) throw cliente.error;
  const responsavel = await servico.from("cliente_responsaveis").insert({
    cliente_id: clienteId,
    setor: "rh",
    responsavel_id: FUNCIONARIO_RH_ID,
  });
  if (responsavel.error) throw responsavel.error;
});

afterAll(async () => {
  await removerClientesDeTeste([CNPJ]);
});

describe("Cadastro do Cliente no RH (integração)", () => {
  it("o Responsável do RH grava as observações do RH e os contatos de um Cliente de qualquer Regime", async () => {
    const supabase = await comoFuncionarioRH();

    const gravado = await salvar(supabase);
    const lido = await new SupabaseClienteQueryGateway(supabase).buscarCadastroRh(clienteId);

    expect(gravado.ok).toBe(true);
    expect(lido.ok && lido.value).toMatchObject({
      empresa: "RH Cadastro Ltda",
      observacoes: "Folha no 5º dia útil.",
      contatos: [{ nome: "Maria", telefone: "11999990000", padrao: true }],
    });
  });

  it("o Líder do RH também grava, e regravar troca os contatos", async () => {
    const lider = await comoLiderRH();

    const gravado = await new SupabaseCadastroRhRepository(lider).atualizar(clienteId, "Nova.", [
      { nome: "João", telefone: "11888880000", padrao: true },
    ]);
    const lido = await new SupabaseClienteQueryGateway(lider).buscarCadastroRh(clienteId);

    expect(gravado.ok).toBe(true);
    expect(lido.ok && lido.value?.contatos.map((c) => c.nome)).toEqual(["João"]);
    expect(lido.ok && lido.value?.observacoes).toBe("Nova.");
  });

  it("o Funcionário do RH que não é o Responsável do Cliente é recusado", async () => {
    const r = await salvar(await comoFuncionario2RH());

    expect(r.ok).toBe(false);
  });

  it("o Funcionário do SN é recusado e não lê as observações do RH", async () => {
    await salvar(await comoFuncionarioRH(), "Só do RH.");
    const sn = await comoFuncionarioSN();

    const recusado = await salvar(sn);
    const leitura = await sn
      .from("cliente_observacoes_setor")
      .select("observacoes")
      .eq("cliente_id", clienteId);

    expect(recusado.ok).toBe(false);
    expect(leitura.data).toEqual([]);
  });

  it("a edição do RH deixa auditoria e não escreve nas tabelas do SN pela API", async () => {
    const rh = await comoFuncionarioRH();

    const direto = await rh
      .from("cliente_cadastro_operacional_sn")
      .insert({ cliente_id: clienteId, forma_envio: "email" });

    expect(direto.error).not.toBeNull();
    const auditoria = await servico
      .from("registros_auditoria")
      .select("acao")
      .eq("alvo", CNPJ)
      .eq("acao", "cliente.editar-operacional");
    expect(auditoria.data?.length).toBeGreaterThan(0);
  });
});
