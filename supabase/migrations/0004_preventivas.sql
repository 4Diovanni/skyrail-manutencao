-- Preventivas: modelos de checklist guardados como dados e a execução de cada preventiva.
-- Os modelos são importados por scripts/importar-checklists.mjs (supabase/seed/checklists.json)
-- e editados só por admin. Nenhum dado pessoal entra por migração.

------------------------------------------------------------------------------
-- Modelos de checklist (um por sistema + periodicidade, ex.: "psd-1m")
------------------------------------------------------------------------------
create table public.checklist_modelos (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sistema text not null check (length(sistema) between 1 and 40),
  sistema_nome text not null check (length(sistema_nome) between 1 and 120),
  sistema_descricao text check (length(sistema_descricao) <= 300),
  codigo text not null check (length(codigo) between 1 and 10),
  tipo_prev text not null check (tipo_prev in ('P0','PQ','P1','P3','P6','P12','P2A','P3A','P5A')),
  periodicidade text not null check (length(periodicidade) between 1 and 40),
  rotulo text check (length(rotulo) <= 120),
  resumo text check (length(resumo) <= 300),
  formulario text check (length(formulario) <= 40),
  ordem int not null default 0,
  ativo boolean not null default true,
  -- Estrutura descrita em src/modules/preventivas/domain/modelo.ts
  conteudo jsonb not null check (
    jsonb_typeof(conteudo) = 'object'
    and jsonb_typeof(conteudo -> 'itens') = 'array'
    and jsonb_typeof(conteudo -> 'grupos') = 'array'
  ),
  versao int not null default 1,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.profiles (id)
);
create index checklist_modelos_sistema on public.checklist_modelos (sistema, ordem);

-- Mudou o conteúdo, sobe a versão (a execução guarda a versão usada).
create or replace function public.checklist_modelos_antes_salvar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.conteudo is distinct from old.conteudo then
    new.versao := old.versao + 1;
  elsif tg_op = 'UPDATE' then
    new.versao := old.versao;
  end if;
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end;
$$;
create trigger checklist_modelos_antes_salvar
  before insert or update on public.checklist_modelos
  for each row execute function public.checklist_modelos_antes_salvar();

------------------------------------------------------------------------------
-- Execução da preventiva
------------------------------------------------------------------------------
create type public.status_preventiva as enum ('Em andamento', 'Concluído', 'Não realizado');

create table public.preventivas (
  id uuid primary key default gen_random_uuid(),
  modelo_id text not null references public.checklist_modelos (id),
  modelo_versao int not null default 1,
  -- Primeiro dia de atuação (os demais ficam em "dias")
  data date not null,
  turno public.turno not null,
  local text check (length(local) <= 200),
  linha text not null default 'Linha 17 Ouro' check (length(linha) <= 60),
  os_numero text check (length(os_numero) <= 40),
  -- {quadro, tipo, ...} conforme conteudo.camposExtras do modelo
  campos jsonb not null default '{}'::jsonb check (jsonb_typeof(campos) = 'object'),
  -- [{nome, calibracao, obs}]
  instrumentos jsonb not null default '[]'::jsonb check (jsonb_typeof(instrumentos) = 'array'),
  -- Tempos do primeiro dia: {prep,desl,lib,atu,ret}: {i, f, na}
  tempos jsonb not null default '{}'::jsonb check (jsonb_typeof(tempos) = 'object'),
  -- Dias seguintes da mesma preventiva: [{data, turno, tempos}]
  dias jsonb not null default '[]'::jsonb check (jsonb_typeof(dias) = 'array'),
  -- {"<item>" | "<item>@<unidade>": {r: "OK"|"NOK"|"NA", obs, med: {<medicao>: número}}}
  respostas jsonb not null default '{}'::jsonb check (jsonb_typeof(respostas) = 'object'),
  -- Ocorrências: [{id, item, unidade, texto}] (as fotos ficam em preventiva_fotos)
  ocorrencias jsonb not null default '[]'::jsonb check (jsonb_typeof(ocorrencias) = 'array'),
  observacoes text check (length(observacoes) <= 8000),
  status public.status_preventiva not null default 'Em andamento',
  motivo text check (length(motivo) <= 4000),
  supervisor_id uuid references public.profiles (id),
  resp_tecnico_id uuid references public.profiles (id),
  lider_id uuid references public.profiles (id),
  gestor_id uuid references public.profiles (id),
  reprog_pedido boolean not null default false,
  reprog_data date,
  reprog_status public.status_reprog,
  reprog_decidido_por uuid references public.profiles (id),
  reprog_decidido_em timestamptz,
  criado_por uuid not null default auth.uid() references public.profiles (id),
  criado_em timestamptz not null default now(),
  versao int not null default 1,
  enviado_por uuid references public.profiles (id),
  enviado_em timestamptz not null default now(),
  constraint prev_nao_realizado_tem_motivo check (status <> 'Não realizado' or length(btrim(coalesce(motivo, ''))) > 0),
  constraint prev_reprog_tem_motivo check (not reprog_pedido or length(btrim(coalesce(motivo, ''))) > 0)
);
create index preventivas_data on public.preventivas (data desc, turno);
create index preventivas_modelo on public.preventivas (modelo_id, data desc);
create index preventivas_reprog_pendente on public.preventivas (reprog_status) where reprog_status = 'pendente';

