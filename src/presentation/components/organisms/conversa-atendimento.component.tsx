import { FileText, SendHorizontal } from "lucide-react";

import { Button } from "@/presentation/components/ui/button";
import { Label } from "@/presentation/components/ui/label";
import { Select } from "@/presentation/components/ui/select";
import { Textarea } from "@/presentation/components/ui/textarea";
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

type Aviso = { tipo: "erro" | "sucesso"; texto: string };

type ConversaAtendimentoProps = {
  titulo: string;
  subtitulo: string;
  encerrado: boolean;
  semCliente: boolean;
  mensagens: MensagemView[];
  servicos: { valor: string; rotulo: string; grupo: "contrato" | "alteracao" }[];
  onEnviarServico: (valor: string) => void;
  enviando: boolean;
  aviso?: Aviso;
  setoresDestino: { valor: string; rotulo: string }[];
  onTransferir: (setorDestino: string, resumo: string) => void;
  transferindo: boolean;
  // Nome do Setor para onde o Atendimento acabou de ir; troca as ações por um aviso.
  transferidoPara?: string;
  avisoTransferencia?: Aviso;
  onEnviarMensagem: (texto: string) => void;
  enviandoMensagem: boolean;
  erroMensagem?: string;
  // Muda a cada envio bem-sucedido: esvazia o campo (se falhou, o texto fica para tentar de novo).
  mensagensEnviadas: number;
};

function AvisoTexto({ aviso }: { aviso: Aviso }) {
  return (
    <p
      role={aviso.tipo === "erro" ? "alert" : "status"}
      className={cn("text-xs", aviso.tipo === "erro" ? "text-destructive" : "text-success")}
    >
      {aviso.texto}
    </p>
  );
}

function TituloDoGrupo({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </h2>
  );
}

