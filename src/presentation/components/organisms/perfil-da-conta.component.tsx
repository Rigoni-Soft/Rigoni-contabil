import { Fragment } from "react";

import { Caixa, Grade } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { escopoDoUsuario } from "@/shared/kernel/escopo-do-usuario";
import { PAPEL_LABEL } from "@/shared/kernel/papeis";

type PerfilDaContaProps = {
  nome: string;
  email: string;
  papel: string;
  setor: string;
  avatar?: React.ReactNode;
  formulario: React.ReactNode;
};

export function PerfilDaConta({
  nome,
  email,
  papel,
  setor,
  avatar,
  formulario,
}: PerfilDaContaProps) {
  const dados = [
    { rotulo: "Nome", valor: nome },
    { rotulo: "E-mail", valor: email },
    { rotulo: "Papel", valor: PAPEL_LABEL[papel] ?? papel },
    { rotulo: "Setor", valor: escopoDoUsuario({ papel, setor }).rotulo },
  ];

  return (
    <>
      {avatar}
      <Grade
        colunas="rotuloValor"
        como="dl"
        className="mb-8 gap-x-4 gap-y-2 border-t border-border pt-8 text-sm"
      >
        {dados.map(({ rotulo, valor }) => (
          <Fragment key={rotulo}>
            <Caixa como="dt" className="text-muted-foreground">
              {rotulo}
            </Caixa>
            <Caixa como="dd" className="min-w-0 font-medium break-words text-foreground">
              {valor}
            </Caixa>
          </Fragment>
        ))}
      </Grade>
      <Caixa
        como="section"
        aria-labelledby="trocar-senha-titulo"
        className="border-t border-border pt-8"
      >
        <Texto variante="subtitulo" como="h2" id="trocar-senha-titulo" className="mb-2">
          Trocar senha
        </Texto>
        <Texto variante="apoio" className="mb-6">
          Defina uma nova senha para sua conta.
        </Texto>
        {formulario}
      </Caixa>
    </>
  );
}
