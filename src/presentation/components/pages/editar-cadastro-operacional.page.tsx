import { Pilha } from "@/presentation/components/atoms/caixa.component";
import { CabecalhoDeTela } from "@/presentation/components/molecules/cabecalho-de-tela.component";
import { TelaDeTrabalhoTemplate } from "@/presentation/components/templates/tela-de-trabalho-template.component";

type EditarCadastroOperacionalPageProps = {
  header: React.ReactNode;
  titulo: string;
  formulario: React.ReactNode;
  // Só o Admin: diálogo de anexar alteração contratual e sua confirmação, fora do formulário.
  alteracoesContratuais?: React.ReactNode;
  // De onde a tela foi aberta (ex.: a lista de um bucket do resumo do setor): "Voltar" leva
  // para lá, não sempre para o dashboard.
  voltarHref?: string;
};

export function EditarCadastroOperacionalPage({
  header,
  titulo,
  formulario,
  alteracoesContratuais,
  voltarHref = "/",
}: EditarCadastroOperacionalPageProps) {
  return (
    <TelaDeTrabalhoTemplate
      header={header}
      largura="cadastro"
      cabecalho={<CabecalhoDeTela voltarHref={voltarHref} titulo={titulo} />}
      conteudo={
        <Pilha espaco={6}>
          {/* Antes do formulário: a confirmação de anexar aparece colada ao cartão do documento, que
              fica no topo dele, em vez de lá embaixo, fora da vista. */}
          {alteracoesContratuais}
          {formulario}
        </Pilha>
      }
    />
  );
}