// Desenho de chat (WhatsApp/Messenger): cliente à esquerda, em balão claro; URA e Funcionário, que
// falam em nome do escritório, à direita. A hora fica dentro do balão, no canto inferior direito.
// Em tela larga a página não rola: só a lista de mensagens rola, sempre parada nas últimas, e as
// ações do Atendimento ficam num painel compacto à direita (abaixo do chat em tela estreita).
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
  setoresDestino,
  onTransferir,
  transferindo,
  transferidoPara,
  avisoTransferencia,
  onEnviarMensagem,
  enviandoMensagem,
  erroMensagem,
  mensagensEnviadas,
}: ConversaAtendimentoProps) {
  const contrato = servicos.find((servico) => servico.grupo === "contrato");
  const alteracoes = servicos.filter((servico) => servico.grupo === "alteracao");

  return (
    <section
      aria-label="Atendimento"
      className={cn(
        "grid gap-4 lg:h-full lg:min-h-0",
        !encerrado && "lg:grid-cols-[minmax(0,1fr)_19rem] 2xl:grid-cols-[minmax(0,1fr)_22rem]",
      )}
    >
      <div className="flex min-h-0 flex-col gap-3">
        <header className="shrink-0">
          <h1 className="text-lg font-bold tracking-tight text-primary">{titulo}</h1>
          <p className="text-sm text-muted-foreground">{subtitulo}</p>
          {encerrado && (
            <p className="mt-1 text-sm font-medium text-muted-foreground">Atendimento encerrado.</p>
          )}
        </header>

        {/* flex-col-reverse com as mensagens da mais nova para a mais antiga: o navegador mantém a
            rolagem no fim (nas últimas conversas) sem JavaScript, e a ordem na tela é a cronológica. */}
        <ol
          aria-label="Mensagens"
          className="flex max-h-[60vh] min-h-0 flex-col-reverse gap-1.5 overflow-y-auto rounded-xl border border-border bg-muted/50 p-3 lg:max-h-none lg:flex-1"
        >
          {[...mensagens].reverse().map((mensagem) => {
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
                <p
                  className={cn("text-xs font-semibold", doCliente ? "text-primary" : "opacity-90")}
                >
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

        {!transferidoPara && !encerrado && (
          <div className="shrink-0 space-y-1">
            <form
              key={mensagensEnviadas}
              className="flex items-end gap-2"
              onSubmit={(evento) => {
                evento.preventDefault();
                onEnviarMensagem(String(new FormData(evento.currentTarget).get("texto")));
              }}
            >
              <Label htmlFor="mensagem-ao-cliente" className="sr-only">
                Mensagem ao cliente
              </Label>
              <Textarea
                id="mensagem-ao-cliente"
                name="texto"
                required
                rows={2}
                maxLength={4096}
                placeholder="Escreva uma mensagem ao cliente..."
                className="min-h-12 flex-1 resize-none rounded-2xl"
                onKeyDown={(evento) => {
                  // Enter envia, Shift+Enter quebra a linha (como nos chats).
                  if (evento.key === "Enter" && !evento.shiftKey) {
                    evento.preventDefault();
                    evento.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <Button
                type="submit"
                size="icon"
                className="rounded-full"
                aria-label="Enviar mensagem"
                disabled={enviandoMensagem}
              >
                <SendHorizontal aria-hidden="true" />
              </Button>
            </form>
            {erroMensagem && <AvisoTexto aviso={{ tipo: "erro", texto: erroMensagem }} />}
          </div>
        )}
      </div>

      {!encerrado && (
        <aside
          aria-label="Ações do Atendimento"
          className="min-h-0 space-y-4 self-start overflow-y-auto rounded-xl border border-border bg-card p-3 lg:max-h-full"
        >
          {transferidoPara ? (
            <div role="status" className="space-y-1">
              <h2 className="font-semibold text-foreground">Atendimento transferido</h2>
              <p className="text-sm text-muted-foreground">
                Foi para o Setor {transferidoPara}. Você não acompanha mais esta conversa.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <TituloDoGrupo>Serviços do cliente</TituloDoGrupo>
                {semCliente ? (
                  <p className="text-xs text-muted-foreground">
                    Sem Cliente vinculado a este número não há serviços para disparar.
                  </p>
                ) : (
                  <>
                    {/* Mesmos serviços do menu da URA. Guias e CND ainda respondem "em construção"
                        lá (#42 e os adapters do Serpro, #66-#68) e passam a disparar quando existirem. */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="justify-start"
                        disabled={enviando || !contrato}
                        title={contrato ? undefined : "Contrato social não cadastrado"}
                        onClick={() => contrato && onEnviarServico(contrato.valor)}
                      >
                        <FileText aria-hidden="true" />
                        Contrato social
                      </Button>
                      {SERVICOS_EM_CONSTRUCAO.map((rotulo) => (
                        <Button
                          key={rotulo}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="justify-start"
                          disabled
                          title="Em construção"
                        >
                          {rotulo}
                        </Button>
                      ))}
                    </div>
                    <form
                      className="flex items-end gap-2"
                      onSubmit={(evento) => {
                        evento.preventDefault();
                        onEnviarServico(
                          String(new FormData(evento.currentTarget).get("alteracao")),
                        );
                      }}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <Label htmlFor="servico-alteracao" className="text-xs">
                          Alteração contratual
                        </Label>
                        <Select
                          id="servico-alteracao"
                          name="alteracao"
                          required
                          defaultValue=""
                          disabled={alteracoes.length === 0}
                          className="h-10"
                        >
                          <option value="" disabled>
                            {alteracoes.length === 0 ? "Nenhuma cadastrada" : "Escolha a alteração"}
                          </option>
                          {alteracoes.map((alteracao) => (
                            <option key={alteracao.valor} value={alteracao.valor}>
                              {alteracao.rotulo}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <Button
                        type="submit"
                        size="sm"
                        aria-label="Enviar alteração"
                        disabled={enviando || alteracoes.length === 0}
                      >
                        Enviar
                      </Button>
                    </form>
                  </>
                )}
                {enviando && (
                  <p role="status" className="text-xs text-muted-foreground">
                    Enviando...
                  </p>
                )}
                {aviso && <AvisoTexto aviso={aviso} />}
              </div>

              <form
                className="space-y-2 border-t border-border pt-3"
                onSubmit={(evento) => {
                  evento.preventDefault();
                  const dados = new FormData(evento.currentTarget);
                  onTransferir(String(dados.get("setor")), String(dados.get("resumo")));
                }}
              >
                <TituloDoGrupo>Transferir Atendimento</TituloDoGrupo>
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <Label htmlFor="transferir-setor" className="text-xs">
                      Setor de destino
                    </Label>
                    <Select
                      id="transferir-setor"
                      name="setor"
                      required
                      defaultValue=""
                      className="h-10"
                    >
                      <option value="" disabled>
                        Escolha o Setor
                      </option>
                      {setoresDestino.map((setor) => (
                        <option key={setor.valor} value={setor.valor}>
                          {setor.rotulo}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button type="submit" size="sm" disabled={transferindo}>
                    {transferindo ? "Transferindo..." : "Transferir"}
                  </Button>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="transferir-resumo" className="text-xs">
                    Resumo do assunto
                  </Label>
                  <Textarea
                    id="transferir-resumo"
                    name="resumo"
                    required
                    rows={2}
                    maxLength={1000}
                    placeholder="O que o próximo atendente precisa saber"
                    className="min-h-16 resize-none"
                  />
                </div>
                {avisoTransferencia && <AvisoTexto aviso={avisoTransferencia} />}
              </form>
            </>
          )}
        </aside>
      )}
    </section>
  );
}
