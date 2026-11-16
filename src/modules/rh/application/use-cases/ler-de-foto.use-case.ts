import type { AuditoriaPort } from "@/modules/rh/application/ports/out/auditoria.provider";
import type { FolhaDePontoRepository } from "@/modules/rh/application/ports/out/folha-de-ponto.repository";
import type { RegistroDeErrosPort } from "@/modules/rh/application/ports/out/registro-de-erros.provider";
import type { SessaoPort } from "@/modules/rh/application/ports/out/sessao.provider";
import { EscreverPonto } from "@/modules/rh/application/use-cases/gerir-quadro-de-funcionarios.use-case";

// O que a leitura do cartão e a do atestado têm em comum: o leitor (visão atrás da porta neutra) pode lançar, e
// a falha só pode ir ao registro como descrição técnica, nunca com a foto ou o que ela tinha (dado pessoal).
export abstract class LerDeFoto extends EscreverPonto {
  constructor(
    sessao: SessaoPort,
    repositorio: FolhaDePontoRepository,
    auditoria: AuditoriaPort,
    acao: string,
    private readonly erros: RegistroDeErrosPort,
  ) {
    super(sessao, repositorio, auditoria, acao);
  }

  // null = o leitor lançou (já registrado); quem chama cai na digitação manual.
  protected async chamarLeitor<T>(evento: string, leitura: () => Promise<T>): Promise<T | null> {
    try {
      return await leitura();
    } catch (falha) {
      // Só o nome do erro: a mensagem pode ecoar texto da resposta do leitor, e a foto tem dado pessoal.
      this.erros.registrar(evento, falha instanceof Error ? falha.name : "desconhecida");
      return null;
    }
  }

  // Leitura que o domínio reprovou: só o motivo, porque a leitura tem nome e horários de uma pessoa.
  protected registrarReprovacao(evento: string, motivo: string): void {
    this.erros.registrar(evento, motivo);
  }
}