create table public.preventiva_equipe (
  preventiva_id uuid not null references public.preventivas (id) on delete cascade,
  profile_id uuid not null references public.profiles (id),
  ordem int not null default 0,
  primary key (preventiva_id, profile_id)
);

create table public.preventiva_assinaturas (
  preventiva_id uuid not null references public.preventivas (id) on delete cascade,
  profile_id uuid not null default auth.uid() references public.profiles (id),
  papel public.papel_assinatura not null default 'equipe',
  versao int not null,
  assinado_em timestamptz not null default now(),
  primary key (preventiva_id, profile_id, papel)
);

create table public.preventiva_fotos (
  id uuid primary key default gen_random_uuid(),
  preventiva_id uuid not null references public.preventivas (id) on delete cascade,
  ocorrencia_id text check (length(ocorrencia_id) <= 60),
  storage_path text not null unique,
  legenda text check (length(legenda) <= 300),
  ordem int not null default 0,
  criado_por uuid not null default auth.uid() references public.profiles (id)
);

create table public.preventiva_historico (
  id bigint generated always as identity primary key,
  preventiva_id uuid not null references public.preventivas (id) on delete cascade,
  versao int not null,
  snapshot jsonb not null,
  arquivado_em timestamptz not null default now()
);

-- Documentos das preventivas usam a mesma tabela dos relatórios.
alter table public.documentos
  add column preventiva_id uuid references public.preventivas (id) on delete set null;
alter type public.tipo_documento add value if not exists 'roteiro';

