import { cn } from "@/presentation/lib/utils";

type ListaComDivisoresProps = {
  // Fundo de cartão (listas de dado) ou transparente (listas de navegação).
  cartao?: boolean;
  children: React.ReactNode;
};

// Lista vertical em moldura, com linha divisória entre os itens.
export function ListaComDivisores({ cartao = false, children }: ListaComDivisoresProps) {
  return (
    <ul
      className={cn("divide-y divide-border rounded-md border border-border", cartao && "bg-card")}
    >
      {children}
    </ul>
  );
}
