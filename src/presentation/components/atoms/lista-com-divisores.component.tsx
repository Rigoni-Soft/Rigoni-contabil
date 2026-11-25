import { cn } from "@/presentation/lib/utils";

type ListaComDivisoresProps = {
  cartao?: boolean;
  children: React.ReactNode;
};

export function ListaComDivisores({ cartao = false, children }: ListaComDivisoresProps) {
  return (
    <ul
      role="list"
      className={cn("divide-y divide-border rounded-md border border-border", cartao && "bg-card")}
    >
      {children}
    </ul>
  );
}
