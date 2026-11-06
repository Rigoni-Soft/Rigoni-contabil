import { BotaoDaGuia } from "@/presentation/components/atoms/botao-da-guia.component";
import { Texto } from "@/presentation/components/atoms/texto.component";

type ConfirmacaoEmLinhaProps = {
  // O que vai acontecer, dito antes (anunciado como alerta ao abrir).
  texto: React.ReactNode;
  rotuloDoConfirmar: string;
  rotuloEmCurso: string;
  nomeDoConfirmar: string;
  nomeDoCancelar: string;
  destrutiva?: boolean;
  // A pessoa já confirmou e o servidor ainda responde.
  emCurso: boolean;
  // Outra ação em curso: o botão segue focável, mas avisa em vez de agir.
  ocupado: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
};

// Pergunta de risco dentro da linha: o texto, "confirmar" e "Cancelar". O foco abre no Cancelar, o
// gesto seguro para quem abriu sem querer.
export function ConfirmacaoEmLinha({
  texto,
  rotuloDoConfirmar,
  rotuloEmCurso,
  nomeDoConfirmar,
  nomeDoCancelar,
  destrutiva,
  emCurso,
  ocupado,
  onConfirmar,
  onCancelar,
}: ConfirmacaoEmLinhaProps) {
  return (
    <>
      <Texto variante="corpo" role="alert" className="basis-full">
        {texto}
      </Texto>
      <BotaoDaGuia
        variant={destrutiva ? "destructive" : "default"}
        ocupado={ocupado}
        onClick={onConfirmar}
        aria-label={nomeDoConfirmar}
      >
        {emCurso ? rotuloEmCurso : rotuloDoConfirmar}
      </BotaoDaGuia>
      <BotaoDaGuia variant="outline" autoFocus onClick={onCancelar} aria-label={nomeDoCancelar}>
        Cancelar
      </BotaoDaGuia>
    </>
  );
}
