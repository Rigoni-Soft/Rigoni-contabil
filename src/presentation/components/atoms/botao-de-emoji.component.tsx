import { cn } from "@/presentation/lib/utils";

// Alvo de 44 px (DESIGN.md); o emoji é o conteúdo, o nome acessível é a descrição dele.
const BOTAO_DE_EMOJI =
  "flex size-11 shrink-0 items-center justify-center rounded-md outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring";

type BotaoDeEmojiProps = {
  emoji: string;
  nome: string;
  onEscolher: (emoji: string) => void;
};

export function BotaoDeEmoji({ emoji, nome, onEscolher }: BotaoDeEmojiProps) {
  return (
    <button
      type="button"
      aria-label={nome}
      className={cn(BOTAO_DE_EMOJI, "text-xl")}
      onClick={() => onEscolher(emoji)}
    >
      {emoji}
    </button>
  );
}
