import { ChevronDown, FileText } from "lucide-react";

import { Button, buttonVariants } from "@/presentation/components/ui/button";
import { cn } from "@/presentation/lib/utils";

const SERVICOS_EM_CONSTRUCAO = ["Guia de imposto", "Guia de parcelamento", "CND"];

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
  servicos: { valor: string; rotulo: string; grupo: "contrato" | "alteracao" }[];
  onEnviarServico: (valor: string) => void;
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
  onEnviarServico,
  enviando,
  aviso,
}: ConversaAtendimentoProps) {
  const contrato = servicos.find((servico) => servico.grupo === "contrato");
  const alteracoes = servicos.filter((servico) => servico.grupo === "alteracao");

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
        <div className="space-y-4 rounded-lg border border-border p-4">
          <div>
            <h2 className="font-semibold text-foreground">Serviços do cliente</h2>
            <p className="text-sm text-muted-foreground">
              Os mesmos serviços do menu da URA. Um clique envia ao WhatsApp do cliente, sem pedir o
              CNPJ de novo.
            </p>
          </div>

          {semCliente ? (
            <p className="text-sm text-muted-foreground">
              Sem Cliente vinculado a este número não há serviços para disparar.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-foreground">
                  Contrato social e alterações
                </h3>
                <div className="flex flex-wrap gap-2">
                  {contrato ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={enviando}
                      onClick={() => onEnviarServico(contrato.valor)}
                    >
                      <FileText aria-hidden="true" />
                      {contrato.rotulo}
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" disabled>
                      <FileText aria-hidden="true" />
                      Contrato social (não cadastrado)
                    </Button>
                  )}
                  {alteracoes.length === 0 ? (
                    <Button type="button" variant="outline" disabled>
                      <FileText aria-hidden="true" />
                      Alterações (não cadastradas)
                    </Button>
                  ) : alteracoes.length === 1 ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={enviando}
                      onClick={() => onEnviarServico(alteracoes[0].valor)}
                    >
                      <FileText aria-hidden="true" />
                      {alteracoes[0].rotulo}
                    </Button>
                  ) : (
                    <details className="w-full">
                      <summary
                        className={cn(
                          buttonVariants({ variant: "outline" }),
                          "cursor-pointer list-none [&::-webkit-details-marker]:hidden",
                        )}
                      >
                        <FileText aria-hidden="true" />
                        Alterações contratuais ({alteracoes.length})
                        <ChevronDown aria-hidden="true" />
                      </summary>
                      <ul
                        aria-label="Alterações contratuais"
                        className="mt-2 max-h-60 divide-y divide-border overflow-y-auto rounded-md border border-border"
                      >
                        {alteracoes.map((alteracao) => (
                          <li key={alteracao.valor}>
                            <button
                              type="button"
                              disabled={enviando}
                              onClick={() => onEnviarServico(alteracao.valor)}
                              className="w-full px-3 py-2.5 text-left text-sm hover:bg-accent disabled:opacity-50"
                            >
                              {alteracao.rotulo}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </div>

              {/* Mesmos itens do menu da URA, que ainda responde "em construção" a eles (#42 e os
                  adapters reais do Serpro, #66-#68). Passam a disparar quando existirem. */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-foreground">Guias e certidões</h3>
                <div className="flex flex-wrap gap-2">
                  {SERVICOS_EM_CONSTRUCAO.map((rotulo) => (
                    <Button key={rotulo} type="button" variant="outline" disabled>
                      {rotulo} · em construção
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}

          {enviando && (
            <p role="status" className="text-sm text-muted-foreground">
              Enviando...
            </p>
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
