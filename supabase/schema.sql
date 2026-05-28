-- ============================================================
-- Podium · Esquema de base de datos (podología)
-- Proyecto Supabase: agenda
-- Actualizado: 2026-05-28
--
-- Esquema completo y recreable: incluye primary keys, foreign
-- keys y valores por defecto. El orden de creación respeta las
-- dependencias (las tablas referenciadas van primero).
--
-- NOTA: la activación de RLS y las políticas están en policies.sql;
-- las funciones helper están en functions.sql.
-- ============================================================


-- ============================================================
-- NEGOCIOS Y PLANES (capa SaaS multi-tenant)
-- ============================================================

CREATE TABLE negocios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  plan text DEFAULT 'free',
  activo boolean DEFAULT true,
  fecha_alta timestamp with time zone DEFAULT now(),
  notas text,
  consultorios_extras integer DEFAULT 0
);

CREATE TABLE planes (
  id text PRIMARY KEY,
  nombre text NOT NULL,
  max_consultorios integer NOT NULL,
  max_profesionales_por_consultorio integer NOT NULL,
  precio_mensual numeric DEFAULT 0,
  precio_consultorio_extra numeric DEFAULT 0,
  descripcion text,
  activo boolean DEFAULT true,
  orden integer DEFAULT 0
);

CREATE TABLE consultorios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL REFERENCES negocios(id),
  nombre text NOT NULL,
  direccion text,
  telefono text,
  hora_apertura time without time zone DEFAULT '09:00:00',
  hora_cierre time without time zone DEFAULT '18:00:00',
  activo boolean DEFAULT true,
  creado_en timestamp with time zone DEFAULT now()
);


-- ============================================================
-- USUARIOS Y PROFESIONALES
-- ============================================================
-- NOTA: usuarios.id corresponde al id de auth.users (Supabase Auth).
-- La relación con auth se maneja a nivel de Supabase, no como FK acá.

CREATE TABLE usuarios (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  nombre text NOT NULL,
  rol text NOT NULL,
  activo boolean DEFAULT true,
  creado_en timestamp with time zone DEFAULT now(),
  negocio_id uuid REFERENCES negocios(id)
);

CREATE TABLE profesionales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES usuarios(id),
  nombre text NOT NULL,
  matricula text,
  telefono text,
  color text DEFAULT '#534AB7',
  activo boolean DEFAULT true,
  creado_en timestamp with time zone DEFAULT now(),
  negocio_id uuid REFERENCES negocios(id)
);

CREATE TABLE profesionales_consultorios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profesional_id uuid NOT NULL REFERENCES profesionales(id),
  consultorio_id uuid NOT NULL REFERENCES consultorios(id),
  creado_en timestamp with time zone DEFAULT now()
);


-- ============================================================
-- PACIENTES Y ATENCIÓN CLÍNICA
-- ============================================================

CREATE TABLE pacientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
  creado_en timestamp with time zone DEFAULT now(),
  actualizado_en timestamp with time zone DEFAULT now(),
  negocio_id uuid REFERENCES negocios(id)
);

CREATE TABLE tipos_atencion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  duracion_minutos integer NOT NULL DEFAULT 30,
  precio numeric DEFAULT 0,
  color text DEFAULT '#534AB7',
  activo boolean DEFAULT true,
  creado_en timestamp with time zone DEFAULT now(),
  negocio_id uuid REFERENCES negocios(id)
);

CREATE TABLE turnos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES pacientes(id),
  profesional_id uuid NOT NULL REFERENCES profesionales(id),
  tipo_atencion_id uuid REFERENCES tipos_atencion(id),
  fecha_hora timestamp with time zone NOT NULL,
  duracion_minutos integer NOT NULL DEFAULT 45,
  estado text NOT NULL DEFAULT 'agendado',
  hora_llegada timestamp with time zone,
  hora_inicio_atencion timestamp with time zone,
  hora_fin_atencion timestamp with time zone,
  notas text,
  creado_por uuid REFERENCES usuarios(id),
  creado_en timestamp with time zone DEFAULT now(),
  actualizado_en timestamp with time zone DEFAULT now(),
  negocio_id uuid REFERENCES negocios(id),
  consultorio_id uuid REFERENCES consultorios(id)
);

CREATE TABLE fichas_atencion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id uuid NOT NULL REFERENCES turnos(id),
  paciente_id uuid NOT NULL REFERENCES pacientes(id),
  profesional_id uuid NOT NULL REFERENCES profesionales(id),
  motivo_consulta text,
  diagnostico text,
  tratamiento text,
  observaciones text,
  proxima_visita date,
  creado_en timestamp with time zone DEFAULT now(),
  actualizado_en timestamp with time zone DEFAULT now(),
  negocio_id uuid REFERENCES negocios(id)
);


-- ============================================================
-- PRODUCTOS Y VENTAS
-- ============================================================

CREATE TABLE productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  precio numeric NOT NULL DEFAULT 0,
  stock integer DEFAULT 0,
  stock_minimo integer DEFAULT 0,
  activo boolean DEFAULT true,
  creado_en timestamp with time zone DEFAULT now(),
  negocio_id uuid REFERENCES negocios(id)
);

CREATE TABLE ventas_productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id uuid NOT NULL REFERENCES turnos(id),
  producto_id uuid NOT NULL REFERENCES productos(id),
  cantidad integer NOT NULL DEFAULT 1,
  precio_unitario numeric NOT NULL,
  creado_en timestamp with time zone DEFAULT now(),
  negocio_id uuid REFERENCES negocios(id)
);


-- ============================================================
-- CONFIGURACIÓN DEL CONSULTORIO
-- ============================================================

CREATE TABLE configuracion (
  id integer PRIMARY KEY DEFAULT 1,
  duracion_turno_minutos integer NOT NULL DEFAULT 45,
  nombre_consultorio text DEFAULT 'Consultorio de Podología',
  hora_apertura time without time zone DEFAULT '09:00:00',
  hora_cierre time without time zone DEFAULT '18:00:00',
  actualizado_en timestamp with time zone DEFAULT now(),
  negocio_id uuid REFERENCES negocios(id)
);

CREATE TABLE dias_laborales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dia_semana integer NOT NULL,
  hora_inicio time without time zone NOT NULL,
  hora_fin time without time zone NOT NULL,
  activo boolean DEFAULT true,
  negocio_id uuid REFERENCES negocios(id)
);

CREATE TABLE feriados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL,
  descripcion text,
  creado_en timestamp with time zone DEFAULT now(),
  negocio_id uuid REFERENCES negocios(id)
);


-- ============================================================
-- VISTAS
-- ============================================================
-- vista_uso_negocios: calcula el uso real de cada negocio
-- (consultorios y profesionales actuales vs. límites del plan).
-- La definición real (el SELECT) hay que exportarla aparte con:
--   select pg_get_viewdef('vista_uso_negocios', true);
--
-- Columnas que devuelve:
--   id, nombre, plan, consultorios_extras,
--   max_consultorios, limite_total_consultorios,
--   max_profesionales_por_consultorio,
--   consultorios_actuales, profesionales_actuales, activo
-- ============================================================
