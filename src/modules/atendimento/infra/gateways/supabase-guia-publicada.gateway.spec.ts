import type { SupabaseClient } from "@supabase/supabase-js";

import { ok } from "@/shared/kernel/result";

import { SupabaseGuiaPublicadaGateway } from "./supabase-guia-publicada.gateway";

// Storage em memória: upload não sobrescreve (409), remove apaga, a assinatura pode falhar.
function montar(assinaturaFalha: () => boolean) {
  const objetos = new Map<string, Buffer>();
  const bucket = {
    upload: jest.fn(async (caminho: string, bytes: Buffer, opcoes: { upsert: boolean }) => {
      if (objetos.has(caminho) && !opcoes.upsert) {
        return { error: { message: "The resource already exists", statusCode: "409" } };
      }
      objetos.set(caminho, bytes);
      return { error: null };
    }),
    createSignedUrl: jest.fn(async (caminho: string) =>
      assinaturaFalha()
        ? { data: null, error: { message: "falha temporária" } }
        : { data: { signedUrl: `https://storage.test/${caminho}` }, error: null },
    ),
    // Na ordem de criação, como o `sortBy: created_at asc` do Storage.
    list: jest.fn(async (pasta: string) => ({
      data: [...objetos.keys()]
        .filter((c) => c.startsWith(`${pasta}/`))
        .map((c) => ({ name: c.slice(pasta.length + 1) })),
      error: null,
    })),
    remove: jest.fn(async (caminhos: string[]) => {
      caminhos.forEach((c) => objetos.delete(c));
      return { error: null };
    }),
  };
  const admin = { storage: { from: () => bucket } } as unknown as SupabaseClient;
  return { gateway: new SupabaseGuiaPublicadaGateway(admin), objetos, bucket };
}

const guia = (pdf: string) => ({
  nomeArquivo: "g.pdf",
  pdfBase64: Buffer.from(pdf).toString("base64"),
});
const acordo = { id: "acordo", periodo: "202610" };

describe("SupabaseGuiaPublicadaGateway", () => {
  it("falha na assinatura da retentativa preserva a guia já publicada e a recupera depois", async () => {
    let falha = false;
    const { gateway, objetos, bucket } = montar(() => falha);
    const primeira = await gateway.publicar("c1", guia("original"), acordo);
    expect(primeira.ok).toBe(true);

    falha = true;
    expect((await gateway.publicar("c1", guia("original"), acordo)).ok).toBe(false);
    expect((await gateway.publicar("c1", guia("original"), acordo)).ok).toBe(false);

    expect(bucket.remove).not.toHaveBeenCalled();
    expect([...objetos.values()].map((b) => b.toString())).toEqual(["original"]);

    falha = false;
    expect(await gateway.publicar("c1", guia("original"), acordo)).toEqual(primeira);
  });

  it("guia reemitida com outros bytes nunca sobrescreve a entregue, mesmo se a assinatura falhar", async () => {
    let falha = false;
    const { gateway, objetos } = montar(() => falha);
    const a = await gateway.publicar("c1", guia("A"), acordo);
    expect(a.ok).toBe(true);

    falha = true;
    expect((await gateway.publicar("c1", guia("B"), acordo)).ok).toBe(false);
    expect((await gateway.publicar("c1", guia("B"), acordo)).ok).toBe(false);

    expect([...objetos.values()].map((b) => b.toString())).toEqual(["A"]);
    falha = false;
    const b = await gateway.publicar("c1", guia("B"), acordo);
    expect(b.ok && a.ok && b.value !== a.value).toBe(true);
    expect([...objetos.values()].map((x) => x.toString()).sort()).toEqual(["A", "B"]);
  });

  it("objeto novo sem link é limpo (o caminho é só desta tentativa)", async () => {
    const { gateway, objetos, bucket } = montar(() => true);

    expect((await gateway.publicar("c1", guia("x"), acordo)).ok).toBe(false);

    expect(bucket.remove).toHaveBeenCalledTimes(1);
    expect(objetos.size).toBe(0);
  });

  it("reencontra a guia guardada, a mais antiga do período, e não acha onde não há", async () => {
    const { gateway } = montar(() => false);
    const a = await gateway.publicar("c1", guia("A"), acordo);
    await gateway.publicar("c1", guia("B"), acordo);
    await gateway.publicar("c1", guia("C"), { id: "acordo", periodo: "202611" });

    expect(await gateway.reencontrar("c1", acordo)).toEqual(a);
    expect(await gateway.reencontrar("c1", { id: "acordo", periodo: "202609" })).toEqual(ok(null));
    expect(await gateway.reencontrar("c1", { id: "outro", periodo: "202610" })).toEqual(ok(null));
  });
});
