-- Relatório de atividades: perfis com matrícula, catálogos, atividades, equipe,
-- assinaturas aplicadas pela própria pessoa, fotos, histórico de envios e documentos (PDFs).
-- Nenhum dado pessoal entra por migração: pessoas são cadastradas pelo admin.

-- FORCE RLS não traz ganho (o dono das tabelas é o admin do banco) e pode
-- atrapalhar funções security definer; RLS continua ativo para os usuários do app.
alter table public.profiles no force row level security;

------------------------------------------------------------------------------
-- Perfis: matrícula (RE) e troca de senha obrigatória no primeiro acesso
------------------------------------------------------------------------------
alter table public.profiles
  add column matricula text unique check (matricula ~ '^[0-9]{4,12}$'),
  add column deve_trocar_senha boolean not null default true;

-- Colegas precisam ver nome e matrícula para montar a equipe e os documentos.
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.meu_perfil() is not null);

-- Usuário comum não edita o próprio perfil direto (matrícula e perfil são do admin).
drop policy profiles_update_self on public.profiles;

create or replace function public.concluir_troca_senha()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set deve_trocar_senha = false where id = auth.uid();
$$;
revoke all on function public.concluir_troca_senha() from public;
grant execute on function public.concluir_troca_senha() to authenticated;

------------------------------------------------------------------------------
-- Tipos
------------------------------------------------------------------------------
create type public.turno as enum ('Diurno', 'Noturno');
create type public.categoria as enum ('Corretiva', 'Preventiva');
create type public.status_atividade as enum ('Concluída', 'Em andamento', 'Não realizada');
create type public.status_reprog as enum ('pendente', 'aprovado', 'recusado');
create type public.papel_assinatura as enum ('equipe', 'resp_tecnico', 'lider', 'gestor');
create type public.tipo_documento as enum ('relatorio', 'os', 'rm', 'passagem');

------------------------------------------------------------------------------
-- Catálogos (locais e sistemas): leitura para todos, edição por supervisor/admin
------------------------------------------------------------------------------
create table public.catalogo_locais (
  codigo text primary key check (length(codigo) between 1 and 40),
  ordem int not null default 0,
  ativo boolean not null default true
);
create table public.catalogo_sistemas (
  codigo text primary key check (length(codigo) between 1 and 60),
  ordem int not null default 0,
  ativo boolean not null default true
);

insert into public.catalogo_locais (codigo, ordem) values
  ('MOB', 1), ('CZD', 2), ('VCD', 3), ('CBM', 4), ('VJD', 5), ('BPA', 6), ('WAS', 7), ('CGN', 8);
insert into public.catalogo_sistemas (codigo, ordem) values
  ('PSD', 1), ('AMV', 2), ('SSC', 3), ('SCC', 4), ('AARU', 5), ('3º e 4º trilho', 6);

do $$
declare t text;
begin
  foreach t in array array['catalogo_locais', 'catalogo_sistemas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format($p$create policy %1$s_select on public.%1$I for select to authenticated
      using (public.meu_perfil() is not null)$p$, t);
    execute format($p$create policy %1$s_write on public.%1$I for all to authenticated
      using (public.meu_perfil() in ('supervisor', 'admin'))
      with check (public.meu_perfil() in ('supervisor', 'admin'))$p$, t);
  end loop;
end $$;

