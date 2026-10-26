import { Linha } from "@/presentation/components/atoms/caixa.component";
import { LinkDeAcao } from "@/presentation/components/atoms/link-de-acao.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { Button } from "@/presentation/components/ui/button";

type AcoesDoFormularioProps = {
  pendente: boolean;
  // Algo ainda em andamento (ex.: leitura de PDF): Salvar espera. O texto é o motivo, dito ao lado do
  // botão e ligado a ele (aria-describedby); o botão segue focável (aria-disabled), como o Remover
  // bloqueado do Parcelamento.
  motivoDoBloqueio?: string;
  onLimpar: () => void;
  // Sem callback, "Cancelar" é um link para "/". Com callback (formulário inline na busca do
  // dashboard) já estamos em "/": quem abriu o painel o fecha direto.
  onCancelar?: () => void;
};

// Salvar / Limpar / Cancelar, na ordem do contrato de ações de formulário do DESIGN.md.
export function AcoesDoFormulario({
  pendente,
  motivoDoBloqueio,
  onLimpar,
  onCancelar,
}: AcoesDoFormularioProps) {
  return (
    <Linha espaco={2} quebra className="sm:col-span-2 lg:col-span-4">
      <Button
        type="submit"
        aria-disabled={motivoDoBloqueio ? true : undefined}
        aria-describedby={motivoDoBloqueio ? "salvar-bloqueado" : undefined}
        onClick={motivoDoBloqueio ? (evento) => evento.preventDefault() : undefined}
        className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
      >
        {pendente ? "Salvando..." : "Salvar"}
      </Button>
      {motivoDoBloqueio && (
        <Texto variante="nota" id="salvar-bloqueado" className="self-center">
          {motivoDoBloqueio}
        </Texto>
      )}
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
