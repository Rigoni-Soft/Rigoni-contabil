import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { LinkDeVoltar } from "@/presentation/components/atoms/link-de-voltar.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { cn } from "@/presentation/lib/utils";

type CabecalhoDeTelaProps = {
  titulo?: string;
  descricao?: string;
  // Sem `voltarHref` não há link de volta (telas de entrada da navegação e do perfil).
  voltarHref?: string;
  voltarRotulo?: string;
};

// Topo de uma tela de trabalho: "Voltar", título e, opcionalmente, uma descrição.
export function CabecalhoDeTela({
  titulo,
  descricao,
  voltarHref,
  voltarRotulo,
}: CabecalhoDeTelaProps) {
  return (
    <Caixa className={cn(voltarHref && !titulo && "mb-3")}>
      {voltarHref && <LinkDeVoltar href={voltarHref}>{voltarRotulo}</LinkDeVoltar>}
      {titulo && (
        <Texto
          como="h1"
          variante="tela"
          className={cn(voltarHref && "mt-3", descricao ? "mb-2" : "mb-6")}
        >
          {titulo}
        </Texto>
      )}
      {descricao && (
        <Texto variante="apoio" className="mb-6">
          {descricao}
        </Texto>
      )}
    </Caixa>
  );
}
