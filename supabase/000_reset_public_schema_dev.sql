-- QR Quest: RESET DE DESARROLLO.
-- ADVERTENCIA: este script borra todos los objetos del schema public.
-- Usalo solo en una base de pruebas o despues de hacer backup.
--
-- Orden para una base existente que quieres dejar limpia:
-- 1. supabase/000_reset_public_schema_dev.sql
-- 2. supabase/001_schema.sql
-- 3. supabase/002_rls_security.sql

drop schema if exists public cascade;

create schema public;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;

alter default privileges in schema public
  grant all on tables to postgres, service_role;

alter default privileges in schema public
  grant all on functions to postgres, service_role;

alter default privileges in schema public
  grant all on sequences to postgres, service_role;

comment on schema public is 'Standard public schema reset for QR Quest development.';
