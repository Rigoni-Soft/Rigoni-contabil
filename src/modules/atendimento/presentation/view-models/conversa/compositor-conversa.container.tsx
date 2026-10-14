"use client";

import { CompositorDeMensagem } from "@/presentation/components/organisms/compositor-de-mensagem.component";
import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import { formatarCronometro } from "@/modules/atendimento/presentation/view-models/conversa/conversa.presenter";
import { useCompositor } from "@/modules/atendimento/presentation/view-models/conversa/use-compositor.hook";
import { useGravadorAudio } from "@/modules/atendimento/presentation/view-models/conversa/use-gravador-audio.hook";
import { useSeletorDeEmoji } from "@/modules/atendimento/presentation/view-models/conversa/use-seletor-de-emoji.hook";

export function CompositorConversaContainer({
  atendimentoId,
  initialData,
}: {
  atendimentoId: string;
  initialData: ConversaVista;
}) {
  const {
    visivel,
    aoEnviar,
    enviando,
    erro,
    enviadas,
    anexo,
    aceitar,
    aoAnexar,
    aoRemoverAnexo,
    aoEnviarAudio,
    aoCancelarAudio,
    arraste,
  } = useCompositor(atendimentoId, initialData);

  const { campoRef, seletor } = useSeletorDeEmoji();
  const gravador = useGravadorAudio();

  // Para a gravação (se ainda corre) e entrega o arquivo; só some da tela se a entrega deu certo.
  const enviarGravacao = async () => {
    const gravado = await gravador.parar();
    if (gravado) aoEnviarAudio(gravado, gravador.descartar);
  };

  if (!visivel) return null;
  return (
    <CompositorDeMensagem
      onEnviar={aoEnviar}
      enviando={enviando}
      erro={gravador.erro ?? erro}
      enviadas={enviadas}
      campoRef={campoRef}
      seletor={seletor}
      anexo={anexo}
      aceitar={aceitar}
      onAnexar={aoAnexar}
      onRemoverAnexo={aoRemoverAnexo}
      gravacao={{
        gravando: gravador.estado !== "ocioso",
        parada: gravador.estado === "pronto",
        tempo: formatarCronometro(gravador.segundos),
        indisponivel: gravador.indisponivel,
        onIniciar: () => void gravador.iniciar(),
        onCancelar: () => {
          gravador.descartar();
          aoCancelarAudio();
        },
        onEnviar: () => void enviarGravacao(),
      }}
      arraste={arraste}
    />
  );
}
