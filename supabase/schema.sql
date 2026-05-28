-- ============================================================
-- Podium · Esquema de base de datos (podología)
-- Proyecto Supabase: agenda
-- Generado: 2026-05-28
--
-- NOTA: este archivo documenta la ESTRUCTURA de columnas y tipos.
-- No incluye todavía: primary keys, foreign keys ni valores DEFAULT.
-- (pendiente: completar para que sea 100% recreable)
-- ============================================================


-- ============================================================
-- NEGOCIOS Y PLANES (capa SaaS multi-tenant)
-- ============================================================

CREATE TABLE negocios (
  id uuid NOT NULL,
  nombre text NOT NULL,
  plan text,
  activo boolean,
  fecha_alta timestamp with time zone,
  notas text,
  consultorios_extras integer
);

CREATE TABLE planes (
  id text NOT NULL,
  nombre text NOT NULL,
  max_consultorios integer NOT NULL,
  max_profesionales_por_consultorio integer NOT NULL,
  precio_mensual numeric,
  precio_consultorio_extra numeric,
  descripcion text,
  activo boolean,
  orden integer
);

CREATE TABLE consultorios (
  id uuid NOT NULL,
  negocio_id uuid NOT NULL,
  nombre text NOT NULL,
  direccion text,
  telefono text,
  hora_apertura time without time zone,
  hora_cierre time without time zone,
  activo boolean,
  creado_en timestamp with time zone
);


-- ============================================================
-- USUARIOS Y PROFESIONALES
-- ============================================================

CREATE TABLE usuarios (
  id uuid NOT NULL,
  email text NOT NULL,
  nombre text NOT NULL,
  rol text NOT NULL,
  activo boolean,
  creado_en timestamp with time zone,
  negocio_id uuid
);

CREATE TABLE profesionales (
  id uuid NOT NULL,
  usuario_id uuid,
  nombre text NOT NULL,
  matricula text,
  telefono text,
  color text,
  activo boolean,
  creado_en timestamp with time zone,
  negocio_id uuid
);

CREATE TABLE profesionales_consultorios (
  id uuid NOT NULL,
  profesional_id uuid NOT NULL,
  consultorio_id uuid NOT NULL,
  creado_en timestamp with time zone
);


-- ============================================================
-- PACIENTES Y ATENCIÓN CLÍNICA
-- ============================================================

CREATE TABLE pacientes (
  id uuid NOT NULL,
  nombre text NOT NULL,
  apellido text NOT NULL,
  dni text,
  fecha_nacimiento date,
  telefono text,
  email text,
  direccion text,
  obra_social text,
  numero_afiliado text,
  notas text,
  creado_en timestamp with time zone,
  actualizado_en timestamp with time zone,
  negocio_id uuid
);

CREATE TABLE tipos_atencion (
  id uuid NOT NULL,
  nombre text NOT NULL,
  duracion_minutos integer NOT NULL,
  precio numeric,
  color text,
  activo boolean,
  creado_en timestamp with time zone,
  negocio_id uuid
);

CREATE TABLE turnos (
  id uuid NOT NULL,
  paciente_id uuid NOT NULL,
  profesional_id uuid NOT NULL,
  tipo_atencion_id uuid,
  fecha_hora timestamp with time zone NOT NULL,
  duracion_minutos integer NOT NULL,
  estado text NOT NULL,
  hora_llegada timestamp with time zone,
  hora_inicio_atencion timestamp with time zone,
  hora_fin_atencion timestamp with time zone,
  notas text,
  creado_por uuid,
  creado_en timestamp with time zone,
  actualizado_en timestamp with time zone,
  negocio_id uuid,
  consultorio_id uuid
);

CREATE TABLE fichas_atencion (
  id uuid NOT NULL,
  turno_id uuid NOT NULL,
  paciente_id uuid NOT NULL,
  profesional_id uuid NOT NULL,
  motivo_consulta text,
  diagnostico text,
  tratamiento text,
  observaciones text,
  proxima_visita date,
  creado_en timestamp with time zone,
  actualizado_en timestamp with time zone,
  negocio_id uuid
);


-- ============================================================
-- PRODUCTOS Y VENTAS
-- ============================================================

CREATE TABLE productos (
  id uuid NOT NULL,
  nombre text NOT NULL,
  descripcion text,
  precio numeric NOT NULL,
  stock integer,
  stock_minimo integer,
  activo boolean,
  creado_en timestamp with time zone,
  negocio_id uuid
);

CREATE TABLE ventas_productos (
  id uuid NOT NULL,
  turno_id uuid NOT NULL,
  producto_id uuid NOT NULL,
  cantidad integer NOT NULL,
  precio_unitario numeric NOT NULL,
  creado_en timestamp with time zone,
  negocio_id uuid
);


-- ============================================================
-- CONFIGURACIÓN DEL CONSULTORIO
-- ============================================================

CREATE TABLE configuracion (
  id integer NOT NULL,
  duracion_turno_minutos integer NOT NULL,
  nombre_consultorio text,
  hora_apertura time without time zone,
  hora_cierre time without time zone,
  actualizado_en timestamp with time zone,
  negocio_id uuid
);

CREATE TABLE dias_laborales (
  id uuid NOT NULL,
  dia_semana integer NOT NULL,
  hora_inicio time without time zone NOT NULL,
  hora_fin time without time zone NOT NULL,
  activo boolean,
  negocio_id uuid
);

CREATE TABLE feriados (
  id uuid NOT NULL,
  fecha date NOT NULL,
  descripcion text,
  creado_en timestamp with time zone,
  negocio_id uuid
);


-- ============================================================
-- VISTAS
-- ============================================================
-- vista_uso_negocios: calcula el uso real de cada negocio
-- (consultorios y profesionales actuales vs. límites del plan).
-- NOTA: esto es una VISTA, no una tabla. La definición real (el SELECT)
-- hay que exportarla aparte; abajo queda solo su forma de salida.
--
-- Columnas que devuelve:
--   id, nombre, plan, consultorios_extras,
--   max_consultorios, limite_total_consultorios,
--   max_profesionales_por_consultorio,
--   consultorios_actuales, profesionales_actuales, activo
-- ============================================================