------------------------------------------------------------------------------
-- Atividades
------------------------------------------------------------------------------
create table public.atividades (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  turno public.turno not null,
  categoria public.categoria not null,
  tipo_prev text check (tipo_prev in ('P0','PQ','P1','P3','P6','P12','P2A','P3A','P5A')),
  ordem numeric not null default 0,
  titulo text not null check (length(btrim(titulo)) between 1 and 300),
  status public.status_atividade not null,
  motivo text check (length(motivo) <= 4000),
  local text check (length(local) <= 200),
  sistema text check (length(sistema) <= 200),
  hora_informe text check (hora_informe ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or hora_informe = 'N/A'),
  equipamento text check (length(equipamento) <= 300),
  sintoma text check (length(sintoma) <= 2000),
  diagnostico text check (length(diagnostico) <= 8000),
  intervencao text check (length(intervencao) <= 8000),
  resultado text check (length(resultado) <= 8000),
  feito text check (length(feito) <= 8000),
  nao_conformidades text check (length(nao_conformidades) <= 4000),
  cim text check (length(cim) <= 60),
  -- {prep,desl,lib,atu,ret}: {i:"HH:MM", f:"HH:MM", na:bool}
  tempos jsonb not null default '{}'::jsonb check (jsonb_typeof(tempos) = 'object'),
  -- Campos da Ordem de Serviço (FO.MNT.S.0003): número digitado, chamado, materiais etc.
  os jsonb not null default '{}'::jsonb check (jsonb_typeof(os) = 'object'),
  -- Campos do Registro de Manutenção (FO.MNT.S.0008): observações etc.
  registro jsonb not null default '{}'::jsonb check (jsonb_typeof(registro) = 'object'),
  -- Responsáveis que assinam nos papéis do documento (além da equipe)
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
  constraint prev_tem_tipo check (categoria <> 'Preventiva' or tipo_prev is not null),
  constraint nao_realizada_tem_motivo check (status <> 'Não realizada' or length(btrim(coalesce(motivo, ''))) > 0),
  constraint reprog_tem_motivo check (not reprog_pedido or length(btrim(coalesce(motivo, ''))) > 0)
);
create index atividades_data_turno on public.atividades (data, turno, categoria);
create index atividades_reprog_pendente on public.atividades (reprog_status) where reprog_status = 'pendente';

create table public.atividade_equipe (
  atividade_id uuid not null references public.atividades (id) on delete cascade,
  profile_id uuid not null references public.profiles (id),
  ordem int not null default 0,
  primary key (atividade_id, profile_id)
);

-- Assinatura aplicada pela própria pessoa, logada, sobre uma versão da atividade.
-- Se a atividade for reenviada (nova versão), a assinatura antiga não vale para o novo PDF.
create table public.atividade_assinaturas (
  atividade_id uuid not null references public.atividades (id) on delete cascade,
  profile_id uuid not null default auth.uid() references public.profiles (id),
  papel public.papel_assinatura not null default 'equipe',
  versao int not null,
  assinado_em timestamptz not null default now(),
  primary key (atividade_id, profile_id, papel)
);

create table public.atividade_fotos (
  id uuid primary key default gen_random_uuid(),
  atividade_id uuid not null references public.atividades (id) on delete cascade,
  storage_path text not null unique,
  legenda text check (length(legenda) <= 300),
  ordem int not null default 0,
  criado_por uuid not null default auth.uid() references public.profiles (id)
);

-- Cada reenvio guarda a versão anterior completa.
create table public.atividade_historico (
  id bigint generated always as identity primary key,
  atividade_id uuid not null references public.atividades (id) on delete cascade,
  versao int not null,
  snapshot jsonb not null,
  arquivado_em timestamptz not null default now()
);

-- PDFs gerados e guardados no Storage (bucket "documentos").
create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  atividade_id uuid references public.atividades (id) on delete set null,
  tipo public.tipo_documento not null,
  categoria public.categoria,
  data date not null,
  turno public.turno not null,
  storage_path text not null unique,
  nome text not null,
  tamanho int,
  gerado_por uuid not null default auth.uid() references public.profiles (id),
  gerado_em timestamptz not null default now()
);
create index documentos_data on public.documentos (data desc, turno);

