-- Documentos do turno: leitura liberada para qualquer usuário ativo.
-- Antes o técnico só via os PDFs que ele mesmo gerou, e a seção "Relatórios do turno"
-- do PDF da passagem saía incompleta. Escrita, troca e exclusão continuam como antes
-- (só quem gerou, ou admin). Usuário inativo ou sem login continua sem ver nada.

drop policy documentos_select on public.documentos;
create policy documentos_select on public.documentos for select to authenticated
  using (public.meu_perfil() is not null);

-- Mesmo critério para baixar o arquivo do bucket "documentos".
drop policy docs_obj_select on storage.objects;
create policy docs_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and public.meu_perfil() is not null);
