-- Projetos novos do Supabase não liberam automaticamente as tabelas criadas por SQL
-- para os papéis da API. Sem estes grants, o service_role (criar-usuario) e o app
-- logado recebem "permission denied". O RLS continua decidindo o que cada pessoa vê.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;

alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema public grant execute on functions to authenticated, service_role;

-- anon nunca lê dados do app: reforça o que as migrações anteriores já revogaram.
revoke all on all tables in schema public from anon;
