import { Plus, Smile } from "lucide-react";

import { Button } from "@/presentation/components/ui/button";
import { cn } from "@/presentation/lib/utils";

const CATEGORIAS: { nome: string; emojis: [emoji: string, nome: string][] }[] = [
  {
    nome: "Rostos",
    emojis: [
      ["😀", "Sorriso"],
      ["😂", "Rindo às lágrimas"],
      ["😊", "Sorriso corado"],
      ["😍", "Olhos de coração"],
      ["😉", "Piscadela"],
      ["🙂", "Sorriso leve"],
      ["😅", "Sorriso com suor"],
      ["🤔", "Pensativo"],
      ["😢", "Chorando"],
      ["😮", "Surpreso"],
      ["😴", "Dormindo"],
      ["😎", "Óculos escuros"],
    ],
  },
  {
    nome: "Gestos",
    emojis: [
      ["👍", "Joinha"],
      ["👎", "Polegar para baixo"],
      ["👏", "Palmas"],
      ["🙏", "Mãos juntas"],
      ["🤝", "Aperto de mão"],
      ["👋", "Mão acenando"],
      ["👌", "Tudo certo"],
      ["✌️", "Paz"],
      ["💪", "Braço forte"],
      ["🤞", "Dedos cruzados"],
    ],
  },
  {
    nome: "Objetos",
    emojis: [
      ["📄", "Documento"],
      ["📎", "Clipe"],
      ["📅", "Calendário"],
      ["📞", "Telefone"],
      ["💻", "Computador"],
      ["📧", "E-mail"],
      ["💰", "Dinheiro"],
      ["🧾", "Recibo"],
      ["⏰", "Despertador"],
      ["🔑", "Chave"],
    ],
  },
  {
    nome: "Símbolos",
    emojis: [
      ["✅", "Confirmado"],
      ["❌", "Erro"],
      ["⚠️", "Atenção"],
      ["❗", "Exclamação"],
      ["❓", "Interrogação"],
      ["❤️", "Coração"],
      ["⭐", "Estrela"],
      ["🔔", "Sino"],
      ["➡️", "Seta para a direita"],
      ["🎉", "Festa"],
    ],
  },
];

const NOMES = new Map(CATEGORIAS.flatMap((categoria) => categoria.emojis));

function BotaoDeEmoji({
  emoji,
  nome,
  onEscolher,
}: {
  emoji: string;
  nome: string;
  onEscolher: (emoji: string) => void;
}) {
  return (
    <button
      type="button"
      aria-label={nome}
      className="flex size-10 shrink-0 items-center justify-center rounded-md text-xl outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => onEscolher(emoji)}
    >
      {emoji}
    </button>
  );
}

type SeletorDeEmojiProps = {
  aberto: boolean;
  // Últimos escolhidos, do mais novo ao mais antigo.
  recentes: string[];
  // Com recentes, o seletor mostra só a linha deles até `completo` (via "ver todos").
  completo: boolean;
  onExpandir: () => void;
  onAlternar: (evento: React.MouseEvent<HTMLButtonElement>) => void;
  // Posição `fixed` do painel (reação em balão, fora do corte do rolador); sem ela, acima do botão.
  estilo?: React.CSSProperties;
  onEscolher: (emoji: string) => void;
  painelId: string;
  raizRef: React.Ref<HTMLDivElement>;
  botaoRef: React.Ref<HTMLButtonElement>;
  disabled?: boolean;
  // Reação em balão: botão pequeno e rótulo próprio.
  rotulo?: string;
  compacto?: boolean;
};

export function SeletorDeEmoji({
  aberto,
  recentes,
  completo,
  onExpandir,
  estilo,
  onAlternar,
  onEscolher,
  painelId,
  raizRef,
  botaoRef,
  disabled,
  rotulo = "Inserir emoji",
  compacto = false,
}: SeletorDeEmojiProps) {
  return (
    <div ref={raizRef} className="relative">
      <Button
        ref={botaoRef}
        type="button"
        variant="ghost"
        size="icon"
        className={cn("rounded-full", compacto && "size-7")}
        aria-label={rotulo}
        aria-expanded={aberto}
        aria-controls={aberto ? painelId : undefined}
        disabled={disabled}
        onClick={onAlternar}
      >
        <Smile aria-hidden="true" className={compacto ? "size-4" : "size-6"} />
      </Button>
      {aberto && (
        <div
          id={painelId}
          role="group"
          aria-label={compacto ? "Emojis da reação" : "Emojis"}
          style={estilo}
          className={cn(
            "z-20 max-h-64 w-72 space-y-2 overflow-y-auto rounded-xl border border-input bg-background p-2 shadow-md",
            estilo ? "fixed" : "absolute bottom-full left-0 mb-2",
          )}
        >
          {recentes.length > 0 && (
            <div role="group" aria-label="Recentes" className="flex flex-nowrap items-center">
              {recentes.map((emoji) => (
                <BotaoDeEmoji
                  key={emoji}
                  emoji={emoji}
                  nome={NOMES.get(emoji) ?? emoji}
                  onEscolher={onEscolher}
                />
              ))}
              {!completo && (
                <button
                  type="button"
                  aria-label="Ver todos os emojis"
                  className="ml-auto flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={onExpandir}
                >
                  <Plus aria-hidden="true" className="size-5" />
                </button>
              )}
            </div>
          )}
          {(recentes.length === 0 || completo) &&
            CATEGORIAS.map((categoria) => (
              <div key={categoria.nome} role="group" aria-label={categoria.nome}>
                <p className="px-1 text-xs text-muted-foreground">{categoria.nome}</p>
                <div className="flex flex-wrap">
                  {categoria.emojis.map(([emoji, nome]) => (
                    <BotaoDeEmoji key={emoji} emoji={emoji} nome={nome} onEscolher={onEscolher} />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
