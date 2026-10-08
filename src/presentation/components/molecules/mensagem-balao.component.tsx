import { cn } from "@/presentation/lib/utils";

type MensagemBalaoProps = {
  lado: "contato" | "ura" | "atendente";
  autor: string;
  // Só no balão do cliente: a empresa a que o Atendimento pertence.
  detalhe: string | null;
  texto: string;
  hora: string;
};

// Cliente à esquerda, em balão claro; URA e Funcionário, que falam em nome do escritório, à
// direita. A hora fica dentro do balão, no canto inferior direito.
export function MensagemBalao({ lado, autor, detalhe, texto, hora }: MensagemBalaoProps) {
  const doCliente = lado === "contato";
  return (
    <li
      className={cn(
        "max-w-[85%] px-3 py-1.5 shadow-sm sm:max-w-[75%]",
        doCliente
          ? "self-start rounded-2xl rounded-tl-sm border border-border bg-card text-card-foreground"
          : lado === "atendente"
            ? "self-end rounded-2xl rounded-tr-sm bg-primary text-primary-foreground"
            : "self-end rounded-2xl rounded-tr-sm border border-border bg-accent text-accent-foreground",
      )}
    >
      <p className={cn("text-xs font-semibold", doCliente ? "text-primary" : "opacity-90")}>
        {autor}
      </p>
      {detalhe && <p className="text-xs text-muted-foreground">{detalhe}</p>}
      <p className="break-words whitespace-pre-wrap">{texto}</p>
      <p
        className={cn(
          "mt-0.5 text-right text-[11px]",
          lado === "atendente" ? "opacity-75" : "text-muted-foreground",
        )}
      >
        {hora}
      </p>
    </li>
  );
}
