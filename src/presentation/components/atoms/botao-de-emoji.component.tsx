import { Button } from "@/presentation/components/ui/button";

// Alvo de 44 px (DESIGN.md); o emoji é o conteúdo, o nome acessível é a descrição dele.
type BotaoDeEmojiProps = {
  emoji: string;
  nome: string;
  onEscolher: (emoji: string) => void;
};

export function BotaoDeEmoji({ emoji, nome, onEscolher }: BotaoDeEmojiProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={nome}
      className="text-xl"
      onClick={() => onEscolher(emoji)}
    >
      {emoji}
    </Button>
  );
}
