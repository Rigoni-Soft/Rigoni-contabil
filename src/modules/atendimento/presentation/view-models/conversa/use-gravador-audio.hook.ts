import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { ANEXO_TAMANHO_MAXIMO, AUDIO_DURACAO_MAXIMA_S } from "@/shared/kernel/anexo";

const FORMATOS_ACEITOS_PELO_WHATSAPP = [
  "audio/ogg;codecs=opus",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
];

export const GRAVACAO_SEM_HTTPS = "A gravação de áudio exige uma conexão segura (HTTPS).";
export const GRAVACAO_SEM_SUPORTE = "Este navegador não permite gravar áudio.";
export const GRAVACAO_PERMISSAO_NEGADA =
  "Libere o microfone nas configurações do navegador para gravar.";
export const GRAVACAO_SEM_MICROFONE = "Nenhum microfone encontrado neste equipamento.";
export const GRAVACAO_FALHOU = "Não foi possível acessar o microfone.";

const FORMATO_PADRAO_DO_NAVEGADOR = "audio/webm";
const ENTREGA_DE_PARTES_MS = 1000;
const UM_SEGUNDO_MS = 1000;
const AUDIO_MONO = { channelCount: 1 };

export type EstadoGravacao = "ocioso" | "gravando" | "pronto";

function motivoSemSuporte(): string {
  if (window.isSecureContext === false) return GRAVACAO_SEM_HTTPS;
  if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return GRAVACAO_SEM_SUPORTE;
  }
  return "";
}
const semAssinaturaPorqueSuporteNaoMuda = () => () => {};

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

export function useGravadorAudio() {
  const indisponivel = useSyncExternalStore(
    semAssinaturaPorqueSuporteNaoMuda,
    motivoSemSuporte,
    () => "",
  );
  const [estado, setEstado] = useState<EstadoGravacao>("ocioso");
  const [segundos, setSegundos] = useState(0);
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
  }, [liberar]);

  useEffect(() => descartar, [descartar]);

  async function iniciar() {
    if (estado !== "ocioso" || indisponivel) return;
    setErro(undefined);
    let microfone: MediaStream;
    try {
      microfone = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_MONO });
    } catch (falha) {
      setErro(mensagemDoErro(falha));
      return;
    }
    const formato = FORMATOS_ACEITOS_PELO_WHATSAPP.find((tipo) =>
      MediaRecorder.isTypeSupported(tipo),
    );
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
      const tipo = atual.mimeType || formato || FORMATO_PADRAO_DO_NAVEGADOR;
      const gravado = new File(partes, `gravacao.${extensao(tipo)}`, { type: tipo });
      arquivoGravado.current = gravado;
      setEstado("pronto");
    };

    let decorridos = 0;
    setSegundos(0);
    setEstado("gravando");
    relogio.current = setInterval(() => {
      decorridos += 1;
      setSegundos(decorridos);
      if (decorridos >= AUDIO_DURACAO_MAXIMA_S) encerrarPorLimite();
    }, UM_SEGUNDO_MS);
    atual.start(ENTREGA_DE_PARTES_MS);
  }

  return {
    estado,
    segundos,
    indisponivel: indisponivel || undefined,
    erro,
    iniciar,
    parar,
    descartar,
  };
}
