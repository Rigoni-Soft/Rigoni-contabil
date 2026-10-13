import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { TelaDeTrabalhoTemplate } from "@/presentation/components/templates/tela-de-trabalho-template.component";

type ResumoSetorSnPageProps = {
  header: React.ReactNode;
  nav: React.ReactNode;
  // Resumo e comparativos já montados; sem eles (falha de leitura) a tela mostra o `erro`.
  resumo?: React.ReactNode;
  comparativos?: React.ReactNode;
  erro?: string;
};

export function ResumoSetorSnPage({
  header,
  nav,
  resumo,
  comparativos,
  erro,
}: ResumoSetorSnPageProps) {
  return (
    <TelaDeTrabalhoTemplate
      header={header}
      nav={nav}
      largura="conteudo"
      conteudo={
        erro ? (
          <AvisoDeStatus tipo="erro" texto={erro} />
        ) : (
          <Caixa className="space-y-8">
            {resumo}
            {comparativos}
          </Caixa>
        )
      }
    />
  );
}
