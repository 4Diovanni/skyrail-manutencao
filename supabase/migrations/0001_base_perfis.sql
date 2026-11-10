-- Base: perfis de usuário e RLS.
-- Nenhum dado pessoal real entra por migração ou seed; usuários são criados pelo Supabase Auth.

create type public.perfil as enum ('tecnico', 'supervisor', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text,
  perfil public.perfil not null default 'tecnico',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

-- Função auxiliar: perfil do usuário logado (security definer para não cair em recursão de RLS).
create or replace function public.meu_perfil()
returns public.perfil
language sql
stable
security definer
set search_path = ''
as $$
  select p.perfil from public.profiles p where p.id = auth.uid() and p.ativo
$$;

revoke all on function public.meu_perfil() from public;
grant execute on function public.meu_perfil() to authenticated;

-- Cada um lê o próprio perfil; supervisor e admin leem todos.
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.meu_perfil() in ('supervisor', 'admin'));

-- Usuário pode alterar só o próprio nome; perfil/ativo só admin.
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and perfil = (select p.perfil from public.profiles p where p.id = auth.uid())
    and ativo = (select p.ativo from public.profiles p where p.id = auth.uid())
  );

create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.meu_perfil() = 'admin')
  with check (public.meu_perfil() = 'admin');

-- Nada para anon.
revoke all on public.profiles from anon;

-- Cria o perfil (sempre como técnico) quando um usuário é criado no Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();
