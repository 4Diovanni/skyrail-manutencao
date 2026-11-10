-- Testes de RLS dos documentos (PDFs). Rode com: npm run test:db (precisa de Postgres local).
\set ON_ERROR_STOP 1

create function pg_temp.deve_falhar(sql text, rotulo text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then raise notice 'OK (bloqueado): %', rotulo; return; end;
  raise exception 'FALHOU: deveria ter sido bloqueado: %', rotulo;
end $$;
create function pg_temp.confere(cond boolean, rotulo text) returns void language plpgsql as $$
begin if cond then raise notice 'OK: %', rotulo; else raise exception 'FALHOU: %', rotulo; end if; end $$;
grant execute on all functions in schema pg_temp to authenticated;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000031'), ('00000000-0000-0000-0000-000000000032'),
  ('00000000-0000-0000-0000-000000000033'), ('00000000-0000-0000-0000-00000000003a');
update public.profiles set perfil = 'admin' where id = '00000000-0000-0000-0000-00000000003a';
update public.profiles set ativo = false where id = '00000000-0000-0000-0000-000000000033';

set role authenticated;

-- Técnico 31 gera um documento do turno.
set request.jwt.sub = '00000000-0000-0000-0000-000000000031';
insert into storage.objects (bucket_id, name) values ('documentos', 'Corretiva/2026-11-10 ter/Noturno/relatorio/teste.pdf');
insert into public.documentos (id, tipo, categoria, data, turno, storage_path, nome)
  values ('33333333-3333-3333-3333-333333333333', 'relatorio', 'Corretiva', '2026-11-10', 'Noturno',
          'Corretiva/2026-11-10 ter/Noturno/relatorio/teste.pdf', 'teste.pdf');

-- Outro técnico ativo do mesmo turno enxerga (seção 7 do PDF da passagem).
set request.jwt.sub = '00000000-0000-0000-0000-000000000032';
select pg_temp.confere((select count(*) = 1 from public.documentos), 'outro técnico ativo lê os documentos do turno');
select pg_temp.confere((select count(*) = 1 from storage.objects where bucket_id = 'documentos'), 'outro técnico ativo baixa o PDF do bucket');
update public.documentos set nome = 'trocado.pdf';
select pg_temp.confere((select nome = 'teste.pdf' from public.documentos), 'outro técnico não altera documento alheio');
delete from public.documentos;
select pg_temp.confere((select count(*) = 1 from public.documentos), 'técnico não apaga documento');
update storage.objects set name = 'trocado.pdf' where bucket_id = 'documentos';
delete from storage.objects where bucket_id = 'documentos';
select pg_temp.confere((select count(*) = 1 and bool_and(name like '%teste.pdf') from storage.objects where bucket_id = 'documentos'),
  'outro técnico não troca nem apaga o arquivo alheio');
select pg_temp.deve_falhar($$insert into public.documentos (tipo, data, turno, storage_path, nome, gerado_por)
  values ('relatorio', '2026-11-10', 'Noturno', 'x.pdf', 'x.pdf', '00000000-0000-0000-0000-000000000031')$$,
  'não registra documento em nome de outra pessoa');

-- Usuário inativo e sem login não veem nada.
set request.jwt.sub = '00000000-0000-0000-0000-000000000033';
select pg_temp.confere((select count(*) = 0 from public.documentos), 'usuário inativo não lê documentos');
select pg_temp.confere((select count(*) = 0 from storage.objects where bucket_id = 'documentos'), 'usuário inativo não baixa PDF');
set request.jwt.sub = '';
select pg_temp.confere((select count(*) = 0 from public.documentos), 'sem login não lê documentos');
select pg_temp.confere((select count(*) = 0 from storage.objects where bucket_id = 'documentos'), 'sem login não baixa PDF');
reset role;

set role anon;
select pg_temp.deve_falhar($$select 1 from public.documentos$$, 'anon não acessa a tabela');
reset role;

set role authenticated;
set request.jwt.sub = '00000000-0000-0000-0000-00000000003a';
delete from public.documentos where id = '33333333-3333-3333-3333-333333333333';
select pg_temp.confere((select count(*) = 0 from public.documentos), 'admin apaga documento');
reset role;
\echo 'Todos os testes de RLS dos documentos passaram.'
