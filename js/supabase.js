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

// Helper: mini-modal de confirmación (reemplaza al confirm() nativo).
// Devuelve una promesa que resuelve true (confirmar) o false (cancelar).
// Uso:  if (!await confirmarModal({ texto: '¿Eliminar?' })) return;
// Opciones:
//   titulo        encabezado (default: 'Confirmar')
//   texto         cuerpo; admite \n para saltos de línea
//   textoSi       label del botón de confirmar (default: 'Aceptar')
//   textoNo       label del botón de cancelar  (default: 'Cancelar')
//   peligro       true → botón de confirmar en rojo (acciones destructivas)
function confirmarModal(opciones = {}) {
  const {
    titulo = 'Confirmar',
    texto = '¿Confirmás esta acción?',
    textoSi = 'Aceptar',
    textoNo = 'Cancelar',
    peligro = false
  } = opciones;

  return new Promise((resolve) => {
    // Si ya hay uno abierto, lo sacamos (evita apilar)
    const previo = document.getElementById('cm-layer');
    if (previo) previo.remove();

    const esc = (s) => String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const layer = document.createElement('div');
    layer.id = 'cm-layer';
    layer.innerHTML = `
      <div class="cm-overlay">
        <div class="cm-box" role="dialog" aria-modal="true">
          <div class="cm-tit">${esc(titulo)}</div>
          <div class="cm-txt">${esc(texto)}</div>
          <div class="cm-acc">
            <button type="button" class="btn cm-no">${esc(textoNo)}</button>
            <button type="button" class="btn ${peligro ? 'cm-si-peligro' : 'btn-primary-sm'} cm-si">${esc(textoSi)}</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(layer);

    const cerrar = (val) => {
      document.removeEventListener('keydown', onKey);
      layer.remove();
      resolve(val);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') cerrar(false);
      if (e.key === 'Enter') cerrar(true);
    };
    document.addEventListener('keydown', onKey);

    layer.querySelector('.cm-no').onclick = () => cerrar(false);
    layer.querySelector('.cm-si').onclick = () => cerrar(true);
    // Click en el fondo oscuro = cancelar
    layer.querySelector('.cm-overlay').onclick = (e) => {
      if (e.target.classList.contains('cm-overlay')) cerrar(false);
    };

    // Foco en el botón de confirmar
    setTimeout(() => layer.querySelector('.cm-si')?.focus(), 20);
  });
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
