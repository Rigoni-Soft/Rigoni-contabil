import { ListaComDivisores } from "@/presentation/components/atoms/lista-com-divisores.component";
import { LinhaDeUsuario } from "@/presentation/components/molecules/linha-de-usuario.component";
import { PAPEL_LABEL } from "@/shared/kernel/papeis";
import { SETOR_LABEL } from "@/shared/kernel/setores";

export type UsuarioListado = {
  id: string;
  nome: string;
  email: string;
  papel: string;
  setor: string;
  bloqueioPendente?: boolean;
};

type UsuariosListaProps = {
  usuarios: UsuarioListado[];
  // Ação de cada linha, montada no servidor (arquitetura.md §4.6, regra 5): a
  // lista não vira código de cliente por causa de um botão.
  acoes: (usuario: UsuarioListado) => React.ReactNode;
};

export function UsuariosLista({ usuarios, acoes }: UsuariosListaProps) {
  return (
    <ListaComDivisores cartao>
      {usuarios.map((usuario) => (
        <LinhaDeUsuario
          key={usuario.id}
          nome={usuario.nome}
          resumo={`${usuario.email} · ${PAPEL_LABEL[usuario.papel] ?? usuario.papel} · ${SETOR_LABEL[usuario.setor] ?? usuario.setor}`}
          bloqueioPendente={usuario.bloqueioPendente}
          acoes={acoes(usuario)}
        />
      ))}
    </ListaComDivisores>
  );
}
