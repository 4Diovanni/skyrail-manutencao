-- Aceite da política de uso (Anexo I, item 2c).
-- Cada linha registra que a pessoa aceitou uma versão do texto: quem, quando e qual versão.
-- O registro não se altera nem se apaga pelo app; quando o texto muda, a versão nova pede um aceite novo.

create table public.aceites_politica (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  versao text not null check (length(versao) between 1 and 40),
  aceito_em timestamptz not null default now(),
  unique (user_id, versao)
);

alter table public.aceites_politica enable row level security;
alter table public.aceites_politica force row level security;

-- Cada um lê os próprios aceites; supervisor e admin leem todos.
create policy aceites_select on public.aceites_politica for select to authenticated
  using (user_id = auth.uid() or public.meu_perfil() in ('supervisor', 'admin'));

-- Só grava o próprio aceite, com usuário ativo e com a data do servidor.
create policy aceites_insert on public.aceites_politica for insert to authenticated
  with check (user_id = auth.uid() and public.meu_perfil() is not null);

-- Data e hora sempre do servidor: o aparelho não escolhe quando aceitou.
create or replace function public.aceite_data_servidor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.aceito_em = now();
  return new;
end;
$$;

create trigger aceites_data_servidor
  before insert on public.aceites_politica
  for each row execute function public.aceite_data_servidor();

-- Sem update nem delete: nenhuma policy libera, e os privilégios também são retirados.
revoke all on public.aceites_politica from anon;
revoke update, delete on public.aceites_politica from authenticated;
grant select, insert on public.aceites_politica to authenticated;
grant all on public.aceites_politica to service_role;