------------------------------------------------------------------------------
-- Funções auxiliares
------------------------------------------------------------------------------
create or replace function public.pode_editar_atividade(a_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.meu_perfil() in ('supervisor', 'admin')
    or exists (select 1 from public.atividades a where a.id = a_id and a.criado_por = auth.uid())
    or exists (select 1 from public.atividade_equipe e where e.atividade_id = a_id and e.profile_id = auth.uid())
$$;
revoke all on function public.pode_editar_atividade(uuid) from public;
grant execute on function public.pode_editar_atividade(uuid) to authenticated;

-- Cada envio: guarda a versão anterior, incrementa a versão e registra quem enviou.
-- Reprogramação: só admin decide; pedir reprogramação volta o status para "pendente".
create or replace function public.atividades_antes_salvar()
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
  else
    new.criado_por := old.criado_por;
    new.criado_em := old.criado_em;
    -- Decisão de reprogramação pelo admin não é um novo envio do conteúdo.
    if (to_jsonb(new) - array['reprog_status','reprog_decidido_por','reprog_decidido_em'])
       = (to_jsonb(old) - array['reprog_status','reprog_decidido_por','reprog_decidido_em']) then
      new.versao := old.versao;
      new.enviado_por := old.enviado_por;
      new.enviado_em := old.enviado_em;
    else
      insert into public.atividade_historico (atividade_id, versao, snapshot)
        values (old.id, old.versao, to_jsonb(old));
      new.versao := old.versao + 1;
      new.enviado_por := auth.uid();
      new.enviado_em := now();
    end if;
  end if;
  if tg_op = 'INSERT' then
    new.enviado_por := auth.uid();
    new.enviado_em := now();
  end if;

  if new.status = 'Concluída' then
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

create trigger atividades_antes_salvar
  before insert or update on public.atividades
  for each row execute function public.atividades_antes_salvar();

-- A assinatura sempre fica na versão atual da atividade e no nome de quem está logado.
create or replace function public.assinatura_antes_salvar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.profile_id := auth.uid();
  new.assinado_em := now();
  select a.versao into new.versao from public.atividades a where a.id = new.atividade_id;
  if new.versao is null then
    raise exception 'Atividade não encontrada';
  end if;
  if new.papel = 'equipe' and not exists (
    select 1 from public.atividade_equipe e
    where e.atividade_id = new.atividade_id and e.profile_id = auth.uid()
  ) then
    raise exception 'Só quem está na equipe da atividade pode assinar como equipe';
  end if;
  if new.papel <> 'equipe' and not exists (
    select 1 from public.atividades a
    where a.id = new.atividade_id
      and auth.uid() = case new.papel
        when 'resp_tecnico' then a.resp_tecnico_id
        when 'lider' then a.lider_id
        when 'gestor' then a.gestor_id
      end
  ) then
    raise exception 'Você não é o responsável indicado para assinar neste papel';
  end if;
  return new;
end;
$$;

create trigger assinatura_antes_salvar
  before insert or update on public.atividade_assinaturas
  for each row execute function public.assinatura_antes_salvar();

------------------------------------------------------------------------------
-- RLS
------------------------------------------------------------------------------
alter table public.atividades enable row level security;
alter table public.atividade_equipe enable row level security;
alter table public.atividade_assinaturas enable row level security;
alter table public.atividade_fotos enable row level security;
alter table public.atividade_historico enable row level security;
alter table public.documentos enable row level security;

revoke all on public.atividades, public.atividade_equipe, public.atividade_assinaturas,
  public.atividade_fotos, public.atividade_historico, public.documentos from anon;

-- Atividades: toda a equipe ativa lê (a passagem de turno precisa de tudo);
-- edita quem criou, quem está na equipe, supervisor e admin.
create policy atividades_select on public.atividades for select to authenticated
  using (public.meu_perfil() is not null);
create policy atividades_insert on public.atividades for insert to authenticated
  with check (public.meu_perfil() is not null and criado_por = auth.uid());
create policy atividades_update on public.atividades for update to authenticated
  using (public.pode_editar_atividade(id))
  with check (public.pode_editar_atividade(id));
create policy atividades_delete on public.atividades for delete to authenticated
  using (criado_por = auth.uid() or public.meu_perfil() = 'admin');

create policy equipe_select on public.atividade_equipe for select to authenticated
  using (public.meu_perfil() is not null);
create policy equipe_write on public.atividade_equipe for all to authenticated
  using (public.pode_editar_atividade(atividade_id))
  with check (public.pode_editar_atividade(atividade_id));

-- Assinaturas: cada um só cria ou remove a própria.
create policy assinaturas_select on public.atividade_assinaturas for select to authenticated
  using (public.meu_perfil() is not null);
create policy assinaturas_insert on public.atividade_assinaturas for insert to authenticated
  with check (profile_id = auth.uid());
create policy assinaturas_update on public.atividade_assinaturas for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy assinaturas_delete on public.atividade_assinaturas for delete to authenticated
  using (profile_id = auth.uid());

create policy fotos_select on public.atividade_fotos for select to authenticated
  using (public.meu_perfil() is not null);
create policy fotos_write on public.atividade_fotos for all to authenticated
  using (public.pode_editar_atividade(atividade_id))
  with check (public.pode_editar_atividade(atividade_id));

create policy historico_select on public.atividade_historico for select to authenticated
  using (public.pode_editar_atividade(atividade_id));

-- Documentos: supervisor/admin veem todos; o técnico vê os que gerou.
create policy documentos_select on public.documentos for select to authenticated
  using (gerado_por = auth.uid() or public.meu_perfil() in ('supervisor', 'admin'));
create policy documentos_insert on public.documentos for insert to authenticated
  with check (public.meu_perfil() is not null and gerado_por = auth.uid());
create policy documentos_update on public.documentos for update to authenticated
  using (gerado_por = auth.uid() or public.meu_perfil() = 'admin')
  with check (gerado_por = auth.uid() or public.meu_perfil() = 'admin');
create policy documentos_delete on public.documentos for delete to authenticated
  using (public.meu_perfil() = 'admin');

------------------------------------------------------------------------------
-- Storage: buckets privados
------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('fotos', 'fotos', false, 2097152, array['image/jpeg']),
  ('assinaturas', 'assinaturas', false, 524288, array['image/png']),
  ('documentos', 'documentos', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;

-- Fotos: caminho "<atividade_id>/<arquivo>.jpg"
create policy fotos_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and public.meu_perfil() is not null);
create policy fotos_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and public.meu_perfil() is not null);
create policy fotos_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and (owner = auth.uid() or public.meu_perfil() = 'admin'));

