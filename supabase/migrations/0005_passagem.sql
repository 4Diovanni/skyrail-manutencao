-- Passagem de turno (FO.MNT.S.0009).
-- Uma passagem por dia e turno, compartilhada pela equipe do turno. As atividades, preventivas
-- e reprogramações do turno NÃO ficam aqui: a tela e o PDF consultam as tabelas delas.
-- Aqui fica só o que a equipe escreve: condição operacional, ocorrências por prioridade,
-- preventivas programadas e encerramento. Cada envio guarda a versão anterior no histórico.

create table public.passagens (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  turno public.turno not null,
  intro text check (length(intro) <= 2000),
  -- [{i: indicador, c: condição registrada}]
  condicoes jsonb not null default '[]'::jsonb check (jsonb_typeof(condicoes) = 'array'),
  -- [{l: local e equipamento, d: descrição}] por prioridade
  alta jsonb not null default '[]'::jsonb check (jsonb_typeof(alta) = 'array'),
  media jsonb not null default '[]'::jsonb check (jsonb_typeof(media) = 'array'),
  baixa jsonb not null default '[]'::jsonb check (jsonb_typeof(baixa) = 'array'),
  -- [{nome, tipo, local}]: preventivas previstas para o turno, conferidas com as enviadas
  programadas jsonb not null default '[]'::jsonb check (jsonb_typeof(programadas) = 'array'),
  encerramento text check (length(encerramento) <= 8000),
  criado_por uuid not null default auth.uid() references public.profiles (id),
  criado_em timestamptz not null default now(),
  versao int not null default 1,
  enviado_por uuid references public.profiles (id),
  enviado_em timestamptz not null default now(),
  constraint passagem_unica unique (data, turno),
  constraint passagem_tamanho check (pg_column_size(condicoes) + pg_column_size(alta) + pg_column_size(media)
    + pg_column_size(baixa) + pg_column_size(programadas) < 200000)
);

create table public.passagem_historico (
  id bigint generated always as identity primary key,
  passagem_id uuid not null references public.passagens (id) on delete cascade,
  versao int not null,
  snapshot jsonb not null,
  arquivado_em timestamptz not null default now()
);
create index passagem_historico_passagem on public.passagem_historico (passagem_id, versao desc);

alter table public.documentos
  add column passagem_id uuid references public.passagens (id) on delete set null;

-- Cada envio: guarda a versão anterior, incrementa a versão e registra quem enviou.
-- Dia e turno não mudam depois de criada (é a chave da passagem).
create or replace function public.passagens_antes_salvar()
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
    return new;
  end if;
  new.data := old.data;
  new.turno := old.turno;
  new.criado_por := old.criado_por;
  new.criado_em := old.criado_em;
  if (to_jsonb(new) - array['versao','enviado_por','enviado_em'])
     = (to_jsonb(old) - array['versao','enviado_por','enviado_em']) then
    new.versao := old.versao;
    new.enviado_por := old.enviado_por;
    new.enviado_em := old.enviado_em;
  else
    insert into public.passagem_historico (passagem_id, versao, snapshot)
      values (old.id, old.versao, to_jsonb(old));
    new.versao := old.versao + 1;
    new.enviado_por := auth.uid();
    new.enviado_em := now();
  end if;
  return new;
end;
$$;

create trigger passagens_antes_salvar
  before insert or update on public.passagens
  for each row execute function public.passagens_antes_salvar();

------------------------------------------------------------------------------
-- RLS: a passagem é do turno, então todo usuário ativo lê e escreve.
-- Só o admin apaga. O histórico é só leitura (o gatilho escreve como definer).
------------------------------------------------------------------------------
alter table public.passagens enable row level security;
alter table public.passagem_historico enable row level security;
revoke all on public.passagens, public.passagem_historico from anon;

create policy passagens_select on public.passagens for select to authenticated
  using (public.meu_perfil() is not null);
create policy passagens_insert on public.passagens for insert to authenticated
  with check (public.meu_perfil() is not null);
create policy passagens_update on public.passagens for update to authenticated
  using (public.meu_perfil() is not null)
  with check (public.meu_perfil() is not null);
create policy passagens_delete on public.passagens for delete to authenticated
  using (public.meu_perfil() = 'admin');

create policy passagem_historico_select on public.passagem_historico for select to authenticated
  using (public.meu_perfil() is not null);

grant select, insert, update, delete on public.passagens to authenticated;
grant select on public.passagem_historico to authenticated;
revoke insert, update, delete on public.passagem_historico from authenticated;
grant all on public.passagens, public.passagem_historico to service_role;
