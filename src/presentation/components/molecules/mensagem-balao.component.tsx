import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { AnexoDaMensagem } from "@/presentation/components/molecules/anexo-da-mensagem.component";
import { cn } from "@/presentation/lib/utils";

type MensagemBalaoProps = {
  lado: "contato" | "ura" | "atendente";
  autor: string;
  // Só no balão do cliente: a empresa a que o Atendimento pertence.
  detalhe: string | null;
  texto: string;
  hora: string;
  // Reação do escritório à Mensagem do cliente (emoji) e a ação de reagir (slot do organismo).
  reacao?: string | null;
  acao?: React.ReactNode;
  // Imagem ou arquivo enviado junto; `texto` passa a ser a legenda (pode vir vazia).
  anexo?: React.ComponentProps<typeof AnexoDaMensagem> | null;
};

// Cliente à esquerda, em balão claro; URA e Funcionário, que falam em nome do escritório, à direita.
const LADO = {
  contato: "self-start rounded-2xl rounded-tl-sm border border-border bg-card text-card-foreground",
  atendente: "self-end rounded-2xl rounded-tr-sm bg-primary text-primary-foreground",
  ura: "self-end rounded-2xl rounded-tr-sm border border-border bg-accent text-accent-foreground",
} as const;

// Uma Mensagem da conversa: balão + autor, detalhe, texto, reação e hora.
export function MensagemBalao({
  lado,
  autor,
  detalhe,
  texto,
  hora,
  reacao,
  acao,
  anexo,
}: MensagemBalaoProps) {
  return (
    <Caixa
      como="li"
      className={cn(
        "relative px-3 py-1.5 sm:max-w-[75%]",
        // A ação fica fora do balão (left-full): reserva a largura dela para não gerar rolagem horizontal.
        acao ? "max-w-[calc(85%-2rem)]" : "max-w-[85%]",
        LADO[lado],
      )}
    >
      <Texto variante="rotulo" className={lado === "contato" ? "text-primary" : "opacity-90"}>
        {autor}
      </Texto>
      {detalhe && <Texto variante="nota">{detalhe}</Texto>}
      {anexo && <AnexoDaMensagem {...anexo} />}
      {texto && (
        <Caixa como="p" className="break-words whitespace-pre-wrap">
          {texto}
        </Caixa>
      )}
      {reacao && (
        <Caixa
          como="span"
          role="img"
          aria-label={`Reação do escritório: ${reacao}`}
          className="mt-1 inline-block rounded-full border border-border bg-background px-1.5 text-base"
        >
          {reacao}
        </Caixa>
      )}
      <Caixa
        como="p"
        className={cn(
          "mt-0.5 text-right text-xs",
          lado === "atendente" ? "opacity-90" : "text-muted-foreground",
        )}
      >
        {hora}
      </Caixa>
      {acao && <Caixa className="absolute top-0 left-full ml-1">{acao}</Caixa>}
    </Caixa>
  );
}
