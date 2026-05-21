// Cliente de Supabase: este archivo crea la conexión y expone funciones
// que usan los demás módulos. Necesita que config.js esté cargado antes.

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// Devuelve el usuario actualmente logueado (con su rol y datos)
async function getUsuarioActual() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data, error } = await sb
    .from('usuarios')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error obteniendo usuario:', error);
    return null;
  }
  return data;
}

// Si hay un usuario logueado, devuelve true
async function estaLogueado() {
  const { data: { session } } = await sb.auth.getSession();
  return !!session;
}

// Cierra la sesión y vuelve al login
async function cerrarSesion() {
  await sb.auth.signOut();
  window.location.href = 'index.html';
}

// Redirige al login si no hay sesión (se usa al inicio de cada página protegida)
async function protegerPagina() {
  const logueado = await estaLogueado();
  if (!logueado) {
    window.location.href = 'index.html';
    return null;
  }
  return await getUsuarioActual();
}

// Helper: formatea fecha YYYY-MM-DD para inputs HTML
function fechaParaInput(fecha) {
  const d = fecha ? new Date(fecha) : new Date();
  return d.toISOString().split('T')[0];
}

// Helper: formatea hora HH:MM para inputs HTML
function horaParaInput(fecha) {
  const d = new Date(fecha);
  return d.toTimeString().slice(0, 5);
}

// Helper: muestra un toast (mensaje temporal en pantalla)
function mostrarMensaje(texto, tipo = 'info') {
  const div = document.createElement('div');
  div.className = `toast toast-${tipo}`;
  div.textContent = texto;
  document.body.appendChild(div);
  setTimeout(() => div.classList.add('toast-visible'), 10);
  setTimeout(() => {
    div.classList.remove('toast-visible');
    setTimeout(() => div.remove(), 300);
  }, 3500);
}

// Helper: formatea moneda en pesos argentinos
function formatearPrecio(n) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0
  }).format(n || 0);
}

// Helper: formatea fecha legible
function formatearFecha(fecha) {
  const d = new Date(fecha);
  return d.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

// Helper: formatea hora legible
function formatearHora(fecha) {
  const d = new Date(fecha);
  return d.toTimeString().slice(0, 5);
}
