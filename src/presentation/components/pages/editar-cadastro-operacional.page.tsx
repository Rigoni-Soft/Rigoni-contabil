import { Pilha } from "@/presentation/components/atoms/caixa.component";
import { CabecalhoDeTela } from "@/presentation/components/molecules/cabecalho-de-tela.component";
import { CartaoDaTela } from "@/presentation/components/molecules/cartao-da-tela.component";
import { TelaDeTrabalhoTemplate } from "@/presentation/components/templates/tela-de-trabalho-template.component";

type EditarCadastroOperacionalPageProps = {
  header: React.ReactNode;
  titulo: string;
  formulario: React.ReactNode;
  // Só o Admin: diálogo de anexar alteração contratual e sua confirmação, fora do formulário.
  alteracoesContratuais?: React.ReactNode;
  // Líder de Setor fora do Simples Nacional: o Responsável do Cliente no Setor dele.
  responsavelDoSetor?: React.ReactNode;
  // Funcionário, Líder e Admin do RH: o acompanhamento do mês do Cliente (marcar serviços).
  acompanhamentoRh?: React.ReactNode;
  // Só o Admin, que vê o SN e o RH: as observações do RH, à parte do formulário do SN.
  observacoesRh?: React.ReactNode;
  // De onde a tela foi aberta (ex.: a lista de um bucket do resumo do setor): "Voltar" leva
  // para lá, não sempre para o dashboard.
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
          {/* Antes do formulário: a confirmação de anexar aparece colada ao cartão do documento, que
              fica no topo dele, em vez de lá embaixo, fora da vista. */}
          {alteracoesContratuais}
          {responsavelDoSetor}
          {formulario}
          {/* Admin: SN e RH em dois cartões iguais (o RH não entra no <form> do SN: seria form aninhado).
              O cartão do RH existe mesmo se as observações não carregarem. */}
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
