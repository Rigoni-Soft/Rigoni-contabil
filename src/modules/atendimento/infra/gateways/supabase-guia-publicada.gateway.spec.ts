import type { SupabaseClient } from "@supabase/supabase-js";

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

    // B fica no Storage (a assinatura é recuperável) e A nunca é sobrescrita.
    expect([...objetos.values()].map((b) => b.toString()).sort()).toEqual(["A", "B"]);
    falha = false;
    const b = await gateway.publicar("c1", guia("B"), acordo);
    expect(b.ok && a.ok && b.value.caminho !== a.value.caminho).toBe(true);
    expect([...objetos.values()].map((x) => x.toString()).sort()).toEqual(["A", "B"]);
  });

  it("assinatura que falha não apaga o objeto: outra tentativa com os mesmos bytes pode tê-lo aceito", async () => {
    const assinaturas = [true, false]; // a primeira falha, a segunda funciona
    const { gateway, objetos, bucket } = montar(() => assinaturas.shift() ?? false);
    const [t1, t2] = await Promise.all([
      gateway.publicar("c1", guia("X"), acordo),
      gateway.publicar("c1", guia("X"), acordo),
    ]);
    expect(t1.ok).toBe(false);

    expect(bucket.remove).not.toHaveBeenCalled();
    expect(objetos.size).toBe(1);
    if (!t2.ok) throw new Error("publicação falhou");
    expect((await gateway.reencontrar("c1", t2.value.caminho)).ok).toBe(true);
  });

  it("recusa o caminho de outro cliente", async () => {
    const { gateway, bucket } = montar(() => false);
    const outro = await gateway.publicar("c2", guia("Y"), acordo);
    if (!outro.ok) throw new Error("publicação falhou");

    bucket.createSignedUrl.mockClear();

    expect((await gateway.reencontrar("c1", outro.value.caminho)).ok).toBe(false);
    expect(bucket.createSignedUrl).not.toHaveBeenCalled();
  });

  it("reencontra o objeto exato pelo caminho, sem escolher entre versões do período", async () => {
    const { gateway } = montar(() => false);
    const a = await gateway.publicar("c1", guia("A"), acordo);
    const b = await gateway.publicar("c1", guia("B"), acordo);
    if (!a.ok || !b.ok) throw new Error("publicação falhou");

    expect(await gateway.reencontrar("c1", b.value.caminho)).toEqual({
      ok: true,
      value: b.value.url,
    });
    expect(await gateway.reencontrar("c1", a.value.caminho)).toEqual({
      ok: true,
      value: a.value.url,
    });
  });

  it("falha ao gerar o link no reenvio é erro, não 'sem guia'", async () => {
    const { gateway } = montar(() => true);
    expect((await gateway.reencontrar("c1", "c1/acordo/202610-x.pdf")).ok).toBe(false);
  });

  it("nunca remove um objeto publicado e aceito: nada do gateway apaga por chave", async () => {
    const { gateway, objetos, bucket } = montar(() => false);
    const a = await gateway.publicar("c1", guia("A"), acordo);
    await gateway.publicar("c1", guia("B"), acordo);
    if (!a.ok) throw new Error("publicação falhou");

    await gateway.reencontrar("c1", a.value.caminho);

    expect(bucket.remove).not.toHaveBeenCalled();
    expect(objetos.size).toBe(2);
  });
});
