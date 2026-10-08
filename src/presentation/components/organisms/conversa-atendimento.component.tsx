import { Button } from "@/presentation/components/ui/button";
import { Label } from "@/presentation/components/ui/label";
import { Select } from "@/presentation/components/ui/select";
import { cn } from "@/presentation/lib/utils";

type MensagemView = {
  id: string;
  lado: "contato" | "ura" | "atendente";
  autor: string;
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

// Cliente à esquerda; URA e Funcionário à direita (quem fala em nome do escritório).
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

      <ol aria-label="Mensagens" className="space-y-3">
        {mensagens.map((mensagem) => (
          <li
            key={mensagem.id}
            className={cn(
              "max-w-[85%] rounded-lg border border-border px-3 py-2",
              mensagem.lado === "contato" ? "mr-auto bg-card" : "ml-auto bg-accent",
            )}
          >
            <p className="text-xs font-medium text-muted-foreground">
              {mensagem.autor} · {mensagem.hora}
            </p>
            <p className="break-words whitespace-pre-wrap text-foreground">{mensagem.texto}</p>
          </li>
        ))}
      </ol>

      {!encerrado && (
        <div className="space-y-2 rounded-lg border border-border p-4">
          <h2 className="font-semibold text-foreground">Enviar ao cliente</h2>
          {semCliente ? (
            <p className="text-sm text-muted-foreground">
              Sem Cliente vinculado a este número não há documentos para enviar.
            </p>
          ) : servicos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              O Cliente não tem documentos cadastrados.
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
