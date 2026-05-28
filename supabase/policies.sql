-- ============================================================
-- Podium · Políticas de seguridad RLS
-- Proyecto Supabase: agenda
-- Generado: 2026-05-28
--
-- 31 políticas que controlan qué ve y qué puede hacer cada usuario.
-- Patrón general: es_super_admin() ve/hace todo; el resto queda
-- limitado a su propio negocio (negocio_id = obtener_negocio_id()).
-- Las fichas clínicas y algunos turnos se limitan por profesional.
--
-- Requisito previo: RLS activado en cada tabla y las funciones
-- helper de functions.sql ya creadas.
-- ============================================================


-- ============================================================
-- NEGOCIOS (capa SaaS)
-- ============================================================

CREATE POLICY "super admin gestiona negocios" ON negocios
  FOR ALL USING (es_super_admin());

CREATE POLICY "ver negocios" ON negocios
  FOR SELECT USING ((es_super_admin() OR (id = obtener_negocio_id())));


-- ============================================================
-- PLANES (catálogo público de planes activos)
-- ============================================================

CREATE POLICY "todos pueden ver planes activos" ON planes
  FOR SELECT USING ((activo = true));


-- ============================================================
-- CONSULTORIOS
-- ============================================================

CREATE POLICY "admin gestiona consultorios" ON consultorios
  FOR ALL USING ((es_super_admin() OR (es_admin_consultorio() AND (negocio_id = obtener_negocio_id()))));

CREATE POLICY "ver consultorios" ON consultorios
  FOR SELECT USING ((es_super_admin() OR (negocio_id = obtener_negocio_id())));


-- ============================================================
-- USUARIOS
-- ============================================================

CREATE POLICY "super admin edita usuarios" ON usuarios
  FOR ALL USING (es_super_admin());

CREATE POLICY "admin gestiona usuarios de su negocio" ON usuarios
  FOR ALL USING (((es_admin_consultorio() AND (negocio_id = obtener_negocio_id()) AND (rol = ANY (ARRAY['admin_consultorio'::text, 'recepcion'::text, 'profesional'::text]))) OR es_super_admin()));

CREATE POLICY "ver usuarios" ON usuarios
  FOR SELECT USING (((id = auth.uid()) OR es_super_admin() OR ((obtener_rol() = 'recepcion'::text) AND (negocio_id = obtener_negocio_id()))));


-- ============================================================
-- PROFESIONALES
-- ============================================================

CREATE POLICY "admin edita profesionales" ON profesionales
  FOR ALL USING ((es_super_admin() OR (es_admin_o_recepcion() AND (negocio_id = obtener_negocio_id()))));

CREATE POLICY "ver profesionales" ON profesionales
  FOR SELECT USING ((es_super_admin() OR (negocio_id = obtener_negocio_id())));


-- ============================================================
-- PROFESIONALES ↔ CONSULTORIOS (relación, filtra vía consultorio)
-- ============================================================

CREATE POLICY "admin gestiona prof_consult" ON profesionales_consultorios
  FOR ALL USING ((es_super_admin() OR (es_admin_consultorio() AND (EXISTS ( SELECT 1
   FROM consultorios c
  WHERE ((c.id = profesionales_consultorios.consultorio_id) AND (c.negocio_id = obtener_negocio_id())))))));

CREATE POLICY "ver prof_consult" ON profesionales_consultorios
  FOR SELECT USING ((es_super_admin() OR (EXISTS ( SELECT 1
   FROM consultorios c
  WHERE ((c.id = profesionales_consultorios.consultorio_id) AND (c.negocio_id = obtener_negocio_id()))))));


-- ============================================================
-- PACIENTES
-- ============================================================

CREATE POLICY "admin edita pacientes" ON pacientes
  FOR ALL USING ((es_super_admin() OR (es_admin_o_recepcion() AND (negocio_id = obtener_negocio_id()))));

