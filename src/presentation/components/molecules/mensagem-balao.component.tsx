import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { AnexoDaMensagem } from "@/presentation/components/molecules/anexo-da-mensagem.component";
import { cn } from "@/presentation/lib/utils";

type MensagemBalaoProps = {
  lado: "contato" | "ura" | "atendente";
  autor: string;
  detalhe: string | null;
  texto: string;
  hora: string;
  reacao?: string | null;
  acao?: React.ReactNode;
  aviso?: string | null;
  anexo?: React.ComponentProps<typeof AnexoDaMensagem> | null;
};

const LADO = {
  contato: "self-start rounded-2xl rounded-tl-sm border border-border bg-card text-card-foreground",
  atendente: "self-end rounded-2xl rounded-tr-sm bg-primary text-primary-foreground",
  ura: "self-end rounded-2xl rounded-tr-sm border border-border bg-accent text-accent-foreground",
} as const;

export function MensagemBalao({
  lado,
  autor,
  detalhe,
  texto,
  hora,
  reacao,
  acao,
  aviso,
  anexo,
}: MensagemBalaoProps) {
  return (
    <Caixa
      como="li"
      className={cn(
        "relative px-3 py-1.5 sm:max-w-[75%]",
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
        {aviso && (
          <Caixa como="span" className="mr-1 font-semibold">
            {aviso} ·
          </Caixa>
        )}
        {hora}
      </Caixa>
      {acao && <Caixa className="absolute top-0 left-full ml-1">{acao}</Caixa>}
    </Caixa>
  );
}
