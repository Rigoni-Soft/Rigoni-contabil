import { Caixa, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";

const RAZAO_SOCIAL = "Rigoni Serviços Contábeis LTDA";
const CNPJ = "12.246.616/0001-26";
const EMAIL = "rigonicontabilidadepatriki@gmail.com";
const ATUALIZADA_EM = "6 de novembro de 2026";

type Secao = { titulo: string; paragrafos: string[] };

// Rascunho técnico conforme a LGPD (Lei 13.709/2018); o escritório deve revisá-lo.
const SECOES: Secao[] = [
  {
    titulo: "1. Quem é o responsável pelos dados",
    paragrafos: [
      `${RAZAO_SOCIAL}, inscrita no CNPJ ${CNPJ} ("Rigoni Contábil" ou "escritório"), é a controladora dos dados pessoais tratados neste sistema e no atendimento pelo WhatsApp.`,
    ],
  },
  {
    titulo: "2. Quais dados tratamos",
    paragrafos: [
      "Dados de contato dos clientes: nome e telefone das pessoas autorizadas a falar com o escritório.",
      "Mensagens, áudios, imagens e arquivos trocados com o escritório pelo WhatsApp.",
      "Dados cadastrais das empresas clientes: razão social, CNPJ, regime tributário e situação fiscal.",
      "Documentos contábeis e fiscais: contrato social e alterações, guias de impostos e de parcelamento e certidões.",
      "Dados de acesso da equipe do escritório: nome, e-mail e registros de uso do sistema.",
    ],
  },
  {
    titulo: "3. Para que usamos",
    paragrafos: [
      "Atender os clientes, enviar guias e documentos, lembrar prazos e obrigações e manter o histórico dos atendimentos.",
      "Cumprir os contratos de serviços contábeis e as obrigações legais e regulatórias a que o escritório está sujeito.",
      "Não usamos os dados para publicidade de terceiros e não os vendemos.",
    ],
  },
  {
    titulo: "4. Bases legais",
    paragrafos: [
      "Execução de contrato e de procedimentos preliminares a pedido do titular, cumprimento de obrigação legal ou regulatória e legítimo interesse para o atendimento e a segurança do serviço (LGPD, art. 7º).",
    ],
  },
  {
    titulo: "5. Com quem compartilhamos",
    paragrafos: [
      "Somente com os prestadores necessários ao serviço: a Meta Platforms (WhatsApp Business Platform), que transporta as mensagens; o Serviço Federal de Processamento de Dados, Serpro (Integra Contador), para consultar e emitir guias e documentos fiscais mediante procuração do cliente; e os provedores de hospedagem e banco de dados do sistema (Vercel e Supabase).",
      "Alguns desses provedores podem tratar dados fora do Brasil, com as garantias previstas na LGPD. Também podemos compartilhar dados com autoridades quando a lei exigir.",
    ],
  },
  {
    titulo: "6. Por quanto tempo guardamos",
    paragrafos: [
      "Pelo tempo da relação contratual e, depois dela, pelos prazos exigidos pela legislação fiscal, contábil e trabalhista ou para o exercício regular de direitos. Findo o prazo, os dados são eliminados ou anonimizados.",
    ],
  },
  {
    titulo: "7. Seus direitos",
    paragrafos: [
      "Nos termos do art. 18 da LGPD, você pode pedir a confirmação do tratamento, o acesso, a correção, a anonimização, o bloqueio ou a eliminação de dados, a portabilidade, a informação sobre com quem compartilhamos e a revogação de consentimento, quando for o caso.",
      `Para exercer esses direitos, escreva para ${EMAIL}. Podemos pedir informações para confirmar a sua identidade.`,
    ],
  },
  {
    titulo: "8. Exclusão de dados",
    paragrafos: [
      `Para pedir a exclusão dos seus dados, envie um e-mail para ${EMAIL} com o seu nome e o número de telefone usado no WhatsApp. Atenderemos o pedido, ressalvados os dados que a lei nos obriga a manter.`,
    ],
  },
  {
    titulo: "9. Segurança",
    paragrafos: [
      "Usamos controle de acesso por perfil, conexão criptografada, segredos protegidos e registro de ações. Nenhum sistema é totalmente imune a falhas; em caso de incidente relevante, comunicaremos os titulares e a ANPD conforme a lei.",
    ],
  },
  {
    titulo: "10. Contato e atualizações",
    paragrafos: [
      `Dúvidas sobre esta política: ${EMAIL}. Podemos atualizá-la; a data da última atualização fica no início desta página.`,
    ],
  },
];

// Página pública (sem login): a Meta exige o endereço de uma política de privacidade do app.
export function PrivacidadePage() {
  return (
    <Caixa como="main" className="mx-auto w-full max-w-3xl px-4 py-10">
      <Pilha espaco={6}>
        <Pilha espaco={2}>
          <Texto como="h1" variante="tela">
            Política de Privacidade
          </Texto>
          <Texto variante="apoio">
            {RAZAO_SOCIAL} · CNPJ {CNPJ}
          </Texto>
          <Texto variante="nota">Atualizada em {ATUALIZADA_EM}.</Texto>
        </Pilha>
        {SECOES.map((secao) => (
          <Pilha como="section" espaco={2} key={secao.titulo}>
            <Texto como="h2" variante="subtitulo">
              {secao.titulo}
            </Texto>
            {secao.paragrafos.map((paragrafo) => (
              <Texto variante="corpo" key={paragrafo}>
                {paragrafo}
              </Texto>
            ))}
          </Pilha>
        ))}
      </Pilha>
    </Caixa>
  );
}
