import { z } from "zod";

// `abrir_atendimento`: uuid do Atendimento, ou null se o Funcionário escolhido foi ocupado.
export const aberturaRowSchema = z.string().nullable();
// `anexar_mensagem_atendimento`: true se havia Atendimento em andamento.
export const anexoRowSchema = z.boolean();
