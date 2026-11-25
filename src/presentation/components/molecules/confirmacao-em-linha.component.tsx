import { BotaoDaGuia } from "@/presentation/components/atoms/botao-da-guia.component";
import { Texto } from "@/presentation/components/atoms/texto.component";

type ConfirmacaoEmLinhaProps = {
  texto: React.ReactNode;
  idDoTexto?: string;
  rotuloDoConfirmar: string;
  rotuloEmCurso: string;
  nomeDoConfirmar: string;
  nomeDoCancelar: string;
  rotuloDoCancelar?: string;
  focoInicial?: "cancelar" | "confirmar";
  destrutiva?: boolean;
  emCurso: boolean;
  ocupado: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
};

export function ConfirmacaoEmLinha({
  texto,
  idDoTexto,
  rotuloDoConfirmar,
  rotuloEmCurso,
  nomeDoConfirmar,
  nomeDoCancelar,
  rotuloDoCancelar = "Cancelar",
  focoInicial = "cancelar",
  destrutiva,
  emCurso,
  ocupado,
  onConfirmar,
  onCancelar,
}: ConfirmacaoEmLinhaProps) {
  return (
    <>
      <Texto variante="corpo" role="alert" id={idDoTexto} className="basis-full">
        {texto}
      </Texto>
      <BotaoDaGuia
        variant={destrutiva ? "destructive" : "default"}
        ocupado={ocupado}
        autoFocus={focoInicial === "confirmar"}
        onClick={onConfirmar}
        aria-label={nomeDoConfirmar}
        aria-describedby={idDoTexto}
      >
        {emCurso ? rotuloEmCurso : rotuloDoConfirmar}
      </BotaoDaGuia>
      <BotaoDaGuia
        variant="outline"
        autoFocus={focoInicial === "cancelar"}
        onClick={onCancelar}
        aria-label={nomeDoCancelar}
        aria-describedby={idDoTexto}
      >
        {rotuloDoCancelar}
      </BotaoDaGuia>
    </>
  );
}
