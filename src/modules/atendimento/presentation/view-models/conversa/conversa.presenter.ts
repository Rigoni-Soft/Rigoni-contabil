import { formatarCnpj } from "@/presentation/lib/cnpj-mask";
import { formatarTelefone } from "@/presentation/lib/telefone-mask";
import type {
  ConversaVista,
  DocumentoDisponivel,
  DocumentoOferecido,
} from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import { SETOR_LABEL } from "@/shared/kernel/setores";

export type MensagemView = {
  id: string;
  lado: "contato" | "ura" | "atendente";
  autor: string;
  // Só no balão do cliente: a empresa a que o Atendimento pertence.
  detalhe: string | null;
  texto: string;
  hora: string;
};

export type ConversaView = {
  titulo: string;
  subtitulo: string;
  encerrado: boolean;
  semCliente: boolean;
  mensagens: MensagemView[];
  servicos: { valor: string; rotulo: string; grupo: "contrato" | "alteracao" }[];
};

// O telefone do Atendimento vem com DDI; a máscara é de DDD + número.
export function telefoneParaExibicao(telefone: string): string {
  const digitos = telefone.replace(/\D/g, "");
  return formatarTelefone(
    digitos.length > 11 && digitos.startsWith("55") ? digitos.slice(2) : digitos,
  );
}

const valorDaOpcao = (d: DocumentoOferecido) => (d.data ? `${d.tipo}:${d.data}` : d.tipo);

export function documentoDaOpcao(valor: string): DocumentoDisponivel {
  const [tipo, data] = valor.split(":");
  return { tipo: tipo as DocumentoDisponivel["tipo"], data: data ?? null };
}

// Mesmo fuso de negócio do feed de auditoria (não o do navegador).
function formatarHora(iso: string): string {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const p = (tipo: string) => partes.find((x) => x.type === tipo)?.value ?? "";
  return `${p("day")}/${p("month")} ${p("hour")}:${p("minute")}`;
}

export function conversaParaView(conversa: ConversaVista): ConversaView {
  const telefone = telefoneParaExibicao(conversa.telefone);
  const { contatoNome, empresa, cnpj } = conversa.contato;
  const nomeDoContato = contatoNome ?? telefone;
  const cnpjDoContato = cnpj ? `CNPJ ${formatarCnpj(cnpj)}` : "CNPJ não definido";

  return {
    titulo: nomeDoContato,
    subtitulo:
      empresa && cnpj
        ? `${empresa} · ${formatarCnpj(cnpj)} · ${telefone}`
        : "Cliente não identificado",
    encerrado: conversa.encerrado,
    semCliente: !conversa.clienteVinculado,
    mensagens: conversa.mensagens.map((m) => ({
      id: m.id,
      lado: m.autor === "funcionario" ? "atendente" : m.autor,
      autor:
        m.autor === "contato"
          ? nomeDoContato
          : m.autor === "ura"
            ? "URA"
            : m.atendente
              ? `${m.atendente.nome} · ${SETOR_LABEL[m.atendente.setor]}`
              : "Atendente",
      detalhe: m.autor === "contato" ? cnpjDoContato : null,
      texto: m.texto,
      hora: formatarHora(m.criadoEm),
    })),
    servicos: conversa.documentos.map((d) => ({
      valor: valorDaOpcao(d),
      rotulo: d.descricao,
      grupo: d.tipo,
    })),
  };
}
