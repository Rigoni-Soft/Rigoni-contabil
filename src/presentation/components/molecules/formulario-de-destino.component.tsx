import { LoaderCircle, Plus } from "lucide-react";

import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Grade, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { CampoDeOpcoes } from "@/presentation/components/molecules/campo-de-opcoes.component";
import { CampoDeTexto } from "@/presentation/components/molecules/campo-de-texto.component";
import { Button } from "@/presentation/components/ui/button";
import { formatarTelefone } from "@/presentation/lib/telefone-mask";

type Opcao = { valor: string; rotulo: string };

// O estado do formulário vem pronto do Container (View burra: sem hooks nem regra).
export type FormularioDeDestinoValores = {
  modo: "existente" | "novo";
  opcoesDeContato: Opcao[];
  opcoesDeTipo: Opcao[];
  contatoId: string;
  novo: { nome: string; telefone: string; email: string };
  tipo: string;
  canal: string;
  // Nome e e-mail do contato escolhido: aparecem preenchidos e travados.
  escolhido?: { nome: string; email: string };
  // Os canais do contato: um só trava nele; dois pedem escolha; nenhum, sem opção.
  canais: { opcoes: Opcao[]; unico?: string };
  // O contato do Cliente que já tem o WhatsApp ou o e-mail digitado.
  repetido?: { id: string; nome: string };
  erros: Partial<Record<"contato" | "nome" | "telefone" | "email" | "canal", string>>;
  erroGeral?: string;
  pendente: boolean;
};

type FormularioDeDestinoProps = {
  valores: FormularioDeDestinoValores;
  // Id do select de contato: o foco volta a ele depois de adicionar ou remover um destino.
  idDoSelect: string;
  onEscolherContato: (id: string) => void;
  onMudarNovo: (campo: "nome" | "telefone" | "email", valor: string) => void;
  onMudarTipo: (tipo: string) => void;
  onMudarCanal: (canal: string) => void;
  onNovoContato: () => void;
  onVoltar: () => void;
  onUsarExistente: (id: string) => void;
  onAdicionar: () => void;
};

// Ocupado, o botão fica `aria-disabled` e não `disabled`: o navegador não solta o foco dele.
const OCUPADO = "aria-disabled:pointer-events-none aria-disabled:opacity-50";

// Enter num campo adiciona o destino: sem isto enviaria o cadastro inteiro, que envolve este bloco.
const adicionarComEnter =
  (onAdicionar: () => void) => (evento: React.KeyboardEvent<HTMLElement>) => {
    const { tagName } = evento.target as HTMLElement;
    if (evento.key !== "Enter" || (tagName !== "INPUT" && tagName !== "SELECT")) return;
    evento.preventDefault();
    onAdicionar();
  };

// Define um Destino: o contato (já cadastrado ou novo), o tipo de envio e a forma de envio.
export function FormularioDeDestino({
  valores,
  idDoSelect,
  onEscolherContato,
  onMudarNovo,
  onMudarTipo,
  onMudarCanal,
  onNovoContato,
  onVoltar,
  onUsarExistente,
  onAdicionar,
}: FormularioDeDestinoProps) {
  const { modo, erros, canais, pendente, repetido } = valores;
  const eNovo = modo === "novo";
  return (
    <Pilha
      espaco={3}
      role="group"
      aria-label="Adicionar destino de envio"
      onKeyDown={adicionarComEnter(onAdicionar)}
      className="rounded-md border border-dashed border-border p-3"
    >
      <Grade colunas="1>2>4" espaco={3}>
        {eNovo ? (
          <>
            <CampoDeTexto
              id="destino-nome"
              rotulo="Nome"
              obrigatorio
              erro={erros.nome}
              className="gap-1"
              value={valores.novo.nome}
              onChange={(evento) => onMudarNovo("nome", evento.target.value)}
            />
            <CampoDeTexto
              id="destino-telefone"
              rotulo="WhatsApp"
              inputMode="tel"
              erro={erros.telefone}
              className="gap-1"
              value={valores.novo.telefone}
              onChange={(evento) => onMudarNovo("telefone", formatarTelefone(evento.target.value))}
            />
            <CampoDeTexto
              id="destino-email"
              rotulo="E-mail"
              type="email"
              inputMode="email"
              // A falta dos dois canais é erro do contato: o E-mail também fica inválido.
              aria-invalid={erros.telefone || erros.email ? true : undefined}
              aria-describedby={erros.telefone ? "destino-telefone-mensagem" : undefined}
              erro={erros.email}
              className="gap-1"
              value={valores.novo.email}
              onChange={(evento) => onMudarNovo("email", evento.target.value)}
            />
          </>
        ) : (
          <>
            <CampoDeOpcoes
              id={idDoSelect}
              rotulo="WhatsApp ou e-mail do contato"
              opcoes={valores.opcoesDeContato}
              placeholder="Escolha…"
              erro={erros.contato}
              className="gap-1"
              value={valores.contatoId}
              onChange={(evento) => onEscolherContato(evento.target.value)}
            />
            <CampoDeTexto
              id="destino-nome-do-contato"
              rotulo="Nome"
              readOnly
              className="gap-1"
              value={valores.escolhido?.nome ?? ""}
              placeholder="Preenchido ao escolher"
            />
            <CampoDeTexto
              id="destino-email-do-contato"
              rotulo="E-mail"
              readOnly
              className="gap-1"
              value={valores.escolhido?.email ?? ""}
            />
          </>
        )}
        <CampoDeOpcoes
          id="destino-tipo"
          rotulo="Tipo de envio"
          opcoes={valores.opcoesDeTipo}
          className="gap-1"
          value={valores.tipo}
          onChange={(evento) => onMudarTipo(evento.target.value)}
        />
        {canais.opcoes.length > 1 ? (
          <CampoDeOpcoes
            id="destino-canal"
            rotulo="Forma de envio"
            opcoes={canais.opcoes}
            placeholder="Escolha…"
            erro={erros.canal}
            className="gap-1"
            value={valores.canal}
            onChange={(evento) => onMudarCanal(evento.target.value)}
          />
        ) : (
          <CampoDeTexto
            id="destino-canal"
            rotulo="Forma de envio"
            readOnly
            erro={erros.canal}
            className="gap-1"
            value={canais.opcoes[0]?.rotulo ?? ""}
            placeholder="Preenchida ao escolher o contato"
          />
        )}
      </Grade>
      {repetido && (
        <Linha alinhar="centro" espaco={3} quebra>
          <AvisoDeStatus
            tipo="atencao"
            legivel
            texto={`Este Cliente já tem um contato com esse WhatsApp ou e-mail: ${repetido.nome}.`}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onUsarExistente(repetido.id)}
          >
            Usar este contato
          </Button>
        </Linha>
      )}
      {valores.erroGeral && <FieldError>{valores.erroGeral}</FieldError>}
      <Linha espaco={2} quebra>
        <Button
          type="button"
          className={OCUPADO}
          aria-disabled={pendente || undefined}
          aria-busy={pendente}
          onClick={() => !pendente && onAdicionar()}
        >
          {pendente ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="size-4" aria-hidden="true" />
          )}
          Adicionar destino
        </Button>
        {eNovo ? (
          <Button type="button" variant="outline" onClick={onVoltar}>
            Escolher contato já cadastrado
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={onNovoContato}>
            <Plus className="size-4" aria-hidden="true" />
            Novo contato
          </Button>
        )}
      </Linha>
    </Pilha>
  );
}
