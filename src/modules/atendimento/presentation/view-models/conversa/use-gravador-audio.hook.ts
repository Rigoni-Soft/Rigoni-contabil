import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { ANEXO_TAMANHO_MAXIMO, AUDIO_DURACAO_MAXIMA_S } from "@/shared/kernel/anexo";

// Primeiro formato que o navegador gravar: o que o WhatsApp aceita sem conversão. Sem nenhum deles
// (Chrome/Edge), grava o padrão do navegador (webm) e o servidor converte (docs/adr/0006).
const FORMATOS = ["audio/ogg;codecs=opus", "audio/mp4;codecs=mp4a.40.2", "audio/mp4"];

export const GRAVACAO_SEM_HTTPS = "A gravação de áudio exige uma conexão segura (HTTPS).";
export const GRAVACAO_SEM_SUPORTE = "Este navegador não permite gravar áudio.";
export const GRAVACAO_PERMISSAO_NEGADA =
  "Libere o microfone nas configurações do navegador para gravar.";
export const GRAVACAO_SEM_MICROFONE = "Nenhum microfone encontrado neste equipamento.";
export const GRAVACAO_FALHOU = "Não foi possível acessar o microfone.";

export type EstadoGravacao = "ocioso" | "gravando" | "pronto";

// "" quando dá para gravar; senão, o motivo. Lido só no navegador (o servidor assume que sim).
function motivoSemSuporte(): string {
  if (window.isSecureContext === false) return GRAVACAO_SEM_HTTPS;
  if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return GRAVACAO_SEM_SUPORTE;
  }
  return "";
}
const semAssinatura = () => () => {};

function extensao(mime: string) {
  if (mime.startsWith("audio/ogg")) return "ogg";
  if (mime.startsWith("audio/mp4")) return "m4a";
  return "webm";
}

function mensagemDoErro(erro: unknown) {
  const nome = erro instanceof DOMException ? erro.name : "";
  if (nome === "NotAllowedError" || nome === "SecurityError") return GRAVACAO_PERMISSAO_NEGADA;
  if (nome === "NotFoundError" || nome === "OverconstrainedError") return GRAVACAO_SEM_MICROFONE;
  return GRAVACAO_FALHOU;
}

// Gravação pelo microfone (UI efêmera, arquitetura.md §4.7). A permissão só é pedida em `iniciar`.
// O microfone é liberado ao parar, ao descartar e ao sair da tela; nada fica guardado no navegador.
// `limiteAtingido`: a gravação parou sozinha (duração ou tamanho) e espera a confirmação para enviar.
export function useGravadorAudio() {
  const indisponivel = useSyncExternalStore(semAssinatura, motivoSemSuporte, () => "");
  const [estado, setEstado] = useState<EstadoGravacao>("ocioso");
  const [segundos, setSegundos] = useState(0);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [limiteAtingido, setLimiteAtingido] = useState(false);
  const [erro, setErro] = useState<string>();

  const gravador = useRef<MediaRecorder | null>(null);
  const fluxo = useRef<MediaStream | null>(null);
  const relogio = useRef<ReturnType<typeof setInterval> | null>(null);
  const arquivoGravado = useRef<File | null>(null);
  const descartado = useRef(false);

  const liberar = useCallback(() => {
    if (relogio.current) clearInterval(relogio.current);
    relogio.current = null;
    fluxo.current?.getTracks().forEach((trilha) => trilha.stop());
    fluxo.current = null;
  }, []);

  const parar = useCallback((): Promise<File | null> => {
    const atual = gravador.current;
    if (!atual || atual.state === "inactive") return Promise.resolve(arquivoGravado.current);
    return new Promise((resolve) => {
      atual.addEventListener("stop", () => resolve(arquivoGravado.current), { once: true });
      atual.stop();
    });
  }, []);

  const descartar = useCallback(() => {
    descartado.current = true;
    const atual = gravador.current;
    if (atual && atual.state !== "inactive") atual.stop();
    gravador.current = null;
    arquivoGravado.current = null;
    liberar();
    setEstado("ocioso");
    setSegundos(0);
    setArquivo(null);
    setLimiteAtingido(false);
  }, [liberar]);

  useEffect(() => descartar, [descartar]);

  async function iniciar() {
    if (estado !== "ocioso" || indisponivel) return;
    setErro(undefined);
    let microfone: MediaStream;
    try {
      microfone = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (falha) {
      setErro(mensagemDoErro(falha));
      return;
    }
    const formato = FORMATOS.find((tipo) => MediaRecorder.isTypeSupported(tipo));
    let atual: MediaRecorder;
    try {
      atual = new MediaRecorder(microfone, formato ? { mimeType: formato } : undefined);
    } catch {
      microfone.getTracks().forEach((trilha) => trilha.stop());
      setErro(GRAVACAO_SEM_SUPORTE);
      return;
    }

    const partes: Blob[] = [];
    let bytes = 0;
    descartado.current = false;
    arquivoGravado.current = null;
    fluxo.current = microfone;
    gravador.current = atual;

    const encerrarPorLimite = () => {
      setLimiteAtingido(true);
      if (atual.state !== "inactive") atual.stop();
    };
    atual.ondataavailable = (evento) => {
      if (evento.data.size === 0) return;
      partes.push(evento.data);
      bytes += evento.data.size;
      if (bytes >= ANEXO_TAMANHO_MAXIMO) encerrarPorLimite();
    };
    atual.onstop = () => {
      liberar();
      if (descartado.current) return;
      const tipo = atual.mimeType || formato || "audio/webm";
      const gravado = new File(partes, `gravacao.${extensao(tipo)}`, { type: tipo });
      arquivoGravado.current = gravado;
      setArquivo(gravado);
      setEstado("pronto");
    };

    let decorridos = 0;
    setSegundos(0);
    setLimiteAtingido(false);
    setEstado("gravando");
    relogio.current = setInterval(() => {
      decorridos += 1;
      setSegundos(decorridos);
      if (decorridos >= AUDIO_DURACAO_MAXIMA_S) encerrarPorLimite();
    }, 1000);
    // Entrega os pedaços a cada segundo: o tamanho é conferido durante a gravação, não só no fim.
    atual.start(1000);
  }

  return {
    estado,
    segundos,
    arquivo,
    limiteAtingido,
    // Motivo fixo de o botão não funcionar; `erro` é o da última tentativa (permissão, sem microfone).
    indisponivel: indisponivel || undefined,
    erro,
    iniciar,
    parar,
    descartar,
  };
}
