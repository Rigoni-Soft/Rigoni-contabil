import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Caixa, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { CampoDeArquivo } from "@/presentation/components/molecules/campo-de-arquivo.component";
import { PainelModal } from "@/presentation/components/molecules/painel-modal.component";
import { Button } from "@/presentation/components/ui/button";

type Props = {
  // Id do modal (e base dos ids internos); único na página.
  painelId: string;
  nomeDoEmpregado: string;
  arquivo?: File;
  pendente: boolean;
  erro?: string;
  // O erro é da foto escolhida (falta ou tamanho): vai no próprio campo; senão é da leitura.
  erroNoCampo?: boolean;
  aoAbrir: () => void;
  aoFechar: () => void;
  onArquivo: (arquivo?: File) => void;
  onLer: () => void;
};

// "Ler atestado" no cartão do empregado (DESIGN.md → LeituraDeAtestado): o botão abre um <dialog> modal (o
// Container o abre com showModal) com a foto do atestado ou da declaração de comparecimento. Sucesso fecha a
// modal e o cartão se atualiza; erro mantém a modal aberta com o motivo e o cartão fica como estava.
export function LeituraDeAtestado({
  painelId,
  nomeDoEmpregado,
  arquivo,
  pendente,
  erro,
  erroNoCampo,
  aoAbrir,
  aoFechar,
  onArquivo,
  onLer,
}: Props) {
  return (
    <>
      <Button type="button" variant="outline" onClick={aoAbrir}>
        Ler atestado
      </Button>
      <PainelModal
        painelId={painelId}
        titulo="Ler atestado ou declaração"
        rotuloDoFechar="Fechar a leitura do atestado"
        aoFechar={aoFechar}
      >
        <Caixa
          como="form"
          aria-labelledby={`${painelId}-titulo`}
          aria-busy={pendente}
          className="min-h-0 flex-1 overflow-auto p-4"
          onSubmit={(e) => {
            e.preventDefault();
            onLer();
          }}
        >
          <Pilha espaco="formulario">
            <Texto variante="apoio">
              A foto abona os dias de {nomeDoEmpregado}: o atestado, os dias de trabalho do período
              sem batida; a declaração de comparecimento, só o horário de um dia que já tem batida.
              O nome no documento precisa ser o dele e o cartão do mês precisa estar iniciado. A
              foto e o CID não são guardados.
            </Texto>
            <CampoDeArquivo
              id={`${painelId}-foto`}
              name="imagem"
              rotulo="Foto do atestado (JPEG ou PNG)"
              accept="image/jpeg,image/png"
              dica="JPEG ou PNG de até 4 MB"
              file={arquivo}
              onChange={onArquivo}
              erro={erroNoCampo ? erro : undefined}
            />
            {erro && !erroNoCampo && <AvisoDeStatus tipo="erro" legivel texto={erro} />}
            <Linha espaco={3} quebra alinhar="centro">
              <Button type="submit" aria-disabled={pendente}>
                {pendente ? "Lendo o atestado…" : "Abonar pelo atestado"}
              </Button>
              <Button type="button" variant="destructive" onClick={aoFechar}>
                Cancelar
              </Button>
            </Linha>
          </Pilha>
        </Caixa>
      </PainelModal>
    </>
  );
}
