import type { AvisoDeCadastro } from "@/presentation/components/molecules/item-de-aviso.component";
import type {
  AvisoCadastroDto,
  TipoAvisoCadastro,
} from "@/modules/clientes/application/dtos/aviso-cadastro.dto";
import { FUSO_DE_NEGOCIO } from "@/shared/kernel/mes-atual";

export type { AvisoDeCadastro };

const TITULO: Record<TipoAvisoCadastro, string> = {
  novo_cliente: "Novo Cliente no Cadastro operacional",
  nova_alteracao: "Nova Alteração contratual",
  sem_meio_de_envio: "Cliente sem meio de envio",
};

const QUANDO = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO_DE_NEGOCIO,
  dateStyle: "short",
  timeStyle: "short",
});

export function avisoCadastroParaView(aviso: AvisoCadastroDto): AvisoDeCadastro {
  const numero = aviso.tipo === "nova_alteracao" ? aviso.alteracaoNumero : null;
  const cliente = `/clientes/${aviso.clienteId}`;
  const titulo = aviso.mensagem ?? TITULO[aviso.tipo];
  return {
    id: aviso.id,
    titulo: numero === null ? titulo : `${titulo} nº ${numero}`,
    quando: QUANDO.format(new Date(aviso.criadoEm)),
    visto: aviso.vistoEm !== null,
    href: numero === null ? cliente : `${cliente}?alteracao=${numero}`,
  };
}

export function anuncioDeAvisos(naoVistos: number): string {
  return `${naoVistos} ${naoVistos === 1 ? "aviso de cadastro não visto" : "avisos de cadastro não vistos"}`;
}