CREATE POLICY "ver pacientes" ON pacientes
  FOR SELECT USING ((es_super_admin() OR (negocio_id = obtener_negocio_id())));


-- ============================================================
-- TIPOS DE ATENCIÓN
-- ============================================================

CREATE POLICY "admin edita tipos atencion" ON tipos_atencion
  FOR ALL USING ((es_super_admin() OR (es_admin_consultorio() AND (negocio_id = obtener_negocio_id()))));

CREATE POLICY "ver tipos atencion" ON tipos_atencion
  FOR SELECT USING ((es_super_admin() OR (negocio_id = obtener_negocio_id())));


-- ============================================================
-- TURNOS (granularidad por rol: admin/recepción vs profesional)
-- ============================================================

CREATE POLICY "admin gestiona turnos" ON turnos
  FOR ALL USING ((es_super_admin() OR (es_admin_o_recepcion() AND (negocio_id = obtener_negocio_id()))));

CREATE POLICY "profesional actualiza sus turnos" ON turnos
  FOR UPDATE USING ((profesional_id = obtener_profesional_id()));

CREATE POLICY "ver turnos" ON turnos
  FOR SELECT USING ((es_super_admin() OR ((obtener_rol() = 'recepcion'::text) AND (negocio_id = obtener_negocio_id())) OR ((obtener_rol() = 'profesional'::text) AND (profesional_id = obtener_profesional_id()))));


-- ============================================================
-- FICHAS DE ATENCIÓN (historia clínica: solo el profesional dueño)
-- ============================================================

CREATE POLICY "profesional gestiona sus fichas" ON fichas_atencion
  FOR ALL USING ((es_super_admin() OR (profesional_id = obtener_profesional_id())));

CREATE POLICY "profesional ve sus fichas" ON fichas_atencion
  FOR SELECT USING ((es_super_admin() OR (profesional_id = obtener_profesional_id())));


-- ============================================================
-- PRODUCTOS
-- ============================================================

CREATE POLICY "admin edita productos" ON productos
  FOR ALL USING ((es_super_admin() OR (es_admin_o_recepcion() AND (negocio_id = obtener_negocio_id()))));

CREATE POLICY "ver productos" ON productos
  FOR SELECT USING ((es_super_admin() OR (negocio_id = obtener_negocio_id())));


-- ============================================================
-- VENTAS DE PRODUCTOS
-- ============================================================

CREATE POLICY "cargar ventas" ON ventas_productos
  FOR ALL USING ((es_super_admin() OR (negocio_id = obtener_negocio_id())));

CREATE POLICY "ver ventas" ON ventas_productos
  FOR SELECT USING ((es_super_admin() OR (negocio_id = obtener_negocio_id())));


-- ============================================================
-- DÍAS LABORALES
-- ============================================================

CREATE POLICY "admin edita dias laborales" ON dias_laborales
  FOR ALL USING ((es_super_admin() OR (es_admin_consultorio() AND (negocio_id = obtener_negocio_id()))));

CREATE POLICY "ver dias laborales" ON dias_laborales
  FOR SELECT USING ((es_super_admin() OR (negocio_id = obtener_negocio_id())));


-- ============================================================
-- FERIADOS
-- ============================================================

CREATE POLICY "admin edita feriados" ON feriados
  FOR ALL USING ((es_super_admin() OR (es_admin_consultorio() AND (negocio_id = obtener_negocio_id()))));

CREATE POLICY "ver feriados" ON feriados
  FOR SELECT USING ((es_super_admin() OR (negocio_id = obtener_negocio_id())));


-- ============================================================
-- CONFIGURACIÓN
-- ============================================================

CREATE POLICY "admin edita configuracion" ON configuracion
  FOR ALL USING ((es_super_admin() OR (es_admin_consultorio() AND (negocio_id = obtener_negocio_id()))));

CREATE POLICY "todos ven configuracion" ON configuracion
  FOR SELECT USING ((es_super_admin() OR (negocio_id = obtener_negocio_id())));
