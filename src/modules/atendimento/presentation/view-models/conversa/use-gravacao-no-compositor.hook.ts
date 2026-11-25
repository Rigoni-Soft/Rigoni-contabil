import { useState } from "react";

import { formatarCronometro } from "@/modules/atendimento/presentation/view-models/conversa/conversa.presenter";
import { useGravadorAudio } from "@/modules/atendimento/presentation/view-models/conversa/use-gravador-audio.hook";

export function useGravacaoNoCompositor({
  aoEnviarAudio,
  aoCancelarAudio,
}: {
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
      onEnviar: () => {
        void gravador.parar().then((gravado) => {
          if (gravado) aoEnviarAudio(gravado, descartar);
        });
      },
    },
  };
}
