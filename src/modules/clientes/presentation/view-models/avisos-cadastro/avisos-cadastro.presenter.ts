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

export function avisoCadastroParaView(aviso: AvisoCadastroDto): AvisoDeCadastro {
  return {
    id: aviso.id,
    titulo: TITULO[aviso.tipo],
    quando: QUANDO.format(new Date(aviso.criadoEm)),
    visto: aviso.vistoEm !== null,
    href: `/clientes/${aviso.clienteId}`,
  };
}
