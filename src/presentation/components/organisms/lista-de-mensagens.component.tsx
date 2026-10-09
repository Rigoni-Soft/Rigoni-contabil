import { MensagemBalao } from "@/presentation/components/molecules/mensagem-balao.component";

type MensagemView = {
  id: string;
  lado: "contato" | "ura" | "atendente";
  autor: string;
  detalhe: string | null;
  texto: string;
  hora: string;
};

type ListaDeMensagensProps = { mensagens: MensagemView[] };

// Em tela larga é a única parte da página que rola. O rolador é col-reverse com a lista dentro em
// ordem cronológica: o scroll nasce no fim (nas últimas mensagens) sem JavaScript e o DOM segue a
// ordem de leitura. role="log" anuncia a mensagem nova ao leitor de tela.
export function ListaDeMensagens({ mensagens }: ListaDeMensagensProps) {
  return (
    <div
      role="log"
      aria-label="Conversa"
      className="flex max-h-[60vh] min-h-0 flex-col-reverse overflow-y-auto rounded-xl border border-border bg-muted/50 p-3 lg:max-h-none lg:flex-1"
    >
      <ol aria-label="Mensagens" className="flex shrink-0 flex-col gap-1.5">
        {mensagens.map(({ id, ...mensagem }) => (
          <MensagemBalao key={id} {...mensagem} />
        ))}
      </ol>
    </div>
  );
}
