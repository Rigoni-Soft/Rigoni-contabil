import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { LinkDeVoltar } from "@/presentation/components/atoms/link-de-voltar.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { cn } from "@/presentation/lib/utils";

type CabecalhoDeTelaProps = {
  titulo?: string;
  descricao?: string;
  // Sem `voltarHref` nem `voltar` não há link de volta (telas de entrada da navegação).
  voltarHref?: string;
  voltarRotulo?: string;
  // Slot do "Voltar" que precisa de cliente (ex.: voltar ao histórico); vale sem `voltarHref`.
  voltar?: React.ReactNode;
};

export function CabecalhoDeTela({
  titulo,
  descricao,
  voltarHref,
  voltarRotulo,
  voltar,
}: CabecalhoDeTelaProps) {
  const temVoltar = Boolean(voltarHref || voltar);
  return (
    <Caixa className={cn(temVoltar && !titulo && "mb-3")}>
      {voltarHref ? <LinkDeVoltar href={voltarHref}>{voltarRotulo}</LinkDeVoltar> : voltar}
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
