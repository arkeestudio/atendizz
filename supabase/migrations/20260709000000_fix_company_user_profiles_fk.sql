-- Fix: o embed `profiles(nome,email)` em company_user retornava 400 (PGRST200
-- "Could not find a relationship between 'company_user' and 'profiles'") porque
-- company_user.user_id não tinha foreign key. profiles.user_id é PK.
-- Sem a FK, o PostgREST não consegue inferir a relação e o embed falha.
--
-- Telas afetadas (nome/e-mail do responsável ficava vazio + 400 no console):
-- Conversas, CRM, Contatos, Relatórios.
--
-- Seguro: o convite de equipe (inviteMember) sempre garante a linha em profiles
-- ANTES de inserir em company_user, então não há linhas órfãs.

ALTER TABLE public.company_user
  ADD CONSTRAINT company_user_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
