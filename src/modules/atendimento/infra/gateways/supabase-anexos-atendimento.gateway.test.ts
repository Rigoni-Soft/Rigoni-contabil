/**
 * Integração infra ↔ Supabase Storage (testes.md, seção 3) do bucket `anexos-atendimento` (#79).
 * Requer `npx supabase start` local com a migration de anexos aplicada.
 */
import { createClient } from "@supabase/supabase-js";

import { SupabaseAnexosAtendimentoGateway } from "./supabase-anexos-atendimento.gateway";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const gateway = new SupabaseAnexosAtendimentoGateway(admin);
const ATENDIMENTO = crypto.randomUUID();
const guardados: string[] = [];

afterAll(async () => {
  if (guardados.length) await admin.storage.from("anexos-atendimento").remove(guardados);
});

async function guardar(nome: string, tipoMime: string, conteudo = new Uint8Array([1, 2, 3])) {
  const r = await gateway.guardar({
    atendimentoId: ATENDIMENTO,
    arquivo: { nome, tipoMime, conteudo },
  });
  if (r.ok) guardados.push(r.value);
  return r;
}

describe("SupabaseAnexosAtendimentoGateway", () => {
  it("guarda o arquivo numa pasta por envio, com nome seguro, e devolve link temporário que baixa o conteúdo", async () => {
    const r = await guardar("Balanço de setembro (final).pdf", "application/pdf");

    expect(r.ok).toBe(true);
    const caminho = r.ok ? r.value : "";
    expect(caminho).toMatch(
      new RegExp(`^${ATENDIMENTO}/[0-9a-f-]{36}/Balanco_de_setembro_final_\.pdf$`),
    );

    const links = await gateway.linksTemporarios([caminho]);
    expect(links.ok).toBe(true);
    const link = links.ok ? links.value[caminho] : undefined;
    expect(link?.expiraEm).toEqual(expect.any(String));
    const resposta = await fetch(link!.url);
    expect(resposta.status).toBe(200);
    expect([...new Uint8Array(await resposta.arrayBuffer())]).toEqual([1, 2, 3]);
  });

  it("gera os links de vários arquivos de uma vez, indexados pelo caminho", async () => {
    const a = await guardar("a.png", "image/png");
    const b = await guardar("b.txt", "text/plain");
    const caminhos = [a, b].map((r) => (r.ok ? r.value : ""));

    const links = await gateway.linksTemporarios(caminhos);

    expect(links.ok && Object.keys(links.value).sort()).toEqual([...caminhos].sort());
  });

  it("o bucket recusa tipo fora da lista (SVG, HTML)", async () => {
    const r = await guardar("x.svg", "image/svg+xml");
    expect(r.ok).toBe(false);
  });

  it("o bucket é privado: o endereço público não serve o arquivo", async () => {
    const r = await guardar("privado.pdf", "application/pdf");
    const caminho = r.ok ? r.value : "";

    const resposta = await fetch(
      `${SUPABASE_URL}/storage/v1/object/public/anexos-atendimento/${caminho}`,
    );

    expect(resposta.status).not.toBe(200);
  });

  it("remove o arquivo guardado", async () => {
    const r = await guardar("descartar.pdf", "application/pdf");
    const caminho = r.ok ? r.value : "";

    expect((await gateway.remover(caminho)).ok).toBe(true);

    const links = await gateway.linksTemporarios([caminho]);
    expect(links.ok).toBe(false);
  });

  it("inspeciona o objeto (tipo e tamanho do Storage), lê só o início e baixa inteiro", async () => {
    const conteudo = Uint8Array.from("OggS....OpusHead e o resto do arquivo", (c) =>
      c.charCodeAt(0),
    );
    const r = await guardar("gravacao.ogg", "audio/ogg", conteudo);
    const caminho = r.ok ? r.value : "";

    const info = await gateway.inspecionar(caminho);
    const inicio = await gateway.cabecalho(caminho, 16);
    const inteiro = await gateway.baixar(caminho);

    expect(info.ok && info.value).toEqual({ tipoMime: "audio/ogg", tamanho: conteudo.byteLength });
    expect(inicio.ok && [...inicio.value]).toEqual([...conteudo.subarray(0, 16)]);
    expect(inteiro.ok && [...inteiro.value]).toEqual([...conteudo]);
  });

  it("objeto inexistente não é erro: inspecionar devolve null", async () => {
    const r = await gateway.inspecionar(`${ATENDIMENTO}/${crypto.randomUUID()}/nao-existe.ogg`);

    expect(r.ok && r.value).toBeNull();
  });
});
