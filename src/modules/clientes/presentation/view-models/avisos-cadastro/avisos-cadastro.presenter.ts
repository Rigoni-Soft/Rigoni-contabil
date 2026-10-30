import type { AvisoDeCadastro } from "@/presentation/components/molecules/item-de-aviso.component";
import type {
  AvisoCadastroDto,
  TipoAvisoCadastro,
} from "@/modules/clientes/application/dtos/aviso-cadastro.dto";
import { FUSO_DE_NEGOCIO } from "@/shared/kernel/mes-atual";

// O hook não importa a View (arquitetura.md): o tipo chega por aqui.
export type { AvisoDeCadastro };

const TITULO: Record<TipoAvisoCadastro, string> = {
  novo_cliente: "Novo Cliente no Cadastro operacional",
  nova_alteracao: "Nova Alteração contratual",
};

const QUANDO = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO_DE_NEGOCIO,
  dateStyle: "short",
  timeStyle: "short",
});

// O nº só existe no aviso de alteração (a trigger o grava): vai no título, para duas alterações do mesmo
// Cliente não parecerem iguais, e no destino, para a tela destacar o botão e abrir aquela alteração.
export function avisoCadastroParaView(aviso: AvisoCadastroDto): AvisoDeCadastro {
  const numero = aviso.alteracaoNumero;
  const cliente = `/clientes/${aviso.clienteId}`;
  return {
    id: aviso.id,
    titulo: numero === null ? TITULO[aviso.tipo] : `${TITULO[aviso.tipo]} nº ${numero}`,
    quando: QUANDO.format(new Date(aviso.criadoEm)),
    visto: aviso.vistoEm !== null,
    href: numero === null ? cliente : `${cliente}?alteracao=${numero}`,
  };
}

// Texto do anúncio ao leitor de tela quando chegam avisos novos.
export function anuncioDeAvisos(naoVistos: number): string {
  return `${naoVistos} ${naoVistos === 1 ? "aviso de cadastro não visto" : "avisos de cadastro não vistos"}`;
}
