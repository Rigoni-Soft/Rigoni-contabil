import { Balao } from "@/presentation/components/atoms/balao.component";
import { HoraDaMensagem } from "@/presentation/components/atoms/hora-da-mensagem.component";
import { ReacaoEmPilula } from "@/presentation/components/atoms/reacao-em-pilula.component";
import { Texto } from "@/presentation/components/atoms/texto.component";

type MensagemBalaoProps = {
  lado: "contato" | "ura" | "atendente";
  autor: string;
  // Só no balão do cliente: a empresa a que o Atendimento pertence.
  detalhe: string | null;
  texto: string;
  hora: string;
  // Reação do escritório à Mensagem do cliente (emoji) e a ação de reagir (slot do organismo).
  reacao?: string | null;
  acao?: React.ReactNode;
};

// Uma Mensagem da conversa: balão + autor, detalhe, texto, reação e hora.
export function MensagemBalao({
  lado,
  autor,
  detalhe,
  texto,
  hora,
  reacao,
  acao,
}: MensagemBalaoProps) {
  const doCliente = lado === "contato";
  return (
    <Balao lado={lado} acao={acao}>
      <Texto variante="rotulo" className={doCliente ? "text-primary" : "opacity-90"}>
        {autor}
      </Texto>
      {detalhe && <Texto variante="nota">{detalhe}</Texto>}
      <p className="break-words whitespace-pre-wrap">{texto}</p>
      {reacao && <ReacaoEmPilula emoji={reacao} />}
      <HoraDaMensagem hora={hora} sobrePrimario={lado === "atendente"} />
    </Balao>
  );
}
