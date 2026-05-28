-- ============================================================
-- Podium · Funciones helper de permisos (RLS)
-- Proyecto Supabase: agenda
-- Generado: 2026-05-28
--
-- Estas 6 funciones se usan dentro de las políticas RLS para
-- decidir qué puede ver/hacer cada usuario según su rol y negocio.
-- Todas son SECURITY DEFINER (corren con permisos elevados).
-- ============================================================


-- ============================================================
-- SECCIÓN 1 · VERSIÓN ACTUAL (tal como está hoy en producción)
-- ============================================================
-- ⚠️ NOTA DE SEGURIDAD: ninguna de estas funciones fija search_path.
-- En funciones SECURITY DEFINER eso es una vulnerabilidad conocida.
-- La versión corregida está en la SECCIÓN 2, más abajo.
-- ============================================================

CREATE OR REPLACE FUNCTION public.es_super_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
AS $function$
  select coalesce(rol = 'super_admin', false) from public.usuarios where id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.es_admin_consultorio()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
AS $function$
  select coalesce(rol = 'admin_consultorio', false) from public.usuarios where id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.es_admin_o_recepcion()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
AS $function$
  select coalesce(rol in ('admin_consultorio', 'recepcion'), false) from public.usuarios where id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.obtener_negocio_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE SECURITY DEFINER
AS $function$
  select negocio_id from public.usuarios where id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.obtener_profesional_id()
  RETURNS uuid
  LANGUAGE sql
  SECURITY DEFINER
AS $function$
  select id from public.profesionales where usuario_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.obtener_rol()
  RETURNS text
  LANGUAGE sql
  SECURITY DEFINER
AS $function$
  select rol from public.usuarios where id = auth.uid();
$function$;


-- ============================================================
-- SECCIÓN 2 · VERSIÓN MEJORADA (recomendada, NO aplicada todavía)
-- ============================================================
-- Cambios respecto a la versión actual:
--   1) Se agrega "SET search_path = public, pg_temp" → cierra el
--      agujero de seguridad de las funciones SECURITY DEFINER.
--   2) Se agrega STABLE a obtener_profesional_id y obtener_rol
--      (las otras 4 ya lo tenían).
--
-- Para aplicar: correr este bloque en el SQL Editor de Supabase.
-- Como usa CREATE OR REPLACE, pisa las funciones viejas sin romper
-- las políticas que las usan.
-- ============================================================

/*
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
*/
