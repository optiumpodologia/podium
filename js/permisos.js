// ============================================================
// permisos.js — Fuente de verdad de quién ve/hace qué en Podium
// ============================================================
//
// IMPORTANTE: esto controla la EXPERIENCIA (qué módulos muestra el
// menú, a qué pantallas se entra, qué botones aparecen). NO es la
// seguridad real: cualquiera con la consola del navegador puede
// saltearse estos chequeos. La seguridad de verdad vive en las
// políticas RLS de Supabase, con negocio_id como muralla entre
// negocios. Este mapa y la RLS tienen que decir lo mismo; manda la base.
//
// "profesional_full" NO es un rol: es el rol 'profesional' con la
// capacidad full activada (un flag, disponible solo en Plan 1).
// Por eso lo leemos de usuarioActual.profesional_full, no del rol.
// ============================================================

const ROLES = ['super_admin', 'negocio', 'recepcion', 'profesional'];

// --- Acceso a MÓDULOS -------------------------------------------------
// Para cada módulo: qué roles pueden ABRIRLO. Esto controla tanto el
// menú lateral como el guarda de entrada de cada pantalla.
// El ORDEN de las claves es el orden en que aparecen en el menú.
//
// NOTA: el módulo 'profesionales' es la pantalla "Mi equipo" (profesionales
// + recepción del negocio). Mantenemos el id 'profesionales' para no romper
// nada; solo cambia la etiqueta visible (en app.html).
// 'usuarios' quedó SOLO para super_admin: el dueño gestiona su gente desde
// "Mi equipo", no desde acá.
const MODULOS_ACCESO = {
  negocios:       ['super_admin'],                          // clientes del SaaS
  planes:         ['super_admin'],                          // planes de suscripción del SaaS
  dashboard:      ['negocio', 'recepcion', 'profesional'],  // Inicio
  agenda:         ['negocio', 'recepcion', 'profesional'],
  pacientes:      ['negocio', 'recepcion', 'profesional'],
  consultorios:   ['negocio', 'recepcion'],
  profesionales:  ['negocio', 'recepcion'],                 // pantalla "Mi equipo"
  tipos_atencion: ['negocio'],                              // Atenciones (catálogo)
  productos:      ['negocio'],
  usuarios:       ['super_admin'],                          // solo uso interno Optium
  configuracion:  ['negocio'],
};

// --- ACCIONES / capacidades dentro de un módulo -----------------------
// Cosas más finas que "entrar o no entrar a una pantalla". Son funciones
// que reciben el usuario y devuelven true/false, así el flag full se
// expresa con naturalidad.
const esFull = u => u.rol === 'profesional' && u.profesional_full === true;

const ACCIONES = {
  // Crear/editar turnos: Negocio, Recepción y Profesional Full.
  crear_turno: u => ['negocio', 'recepcion'].includes(u.rol) || esFull(u),

  // Recibir paciente y cargar la atención/ficha: el profesional (con o
  // sin full) y el negocio. Recepción NO atiende.
  atender: u => u.rol === 'profesional' || u.rol === 'negocio',

  // Estadísticas de dinero en el dashboard: solo Negocio.
  // (Recepción, Profesional y Profesional Full NO ven plata.)
  ver_dinero: u => u.rol === 'negocio',

  // Recepción gestiona profesionales pero NO puede tocar sus claves.
  resetear_clave_profesional: u => u.rol === 'negocio',

  // Dar de alta un profesional (crea login + registro de agenda): solo el dueño.
  crear_profesional: u => u.rol === 'negocio',

  // Dar de alta / activar recepción: solo el dueño. Hoy se hace una vez;
  // si mañana el plan permite más de una, igual lo hace el dueño (el tope
  // real lo pone max_recepcion del plan).
  crear_recepcion: u => u.rol === 'negocio',
};

// --- Helpers ----------------------------------------------------------
// ¿Este usuario puede abrir este módulo?
function puedeVerModulo(usuario, moduloId) {
  if (!usuario) return false;
  const roles = MODULOS_ACCESO[moduloId] || [];
  return roles.includes(usuario.rol);
}

// ¿Este usuario puede hacer esta acción?
function puede(usuario, accion) {
  if (!usuario) return false;
  const regla = ACCIONES[accion];
  return typeof regla === 'function' ? regla(usuario) : false;
}

// --- Pendientes que se resuelven con FILTRO DE DATOS, no con acceso ----
// El Profesional SÍ entra a Pacientes y Agenda, pero ve un subconjunto:
//   - Agenda: solo sus propios turnos (ya lo hace dibujarAgenda()).
//   - Pacientes: solo los que alguna vez atendió (pendiente, Fase 2/3).
// Eso se decide en la query a Supabase + RLS, no en este mapa.
