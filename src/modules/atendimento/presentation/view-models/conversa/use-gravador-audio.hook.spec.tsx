import { act, renderHook } from "@testing-library/react";

import {
  GRAVACAO_PERMISSAO_NEGADA,
  GRAVACAO_SEM_MICROFONE,
  useGravadorAudio,
} from "./use-gravador-audio.hook";

class FakeMediaRecorder {
  static suportados: string[] = [];
  static ultimo: FakeMediaRecorder | null = null;
  static isTypeSupported = (tipo: string) => FakeMediaRecorder.suportados.includes(tipo);

  state: "inactive" | "recording" = "inactive";
  mimeType: string;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  private ouvintes: (() => void)[] = [];

  constructor(
    public stream: MediaStream,
    opcoes?: { mimeType?: string },
  ) {
    this.mimeType = opcoes?.mimeType ?? "audio/webm;codecs=opus";
    FakeMediaRecorder.ultimo = this;
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.onstop?.();
    this.ouvintes.forEach((o) => o());
  }
  addEventListener(_: string, ouvinte: () => void) {
    this.ouvintes.push(ouvinte);
  }
  emitir(bytes: number) {
    this.ondataavailable?.({ data: new Blob([new Uint8Array(bytes)]) });
  }
}

function fluxoFalso() {
  const trilha = { stop: jest.fn() };
  return { fluxo: { getTracks: () => [trilha] } as unknown as MediaStream, trilha };
}

function instalar(getUserMedia: () => Promise<MediaStream>) {
  Object.defineProperty(global, "MediaRecorder", { value: FakeMediaRecorder, configurable: true });
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia },
    configurable: true,
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  FakeMediaRecorder.suportados = [];
  FakeMediaRecorder.ultimo = null;
});
afterEach(() => jest.useRealTimers());

describe("useGravadorAudio", () => {
  it("só pede o microfone ao iniciar, grava e, ao parar, entrega o arquivo e libera as trilhas", async () => {
    const { fluxo, trilha } = fluxoFalso();
    const getUserMedia = jest.fn().mockResolvedValue(fluxo);
    instalar(getUserMedia);
    FakeMediaRecorder.suportados = ["audio/ogg;codecs=opus"];
    const { result } = renderHook(() => useGravadorAudio());
    expect(getUserMedia).not.toHaveBeenCalled();

    await act(() => result.current.iniciar());
    expect(result.current.estado).toBe("gravando");
    act(() => FakeMediaRecorder.ultimo!.emitir(100));
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(result.current.segundos).toBe(3);

    let arquivo: File | null = null;
    await act(async () => {
      arquivo = await result.current.parar();
    });

    expect(arquivo).toMatchObject({
      name: "gravacao.ogg",
      type: "audio/ogg;codecs=opus",
      size: 100,
    });
    expect(result.current.estado).toBe("pronto");
    expect(trilha.stop).toHaveBeenCalled();
  });

  it("sem formato aceito pelo provedor, grava o padrão do navegador (webm)", async () => {
    instalar(jest.fn().mockResolvedValue(fluxoFalso().fluxo));
    const { result } = renderHook(() => useGravadorAudio());

    await act(() => result.current.iniciar());
    act(() => FakeMediaRecorder.ultimo!.emitir(10));
    await act(async () => {
      await result.current.parar();
    });

    expect(result.current.arquivo).toMatchObject({ name: "gravacao.webm" });
  });

  it.each([
    ["NotAllowedError", GRAVACAO_PERMISSAO_NEGADA],
    ["NotFoundError", GRAVACAO_SEM_MICROFONE],
  ])("%s vira mensagem clara e não inicia a gravação", async (nome, mensagem) => {
    instalar(jest.fn().mockRejectedValue(new DOMException("x", nome)));
    const { result } = renderHook(() => useGravadorAudio());

    await act(() => result.current.iniciar());

    expect(result.current.erro).toBe(mensagem);
    expect(result.current.estado).toBe("ocioso");
  });

  it("cancelar descarta a gravação e libera as trilhas", async () => {
    const { fluxo, trilha } = fluxoFalso();
    instalar(jest.fn().mockResolvedValue(fluxo));
    const { result } = renderHook(() => useGravadorAudio());
    await act(() => result.current.iniciar());
    act(() => FakeMediaRecorder.ultimo!.emitir(10));

    act(() => result.current.descartar());

    expect(trilha.stop).toHaveBeenCalled();
    expect(result.current).toMatchObject({ estado: "ocioso", arquivo: null, segundos: 0 });
  });

  it("sair da tela no meio da gravação libera o microfone", async () => {
    const { fluxo, trilha } = fluxoFalso();
    instalar(jest.fn().mockResolvedValue(fluxo));
    const { result, unmount } = renderHook(() => useGravadorAudio());
    await act(() => result.current.iniciar());

    unmount();

    expect(trilha.stop).toHaveBeenCalled();
  });

  it("ao atingir o limite de tamanho, a gravação para sozinha e espera a confirmação", async () => {
    instalar(jest.fn().mockResolvedValue(fluxoFalso().fluxo));
    const { result } = renderHook(() => useGravadorAudio());
    await act(() => result.current.iniciar());

    act(() => FakeMediaRecorder.ultimo!.emitir(10 * 1024 * 1024));

    expect(result.current).toMatchObject({ estado: "pronto", limiteAtingido: true });
    expect(result.current.arquivo).not.toBeNull();
  });

  it("ao atingir o limite de duração, a gravação para sozinha", async () => {
    instalar(jest.fn().mockResolvedValue(fluxoFalso().fluxo));
    const { result } = renderHook(() => useGravadorAudio());
    await act(() => result.current.iniciar());
    act(() => FakeMediaRecorder.ultimo!.emitir(10));

    act(() => {
      jest.advanceTimersByTime(300_000);
    });

    expect(result.current).toMatchObject({ estado: "pronto", limiteAtingido: true });
  });

  it("sem MediaRecorder, informa que o navegador não tem suporte", () => {
    Object.defineProperty(global, "MediaRecorder", { value: undefined, configurable: true });
    const { result } = renderHook(() => useGravadorAudio());

    expect(result.current.indisponivel).toMatch(/não permite gravar áudio/);
  });
});
