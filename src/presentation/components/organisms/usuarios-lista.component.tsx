import { ListaComDivisores } from "@/presentation/components/atoms/lista-com-divisores.component";
import { LinhaDeUsuario } from "@/presentation/components/molecules/linha-de-usuario.component";
import { PAPEL_LABEL } from "@/shared/kernel/papeis";
import { SETOR_LABEL } from "@/shared/kernel/setores";

type UsuarioListado = {
  id: string;
  nome: string;
  email: string;
  papel: string;
  setor: string;
  desativacaoPendente?: boolean;
};

type UsuariosListaProps = {
  usuarios: UsuarioListado[];
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
          desativacaoPendente={usuario.desativacaoPendente}
          acoes={acoes(usuario)}
        />
      ))}
    </ListaComDivisores>
  );
}
