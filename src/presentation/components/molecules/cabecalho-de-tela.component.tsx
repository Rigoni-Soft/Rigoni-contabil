import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { LinkDeVoltar } from "@/presentation/components/atoms/link-de-voltar.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { VoltarAoHistorico } from "@/presentation/components/atoms/voltar-ao-historico.component";
import { cn } from "@/presentation/lib/utils";

type CabecalhoDeTelaProps = {
  titulo?: string;
  descricao?: string;
  // Sem `voltarHref` não há link de volta (telas de entrada da navegação e do perfil).
  voltarHref?: string;
  voltarRotulo?: string;
  // Volta à tela anterior do histórico (cai no início se não houver); vale sem `voltarHref`.
  voltarAoHistorico?: boolean;
};

// Topo de uma tela de trabalho: "Voltar", título e, opcionalmente, uma descrição.
export function CabecalhoDeTela({
  titulo,
  descricao,
  voltarHref,
  voltarRotulo,
  voltarAoHistorico,
}: CabecalhoDeTelaProps) {
  const temVoltar = Boolean(voltarHref) || voltarAoHistorico;
  return (
    <Caixa className={cn(temVoltar && !titulo && "mb-3")}>
      {voltarHref ? (
        <LinkDeVoltar href={voltarHref}>{voltarRotulo}</LinkDeVoltar>
      ) : (
        voltarAoHistorico && <VoltarAoHistorico>{voltarRotulo}</VoltarAoHistorico>
      )}
      {titulo && (
        <Texto
          como="h1"
          variante="tela"
          className={cn(temVoltar && "mt-3", descricao ? "mb-2" : "mb-6")}
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
