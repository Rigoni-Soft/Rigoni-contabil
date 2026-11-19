import { cn } from "@/presentation/lib/utils";

type ListaComDivisoresProps = {
  // Fundo de cartão (listas de dado) ou transparente (listas de navegação).
  cartao?: boolean;
  // Nome acessível da lista: o id do título que a descreve.
  "aria-labelledby"?: string;
  children: React.ReactNode;
};

// Lista vertical em moldura, com linha divisória entre os itens.
export function ListaComDivisores({
  cartao = false,
  "aria-labelledby": rotuloId,
  children,
}: ListaComDivisoresProps) {
  return (
    <ul
      role="list"
      aria-labelledby={rotuloId}
      className={cn("divide-y divide-border rounded-md border border-border", cartao && "bg-card")}
    >
      {children}
    </ul>
  );
}
