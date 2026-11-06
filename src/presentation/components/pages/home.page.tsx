import { Texto } from "@/presentation/components/atoms/texto.component";
import { TelaDeTrabalhoTemplate } from "@/presentation/components/templates/tela-de-trabalho-template.component";

type HomePageProps = { header: React.ReactNode; nav: React.ReactNode; busca: React.ReactNode };

export function HomePage({ header, nav, busca }: HomePageProps) {
  return (
    <TelaDeTrabalhoTemplate
      header={header}
      nav={nav}
      largura="conteudo"
      // O visual da home é a busca; o h1 existe para a hierarquia de títulos (leitor de tela).
      cabecalho={
        <Texto como="h1" variante="somenteLeitor">
          Busca de clientes
        </Texto>
      }
      conteudo={busca}
    />
  );
}
