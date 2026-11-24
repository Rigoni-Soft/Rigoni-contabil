import { Pilha } from "@/presentation/components/atoms/caixa.component";
import { CabecalhoDeTela } from "@/presentation/components/molecules/cabecalho-de-tela.component";
import { CartaoDaTela } from "@/presentation/components/molecules/cartao-da-tela.component";
import { TelaDeTrabalhoTemplate } from "@/presentation/components/templates/tela-de-trabalho-template.component";

type EditarCadastroOperacionalPageProps = {
  header: React.ReactNode;
  titulo: string;
  formulario: React.ReactNode;
  alteracoesContratuais?: React.ReactNode;
  responsavelDoSetor?: React.ReactNode;
  acompanhamentoRh?: React.ReactNode;
  observacoesRh?: React.ReactNode;
  voltarHref?: string;
};

export function EditarCadastroOperacionalPage({
  header,
  titulo,
  formulario,
  alteracoesContratuais,
  responsavelDoSetor,
  acompanhamentoRh,
  observacoesRh,
  voltarHref = "/",
}: EditarCadastroOperacionalPageProps) {
  return (
    <TelaDeTrabalhoTemplate
      header={header}
      largura="cadastro"
      cabecalho={<CabecalhoDeTela voltarHref={voltarHref} titulo={titulo} />}
      conteudo={
        <Pilha espaco={6}>
          {alteracoesContratuais}
          {responsavelDoSetor}
          {formulario}
          {(acompanhamentoRh || observacoesRh) && (
            <CartaoDaTela>
              {acompanhamentoRh}
              {observacoesRh}
            </CartaoDaTela>
          )}
        </Pilha>
      }
    />
  );
}
