import { CampoDeOpcoes } from "@/presentation/components/molecules/campo-de-opcoes.component";

// Os contatos que outro Setor já cadastrou: na linha nova do Setor, Nome, WhatsApp e E-mail viram seleções
// (escolher um preenche e trava a linha) com a opção "+ Cadastrar novo", que troca os três por campos de
// texto (`modoNovo`).
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

// O valor da opção "+ Cadastrar novo" nas seleções (não é id de contato).
const OPCAO_CADASTRAR_NOVO = "__novo__";

const CAMPOS: { campo: CampoEscolhido; rotulo: string }[] = [
  { campo: "nome", rotulo: "Nome" },
  { campo: "telefone", rotulo: "WhatsApp" },
  { campo: "email", rotulo: "E-mail" },
];

type Existente = ExistentesDaLinha["opcoes"][number];

// O valor do campo; quando outro contato tem o mesmo valor (dois "Ana"), acrescenta o que os distingue (o
// WhatsApp ou o e-mail; no Nome e no E-mail, o contato inteiro é identificado pelo outro dado).
function rotuloDaOpcao(todos: Existente[], opcao: Existente, campo: CampoEscolhido): string {
  const valor = opcao[campo];
  const repetido = todos.some((o) => o.id !== opcao.id && o[campo].trim() === valor.trim());
  if (!repetido) return valor;
  const distintivo = [opcao.telefone, opcao.email, opcao.nome].find(
    (dado) => dado.trim() && dado.trim() !== valor.trim(),
  );
  return distintivo ? `${valor} (${distintivo})` : valor;
}

// Nome, WhatsApp e E-mail da linha nova como seleções: cada uma lista o que esse campo tem nos contatos já
// cadastrados, mais "Cadastrar novo". Escolher um contato preenche a linha; "Cadastrar novo" em qualquer um
// dos três troca os três por campos de texto.
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
