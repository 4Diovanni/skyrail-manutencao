-- Testes de RLS e regras das Preventivas. Rode com: npm run test:db (precisa de Postgres local).
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
  ('00000000-0000-0000-0000-000000000011'), ('00000000-0000-0000-0000-000000000012'), ('00000000-0000-0000-0000-00000000001a');
update public.profiles set perfil = 'admin' where id = '00000000-0000-0000-0000-00000000001a';

-- Modelo de exemplo (fictício)
insert into public.checklist_modelos (id, sistema, sistema_nome, codigo, tipo_prev, periodicidade, conteudo)
  values ('teste-p1', 'teste', 'Teste', 'P1', 'P1', 'Mensal',
    '{"titulo":"PREVENTIVA TESTE","grupos":[{"titulo":"G","escopo":"geral","itens":["1.1"]}],"itens":[{"id":"1.1","atividade":"Verificar"}]}');

set role authenticated;

set request.jwt.sub = '';
select pg_temp.confere((select count(*) from public.checklist_modelos) = 0, 'sem login não vê modelos');

set request.jwt.sub = '00000000-0000-0000-0000-000000000011';
select pg_temp.confere((select count(*) from public.checklist_modelos) = 1, 'técnico lê os modelos');
update public.checklist_modelos set ativo = false;
select pg_temp.confere((select ativo from public.checklist_modelos where id = 'teste-p1'), 'técnico não altera modelo');
select pg_temp.deve_falhar($$insert into public.checklist_modelos (id, sistema, sistema_nome, codigo, tipo_prev, periodicidade, conteudo) values ('x-p1','x','X','P1','P1','Mensal','{"grupos":[],"itens":[]}')$$, 'técnico cria modelo');

insert into public.preventivas (id, modelo_id, data, turno, local, respostas)
  values ('22222222-2222-2222-2222-222222222222', 'teste-p1', '2026-11-10', 'Noturno', 'BPA', '{"1.1":{"r":"OK"}}');
select pg_temp.confere((select versao = 1 and modelo_versao = 1 and criado_por = auth.uid() from public.preventivas), 'insert registra autor, versão 1 e versão do modelo');
select pg_temp.deve_falhar($$insert into public.preventivas (modelo_id, data, turno, status) values ('teste-p1','2026-11-10','Noturno','Não realizado')$$, 'Não realizado sem motivo');
select pg_temp.deve_falhar($$insert into public.preventivas (modelo_id, data, turno, respostas) values ('teste-p1','2026-11-10','Noturno','[]')$$, 'respostas fora do formato');
update public.preventivas set status = 'Em andamento', motivo = 'sem liberação', reprog_pedido = true, reprog_status = 'aprovado', modelo_id = 'outro'
  where id = '22222222-2222-2222-2222-222222222222';
select pg_temp.confere((select reprog_status = 'pendente' and versao = 2 and modelo_id = 'teste-p1' from public.preventivas), 'técnico não aprova a própria reprogramação nem troca o modelo; envio vira versão 2');
select pg_temp.deve_falhar($$insert into public.preventiva_assinaturas (preventiva_id) values ('22222222-2222-2222-2222-222222222222')$$, 'assinar sem estar na equipe');
insert into public.preventiva_equipe (preventiva_id, profile_id) values ('22222222-2222-2222-2222-222222222222', auth.uid());
insert into public.preventiva_assinaturas (preventiva_id) values ('22222222-2222-2222-2222-222222222222');
select pg_temp.confere((select versao = 2 and profile_id = auth.uid() from public.preventiva_assinaturas), 'assinatura na versão atual e no nome de quem está logado');
select pg_temp.deve_falhar($$insert into public.preventiva_assinaturas (preventiva_id, papel) values ('22222222-2222-2222-2222-222222222222','gestor')$$, 'assinar como gestor sem ser o indicado');

set request.jwt.sub = '00000000-0000-0000-0000-000000000012';
update public.preventivas set local = 'hack';
delete from public.preventivas;
select pg_temp.confere((select local = 'BPA' from public.preventivas), 'técnico fora da equipe não altera nem apaga');
select pg_temp.confere((select count(*) = 0 from public.preventiva_historico), 'técnico fora da equipe não vê histórico');
select pg_temp.deve_falhar($$insert into public.preventiva_fotos (preventiva_id, storage_path) values ('22222222-2222-2222-2222-222222222222','p/x.jpg')$$, 'foto em preventiva de outra equipe');

set request.jwt.sub = '00000000-0000-0000-0000-00000000001a';
update public.preventivas set reprog_status = 'aprovado';
select pg_temp.confere((select reprog_status = 'aprovado' and reprog_decidido_por = auth.uid() and versao = 2 from public.preventivas), 'admin aprova sem criar nova versão');
update public.checklist_modelos set conteudo = jsonb_set(conteudo, '{titulo}', '"NOVO"');
select pg_temp.confere((select versao = 2 from public.checklist_modelos where id = 'teste-p1'), 'admin edita modelo e a versão sobe');

reset role;
select pg_temp.confere((select array_agg(versao) = '{1}' from public.preventiva_historico), 'versão anterior guardada no histórico');
\echo 'Todos os testes de RLS das preventivas passaram.'
