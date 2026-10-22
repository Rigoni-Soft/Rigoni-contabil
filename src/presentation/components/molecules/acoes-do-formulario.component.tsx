import { Linha } from "@/presentation/components/atoms/caixa.component";
import { LinkDeAcao } from "@/presentation/components/atoms/link-de-acao.component";
import { Button } from "@/presentation/components/ui/button";

type AcoesDoFormularioProps = {
  pendente: boolean;
  onLimpar: () => void;
  // Sem callback, "Cancelar" é um link para "/". Com callback (formulário inline na busca do
  // dashboard) já estamos em "/": quem abriu o painel o fecha direto.
  onCancelar?: () => void;
};

// Salvar / Limpar / Cancelar, na ordem do contrato de ações de formulário do DESIGN.md.
export function AcoesDoFormulario({ pendente, onLimpar, onCancelar }: AcoesDoFormularioProps) {
  return (
    <Linha espaco={2} quebra className="sm:col-span-2 lg:col-span-4">
      <Button type="submit">{pendente ? "Salvando..." : "Salvar"}</Button>
      <Button type="button" variant="outline" onClick={onLimpar} disabled={pendente}>
        Limpar
      </Button>
      {onCancelar ? (
        <Button type="button" variant="destructive" onClick={onCancelar} disabled={pendente}>
          Cancelar
        </Button>
      ) : (
        <LinkDeAcao href="/" variant="destructive">
          Cancelar
        </LinkDeAcao>
      )}
    </Linha>
  );
}
