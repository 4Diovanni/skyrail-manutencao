-- Testes de RLS e regras do Relatório. Rode com: npm run test:db (precisa de Postgres local).
-- Cada bloco falha (e o script para) se a regra não se comportar como esperado.
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
  ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002'), ('00000000-0000-0000-0000-00000000000a');
update public.profiles set perfil = 'admin' where id = '00000000-0000-0000-0000-00000000000a';

set role authenticated;

set request.jwt.sub = '';
select pg_temp.confere((select count(*) from public.profiles) = 0, 'sem login não vê perfis');

set request.jwt.sub = '00000000-0000-0000-0000-000000000001';
insert into public.atividades (id, data, turno, categoria, titulo, status)
  values ('11111111-1111-1111-1111-111111111111', '2026-11-10', 'Noturno', 'Corretiva', 'Falha teste', 'Concluída');
select pg_temp.confere((select versao = 1 and criado_por = auth.uid() from public.atividades), 'insert registra autor e versão 1');
select pg_temp.deve_falhar($$insert into public.atividades (data, turno, categoria, titulo, status) values ('2026-11-10','Noturno','Corretiva','x','Não realizada')$$, 'Não realizada sem motivo');
update public.profiles set perfil = 'admin' where id = auth.uid();
select pg_temp.confere((select perfil = 'tecnico' from public.profiles where id = auth.uid()), 'técnico não se promove a admin');
update public.atividades set status = 'Em andamento', motivo = 'sem CCO', reprog_pedido = true, reprog_status = 'aprovado'
  where id = '11111111-1111-1111-1111-111111111111';
select pg_temp.confere((select reprog_status = 'pendente' and versao = 2 from public.atividades), 'técnico não aprova a própria reprogramação; envio vira versão 2');
select pg_temp.deve_falhar($$insert into public.atividade_assinaturas (atividade_id) values ('11111111-1111-1111-1111-111111111111')$$, 'assinar sem estar na equipe');
insert into public.atividade_equipe (atividade_id, profile_id) values ('11111111-1111-1111-1111-111111111111', auth.uid());
insert into public.atividade_assinaturas (atividade_id) values ('11111111-1111-1111-1111-111111111111');
select pg_temp.deve_falhar($$insert into public.atividade_assinaturas (atividade_id, profile_id, papel) values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000002','gestor')$$, 'assinar como gestor sem ser o gestor indicado');
select pg_temp.confere((select count(*) = 1 and bool_and(profile_id = auth.uid()) from public.atividade_assinaturas), 'só a própria assinatura foi registrada');

set request.jwt.sub = '00000000-0000-0000-0000-000000000002';
update public.atividades set titulo = 'hack' where id = '11111111-1111-1111-1111-111111111111';
delete from public.atividades;
select pg_temp.confere((select titulo = 'Falha teste' from public.atividades), 'outro técnico fora da equipe não altera nem apaga');
select pg_temp.confere((select count(*) = 0 from public.atividade_historico), 'outro técnico não vê histórico');
select pg_temp.deve_falhar($$insert into storage.objects (bucket_id, name) values ('assinaturas', '00000000-0000-0000-0000-000000000001.png')$$, 'subir assinatura no nome de outra pessoa');

set request.jwt.sub = '00000000-0000-0000-0000-00000000000a';
update public.atividades set reprog_status = 'aprovado' where id = '11111111-1111-1111-1111-111111111111';
select pg_temp.confere((select reprog_status = 'aprovado' and reprog_decidido_por = auth.uid() and versao = 2 from public.atividades), 'admin aprova sem criar nova versão');

reset role;
select pg_temp.confere((select array_agg(versao) = '{1}' from public.atividade_historico), 'versão anterior guardada no histórico');
\echo 'Todos os testes de RLS passaram.'
