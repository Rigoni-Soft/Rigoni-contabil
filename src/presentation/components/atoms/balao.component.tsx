import { cn } from "@/presentation/lib/utils";

type BalaoProps = {
  lado: "contato" | "ura" | "atendente";
  // Slot fora do balão, à direita (ex.: botão de reagir); reserva a largura dele no `max-w`.
  acao?: React.ReactNode;
  children: React.ReactNode;
};

// Cliente à esquerda, em balão claro; URA e Funcionário, que falam em nome do escritório, à direita.
export function Balao({ lado, acao, children }: BalaoProps) {
  return (
    <li
      className={cn(
        "relative px-3 py-1.5 sm:max-w-[75%]",
        // A ação fica fora do balão (left-full): reserva a largura dela para não gerar rolagem horizontal.
        acao ? "max-w-[calc(85%-2rem)]" : "max-w-[85%]",
        lado === "contato"
          ? "self-start rounded-2xl rounded-tl-sm border border-border bg-card text-card-foreground"
          : lado === "atendente"
            ? "self-end rounded-2xl rounded-tr-sm bg-primary text-primary-foreground"
            : "self-end rounded-2xl rounded-tr-sm border border-border bg-accent text-accent-foreground",
      )}
    >
      {children}
      {acao && <div className="absolute top-0 left-full ml-1">{acao}</div>}
    </li>
  );
}
