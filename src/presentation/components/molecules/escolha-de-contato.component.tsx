import { CampoDeOpcoes } from "@/presentation/components/molecules/campo-de-opcoes.component";

export type ExistentesDaLinha = {
  opcoes: { id: string; nome: string; telefone: string; email: string }[];
  modoNovo: boolean;
  onEscolher: (contatoId: string) => void;
  onNovo: () => void;
};

type CampoEscolhido = "nome" | "telefone" | "email";

type EscolhaDeContatoProps = {
  indice: number;
  existentes: ExistentesDaLinha;
  erros: Partial<Record<CampoEscolhido, string>>;
};

const OPCAO_CADASTRAR_NOVO = "__novo__";

const CAMPOS: { campo: CampoEscolhido; rotulo: string }[] = [
  { campo: "nome", rotulo: "Nome" },
  { campo: "telefone", rotulo: "WhatsApp" },
  { campo: "email", rotulo: "E-mail" },
];

type Existente = ExistentesDaLinha["opcoes"][number];

function rotuloDaOpcao(todos: Existente[], opcao: Existente, campo: CampoEscolhido): string {
  const valor = opcao[campo];
  const repetido = todos.some((o) => o.id !== opcao.id && o[campo].trim() === valor.trim());
  if (!repetido) return valor;
  const distintivo = [opcao.telefone, opcao.email, opcao.nome].find(
    (dado) => dado.trim() && dado.trim() !== valor.trim(),
  );
  return distintivo ? `${valor} (${distintivo})` : valor;
}

export function EscolhaDeContato({ indice, existentes, erros }: EscolhaDeContatoProps) {
  return (
    <>
      {CAMPOS.map(({ campo, rotulo }) => (
        <CampoDeOpcoes
          key={campo}
          id={`contatos.${indice}.${campo}`}
          rotulo={rotulo}
          obrigatorio={campo === "nome"}
          erro={erros[campo]}
          opcoes={[
            ...existentes.opcoes
              .filter((opcao) => opcao[campo].trim())
              .map((opcao) => ({
                valor: opcao.id,
                rotulo: rotuloDaOpcao(existentes.opcoes, opcao, campo),
              })),
            { valor: OPCAO_CADASTRAR_NOVO, rotulo: "+ Cadastrar novo" },
          ]}
          placeholder="Escolher contato"
          className="min-w-[10rem] flex-1 gap-1"
          value=""
          onChange={(evento) =>
            evento.target.value === OPCAO_CADASTRAR_NOVO
              ? existentes.onNovo()
              : existentes.onEscolher(evento.target.value)
          }
        />
      ))}
    </>
  );
}
