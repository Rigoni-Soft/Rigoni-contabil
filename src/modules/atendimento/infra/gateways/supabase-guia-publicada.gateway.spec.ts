import type { SupabaseClient } from "@supabase/supabase-js";

import { SupabaseGuiaPublicadaGateway } from "./supabase-guia-publicada.gateway";

// Storage em memória: upload sobrescreve, remove apaga, a assinatura pode falhar.
function montar(assinaturaFalha: () => boolean) {
  const objetos = new Map<string, Buffer>();
  const bucket = {
    upload: jest.fn(async (caminho: string, bytes: Buffer) => {
      objetos.set(caminho, bytes);
      return { error: null };
    }),
    createSignedUrl: jest.fn(async (caminho: string) =>
      assinaturaFalha()
        ? { data: null, error: { message: "falha temporária" } }
        : { data: { signedUrl: `https://storage.test/${caminho}` }, error: null },
    ),
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
const acordo = { id: "acordo", parcela: "202610" };

describe("SupabaseGuiaPublicadaGateway", () => {
  it("falha na assinatura da retentativa preserva a guia já publicada no mesmo caminho", async () => {
    let falha = false;
    const { gateway, objetos, bucket } = montar(() => falha);
    expect((await gateway.publicar("c1", guia("original"), acordo)).ok).toBe(true);

    falha = true;
    expect((await gateway.publicar("c1", guia("original"), acordo)).ok).toBe(false);
    expect((await gateway.publicar("c1", guia("original"), acordo)).ok).toBe(false);

    expect(bucket.remove).not.toHaveBeenCalled();
    expect(objetos.get("c1/acordo/202610.pdf")?.toString()).toBe("original");

    falha = false;
    const recuperada = await gateway.publicar("c1", guia("original"), acordo);
    expect(recuperada).toEqual({ ok: true, value: "https://storage.test/c1/acordo/202610.pdf" });
  });

  it("sem parcelamento, o objeto novo sem link é limpo (o caminho é só desta tentativa)", async () => {
    const { gateway, objetos, bucket } = montar(() => true);

    expect((await gateway.publicar("c1", guia("x"))).ok).toBe(false);

    expect(bucket.remove).toHaveBeenCalledTimes(1);
    expect(objetos.size).toBe(0);
  });
});