-- Assinaturas: caminho "<user_id>.png". Só o dono envia, troca ou apaga a própria.
-- Leitura: o dono, supervisor/admin, ou qualquer usuário ativo se a pessoa já assinou
-- alguma atividade (necessário para montar o PDF).
create policy assin_obj_select on storage.objects for select to authenticated
  using (
    bucket_id = 'assinaturas' and (
      name = auth.uid()::text || '.png'
      or public.meu_perfil() in ('supervisor', 'admin')
      or (public.meu_perfil() is not null and exists (
        select 1 from public.atividade_assinaturas s
        where s.profile_id::text || '.png' = name
      ))
    )
  );
create policy assin_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'assinaturas' and name = auth.uid()::text || '.png');
create policy assin_obj_update on storage.objects for update to authenticated
  using (bucket_id = 'assinaturas' and name = auth.uid()::text || '.png')
  with check (bucket_id = 'assinaturas' and name = auth.uid()::text || '.png');
create policy assin_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'assinaturas' and name = auth.uid()::text || '.png');

-- Documentos: "<categoria>/<data> <dia>/<turno>/<tipo>/<arquivo>.pdf"
create policy docs_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and (owner = auth.uid() or public.meu_perfil() in ('supervisor', 'admin')));
create policy docs_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and public.meu_perfil() is not null);
create policy docs_obj_update on storage.objects for update to authenticated
  using (bucket_id = 'documentos' and (owner = auth.uid() or public.meu_perfil() = 'admin'))
  with check (bucket_id = 'documentos' and (owner = auth.uid() or public.meu_perfil() = 'admin'));
create policy docs_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documentos' and public.meu_perfil() = 'admin');
