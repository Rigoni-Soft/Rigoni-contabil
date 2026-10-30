/**
 * Integração infra ↔ Supabase (testes.md, seção 3) da leitura da conversa por janela.
 * Requer `npx supabase start` local com migrations + seed aplicados.
 */
import { createClient } from "@supabase/supabase-js";

import { CONVERSA_JANELA_MENSAGENS } from "@/modules/atendimento/domain/services/janela-da-conversa.service";

import { SupabaseAtendimentoRepository } from "./atendimento.repository";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const repositorio = new SupabaseAtendimentoRepository(admin);

const TELEFONES = ["61955572001", "61955572002", "61955572003", "61955572004"];
const INICIO = Date.parse("2026-09-01T12:00:00Z");

// `total` Mensagens do cliente, uma por segundo; as `empatadas` últimas partilham o mesmo instante
// (o cursor desempata pelo id). Devolve o Atendimento e as Mensagens na ordem da conversa.
async function conversaCom(telefone: string, total: number, empatadas = 0) {
  const aberto = await repositorio.abrir({
    telefone,
    chave: telefone,
    clienteId: null,
    setor: "condominios",
    mensagens: [],
  });
  if (!aberto.ok) throw new Error("abertura falhou");
  const atendimentoId = aberto.value.id;
  const linhas = Array.from({ length: total }, (_, i) => {
    const instante = i >= total - empatadas ? total - empatadas : i;
    return {
      id: crypto.randomUUID(),
      atendimento_id: atendimentoId,
      autor: "contato" as const,
      texto: `m${i}`,
      criado_em: new Date(INICIO + instante * 1000).toISOString(),
    };
  });
  for (let i = 0; i < linhas.length; i += 500) {
    const { error } = await admin.from("mensagens").insert(linhas.slice(i, i + 500));
    if (error) throw error;
  }
  // Ordem da conversa: data e, no empate, id.
  linhas.sort((a, b) => a.criado_em.localeCompare(b.criado_em) || a.id.localeCompare(b.id));
  return { atendimentoId, textos: linhas.map((l) => l.texto), ids: linhas.map((l) => l.id) };
}

// Lê a janela e depois o histórico inteiro, página a página, pelo cursor da mensagem mais antiga.
async function lerTudo(atendimentoId: string) {
  const primeira = await repositorio.conversa(atendimentoId);
  if (!primeira.ok || !primeira.value) throw new Error("conversa não lida");
  let ids = primeira.value.mensagens.map((m) => m.id);
  let cursor = primeira.value.mensagens[0];
  let tem = primeira.value.temMaisAntigas;
  while (tem && cursor) {
    const pagina = await repositorio.mensagensAnteriores(
      atendimentoId,
      { criadoEm: cursor.criadoEm, id: cursor.id },
      CONVERSA_JANELA_MENSAGENS,
    );
    if (!pagina.ok || !pagina.value) throw new Error("página não lida");
    ids = [...pagina.value.mensagens.map((m) => m.id), ...ids];
    cursor = pagina.value.mensagens[0];
    tem = pagina.value.temMaisAntigas;
  }
  return { janela: primeira.value, ids };
}

afterAll(async () => {
  await admin.from("atendimentos").delete().in("telefone", TELEFONES);
});

describe("SupabaseAtendimentoRepository — conversa por janela", () => {
  it.each([
    [CONVERSA_JANELA_MENSAGENS, false],
    [CONVERSA_JANELA_MENSAGENS + 1, true],
  ])("conversa de %i Mensagens: a janela traz as mais recentes", async (total, tem) => {
    const telefone = TELEFONES[total === CONVERSA_JANELA_MENSAGENS ? 0 : 1];
    const { atendimentoId, ids } = await conversaCom(telefone, total);

    const { janela, ids: todas } = await lerTudo(atendimentoId);

    expect(janela.mensagens).toHaveLength(CONVERSA_JANELA_MENSAGENS);
    expect(janela.temMaisAntigas).toBe(tem);
    expect(janela.mensagens.at(-1)?.id).toBe(ids.at(-1));
    expect(todas).toEqual(ids);
  });

  it("2.000 Mensagens (acima do max_rows da API): a mais recente aparece e o histórico vem inteiro, sem repetir nem omitir, mesmo com datas iguais", async () => {
    const { atendimentoId, ids } = await conversaCom(TELEFONES[2], 2000, 150);

    const { janela, ids: todas } = await lerTudo(atendimentoId);

    expect(janela.temMaisAntigas).toBe(true);
    expect(janela.mensagens.at(-1)?.id).toBe(ids.at(-1));
    expect(todas).toHaveLength(2000);
    expect(new Set(todas).size).toBe(2000);
    expect(todas).toEqual(ids);
  });
});
