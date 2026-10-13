import { Smile } from "lucide-react";

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

type SeletorDeEmojiProps = {
  aberto: boolean;
  // Últimos escolhidos, do mais novo ao mais antigo.
  recentes: string[];
  onAlternar: () => void;
  onEscolher: (emoji: string) => void;
  painelId: string;
  raizRef: React.Ref<HTMLDivElement>;
  botaoRef: React.Ref<HTMLButtonElement>;
  disabled?: boolean;
  // Reação em balão: botão pequeno, painel para baixo e rótulo próprio.
  rotulo?: string;
  compacto?: boolean;
};

export function SeletorDeEmoji({
  aberto,
  recentes,
  onAlternar,
  onEscolher,
  painelId,
  raizRef,
  botaoRef,
  disabled,
  rotulo = "Inserir emoji",
  compacto = false,
}: SeletorDeEmojiProps) {
  const grupos = [
    ...(recentes.length
      ? [
          {
            nome: "Recentes",
            emojis: recentes.map((e): [string, string] => [e, NOMES.get(e) ?? e]),
          },
        ]
      : []),
    ...CATEGORIAS,
  ];
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
          className={cn(
            "absolute left-0 z-10 max-h-64 w-72 space-y-2 overflow-y-auto rounded-xl border border-input bg-background p-2 shadow-md",
            compacto ? "top-full mt-1" : "bottom-full mb-2",
          )}
        >
          {grupos.map((categoria) => (
            <div key={categoria.nome} role="group" aria-label={categoria.nome}>
              <p className="px-1 text-xs text-muted-foreground">{categoria.nome}</p>
              <div className="flex flex-wrap">
                {categoria.emojis.map(([emoji, nome]) => (
                  <button
                    key={emoji}
                    type="button"
                    aria-label={nome}
                    className="flex size-10 items-center justify-center rounded-md text-xl outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => onEscolher(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
