import { Caixa, Linha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";

type LinhaDeUsuarioProps = {
  nome: string;
  // E-mail, Papel e Setor, já formatados para exibição.
  resumo: string;
  // Desativado, mas o bloqueio da conta ainda não foi concluído.
  bloqueioPendente?: boolean;
  // Ações da linha (slot montado no servidor).
  acoes?: React.ReactNode;
};

export function LinhaDeUsuario({ nome, resumo, bloqueioPendente, acoes }: LinhaDeUsuarioProps) {
  return (
    <Linha
      como="li"
      alinhar="centro"
      justificar="entre"
      espaco={4}
      className="flex-wrap px-4 py-3 sm:flex-nowrap"
    >
      <Caixa className="min-w-0 flex-1 basis-56">
        <Texto variante="destaque" className="[overflow-wrap:anywhere] sm:truncate">
          {nome}
        </Texto>
        <Texto variante="apoio" className="[overflow-wrap:anywhere] sm:truncate">
          {resumo}
        </Texto>
        {bloqueioPendente && (
          <Texto variante="alerta">
            Desativado, mas o bloqueio da conta ainda não foi concluído.
          </Texto>
        )}
      </Caixa>
      {acoes}
    </Linha>
  );
}
