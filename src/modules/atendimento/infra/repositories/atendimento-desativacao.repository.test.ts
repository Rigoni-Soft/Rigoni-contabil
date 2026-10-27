/**
 * Integração infra ↔ Supabase (testes.md, seção 3): desativar um
 * usuário não deixa Atendimento preso a uma conta irrecuperável: volta à espera do Setor, sem
 * atribuição automática. Requer `npx supabase start` local com migrations + seed.
 */
import { createClient } from "@supabase/supabase-js";

import { abrirComDono } from "../../../../../test-support/atendimento-com-dono";
import { SupabaseAtendimentoRepository } from "./atendimento.repository";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const ADMIN_ID = "11111111-1111-1111-1111-111111111111";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const repositorio = new SupabaseAtendimentoRepository(admin);

// Setor sem ninguém no seed e fora das outras suítes: só os perfis criados aqui são "livres".
const SETOR = "condominios" as const;
const OUTRO_SETOR = "recepcao" as const;
const usuarios: string[] = [];
const telefonesUsados: string[] = [];
let proximoNumero = 1;

async function criarPerfil(nome: string, setor: string = SETOR): Promise<string> {
  const { data } = await admin.auth.admin.createUser({
    email: `desativacao-77-${nome.replace(/\W/g, "")}-${Date.now()}-${proximoNumero}@teste.local`,
    password: "senha-de-teste-123",
    email_confirm: true,
  });
  const id = data.user!.id;
  usuarios.push(id);
  const { error } = await admin
    .from("perfis")
    .insert({ id, nome, email: data.user!.email, papel: "funcionario", setor });
  if (error) throw error;
  return id;
}

const desativar = (id: string) =>
  admin.rpc("desativar_usuario", { alvo_id: id, ator_id: ADMIN_ID });

function numero(): string {
  const n = `619555740${String(proximoNumero++).padStart(2, "0")}`;
  telefonesUsados.push(n);
  return n;
}

async function abrir(
  funcionarioId: string | null,
  opcoes: { setor?: typeof SETOR | typeof OUTRO_SETOR; mensagens?: number } = {},
) {
  const tel = numero();
  const abertura = {
    telefone: tel,
    chave: tel,
    clienteId: null,
    setor: opcoes.setor ?? SETOR,
    mensagens: Array.from({ length: opcoes.mensagens ?? 1 }, (_, i) => ({
      autor: "contato" as const,
      texto: `mensagem ${i + 1}`,
    })),
  };
  if (funcionarioId) {
    return { telefone: tel, id: await abrirComDono(admin, repositorio, abertura, funcionarioId) };
  }
  const r = await repositorio.abrir(abertura);
  if (!r.ok) throw new Error("setup: não abriu");
  return { telefone: tel, id: r.value.id };
}

async function atendimento(id: string) {
  const { data } = await admin
    .from("atendimentos")
    .select("status, funcionario_id, fila_funcionario_id, fila_desde, assumido_em, criado_em")
    .eq("id", id)
    .single();
  return data!;
}

async function mensagensDe(id: string) {
  const { data } = await admin.from("mensagens").select("texto").eq("atendimento_id", id);
  return (data ?? []).map((m) => m.texto).sort();
}

async function assuncoesDe(atendimentoId: string) {
  const { data } = await admin
    .from("assuncoes_atendimento")
    .select("funcionario_id")
    .eq("atendimento_id", atendimentoId);
  return (data ?? []).map((a) => a.funcionario_id).sort();
}

async function auditoriasDe(acao: string, atendimentoId: string) {
  const { data } = await admin
    .from("registros_auditoria")
    .select("ator, acao, resultado")
    .eq("acao", acao)
    .eq("alvo", atendimentoId);
  return data ?? [];
}

// Cada teste começa sem Fila no Setor desta suíte e sem ninguém livre de testes anteriores.
beforeEach(async () => {
  await admin
    .from("atendimentos")
    .update({ status: "encerrado" })
    .in("chave_telefone", telefonesUsados)
    .eq("status", "em_andamento");
  for (const id of usuarios) {
    await admin.from("perfis").update({ desativado_em: new Date().toISOString() }).eq("id", id);
  }
});

afterAll(async () => {
  await admin.from("atendimentos").delete().in("chave_telefone", telefonesUsados);
  for (const id of usuarios) await admin.auth.admin.deleteUser(id);
});