------------------------------------------------------------------------------
-- Funções e gatilhos
------------------------------------------------------------------------------
create or replace function public.pode_editar_preventiva(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.meu_perfil() in ('supervisor', 'admin')
    or exists (select 1 from public.preventivas p where p.id = p_id and p.criado_por = auth.uid())
    or exists (select 1 from public.preventiva_equipe e where e.preventiva_id = p_id and e.profile_id = auth.uid())
$$;
revoke all on function public.pode_editar_preventiva(uuid) from public;
grant execute on function public.pode_editar_preventiva(uuid) to authenticated;

-- Mesmas regras do relatório: cada envio guarda a versão anterior e sobe a versão;
-- só admin decide a reprogramação; a versão do modelo usada fica registrada.
create or replace function public.preventivas_antes_salvar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.versao := 1;
    new.criado_por := auth.uid();
    new.criado_em := now();
    new.enviado_por := auth.uid();
    new.enviado_em := now();
    select m.versao into new.modelo_versao from public.checklist_modelos m where m.id = new.modelo_id;
  else
    new.criado_por := old.criado_por;
    new.criado_em := old.criado_em;
    new.modelo_id := old.modelo_id;
    new.modelo_versao := old.modelo_versao;
    if (to_jsonb(new) - array['reprog_status','reprog_decidido_por','reprog_decidido_em'])
       = (to_jsonb(old) - array['reprog_status','reprog_decidido_por','reprog_decidido_em']) then
      new.versao := old.versao;
      new.enviado_por := old.enviado_por;
      new.enviado_em := old.enviado_em;
    else
      insert into public.preventiva_historico (preventiva_id, versao, snapshot)
        values (old.id, old.versao, to_jsonb(old));
      new.versao := old.versao + 1;
      new.enviado_por := auth.uid();
      new.enviado_em := now();
    end if;
  end if;

  if new.status = 'Concluído' then
    new.reprog_pedido := false;
    new.reprog_data := null;
  end if;

  if public.meu_perfil() is distinct from 'admin' then
    if tg_op = 'INSERT' then
      new.reprog_decidido_por := null;
      new.reprog_decidido_em := null;
      new.reprog_status := case when new.reprog_pedido then 'pendente'::public.status_reprog end;
    else
      new.reprog_decidido_por := old.reprog_decidido_por;
      new.reprog_decidido_em := old.reprog_decidido_em;
      if new.reprog_pedido and not old.reprog_pedido then
        new.reprog_status := 'pendente';
        new.reprog_decidido_por := null;
        new.reprog_decidido_em := null;
      elsif not new.reprog_pedido then
        new.reprog_status := null;
      else
        new.reprog_status := old.reprog_status;
      end if;
    end if;
  elsif new.reprog_status is distinct from (case when tg_op = 'UPDATE' then old.reprog_status end)
        and new.reprog_status in ('aprovado', 'recusado') then
    new.reprog_decidido_por := auth.uid();
    new.reprog_decidido_em := now();
  end if;
  return new;
end;
$$;
create trigger preventivas_antes_salvar
  before insert or update on public.preventivas
  for each row execute function public.preventivas_antes_salvar();

create or replace function public.prev_assinatura_antes_salvar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.profile_id := auth.uid();
  new.assinado_em := now();
  select p.versao into new.versao from public.preventivas p where p.id = new.preventiva_id;
  if new.versao is null then
    raise exception 'Preventiva não encontrada';
  end if;
  if new.papel = 'equipe' and not exists (
    select 1 from public.preventiva_equipe e
    where e.preventiva_id = new.preventiva_id and e.profile_id = auth.uid()
  ) then
    raise exception 'Só quem está na equipe da preventiva pode assinar como equipe';
  end if;
  if new.papel <> 'equipe' and not exists (
    select 1 from public.preventivas p
    where p.id = new.preventiva_id
      and auth.uid() = case new.papel
        when 'resp_tecnico' then p.resp_tecnico_id
        when 'lider' then p.lider_id
        when 'gestor' then p.gestor_id
      end
  ) then
    raise exception 'Você não é o responsável indicado para assinar neste papel';
  end if;
  return new;
end;
$$;
create trigger prev_assinatura_antes_salvar
  before insert or update on public.preventiva_assinaturas
  for each row execute function public.prev_assinatura_antes_salvar();

------------------------------------------------------------------------------
-- RLS
------------------------------------------------------------------------------
alter table public.checklist_modelos enable row level security;
alter table public.preventivas enable row level security;
alter table public.preventiva_equipe enable row level security;
alter table public.preventiva_assinaturas enable row level security;
alter table public.preventiva_fotos enable row level security;
alter table public.preventiva_historico enable row level security;

revoke all on public.checklist_modelos, public.preventivas, public.preventiva_equipe,
  public.preventiva_assinaturas, public.preventiva_fotos, public.preventiva_historico from anon;

-- Modelos: todo usuário ativo lê; só admin cria, altera ou remove.
create policy modelos_select on public.checklist_modelos for select to authenticated
  using (public.meu_perfil() is not null);
create policy modelos_write on public.checklist_modelos for all to authenticated
  using (public.meu_perfil() = 'admin')
  with check (public.meu_perfil() = 'admin');

create policy preventivas_select on public.preventivas for select to authenticated
  using (public.meu_perfil() is not null);
create policy preventivas_insert on public.preventivas for insert to authenticated
  with check (public.meu_perfil() is not null and criado_por = auth.uid());
create policy preventivas_update on public.preventivas for update to authenticated
  using (public.pode_editar_preventiva(id))
  with check (public.pode_editar_preventiva(id));
create policy preventivas_delete on public.preventivas for delete to authenticated
  using (criado_por = auth.uid() or public.meu_perfil() = 'admin');

create policy prev_equipe_select on public.preventiva_equipe for select to authenticated
  using (public.meu_perfil() is not null);
create policy prev_equipe_write on public.preventiva_equipe for all to authenticated
  using (public.pode_editar_preventiva(preventiva_id))
  with check (public.pode_editar_preventiva(preventiva_id));

create policy prev_assin_select on public.preventiva_assinaturas for select to authenticated
  using (public.meu_perfil() is not null);
create policy prev_assin_insert on public.preventiva_assinaturas for insert to authenticated
  with check (profile_id = auth.uid());
create policy prev_assin_update on public.preventiva_assinaturas for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy prev_assin_delete on public.preventiva_assinaturas for delete to authenticated
  using (profile_id = auth.uid());

create policy prev_fotos_select on public.preventiva_fotos for select to authenticated
  using (public.meu_perfil() is not null);
create policy prev_fotos_write on public.preventiva_fotos for all to authenticated
  using (public.pode_editar_preventiva(preventiva_id))
  with check (public.pode_editar_preventiva(preventiva_id));

create policy prev_historico_select on public.preventiva_historico for select to authenticated
  using (public.pode_editar_preventiva(preventiva_id));

-- Permissões das tabelas novas para a API (o 0003 cobre as futuras por default privileges,
-- mas deixamos explícito para quem aplicar as migrações fora de ordem).
grant select, insert, update, delete on public.checklist_modelos, public.preventivas,
  public.preventiva_equipe, public.preventiva_assinaturas, public.preventiva_fotos to authenticated;
grant select on public.preventiva_historico to authenticated;
grant all on public.checklist_modelos, public.preventivas, public.preventiva_equipe,
  public.preventiva_assinaturas, public.preventiva_fotos, public.preventiva_historico to service_role;

------------------------------------------------------------------------------
-- Storage: a assinatura de quem assinou uma preventiva também pode ser lida para o PDF
------------------------------------------------------------------------------
drop policy assin_obj_select on storage.objects;
create policy assin_obj_select on storage.objects for select to authenticated
  using (
    bucket_id = 'assinaturas' and (
      name = auth.uid()::text || '.png'
      or public.meu_perfil() in ('supervisor', 'admin')
      or (public.meu_perfil() is not null and (
        exists (select 1 from public.atividade_assinaturas s where s.profile_id::text || '.png' = name)
        or exists (select 1 from public.preventiva_assinaturas s where s.profile_id::text || '.png' = name)
      ))
    )
  );
