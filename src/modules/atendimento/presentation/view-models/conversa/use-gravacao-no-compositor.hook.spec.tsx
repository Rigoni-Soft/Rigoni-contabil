import { act, renderHook } from "@testing-library/react";

import { useGravacaoNoCompositor } from "./use-gravacao-no-compositor.hook";
import { useGravadorAudio } from "./use-gravador-audio.hook";

jest.mock("./use-gravador-audio.hook", () => ({ useGravadorAudio: jest.fn() }));

const gravadorFalso = (sobrescritas: Record<string, unknown> = {}) => ({
  estado: "gravando",
  segundos: 65,
  indisponivel: undefined,
  erro: undefined,
  iniciar: jest.fn(),
  parar: jest.fn().mockResolvedValue(new File(["x"], "gravacao.ogg")),
  descartar: jest.fn(),
  ...sobrescritas,
});

describe("useGravacaoNoCompositor", () => {
  it("traduz o estado do gravador para o que a barra mostra", () => {
    jest.mocked(useGravadorAudio).mockReturnValue(gravadorFalso() as never);

    const { result } = renderHook(() =>
      useGravacaoNoCompositor({ aoEnviarAudio: jest.fn(), aoCancelarAudio: jest.fn() }),
    );

    expect(result.current.gravacao).toMatchObject({
      gravando: true,
      parada: false,
      tempo: "01:05",
      focarMicrofone: false,
    });
  });

  it("enviar para a gravação, entrega o arquivo e só descarta (e devolve o foco) se a entrega deu certo", async () => {
    const gravador = gravadorFalso();
    jest.mocked(useGravadorAudio).mockReturnValue(gravador as never);
    const aoEnviarAudio = jest.fn();
    const { result } = renderHook(() =>
      useGravacaoNoCompositor({ aoEnviarAudio, aoCancelarAudio: jest.fn() }),
    );

    await act(async () => result.current.gravacao.onEnviar());

    expect(aoEnviarAudio).toHaveBeenCalledWith(expect.any(File), expect.any(Function));
    expect(gravador.descartar).not.toHaveBeenCalled();
    act(() => aoEnviarAudio.mock.calls[0][1]());
    expect(gravador.descartar).toHaveBeenCalled();
    expect(result.current.gravacao.focarMicrofone).toBe(true);
  });

  it("cancelar descarta a gravação, devolve o foco e apaga o erro do envio", () => {
    const gravador = gravadorFalso();
    jest.mocked(useGravadorAudio).mockReturnValue(gravador as never);
    const aoCancelarAudio = jest.fn();
    const { result } = renderHook(() =>
      useGravacaoNoCompositor({ aoEnviarAudio: jest.fn(), aoCancelarAudio }),
    );

    act(() => result.current.gravacao.onCancelar());

    expect(gravador.descartar).toHaveBeenCalled();
    expect(aoCancelarAudio).toHaveBeenCalled();
    expect(result.current.gravacao.focarMicrofone).toBe(true);
  });
});