describe("desativação × Atendimento em andamento", () => {
  it("o Atendimento volta à Fila, sem perder Mensagem nem crédito, e é auditado", async () => {
    const dono = await criarPerfil("Dono Desativado");
    const { id } = await abrir(dono, { mensagens: 3 });
    const antes = await atendimento(id);
    const antesDeDesativar = Date.now();

    expect((await desativar(dono)).error).toBeNull();

    const depois = await atendimento(id);
    expect(depois).toMatchObject({
      status: "em_andamento",
      funcionario_id: null,
      fila_funcionario_id: null,
      assumido_em: null,
    });
    // A posição na Fila é a da entrada nela (a devolução), não a da abertura do Atendimento.
    expect(new Date(depois.fila_desde!).getTime()).toBeGreaterThan(
      new Date(antes.criado_em).getTime(),
    );
    expect(new Date(depois.fila_desde!).getTime()).toBeGreaterThanOrEqual(antesDeDesativar - 1000);
    expect(await mensagensDe(id)).toEqual(["mensagem 1", "mensagem 2", "mensagem 3"]);
    expect(await assuncoesDe(id)).toEqual([dono]);
    expect(await auditoriasDe("atendimento.devolver-fila", id)).toEqual([
      { ator: ADMIN_ID, acao: "atendimento.devolver-fila", resultado: "sucesso" },
    ]);
  });

  it("desativar de novo não repete a devolução nem a auditoria", async () => {
    const dono = await criarPerfil("Dono Duas Vezes");
    const { id } = await abrir(dono);

    await desativar(dono);
    await desativar(dono);

    expect(await auditoriasDe("atendimento.devolver-fila", id)).toHaveLength(1);
  });

  it("quem esperava dirigido ao desativado volta à espera do Setor", async () => {
    const destino = await criarPerfil("Destino Pessoal");
    const { id } = await abrir(null);
    await admin.from("atendimentos").update({ fila_funcionario_id: destino }).eq("id", id);
    const antes = await atendimento(id);

    await desativar(destino);

    const depois = await atendimento(id);
    expect(depois.fila_funcionario_id).toBeNull();
    expect(depois.funcionario_id).toBeNull();
    // Já estava na Fila: mantém a antiga entrada.
    expect(depois.fila_desde).toBe(antes.fila_desde);
    expect(await auditoriasDe("atendimento.devolver-fila", id)).toHaveLength(1);
  });

  it("com colega livre no Setor o devolvido continua na espera: ninguém é atribuído", async () => {
    const dono = await criarPerfil("Dono Com Colega");
    await criarPerfil("Colega Livre");
    const { id } = await abrir(dono, { mensagens: 2 });

    await desativar(dono);

    const depois = await atendimento(id);
    expect(depois.funcionario_id).toBeNull();
    expect(depois.fila_desde).not.toBeNull();
    expect(await mensagensDe(id)).toEqual(["mensagem 1", "mensagem 2"]);
    expect(await auditoriasDe("atendimento.reatribuir", id)).toHaveLength(0);
  });

  it("FIFO: o devolvido entra na Fila no instante da desativação, depois de quem já esperava", async () => {
    const dono = await criarPerfil("Dono Fila Ordem");
    const { id: devolvido } = await abrir(dono);
    const { id: esperava } = await abrir(null);
    const antes = await atendimento(esperava);

    await desativar(dono);

    const depois = await atendimento(devolvido);
    expect(new Date(depois.fila_desde!).getTime()).toBeGreaterThan(
      new Date(antes.fila_desde!).getTime(),
    );
    // Os dois esperam e B (que já esperava) está na frente.
    const fila = await repositorio.filaDoSetor(SETOR);
    if (!fila.ok) throw new Error("setup: fila");
    expect(fila.value.map((item) => item.id)).toEqual([esperava, devolvido]);
  });

  it("não mexe nos Atendimentos de colegas ativos nem de outros Setores", async () => {
    const desativado = await criarPerfil("Desativado Isolado");
    const colegaOcupado = await criarPerfil("Colega Ocupado");
    const deOutroSetor = await criarPerfil("Outro Setor", OUTRO_SETOR);
    const { id: doColega } = await abrir(colegaOcupado);
    const { id: doOutro } = await abrir(deOutroSetor, { setor: OUTRO_SETOR });

    await desativar(desativado);

    expect((await atendimento(doColega)).funcionario_id).toBe(colegaOcupado);
    expect((await atendimento(doOutro)).funcionario_id).toBe(deOutroSetor);
  });
});
