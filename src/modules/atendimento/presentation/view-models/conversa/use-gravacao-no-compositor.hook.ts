import { useState } from "react";

import { formatarCronometro } from "@/modules/atendimento/presentation/view-models/conversa/conversa.presenter";
import { useGravadorAudio } from "@/modules/atendimento/presentation/view-models/conversa/use-gravador-audio.hook";

// Liga a gravação ao envio do compositor: o que a barra de gravação mostra e faz. A barra ocupa o
// lugar do campo, então ao sair dela (enviou ou cancelou) o foco volta ao microfone.
export function useGravacaoNoCompositor({
  aoEnviarAudio,
  aoCancelarAudio,
}: {
  // `aoConcluir` roda só se a entrega deu certo (falhou, a gravação fica para tentar de novo).
  aoEnviarAudio: (audio: File, aoConcluir: () => void) => void;
  aoCancelarAudio: () => void;
}) {
  const gravador = useGravadorAudio();
  const [focarMicrofone, setFocarMicrofone] = useState(false);

  const descartar = () => {
    gravador.descartar();
    setFocarMicrofone(true);
  };

  return {
    erro: gravador.erro,
    gravacao: {
      // A barra aparece enquanto grava e enquanto a gravação parada espera enviar ou cancelar.
      gravando: gravador.estado !== "ocioso",
      parada: gravador.estado === "pronto",
      tempo: formatarCronometro(gravador.segundos),
      indisponivel: gravador.indisponivel,
      focarMicrofone,
      onIniciar: () => {
        setFocarMicrofone(false);
        void gravador.iniciar();
      },
      onCancelar: () => {
        descartar();
        aoCancelarAudio();
      },
      // Para a gravação (se ainda corre) e entrega o arquivo.
      onEnviar: () => {
        void gravador.parar().then((gravado) => {
          if (gravado) aoEnviarAudio(gravado, descartar);
        });
      },
    },
  };
}
