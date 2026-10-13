import { TelaDeTrabalhoTemplate } from "@/presentation/components/templates/tela-de-trabalho-template.component";

type EditarCadastroOperacionalPageProps = {
  header: React.ReactNode;
  titulo: string;
  formulario: React.ReactNode;
  // De onde a tela foi aberta (ex.: a lista de um bucket do resumo do setor, #36): "Voltar" leva
  // para lá, não sempre para o dashboard.
  voltarHref?: string;
};

export function EditarCadastroOperacionalPage({
  header,
  titulo,
  formulario,
  voltarHref = "/",
}: EditarCadastroOperacionalPageProps) {
  return (
    <TelaDeTrabalhoTemplate
      header={header}
      largura="conteudo"
      voltarHref={voltarHref}
      titulo={titulo}
      conteudo={formulario}
    />
  );
}
