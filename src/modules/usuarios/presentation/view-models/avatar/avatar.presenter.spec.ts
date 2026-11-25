import { avisoDaFoto, imagemDoAvatar, LIMITE_DA_FOTO_ENVIADA_BYTES } from "./avatar.presenter";

describe("imagemDoAvatar", () => {
  it("sem foto, usa a logo e diz que não há foto", () => {
    const imagem = imagemDoAvatar({ papel: "funcionario", setor: "rh", avatarAtualizadoEm: null });

    expect(imagem.temFoto).toBe(false);
    expect(imagem.srcAtual).not.toMatch(/^\/api\/avatar/);
  });

  it("com foto, aponta para a rota autenticada versionada", () => {
    const imagem = imagemDoAvatar({
      papel: "funcionario",
      setor: "rh",
      avatarAtualizadoEm: "2026-11-01T10:00:00Z",
    });

    expect(imagem.temFoto).toBe(true);
    expect(imagem.srcAtual).toMatch(/^\/api\/avatar\?v=/);
  });
});

describe("avisoDaFoto", () => {
  it.each(["image/jpeg", "image/png", "image/webp"])("aceita %s", (type) => {
    expect(avisoDaFoto({ type, size: 1024 })).toBeUndefined();
  });

  it("aceita exatamente 5 MB", () => {
    expect(avisoDaFoto({ type: "image/png", size: LIMITE_DA_FOTO_ENVIADA_BYTES })).toBeUndefined();
  });

  it.each(["image/gif", "image/svg+xml", "application/pdf", ""])("avisa do formato %p", (type) => {
    expect(avisoDaFoto({ type, size: 1024 })).toMatch(/JPEG, PNG ou WebP/);
  });

  it("avisa do tamanho acima de 5 MB", () => {
    expect(avisoDaFoto({ type: "image/jpeg", size: LIMITE_DA_FOTO_ENVIADA_BYTES + 1 })).toMatch(
      /5 MB/,
    );
  });
});
