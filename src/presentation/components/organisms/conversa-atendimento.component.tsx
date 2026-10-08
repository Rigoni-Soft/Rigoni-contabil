import { Button } from "@/presentation/components/ui/button";
import { Label } from "@/presentation/components/ui/label";
import { Select } from "@/presentation/components/ui/select";
import { cn } from "@/presentation/lib/utils";

type MensagemView = {
  id: string;
  lado: "contato" | "ura" | "atendente";
  autor: string;
  detalhe: string | null;
  texto: string;
  hora: string;
};

type ConversaAtendimentoProps = {
  titulo: string;
  subtitulo: string;
  encerrado: boolean;
  semCliente: boolean;
  mensagens: MensagemView[];
  servicos: { valor: string; rotulo: string }[];
  servicoEscolhido: string;
  onEscolherServico: (valor: string) => void;
  onEnviarServico: () => void;
  enviando: boolean;
  aviso?: { tipo: "erro" | "sucesso"; texto: string };
};

// Desenho de chat (WhatsApp/Messenger): cliente à esquerda, em balão claro; URA e Funcionário, que
// falam em nome do escritório, à direita. A hora fica dentro do balão, no canto inferior direito.
export function ConversaAtendimento({
  titulo,
  subtitulo,
  encerrado,
  semCliente,
  mensagens,
  servicos,
  servicoEscolhido,
  onEscolherServico,
  onEnviarServico,
  enviando,
  aviso,
}: ConversaAtendimentoProps) {
  return (
    <section aria-label="Atendimento" className="space-y-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-primary">{titulo}</h1>
        <p className="text-sm text-muted-foreground">{subtitulo}</p>
        {encerrado && (
          <p className="mt-2 text-sm font-medium text-muted-foreground">Atendimento encerrado.</p>
        )}
      </header>

      <ol
        aria-label="Mensagens"
        className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted/50 p-3 sm:p-4"
      >
        {mensagens.map((mensagem) => {
          const doCliente = mensagem.lado === "contato";
          return (
            <li
              key={mensagem.id}
              className={cn(
                "max-w-[85%] px-3 py-1.5 shadow-sm sm:max-w-[75%]",
                doCliente
                  ? "self-start rounded-2xl rounded-tl-sm border border-border bg-card text-card-foreground"
                  : mensagem.lado === "atendente"
                    ? "self-end rounded-2xl rounded-tr-sm bg-primary text-primary-foreground"
                    : "self-end rounded-2xl rounded-tr-sm border border-border bg-accent text-accent-foreground",
              )}
            >
              <p className={cn("text-xs font-semibold", doCliente ? "text-primary" : "opacity-90")}>
                {mensagem.autor}
              </p>
              {mensagem.detalhe && (
                <p className="text-xs text-muted-foreground">{mensagem.detalhe}</p>
              )}
              <p className="break-words whitespace-pre-wrap">{mensagem.texto}</p>
              <p
                className={cn(
                  "mt-0.5 text-right text-[11px]",
                  mensagem.lado === "atendente" ? "opacity-75" : "text-muted-foreground",
                )}
              >
                {mensagem.hora}
              </p>
            </li>
          );
        })}
      </ol>

      {!encerrado && (
        <div className="space-y-2 rounded-lg border border-border p-4">
          <h2 className="font-semibold text-foreground">Enviar ao cliente</h2>
          <p className="text-sm text-muted-foreground">
            Escolha um documento do cadastro do Cliente (contrato social e alterações contratuais) e
            clique em Enviar: ele chega ao cliente no WhatsApp. Não é preciso anexar arquivo.
          </p>
          {semCliente ? (
            <p className="text-sm text-muted-foreground">
              Sem Cliente vinculado a este número não há documentos para enviar.
            </p>
          ) : servicos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este Cliente não tem contrato social nem alterações cadastrados, então não há o que
              enviar. O Admin anexa os documentos no cadastro do Cliente.
            </p>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1">
                <Label htmlFor="servico-atendimento">Documento</Label>
                <Select
                  id="servico-atendimento"
                  value={servicoEscolhido}
                  onChange={(e) => onEscolherServico(e.target.value)}
                >
                  {servicos.map((servico) => (
                    <option key={servico.valor} value={servico.valor}>
                      {servico.rotulo}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="button" onClick={onEnviarServico} disabled={enviando}>
                {enviando ? "Enviando..." : "Enviar"}
              </Button>
            </div>
          )}
          {aviso && (
            <p
              role={aviso.tipo === "erro" ? "alert" : "status"}
              className={cn("text-sm", aviso.tipo === "erro" ? "text-destructive" : "text-success")}
            >
              {aviso.texto}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
