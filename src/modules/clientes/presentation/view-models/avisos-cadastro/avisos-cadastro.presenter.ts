import type { AvisoDeCadastro } from "@/presentation/components/molecules/item-de-aviso.component";
import type {
  AvisoCadastroDto,
  TipoAvisoCadastro,
} from "@/modules/clientes/application/dtos/aviso-cadastro.dto";

// O hook não importa a View (arquitetura.md): o tipo chega por aqui.
export type { AvisoDeCadastro };

const TITULO: Record<TipoAvisoCadastro, string> = {
  novo_cliente: "Novo Cliente no Cadastro operacional",
  nova_alteracao: "Nova Alteração contratual",
};

const QUANDO = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "short",
  timeStyle: "short",
});

// Só o aviso de alteração aponta uma alteração: a tela destaca o botão e abre aquela, não a mais recente.
function destinoDoAviso(aviso: AvisoCadastroDto): string {
  const cliente = `/clientes/${aviso.clienteId}`;
  return aviso.tipo === "nova_alteracao" && aviso.alteracaoNumero !== null
    ? `${cliente}?alteracao=${aviso.alteracaoNumero}`
    : cliente;
}

// O nº distingue duas alterações do mesmo Cliente na lista (o título era idêntico).
function tituloDoAviso(aviso: AvisoCadastroDto): string {
  const titulo = TITULO[aviso.tipo];
  return aviso.tipo === "nova_alteracao" && aviso.alteracaoNumero !== null
    ? `${titulo} nº ${aviso.alteracaoNumero}`
    : titulo;
}

export function avisoCadastroParaView(aviso: AvisoCadastroDto): AvisoDeCadastro {
  return {
    id: aviso.id,
    titulo: tituloDoAviso(aviso),
    quando: QUANDO.format(new Date(aviso.criadoEm)),
    visto: aviso.vistoEm !== null,
    href: destinoDoAviso(aviso),
  };
}

// Texto do anúncio ao leitor de tela quando chegam avisos novos.
export function anuncioDeAvisos(naoVistos: number): string {
  return `${naoVistos} ${naoVistos === 1 ? "aviso de cadastro não visto" : "avisos de cadastro não vistos"}`;
}
