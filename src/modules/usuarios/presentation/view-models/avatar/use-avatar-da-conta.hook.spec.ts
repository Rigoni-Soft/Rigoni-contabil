import { act, renderHook } from "@testing-library/react";

import { useAvatarDaConta } from "./use-avatar-da-conta.hook";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const enviarMock = jest.fn();
const removerMock = jest.fn();
jest.mock("./avatar.actions", () => ({
  enviarAvatarAction: (formData: FormData) => enviarMock(formData),
  removerAvatarAction: () => removerMock(),
}));

const recortarMock = jest.fn();
jest.mock("@/presentation/lib/recortar-quadrado", () => ({
  recortarQuadrado: (arquivo: File, lado: number) => recortarMock(arquivo, lado),
}));

const foto = (type = "image/png", tamanho = 10) =>
  new File([new Uint8Array(tamanho)], "foto", { type });

describe("useAvatarDaConta", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    URL.createObjectURL = jest.fn(() => "blob:previa");
    URL.revokeObjectURL = jest.fn();
    recortarMock.mockResolvedValue(new Blob(["webp"], { type: "image/webp" }));
  });

  it("formato não aceito avisa e não recorta", async () => {
    const { result } = renderHook(() => useAvatarDaConta());

    await act(() => result.current.aoEscolher(foto("image/gif")));

    expect(result.current.erro).toMatch(/JPEG, PNG ou WebP/);
    expect(recortarMock).not.toHaveBeenCalled();
    expect(result.current.previaSrc).toBeUndefined();
  });

  it("acima de 5 MB avisa e não recorta", async () => {
    const { result } = renderHook(() => useAvatarDaConta());

    await act(() => result.current.aoEscolher(foto("image/png", 5 * 1024 * 1024 + 1)));

    expect(result.current.erro).toMatch(/5 MB/);
    expect(recortarMock).not.toHaveBeenCalled();
  });

  it("foto válida vira prévia recortada; Salvar envia o WebP e atualiza a tela", async () => {
    enviarMock.mockResolvedValue({ ok: true, data: { avatarAtualizadoEm: "x" } });
    const { result } = renderHook(() => useAvatarDaConta());

    await act(() => result.current.aoEscolher(foto()));
    expect(result.current.previaSrc).toBe("blob:previa");

    await act(async () => {
      await result.current.aoSalvar();
    });

    const formData = enviarMock.mock.calls[0][0] as FormData;
    expect((formData.get("foto") as File).type).toBe("image/webp");
    expect(result.current.previaSrc).toBeUndefined();
    expect(refresh).toHaveBeenCalled();
  });

  it("imagem que o navegador não lê avisa", async () => {
    recortarMock.mockRejectedValue(new Error("corrompida"));
    const { result } = renderHook(() => useAvatarDaConta());

    await act(() => result.current.aoEscolher(foto()));

    expect(result.current.erro).toMatch(/Escolha outra/);
  });

  it("erro do servidor fica visível e a prévia é mantida", async () => {
    enviarMock.mockResolvedValue({
      ok: false,
      error: { code: "X", message: "A imagem passa de 256 KB." },
    });
    const { result } = renderHook(() => useAvatarDaConta());
    await act(() => result.current.aoEscolher(foto()));

    await act(async () => {
      await result.current.aoSalvar();
    });

    expect(result.current.erro).toBe("A imagem passa de 256 KB.");
    expect(result.current.previaSrc).toBe("blob:previa");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("Cancelar descarta a prévia", async () => {
    const { result } = renderHook(() => useAvatarDaConta());
    await act(() => result.current.aoEscolher(foto()));

    act(() => result.current.aoCancelar());

    expect(result.current.previaSrc).toBeUndefined();
  });

  it("Remover chama a ação e atualiza a tela; falha mostra o erro", async () => {
    removerMock.mockResolvedValueOnce({ ok: true, data: undefined });
    const { result } = renderHook(() => useAvatarDaConta());

    await act(async () => {
      await result.current.aoRemover();
    });
    expect(refresh).toHaveBeenCalledTimes(1);

    removerMock.mockResolvedValueOnce({ ok: false, error: { code: "X", message: "Falhou." } });
    await act(async () => {
      await result.current.aoRemover();
    });
    expect(result.current.erro).toBe("Falhou.");
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
