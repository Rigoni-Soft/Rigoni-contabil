import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { EntradaTemplate } from "@/presentation/components/templates/entrada-template.component";

type TelaDeAvisoPageProps = {
  subtitulo: string;
  aviso: string;
  rodape: string;
  acoes: React.ReactNode;
};

// Tela inteira para o que não é um fluxo normal: rota inexistente ou falha inesperada.
export function TelaDeAvisoPage({ subtitulo, aviso, rodape, acoes }: TelaDeAvisoPageProps) {
  return (
    <EntradaTemplate
      titulo="Rigoni Contábil"
      subtitulo={subtitulo}
      rodape={rodape}
      formulario={
        <Caixa className="flex flex-col gap-4">
          <AvisoDeStatus tipo="erro" texto={aviso} className="text-sm" />
          <Caixa className="flex flex-col gap-2">{acoes}</Caixa>
        </Caixa>
      }
    />
  );
}
