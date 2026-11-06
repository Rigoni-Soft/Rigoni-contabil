-- #165: a regra do Responsável do Cliente é do sistema, não do Simples Nacional. Em todo Setor, o
-- Funcionário só enxerga os Clientes pelos quais é Responsável (no SN, `responsavel_id` do cadastro
-- operacional; nos demais, `cliente_responsaveis`). Líder e Admin enxergam todos. A Recepção é a
-- exceção: todos os Funcionários e o Líder respondem por todo cliente que chega, então o
-- Funcionário da Recepção vê todos os Clientes. A leitura de Cliente passa toda por
-- `pode_ver_cliente` (view `clientes_basico`, Contatos, Atividade, cadastro operacional,
-- Parcelamentos e documentos contratuais), então a regra muda num só lugar. Editar o cadastro
-- operacional segue sendo só do SN (`pode_editar_cadastro_operacional`).

CREATE OR REPLACE FUNCTION public.sou_responsavel_do_cliente(p_cliente_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.cliente_cadastro_operacional_sn
    where cliente_id = p_cliente_id and responsavel_id = auth.uid()
  ) or exists (
    select 1 from public.cliente_responsaveis
    where cliente_id = p_cliente_id and responsavel_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.pode_ver_cliente(p_cliente_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  -- acesso_liberado(): primeiro acesso finalizado (PR #69, ADR 0002).
  select public.acesso_liberado() and case
    when public.meu_papel() is null then false
    when public.meu_papel() = 'funcionario' and public.meu_setor() is distinct from 'recepcao'
      then public.sou_responsavel_do_cliente(p_cliente_id)
    else true
  end;
$$;

-- O Funcionário lê só as próprias atribuições (quem cuida de quê é do Líder e do Admin).
DROP POLICY cliente_responsaveis_select ON public.cliente_responsaveis;
CREATE POLICY cliente_responsaveis_select ON public.cliente_responsaveis FOR SELECT
  USING (
    public.acesso_liberado() and (
      public.meu_papel() = 'admin'
      or (public.meu_papel() = 'lider_setor' and public.meu_setor() = setor)
      or responsavel_id = auth.uid()
    )
  );
