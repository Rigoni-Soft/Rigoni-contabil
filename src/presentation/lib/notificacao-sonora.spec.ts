import type * as Modulo from "./notificacao-sonora";

// O contexto de áudio fica guardado no módulo: cada teste carrega uma cópia nova.
function carregar(): typeof Modulo {
  let modulo!: typeof Modulo;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    modulo = require("./notificacao-sonora");
  });
  return modulo;
}

type Oscilador = {
  type: string;
  frequency: { value: number };
  connect: jest.Mock;
  start: jest.Mock;
  stop: jest.Mock;
};

function instalarAudioFalso(estado: "running" | "suspended") {
  const osciladores: Oscilador[] = [];
  const resume = jest.fn();
  class AudioContextFalso {
    state = estado;
    currentTime = 10;
    destination = {};
    resume = resume;
    createOscillator() {
      const oscilador: Oscilador = {
        type: "",
        frequency: { value: 0 },
        connect: jest.fn(function (this: Oscilador, destino: unknown) {
          return destino;
        }),
        start: jest.fn(),
        stop: jest.fn(),
      };
      osciladores.push(oscilador);
      return oscilador;
    }
    createGain() {
      return {
        gain: { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() },
        connect: jest.fn((destino: unknown) => destino),
      };
    }
  }
  Object.defineProperty(window, "AudioContext", { value: AudioContextFalso, configurable: true });
  return { osciladores, resume };
}

afterEach(() => {
  Reflect.deleteProperty(window, "AudioContext");
  jest.resetModules();
});

describe("tocarNotificacao", () => {
  it("toca dois tons em sequência quando o navegador liberou o som", () => {
    const { osciladores } = instalarAudioFalso("running");
    carregar().tocarNotificacao();

    expect(osciladores.map((o) => o.frequency.value)).toEqual([880, 1174.66]);
    expect(osciladores[0].start).toHaveBeenCalledWith(10);
    expect(osciladores[1].start).toHaveBeenCalledWith(10.12);
  });

  it("fica em silêncio, sem erro, enquanto o navegador não liberou o som", () => {
    const { osciladores } = instalarAudioFalso("suspended");

    expect(() => carregar().tocarNotificacao()).not.toThrow();
    expect(osciladores).toEqual([]);
  });

  it("sem suporte a áudio no navegador não faz nada nem lança erro", () => {
    expect(() => carregar().tocarNotificacao()).not.toThrow();
  });
});

describe("prepararSom", () => {
  it("o primeiro clique cria o contexto e libera o som", () => {
    const { resume } = instalarAudioFalso("suspended");
    carregar().prepararSom();

    window.dispatchEvent(new Event("pointerdown"));

    expect(resume).toHaveBeenCalledTimes(1);
  });

  it("não lança erro sem suporte a áudio", () => {
    carregar().prepararSom();

    expect(() => window.dispatchEvent(new Event("keydown"))).not.toThrow();
  });
});
