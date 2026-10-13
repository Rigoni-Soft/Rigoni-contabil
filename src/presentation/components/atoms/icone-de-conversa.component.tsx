import { MessageCircle } from "lucide-react";

// Ícone de conversa; com `aguardando`, um ponto vermelho (o cliente escreveu por último).
export function IconeDeConversa({ aguardando = false }: { aguardando?: boolean }) {
  return (
    <span className="relative shrink-0">
      <MessageCircle aria-hidden="true" className="size-5 text-primary" />
      {aguardando && (
        <span
          aria-hidden="true"
          className="absolute -top-1 -right-1 size-2.5 rounded-full bg-destructive"
        />
      )}
    </span>
  );
}
