import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { CaixaDeMarcacao } from "@/presentation/components/atoms/caixa-de-marcacao.component";
import { Caixa, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { LinkDeAcao } from "@/presentation/components/atoms/link-de-acao.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";

export type EmpregadoDoQuadro = {
  id: string;
  nome: string;
  href: string;
  selecionado: boolean;
  // Selos curtos: "inativo", "sem movimento", "comissionado".
  selos: string[];
};

export type EmpregadoEmEdicao = {
  id: string;
  nome: string;
  comissionado: boolean;
  ativo: boolean;
  semMovimento: boolean;
  // Carga "HH:MM" de domingo a sábado ("00:00" = não trabalha).
  cargas: string[];
};

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Props = {
  empregados: EmpregadoDoQuadro[];
  emEdicao?: EmpregadoEmEdicao;
  cargasPadrao: string[];
  padraoComissionados: boolean;
  rotuloMes: string;
  editavel: boolean;
  pendente: boolean;
  erro?: string;
  // Erro do cadastro: aparece colado ao formulário "Novo empregado" e ligado ao campo Nome.
  erroDoNovo?: string;
  // Muda quando o cadastro dá certo: o formulário é remontado e o que foi digitado some.
  chaveDoNovo: number;
  onCadastrar: (campos: FormData) => void;
  onCorrigir: (campos: FormData) => void;
  onAtivo: (ativo: boolean) => void;
  onSemMovimento: (sem: boolean) => void;
  onPadrao: (comissionados: boolean) => void;
};

function CamposDoEmpregado({
  nome,
  comissionado,
  cargas,
  erro,
}: {
  nome: string;
  comissionado: boolean;
  cargas: string[];
  erro?: string;
}) {
  return (
    <>
      <Caixa como="label" className="flex flex-col gap-1 text-sm font-semibold">
        Nome
        <Input
          name="nome"
          defaultValue={nome}
          required
          maxLength={120}
          className="w-64"
          aria-invalid={!!erro}
          aria-describedby={erro ? "erro-do-novo-empregado" : undefined}
        />
      </Caixa>
      <Linha alinhar="fim" espaco={2} quebra>
        {DIAS.map((dia, i) => (
          <Caixa como="label" key={dia} className="flex flex-col gap-1 text-sm font-semibold">
            {dia}
            <Input
              type="time"
              name={`carga${i}`}
              defaultValue={cargas[i]}
              aria-label={`Jornada de ${dia}`}
              className="w-28"
            />
          </Caixa>
        ))}
      </Linha>
      <CaixaDeMarcacao rotulo="Comissionado" name="comissionado" defaultChecked={comissionado} />
    </>
  );
}

// O Quadro de funcionários do Cliente: só nome, Jornada por dia da semana e a marca "comissionado".
export function QuadroDeFuncionarios({
  empregados,
  emEdicao,
  cargasPadrao,
  padraoComissionados,
  rotuloMes,
  editavel,
  pendente,
  erro,
  erroDoNovo,
  chaveDoNovo,
  onCadastrar,
  onCorrigir,
  onAtivo,
  onSemMovimento,
  onPadrao,
}: Props) {
  return (
    <Pilha como="section" espaco={6} aria-label="Quadro de funcionários">
      <Texto como="h2" variante="subtitulo">
        Quadro de funcionários
      </Texto>
      {erro && <AvisoDeStatus tipo="erro" legivel texto={erro} />}
      {empregados.length === 0 ? (
        <Texto variante="apoio">
          Nenhum empregado cadastrado neste cliente.{editavel && " Cadastre o primeiro abaixo."}
        </Texto>
      ) : (
        <Pilha como="ul" espaco={2} aria-label="Empregados">
          {empregados.map((e) => (
            <Caixa como="li" key={e.id}>
              <Linha alinhar="centro" espaco={3} quebra>
                <LinkDeAcao
                  href={e.href}
                  variant={e.selecionado ? "default" : "outline"}
                  atual={e.selecionado}
                >
                  {e.nome}
                </LinkDeAcao>
                {e.selos.length > 0 && <Texto variante="nota">{e.selos.join(" · ")}</Texto>}
              </Linha>
            </Caixa>
          ))}
        </Pilha>
      )}

      {editavel && (
        <CaixaDeMarcacao
          rotulo="Os empregados deste cliente são comissionados (padrão para os novos)"
          checked={padraoComissionados}
          disabled={pendente}
          onChange={(e) => onPadrao(e.target.checked)}
        />
      )}

      {editavel && (
        <Caixa
          como="form"
          key={chaveDoNovo}
          aria-label="Novo empregado"
          onSubmit={(e) => {
            e.preventDefault();
            onCadastrar(new FormData(e.currentTarget));
          }}
        >
          <Pilha espaco={3}>
            <Texto como="h3" variante="rotuloDeSecao">
              Novo empregado
            </Texto>
            <CamposDoEmpregado
              nome=""
              comissionado={padraoComissionados}
              cargas={cargasPadrao}
              erro={erroDoNovo}
            />
            {erroDoNovo && (
              <Caixa id="erro-do-novo-empregado">
                <AvisoDeStatus tipo="erro" legivel texto={erroDoNovo} />
              </Caixa>
            )}
            <Button type="submit" size="sm" disabled={pendente} className="self-start">
              Cadastrar empregado
            </Button>
          </Pilha>
        </Caixa>
      )}

      {emEdicao && (
        <Pilha espaco={3}>
          <Texto como="h3" variante="rotuloDeSecao">
            Corrigir {emEdicao.nome}
          </Texto>
          <Caixa
            como="form"
            key={`${emEdicao.id}|${emEdicao.nome}|${emEdicao.comissionado}|${emEdicao.cargas.join()}`}
            aria-label="Corrigir empregado"
            onSubmit={(e) => {
              e.preventDefault();
              onCorrigir(new FormData(e.currentTarget));
            }}
          >
            <Pilha espaco={3}>
              <Caixa como="fieldset" disabled={!editavel} className="contents">
                <CamposDoEmpregado
                  nome={emEdicao.nome}
                  comissionado={emEdicao.comissionado}
                  cargas={emEdicao.cargas}
                />
              </Caixa>
              {editavel && (
                <Button type="submit" size="sm" disabled={pendente} className="self-start">
                  Salvar empregado
                </Button>
              )}
            </Pilha>
          </Caixa>
          {editavel && (
            <Linha espaco={4} quebra alinhar="centro">
              <CaixaDeMarcacao
                rotulo={`Sem movimento em ${rotuloMes}`}
                checked={emEdicao.semMovimento}
                disabled={pendente || !emEdicao.ativo}
                onChange={(e) => onSemMovimento(e.target.checked)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pendente}
                onClick={() => onAtivo(!emEdicao.ativo)}
              >
                {emEdicao.ativo ? "Inativar empregado" : "Reativar empregado"}
              </Button>
            </Linha>
          )}
        </Pilha>
      )}
    </Pilha>
  );
}
