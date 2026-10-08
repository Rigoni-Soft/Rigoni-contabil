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

// Em tela larga é a única parte da página que rola. flex-col-reverse com as mensagens da mais nova
// para a mais antiga mantém a rolagem no fim (nas últimas conversas) sem JavaScript, e a ordem na
// tela continua a cronológica.
export function ListaDeMensagens({ mensagens }: ListaDeMensagensProps) {
  return (
    <ol
      aria-label="Mensagens"
      className="flex max-h-[60vh] min-h-0 flex-col-reverse gap-1.5 overflow-y-auto rounded-xl border border-border bg-muted/50 p-3 lg:max-h-none lg:flex-1"
    >
      {[...mensagens].reverse().map(({ id, ...mensagem }) => (
        <MensagemBalao key={id} {...mensagem} />
      ))}
    </ol>
  );
}
