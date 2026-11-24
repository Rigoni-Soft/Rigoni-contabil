import { Texto } from "@/presentation/components/atoms/texto.component";
import { TelaDeTrabalhoTemplate } from "@/presentation/components/templates/tela-de-trabalho-template.component";

type HomePageProps = { header: React.ReactNode; nav: React.ReactNode; busca: React.ReactNode };

export function HomePage({ header, nav, busca }: HomePageProps) {
  return (
    <TelaDeTrabalhoTemplate
      header={header}
      nav={nav}
      largura="conteudo"
      cabecalho={
        <Texto como="h1" variante="somenteLeitor">
          Busca de clientes
        </Texto>
      }
      conteudo={busca}
    />
  );
}
