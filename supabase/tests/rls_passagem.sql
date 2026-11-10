-- Testes de RLS e regras da Passagem de turno. Rode com: npm run test:db (precisa de Postgres local).
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
  ('00000000-0000-0000-0000-000000000021'), ('00000000-0000-0000-0000-000000000022'),
  ('00000000-0000-0000-0000-000000000023'), ('00000000-0000-0000-0000-00000000002a');
update public.profiles set perfil = 'admin' where id = '00000000-0000-0000-0000-00000000002a';
update public.profiles set ativo = false where id = '00000000-0000-0000-0000-000000000023';

set role authenticated;

set request.jwt.sub = '';
select pg_temp.deve_falhar($$insert into public.passagens (data, turno) values ('2026-11-10','Noturno')$$, 'sem login não cria passagem');

set request.jwt.sub = '00000000-0000-0000-0000-000000000023';
select pg_temp.deve_falhar($$insert into public.passagens (data, turno) values ('2026-11-10','Noturno')$$, 'usuário inativo não cria passagem');

set request.jwt.sub = '00000000-0000-0000-0000-000000000021';
insert into public.passagens (id, data, turno, alta, criado_por, versao)
  values ('22222222-2222-2222-2222-222222222222', '2026-11-10', 'Noturno', '[{"l":"VJD PSD","d":"porta travada"}]',
          '00000000-0000-0000-0000-000000000022', 9);
select pg_temp.confere((select versao = 1 and criado_por = auth.uid() and enviado_por = auth.uid() from public.passagens),
  'insert registra autor real e versão 1, ignorando o que o app manda');
select pg_temp.deve_falhar($$insert into public.passagens (data, turno) values ('2026-11-10','Noturno')$$, 'só uma passagem por dia e turno');
select pg_temp.deve_falhar($$insert into public.passagens (data, turno, alta) values ('2026-11-11','Noturno','{}')$$, 'ocorrências precisam ser lista');

-- Outro técnico ativo do turno continua a passagem.
set request.jwt.sub = '00000000-0000-0000-0000-000000000022';
update public.passagens set encerramento = 'Turno entregue sem pendências críticas', data = '2026-01-01'
  where id = '22222222-2222-2222-2222-222222222222';
select pg_temp.confere((select versao = 2 and enviado_por = auth.uid() and data = '2026-11-10'
  and criado_por = '00000000-0000-0000-0000-000000000021' from public.passagens),
  'outro técnico edita; versão 2; dia e autor não mudam');
update public.passagens set encerramento = encerramento where id = '22222222-2222-2222-2222-222222222222';
select pg_temp.confere((select versao = 2 from public.passagens), 'salvar sem mudança não cria versão');
select pg_temp.confere((select count(*) = 1 and bool_and(versao = 1) from public.passagem_historico), 'versão anterior vai para o histórico');
select pg_temp.deve_falhar($$insert into public.passagem_historico (passagem_id, versao, snapshot) values ('22222222-2222-2222-2222-222222222222', 7, '{}')$$, 'ninguém escreve no histórico direto');
delete from public.passagens;
select pg_temp.confere((select count(*) = 1 from public.passagens), 'técnico não apaga passagem');

set request.jwt.sub = '00000000-0000-0000-0000-000000000023';
select pg_temp.confere((select count(*) = 0 from public.passagens), 'usuário inativo não lê passagens');

set request.jwt.sub = '00000000-0000-0000-0000-00000000002a';
delete from public.passagens where id = '22222222-2222-2222-2222-222222222222';
select pg_temp.confere((select count(*) = 0 from public.passagens), 'admin apaga passagem');

reset role;
\echo 'Todos os testes de RLS da passagem passaram.'
