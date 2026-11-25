-- Testes de RLS do aceite da política de uso. Rode com: npm run test:db (precisa de Postgres local).
\set ON_ERROR_STOP 1

create function pg_temp.deve_falhar(sql text, rotulo text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then raise notice 'OK (bloqueado): %', rotulo; return; end;
  raise exception 'FALHOU: deveria ter sido bloqueado: %', rotulo;
end $$;
create function pg_temp.confere(cond boolean, rotulo text) returns void language plpgsql as $$
begin if cond then raise notice 'OK: %', rotulo; else raise exception 'FALHOU: %', rotulo; end if; end $$;
grant execute on all functions in schema pg_temp to authenticated, anon;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000041'), ('00000000-0000-0000-0000-000000000042'),
  ('00000000-0000-0000-0000-000000000043'), ('00000000-0000-0000-0000-00000000004b'),
  ('00000000-0000-0000-0000-00000000004a');
update public.profiles set perfil = 'supervisor' where id = '00000000-0000-0000-0000-00000000004b';
update public.profiles set perfil = 'admin' where id = '00000000-0000-0000-0000-00000000004a';
update public.profiles set ativo = false where id = '00000000-0000-0000-0000-000000000043';

set role authenticated;

-- Técnico 41 aceita a versão 1; a data enviada pelo aparelho é ignorada.
set request.jwt.sub = '00000000-0000-0000-0000-000000000041';
insert into public.aceites_politica (versao, aceito_em) values ('1', '2000-01-01');
select pg_temp.confere((select count(*) = 1 and bool_and(user_id = '00000000-0000-0000-0000-000000000041')
  from public.aceites_politica), 'técnico grava e lê o próprio aceite');
select pg_temp.confere((select aceito_em > '2020-01-01' from public.aceites_politica), 'data e hora vêm do servidor');
select pg_temp.deve_falhar($$insert into public.aceites_politica (versao) values ('1')$$, 'não grava a mesma versão duas vezes');
select pg_temp.deve_falhar($$insert into public.aceites_politica (user_id, versao)
  values ('00000000-0000-0000-0000-000000000042', '1')$$, 'não grava aceite em nome de outra pessoa');
select pg_temp.deve_falhar($$update public.aceites_politica set versao = '2'$$, 'não altera o aceite');
select pg_temp.deve_falhar($$delete from public.aceites_politica$$, 'não apaga o aceite');

-- Outro técnico não vê o aceite do 41.
set request.jwt.sub = '00000000-0000-0000-0000-000000000042';
select pg_temp.confere((select count(*) = 0 from public.aceites_politica), 'técnico não lê aceite de outra pessoa');

-- Usuário inativo não grava.
set request.jwt.sub = '00000000-0000-0000-0000-000000000043';
select pg_temp.deve_falhar($$insert into public.aceites_politica (versao) values ('1')$$, 'usuário inativo não grava aceite');

-- Supervisor e admin leem todos, mas também não alteram nem apagam.
set request.jwt.sub = '00000000-0000-0000-0000-00000000004b';
select pg_temp.confere((select count(*) = 1 from public.aceites_politica), 'supervisor lê os aceites');
set request.jwt.sub = '00000000-0000-0000-0000-00000000004a';
select pg_temp.confere((select count(*) = 1 from public.aceites_politica), 'admin lê os aceites');
select pg_temp.deve_falhar($$delete from public.aceites_politica$$, 'admin não apaga aceite pelo app');

set request.jwt.sub = '';
select pg_temp.confere((select count(*) = 0 from public.aceites_politica), 'sem login não lê aceites');
reset role;

set role anon;
select pg_temp.deve_falhar($$select 1 from public.aceites_politica$$, 'anon não acessa a tabela');
reset role;
\echo 'Todos os testes de RLS do aceite da política passaram.'
