import { Linha } from "@/presentation/components/atoms/caixa.component";
import { LinkDeAcao } from "@/presentation/components/atoms/link-de-acao.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { Button } from "@/presentation/components/ui/button";
import { BOTAO_OCUPADO } from "@/presentation/lib/botao-ocupado";

type AcoesDoFormularioProps = {
  pendente: boolean;
  motivoDoBloqueio?: string;
  onLimpar: () => void;
  onCancelar?: () => void;
};

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
        className={BOTAO_OCUPADO}
      >
        {pendente ? "Salvando…" : "Salvar"}
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
