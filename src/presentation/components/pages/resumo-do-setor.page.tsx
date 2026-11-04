import { Pilha } from "@/presentation/components/atoms/caixa.component";
import { FalhaDeCarga } from "@/presentation/components/molecules/falha-de-carga.component";
import { TelaDeTrabalhoTemplate } from "@/presentation/components/templates/tela-de-trabalho-template.component";

type ResumoDoSetorPageProps = {
  header: React.ReactNode;
  nav: React.ReactNode;
  // Resumo e comparativos já montados; sem eles (falha de leitura) a tela mostra o `erro`.
  resumo?: React.ReactNode;
  comparativos?: React.ReactNode;
  erro?: string;
  // A própria rota: com o `erro`, a tela oferece recarregá-la.
  tentarNovamenteHref?: string;
};

export function ResumoDoSetorPage({
  header,
  nav,
  resumo,
  comparativos,
  erro,
  tentarNovamenteHref,
}: ResumoDoSetorPageProps) {
  return (
    <TelaDeTrabalhoTemplate
      header={header}
      nav={nav}
      largura="conteudo"
      conteudo={
        erro ? (
          <FalhaDeCarga texto={erro} tentarNovamenteHref={tentarNovamenteHref} />
        ) : (
          <Pilha espaco={8}>
            {resumo}
            {comparativos}
          </Pilha>
        )
      }
    />
  );
}
