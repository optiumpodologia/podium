-- ============================================================
-- Podium · Funciones helper de permisos (RLS)
-- Proyecto Supabase: agenda
-- Actualizado: 2026-05-28
--
-- Estas 6 funciones se usan dentro de las políticas RLS para
-- decidir qué puede ver/hacer cada usuario según su rol y negocio.
-- Todas son SECURITY DEFINER con search_path fijado (buena práctica
-- de seguridad para funciones con permisos elevados).
-- ============================================================

CREATE OR REPLACE FUNCTION public.es_super_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $function$
  select coalesce(rol = 'super_admin', false) from public.usuarios where id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.es_admin_consultorio()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $function$
  select coalesce(rol = 'admin_consultorio', false) from public.usuarios where id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.es_admin_o_recepcion()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $function$
  select coalesce(rol in ('admin_consultorio', 'recepcion'), false) from public.usuarios where id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.obtener_negocio_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $function$
  select negocio_id from public.usuarios where id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.obtener_profesional_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $function$
  select id from public.profesionales where usuario_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.obtener_rol()
  RETURNS text
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $function$
  select rol from public.usuarios where id = auth.uid();
$function$;
