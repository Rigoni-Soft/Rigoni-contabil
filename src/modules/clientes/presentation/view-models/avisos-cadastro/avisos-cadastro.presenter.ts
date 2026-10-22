import type {
  AvisoCadastroDto,
  TipoAvisoCadastro,
} from "@/modules/clientes/application/dtos/aviso-cadastro.dto";

export type AvisoCadastroView = {
  id: string;
  titulo: string;
  quando: string;
  visto: boolean;
  href: string;
};

const TITULO: Record<TipoAvisoCadastro, string> = {
  novo_cliente: "Novo Cliente no Cadastro operacional",
  nova_alteracao: "Nova Alteração contratual",
};

const QUANDO = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "short",
  timeStyle: "short",
});

export function avisoCadastroParaView(aviso: AvisoCadastroDto): AvisoCadastroView {
  return {
    id: aviso.id,
    titulo: TITULO[aviso.tipo],
    quando: QUANDO.format(new Date(aviso.criadoEm)),
    visto: aviso.vistoEm !== null,
    href: `/clientes/${aviso.clienteId}`,
  };
}
