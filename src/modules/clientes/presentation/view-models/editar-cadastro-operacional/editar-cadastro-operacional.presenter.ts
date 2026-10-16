import type { CadastroOperacionalClienteDto } from "@/modules/clientes/application/ports/out/cliente-query.provider";
import { rotuloResponsavel } from "@/shared/kernel/papeis";

type Opcao = { id: string; nome: string };

// Antes de abrir o Select só o Responsável atual é conhecido; depois soma a lista carregada.
export function opcoesResponsavel(dados: CadastroOperacionalClienteDto, carregadas: Opcao[]) {
  const atual =
    dados.responsavelId && dados.responsavelNome
      ? [{ id: dados.responsavelId, nome: dados.responsavelNome }]
      : [];
  return [...atual.filter((a) => !carregadas.some((c) => c.id === a.id)), ...carregadas];
}

export const nomeResponsavelAtual = (dados: CadastroOperacionalClienteDto) =>
  rotuloResponsavel(dados.responsavelId, dados.responsavelNome);
