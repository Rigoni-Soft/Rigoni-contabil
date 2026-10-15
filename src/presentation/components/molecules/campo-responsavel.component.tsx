import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { Opcao } from "@/presentation/components/atoms/opcao.component";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import { Select } from "@/presentation/components/ui/select";

type CampoResponsavelProps = {
  editavel: boolean;
  nomeAtual: string;
  opcoes: { id: string; nome: string }[];
  semResponsavel: string;
  // A lista carrega só quando o Select é aberto; "erro" tem saída própria (tentar de novo).
  estadoLista: "ok" | "carregando" | "erro";
  onAbrir: () => void;
  onTentarNovamente: () => void;
  // Props do <select> (o `register` do formulário, já resolvido por quem monta).
  select: React.ComponentProps<"select">;
  desabilitado?: boolean;
};

// Responsável pelo Cliente: só o Líder do setor edita (Select); os demais veem o nome (#65).
export function CampoResponsavel({
  editavel,
  nomeAtual,
  opcoes,
  semResponsavel,
  estadoLista,
  onAbrir,
  onTentarNovamente,
  select,
  desabilitado,
}: CampoResponsavelProps) {
  return (
    <Pilha espaco={1}>
      <Label htmlFor="responsavelId">Responsável</Label>
      {editavel ? (
        <Select id="responsavelId" disabled={desabilitado} {...select} onFocus={onAbrir}>
          <Opcao value="">{semResponsavel}</Opcao>
          {estadoLista === "carregando" && <Opcao disabled>Carregando…</Opcao>}
          {opcoes.map((opcao) => (
            <Opcao key={opcao.id} value={opcao.id}>
              {opcao.nome}
            </Opcao>
          ))}
        </Select>
      ) : (
        <Input id="responsavelId" value={nomeAtual} disabled readOnly />
      )}
      {estadoLista === "erro" && (
        <Linha alinhar="centro" quebra className="gap-x-2">
          <FieldError>Não foi possível carregar a lista de Funcionários.</FieldError>
          <Button type="button" variant="ghost" size="sm" onClick={onTentarNovamente}>
            Tentar de novo
          </Button>
        </Linha>
      )}
    </Pilha>
  );
}
