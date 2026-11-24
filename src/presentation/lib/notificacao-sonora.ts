let contexto: AudioContext | null = null;

function ignorarFalhaDeAudio(_falha: unknown): void {}

function criarContexto(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Construtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Construtor) return null;
  contexto ??= new Construtor();
  return contexto;
}

export function prepararSom(): void {
  if (typeof window === "undefined") return;
  const liberar = () => {
    try {
      const audio = criarContexto();
      if (audio?.state === "suspended") void audio.resume();
    } catch (falha) {
      ignorarFalhaDeAudio(falha);
    }
  };
  window.addEventListener("pointerdown", liberar, { once: true });
  window.addEventListener("keydown", liberar, { once: true });
}

const TONS_HZ = [880, 1174.66];
const DURACAO_DE_CADA_TOM_S = 0.12;
const VOLUME = 0.08;
const VOLUME_QUASE_ZERO = 0.0001;
const DURACAO_DA_ENTRADA_S = 0.02;

export function tocarNotificacao(): void {
  try {
    const audio = criarContexto();
    if (!audio || audio.state !== "running") return;
    const inicio = audio.currentTime;
    TONS_HZ.forEach((frequencia, indice) => {
      const oscilador = audio.createOscillator();
      const volume = audio.createGain();
      const comeco = inicio + indice * DURACAO_DE_CADA_TOM_S;
      oscilador.type = "sine";
      oscilador.frequency.value = frequencia;
      volume.gain.setValueAtTime(VOLUME_QUASE_ZERO, comeco);
      volume.gain.exponentialRampToValueAtTime(VOLUME, comeco + DURACAO_DA_ENTRADA_S);
      volume.gain.exponentialRampToValueAtTime(VOLUME_QUASE_ZERO, comeco + DURACAO_DE_CADA_TOM_S);
      oscilador.connect(volume).connect(audio.destination);
      oscilador.start(comeco);
      oscilador.stop(comeco + DURACAO_DE_CADA_TOM_S);
    });
  } catch (falha) {
    ignorarFalhaDeAudio(falha);
  }
}
