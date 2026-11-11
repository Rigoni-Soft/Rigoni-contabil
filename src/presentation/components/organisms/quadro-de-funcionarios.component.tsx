import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { CaixaDeMarcacao } from "@/presentation/components/atoms/caixa-de-marcacao.component";
import { Caixa, Grade, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { LinkDeAcao } from "@/presentation/components/atoms/link-de-acao.component";
import { NotaDeObrigatorio } from "@/presentation/components/atoms/nota-de-obrigatorio.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { CampoDeTexto } from "@/presentation/components/molecules/campo-de-texto.component";
import { Button } from "@/presentation/components/ui/button";
import { MOLDURA_DO_CARTAO } from "@/presentation/lib/moldura-do-cartao";

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

// Células da grade de 4 colunas do formulário: nome (2), a marca e a Jornada, um dia por campo.
function CamposDoEmpregado({
  prefixo,
  nome,
  comissionado,
  cargas,
  erro,
}: {
  prefixo: string;
  nome: string;
  comissionado: boolean;
  cargas: string[];
  erro?: string;
}) {
  return (
    <>
      <CampoDeTexto
        id={`${prefixo}-nome`}
        rotulo="Nome"
        name="nome"
        defaultValue={nome}
        obrigatorio
        required
        maxLength={120}
        className="gap-1 sm:col-span-2"
        aria-describedby={erro ? "erro-do-novo-empregado" : undefined}
        aria-invalid={!!erro}
      />
      <Caixa className="flex items-center sm:col-span-2 sm:min-h-9 sm:self-end pointer-coarse:min-h-11">
        <CaixaDeMarcacao rotulo="Comissionado" name="comissionado" defaultChecked={comissionado} />
      </Caixa>
      {DIAS.map((dia, i) => (
        <CampoDeTexto
          key={dia}
          id={`${prefixo}-carga${i}`}
          rotulo={dia}
          type="time"
          name={`carga${i}`}
          defaultValue={cargas[i]}
          aria-label={`Jornada de ${dia}`}
          className="gap-1"
        />
      ))}
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
    <Pilha
      como="section"
      espaco={6}
      aria-label="Quadro de funcionários"
      className={MOLDURA_DO_CARTAO}
    >
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

      {editavel && <NotaDeObrigatorio />}

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
          <Pilha espaco="formulario">
            <Texto como="h3" variante="rotuloDeSecao">
              Novo empregado
            </Texto>
            <Grade colunas="1>2>4" espaco={4}>
              <CamposDoEmpregado
                prefixo="novo"
                nome=""
                comissionado={padraoComissionados}
                cargas={cargasPadrao}
                erro={erroDoNovo}
              />
            </Grade>
            {erroDoNovo && (
              <Caixa id="erro-do-novo-empregado">
                <AvisoDeStatus tipo="erro" legivel texto={erroDoNovo} />
              </Caixa>
            )}
            <Button type="submit" disabled={pendente} className="self-start">
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
            <Pilha espaco="formulario">
              <Grade colunas="1>2>4" como="fieldset" disabled={!editavel} espaco={4}>
                <CamposDoEmpregado
                  prefixo="corrigir"
                  nome={emEdicao.nome}
                  comissionado={emEdicao.comissionado}
                  cargas={emEdicao.cargas}
                />
              </Grade>
              {editavel && (
                <Button type="submit" disabled={pendente} className="self-start">
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
