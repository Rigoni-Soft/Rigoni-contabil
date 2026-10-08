// Aviso sonoro curto (dois tons) gerado pelo próprio navegador: não há arquivo de áudio para
// carregar. Navegadores só liberam som depois de um gesto do usuário (política de autoplay), então
// `prepararSom` cria o contexto no primeiro clique/tecla; antes disso, `tocarNotificacao` é
// silencioso e nunca lança erro.
let contexto: AudioContext | null = null;

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
    } catch {
      // sem áudio no ambiente: o aviso sonoro simplesmente não existe
    }
  };
  window.addEventListener("pointerdown", liberar, { once: true });
  window.addEventListener("keydown", liberar, { once: true });
}

const TONS_HZ = [880, 1174.66]; // lá e ré, sobe um pouco: "chegou algo"
const DURACAO_DE_CADA_TOM_S = 0.12;
const VOLUME = 0.08;

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
      // Entrada e saída suaves: sem estalo no começo e no fim do tom.
      volume.gain.setValueAtTime(0.0001, comeco);
      volume.gain.exponentialRampToValueAtTime(VOLUME, comeco + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.0001, comeco + DURACAO_DE_CADA_TOM_S);
      oscilador.connect(volume).connect(audio.destination);
      oscilador.start(comeco);
      oscilador.stop(comeco + DURACAO_DE_CADA_TOM_S);
    });
  } catch {
    // o aviso sonoro nunca derruba a tela
  }
}
