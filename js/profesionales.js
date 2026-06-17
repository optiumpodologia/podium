async function renderProfesionales(container) {
  if (!puedeVerModulo(usuarioActual, 'profesionales')) {
    container.innerHTML = '<div class="vacio">Acceso restringido</div>';
    return;
  }

  // Crear un profesional ahora crea también su login, así que el alta es del
  // dueño (rol 'negocio'). Recepción ve la lista y puede editar, pero no crear.
  const puedeCrear = puede(usuarioActual, 'crear_profesional');

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Mi equipo</div>
        <div class="page-subtitle">Profesionales y recepción del negocio</div>
      </div>
    </div>

    <!-- Tira de recepción (arriba): se gestiona una vez y queda) -->
    <div id="tira-recepcion" style="margin-bottom: 1rem;"></div>

    <!-- Profesionales (la parte dinámica) -->
    <div class="card">
      <div class="card-title">
        <span id="prof-count">Profesionales</span>
        ${puedeCrear ? `
          <button class="btn btn-primary-sm" onclick="abrirModalProfesional()" style="font-size: 12px; padding: 6px 12px;">
            <span>+</span> Nuevo profesional
          </button>
        ` : ''}
      </div>
      <table class="tabla">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Matrícula</th>
            <th>Teléfono</th>
            <th>Color</th>
            <th>Estado</th>
            <th style="text-align:right;">Acciones</th>
          </tr>
        </thead>
        <tbody id="tabla-profesionales">
          <tr><td colspan="6" class="vacio">Cargando...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  await cargarRecepcion();
  await cargarProfesionales();
}

// ============================================================
// RECEPCIÓN (tira de arriba)
// ============================================================
async function cargarRecepcion() {
  const cont = document.getElementById('tira-recepcion');
  if (!cont) return;

  // El super admin no entra a esta pantalla; acá siempre hay negocio_id.
  const negId = usuarioActual.negocio_id;
  const puedeGestionar = puede(usuarioActual, 'crear_recepcion');

  const { data: recepciones, error } = await sb.from('usuarios')
    .select('id, nombre, email, activo')
    .eq('negocio_id', negId)
    .eq('rol', 'recepcion')
    .order('nombre');

  if (error) { console.error(error); }

  const lista = recepciones || [];
  const tope = await topeRecepcionNegocio();
  const hayLugar = !tope || !tope.alcanzado;

  // Botón de alta: solo el dueño y solo si el plan todavía da lugar.
  const botonAlta = (puedeGestionar && hayLugar)
    ? `<button class="btn btn-primary-sm" onclick="abrirModalRecepcion()" style="font-size: 12px; padding: 6px 12px;">
         <span>+</span> ${lista.length === 0 ? 'Activar recepción' : 'Agregar recepción'}
       </button>`
    : '';

  // Aviso de tope alcanzado (solo si el dueño quiso y no hay lugar).
  const avisoTope = (puedeGestionar && !hayLugar && tope && tope.max)
    ? `<span style="font-size: 12px; color: var(--texto-tenue);">Tu plan permite ${tope.max} recepción${tope.max !== 1 ? 'es' : ''}.</span>`
    : '';

  if (lista.length === 0) {
    cont.innerHTML = `
      <div class="card" style="display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap;">
        <div>
          <div style="font-weight:600; font-size:14px;">Recepción</div>
          <div style="font-size:12px; color:var(--texto-secundario);">
            ${puedeGestionar
              ? 'Todavía no activaste la recepción. Es la persona del mostrador que carga turnos y pacientes.'
              : 'Sin recepción activa.'}
          </div>
        </div>
        ${botonAlta}
      </div>
    `;
    return;
  }

  cont.innerHTML = `
    <div class="card">
      <div class="card-title" style="margin-bottom: 0.75rem;">
        <span>Recepción</span>
        ${botonAlta}
      </div>
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${lista.map(r => `
          <div class="turno-row" style="cursor:default;">
            <div class="user-avatar" style="background:var(--exito-claro); color:var(--exito);">
              ${(r.nombre || '?').split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase()}
            </div>
            <div class="turno-row-info">
              <div class="turno-row-nombre">${r.nombre}</div>
              <div class="turno-row-tipo">${r.email}</div>
            </div>
            <span class="badge ${r.activo ? 'badge-llego' : 'badge-cancelado'}">
              ${r.activo ? 'Activo' : 'Inactivo'}
            </span>
            ${puedeGestionar ? `
              <button class="lista-acc-btn" title="Gestionar cuenta (contraseña / email)"
                onclick="abrirGestionCuenta('${r.id}','${(r.nombre || '').replace(/'/g, "\\'")}','${(r.email || '').replace(/'/g, "\\'")}')">
                ${PROF_ICO.llave}
              </button>
              <button class="lista-acc-btn ${r.activo ? 'peligro' : ''}" title="${r.activo ? 'Desactivar' : 'Activar'}"
                onclick="toggleRecepcionActiva('${r.id}', ${!r.activo})"
                ${r.activo ? '' : 'style="color: var(--exito);"'}>
                ${r.activo ? PROF_ICO.ban : PROF_ICO.check}
              </button>
            ` : ''}
          </div>
        `).join('')}
      </div>
      ${avisoTope ? `<div style="margin-top:8px;">${avisoTope}</div>` : ''}
    </div>
  `;
}

async function abrirModalRecepcion() {
  if (!puede(usuarioActual, 'crear_recepcion')) {
    mostrarMensaje('Solo el dueño puede activar la recepción.', 'advertencia');
    return;
  }

  // Chequeo de tope antes de abrir.
  const tope = await topeRecepcionNegocio();
  if (tope && tope.alcanzado) {
    mostrarMensaje(`Tu plan permite ${tope.max} recepción${tope.max !== 1 ? 'es' : ''} (tenés ${tope.actual}). Para sumar más, cambiá de plan.`, 'error');
    return;
  }

  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">Activar recepción</div>
      <button class="modal-cerrar" onclick="cerrarModal()">×</button>
    </div>
    <form id="form-recepcion">
      <div class="modal-body">
        <div style="background: var(--info-claro); color: var(--info); padding: 10px 12px; border-radius: var(--radio); font-size: 12px; margin-bottom: 1rem;">
          La recepción es la persona del mostrador: carga turnos y pacientes. Le creás su acceso acá.
        </div>

        <div class="input-group">
          <label>Nombre completo *</label>
          <input type="text" name="nombre" required placeholder="Ej: María González">
        </div>

        <div class="input-group">
          <label>Email (para que entre a la app) *</label>
          <input type="email" name="email" required placeholder="recepcion@email.com">
        </div>

        <div class="input-group">
          <label>Contraseña *</label>
          <input type="text" name="password" required minlength="6" placeholder="Mínimo 6 caracteres">
          <small style="color: var(--texto-tenue); display:block; margin-top: 4px;">
            Anotala bien: se la pasás a la recepción para que entre la primera vez.
          </small>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn" onclick="cerrarModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary-sm" id="btn-crear-recepcion">Activar recepción</button>
      </div>
    </form>
  `);

  document.getElementById('form-recepcion').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const d = Object.fromEntries(fd.entries());

    // Re-chequeo de tope por las dudas (alguien pudo crear otra en el medio).
    const tope2 = await topeRecepcionNegocio();
    if (tope2 && tope2.alcanzado) {
      mostrarMensaje(`Tu plan permite ${tope2.max} recepción${tope2.max !== 1 ? 'es' : ''}.`, 'error');
      return;
    }

    const btn = document.getElementById('btn-crear-recepcion');
    btn.disabled = true; btn.textContent = 'Creando...';

    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) throw new Error('Sesión expirada');

      const response = await fetch(`${SUPABASE_URL}/functions/v1/crear-usuario`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          email: d.email.trim().toLowerCase(),
          password: d.password,
          nombre: d.nombre.trim(),
          rol: 'recepcion',
          // El dueño no manda negocio_id: la función lo toma de su sesión.
          negocio_id: null
        })
      });

      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error || 'Error desconocido');

      mostrarMensaje('Recepción activada (ya puede entrar a la app)', 'exito');
      cerrarModal();
      await cargarRecepcion();
    } catch (error) {
      mostrarMensaje('Error: ' + error.message, 'error');
      btn.disabled = false; btn.textContent = 'Activar recepción';
    }
  });
}

async function toggleRecepcionActiva(id, activar) {
  const accion = activar ? 'activar' : 'desactivar';
  if (!confirm(`¿Seguro que querés ${accion} esta recepción?`)) return;

  const { error } = await sb.from('usuarios').update({ activo: activar }).eq('id', id);
  if (error) { mostrarMensaje('Error: ' + error.message, 'error'); return; }
  mostrarMensaje(activar ? 'Recepción activada' : 'Recepción desactivada', 'exito');
  await cargarRecepcion();
}

// Tope de recepción del plan del negocio actual.
// Devuelve { max, actual, alcanzado } o null si no aplica.
// max = null significa "sin límite".
async function topeRecepcionNegocio() {
  const negId = usuarioActual.negocio_id;
  if (!negId) return null;

  const { data: vista } = await sb.from('vista_uso_negocios')
    .select('plan').eq('id', negId).single();
  if (!vista) return null;

  const { data: plan } = await sb.from('planes')
    .select('max_recepcion').eq('id', vista.plan).single();

  const max = plan?.max_recepcion;
  if (max === null || max === undefined) return { max: null, actual: 0, alcanzado: false };

  const { count } = await sb.from('usuarios')
    .select('*', { count: 'exact', head: true })
    .eq('negocio_id', negId).eq('rol', 'recepcion');

  return { max, actual: count || 0, alcanzado: (count || 0) >= max };
}

// ============================================================
// PROFESIONALES (tabla dinámica)
// ============================================================
// ============================================================
// PROFESIONALES — íconos del listado + ficha completa
// ============================================================
const PROF_ICO = {
  ojo:   '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  reloj: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  lapiz: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  tacho: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  ban:   '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.9" x2="19.1" y1="4.9" y2="19.1"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  llave: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>',
};

// Modal reutilizable para fijar contraseña nueva y/o cambiar el email de una cuenta.
// Llama a la Edge Function 'gestionar-cuenta' (que valida permisos del lado del server).
function abrirGestionCuenta(usuarioId, nombre, emailActual) {
  const emailOriginal = (emailActual || '').trim().toLowerCase();
  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo" style="font-size:15px; font-weight:600;">Cuenta · ${nombre || ''}</div>
      <button class="modal-cerrar" onclick="cerrarModal()">×</button>
    </div>
    <form id="form-cuenta">
      <div class="modal-body">
        <div class="input-group">
          <label>Email de acceso</label>
          <input type="email" name="email" value="${emailActual || ''}" placeholder="email@ejemplo.com">
          <small style="color:var(--texto-tenue); display:block; margin-top:4px;">Cambialo solo si hace falta. Es con el que entra a la app.</small>
        </div>
        <div class="input-group">
          <label>Nueva contraseña</label>
          <input type="text" name="password" minlength="6" placeholder="Dejala vacía para no cambiarla">
          <small style="color:var(--texto-tenue); display:block; margin-top:4px;">Mínimo 6 caracteres. Anotala: se la pasás a la persona.</small>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn" onclick="cerrarModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary-sm" id="btn-cuenta">Guardar cambios</button>
      </div>
    </form>
  `);

  document.getElementById('form-cuenta').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const email = (fd.get('email') || '').trim().toLowerCase();
    const password = (fd.get('password') || '').trim();

    const payload = { usuario_id: usuarioId };
    if (email && email !== emailOriginal) payload.email = email;
    if (password) {
      if (password.length < 6) { mostrarMensaje('La contraseña debe tener al menos 6 caracteres', 'advertencia'); return; }
      payload.password = password;
    }
    if (!payload.email && !payload.password) { mostrarMensaje('No cambiaste nada', 'advertencia'); return; }

    const btn = document.getElementById('btn-cuenta');
    btn.disabled = true; btn.textContent = 'Guardando...';
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) throw new Error('Sesión expirada');
      const r = await fetch(`${SUPABASE_URL}/functions/v1/gestionar-cuenta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify(payload)
      });
      const res = await r.json();
      if (!r.ok || res.error) throw new Error(res.error || 'Error desconocido');
      mostrarMensaje('Cuenta actualizada', 'exito');
      cerrarModal();
    } catch (err) {
      mostrarMensaje('Error: ' + err.message, 'error');
      btn.disabled = false; btn.textContent = 'Guardar cambios';
    }
  });
}

function profInic(nombre) {
  return (nombre || '?').split(' ').filter(Boolean).map(x => x[0]).slice(0, 2).join('').toUpperCase() || '?';
}

// Avatar reutilizable: muestra la foto si hay, o las iniciales con el color del profesional.
// Se usa en la ficha, el listado de "Mi equipo" y el panel de agenda.
function avatarHTML(nombre, color, foto, size = 36) {
  const c = (color && /^#[0-9a-fA-F]{6}$/.test(color)) ? color : '#6D5BD0';
  const base = `width:${size}px; height:${size}px; border-radius:50%; flex:none;`;
  if (foto) {
    return `<div style="${base} overflow:hidden; background:#eee;"><img src="${foto}" alt="" style="width:100%; height:100%; object-fit:cover; display:block;"></div>`;
  }
  return `<div style="${base} background:${c}; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:${Math.round(size * 0.34)}px;">${profInic(nombre)}</div>`;
}

const FOTOS_BUCKET = 'fotos';
const CAMARA_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>';

async function subirFotoProfesional(profId, file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) { mostrarMensaje('Elegí un archivo de imagen', 'advertencia'); return; }
  if (file.size > 3 * 1024 * 1024) { mostrarMensaje('La imagen no puede superar 3 MB', 'advertencia'); return; }

  const negId = usuarioActual.negocio_id;
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${negId}/${profId}-${Date.now()}.${ext}`;

  const { error: upErr } = await sb.storage.from(FOTOS_BUCKET).upload(path, file, { upsert: true, contentType: file.type });
  if (upErr) { mostrarMensaje('No se pudo subir la foto: ' + upErr.message, 'error'); return; }

  const { data: pub } = sb.storage.from(FOTOS_BUCKET).getPublicUrl(path);
  const { error: dbErr } = await sb.from('profesionales').update({ foto_url: pub.publicUrl }).eq('id', profId);
  if (dbErr) { mostrarMensaje('Foto subida, pero no se guardó: ' + dbErr.message, 'error'); return; }

  mostrarMensaje('Foto actualizada', 'exito');
  verFichaProfesional(profId);
  if (document.getElementById('tabla-profesionales')) cargarProfesionales();
}

async function quitarFotoProfesional(profId) {
  if (!confirm('¿Quitar la foto del profesional?')) return;
  const { error } = await sb.from('profesionales').update({ foto_url: null }).eq('id', profId);
  if (error) { mostrarMensaje('Error: ' + error.message, 'error'); return; }
  mostrarMensaje('Foto quitada', 'exito');
  verFichaProfesional(profId);
  if (document.getElementById('tabla-profesionales')) cargarProfesionales();
}

// Ficha completa del profesional (formato ficha de paciente: panel lateral + pestañas)
async function verFichaProfesional(id) {
  const { data: prof } = await sb.from('profesionales').select('*').eq('id', id).single();
  if (!prof) { mostrarMensaje('Profesional no encontrado', 'error'); return; }

  let email = '', cuentaActiva = null, tieneLogin = false;
  if (prof.usuario_id) {
    const { data: u } = await sb.from('usuarios').select('email, activo').eq('id', prof.usuario_id).maybeSingle();
    if (u) { email = u.email || ''; cuentaActiva = u.activo; tieneLogin = true; }
  }

  const puedeEditar = puede(usuarioActual, 'crear_profesional') || usuarioActual.rol === 'recepcion';
  const inic = profInic(prof.nombre);
  const estadoBadge = prof.activo
    ? '<span class="badge badge-llego">Activo</span>'
    : '<span class="badge badge-cancelado">Inactivo</span>';

  const ic = (p, s = 16) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">${p}</svg>`;
  const ICO = {
    mat:  '<rect width="18" height="14" x="3" y="5" rx="2"/><circle cx="8" cy="11" r="2"/><path d="M14 9h4M14 13h2"/>',
    tel:  '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    color:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  };
  const card = (k, lbl, val, full) => `
    <div class="ficha-card${full ? ' full' : ''}">
      <div class="ficha-card-head"><span class="ficha-card-ico">${ic(ICO[k])}</span><span class="ficha-card-lbl">${lbl}</span></div>
      <div class="ficha-card-val${val ? '' : ' sin-dato'}">${val || 'Sin cargar'}</div>
    </div>`;
  const colorChip = `<span style="display:inline-flex; align-items:center; gap:8px;"><span style="width:16px; height:16px; border-radius:4px; background:${prof.color}; display:inline-block;"></span>${prof.color}</span>`;

  abrirModal(`
    <style>.modal{max-width:820px;}</style>
    <div class="modal-header">
      <div class="modal-titulo" style="font-size:15px; font-weight:600;">Ficha del profesional</div>
      <button class="modal-cerrar" onclick="cerrarModal()">×</button>
    </div>
    <div class="modal-body" style="padding:0;">
      <div class="ficha-cols">
        <aside class="ficha-resumen">
          <div class="ficha-avatar-wrap">
            ${avatarHTML(prof.nombre, prof.color, prof.foto_url, 72)}
            ${puedeEditar ? `
              <button type="button" class="ficha-foto-btn" title="Cambiar foto" onclick="document.getElementById('foto-input-${prof.id}').click()">${CAMARA_SVG}</button>
              <input type="file" id="foto-input-${prof.id}" accept="image/*" style="display:none" onchange="subirFotoProfesional('${prof.id}', this.files[0])">
            ` : ''}
          </div>
          ${(puedeEditar && prof.foto_url) ? `<button type="button" class="ficha-foto-quitar" onclick="quitarFotoProfesional('${prof.id}')">Quitar foto</button>` : ''}
          <div class="ficha-nombre">${prof.nombre}</div>
          <div class="ficha-dni">Profesional</div>
          <div style="margin-top:10px;">${estadoBadge}</div>
          <div class="ficha-resumen-datos">
            <div><span>Matrícula</span><strong>${prof.matricula || '—'}</strong></div>
            <div><span>Teléfono</span><strong>${prof.telefono || '—'}</strong></div>
            <div><span>Cuenta</span><strong>${tieneLogin ? (cuentaActiva ? 'Activa' : 'Inactiva') : 'Sin login'}</strong></div>
          </div>
          ${puedeEditar ? `<button class="btn btn-primary-sm ficha-editar" onclick="cerrarModal(); setTimeout(()=>abrirModalProfesional('${prof.id}'),60);">Editar datos</button>` : ''}
          <button class="btn ficha-editar" style="margin-top:8px;" onclick="cerrarModal(); setTimeout(()=>abrirModalHorarios('${prof.id}'),60);">Horarios de atención</button>
        </aside>

        <div class="ficha-main">
          <div class="ficha-tabs">
            <button class="ficha-tab active" data-ftab="datos" onclick="fichaTab('datos')">Datos</button>
            <button class="ficha-tab" data-ftab="cuenta" onclick="fichaTab('cuenta')">Cuenta</button>
          </div>

          <div class="ficha-panel active" data-fpanel="datos">
            <div class="ficha-cards">
              ${card('mat', 'Matrícula', prof.matricula)}
              ${card('tel', 'Teléfono', prof.telefono)}
              ${card('mail', 'Email', email, true)}
              ${card('color', 'Color en agenda', colorChip, true)}
            </div>
          </div>

          <div class="ficha-panel" data-fpanel="cuenta">
            ${tieneLogin ? `
              <div class="ficha-cards">
                ${card('mail', 'Email de acceso', email, true)}
                ${card('user', 'Estado de la cuenta', cuentaActiva ? 'Activa' : 'Inactiva')}
              </div>
              ${(puede(usuarioActual, 'crear_profesional') || usuarioActual.id === prof.usuario_id) ? `
                <div style="margin-top:14px;">
                  <button type="button" class="btn btn-primary-sm" onclick="cerrarModal(); setTimeout(()=>abrirGestionCuenta('${prof.usuario_id}','${(prof.nombre || '').replace(/'/g, "\\'")}','${(email || '').replace(/'/g, "\\'")}'),60);">Cambiar contraseña / email</button>
                </div>
              ` : ''}
            ` : `
              <div class="vacio" style="padding:1.5rem;">Este profesional no tiene login propio (atiende con la cuenta del dueño).</div>
            `}
          </div>
        </div>
      </div>
    </div>
    <div class="modal-footer" style="justify-content:space-between; align-items:center;">
      <div style="font-size:12px; color:var(--texto-tenue); display:flex; align-items:center; gap:6px;">${ic(ICO.lock, 14)} Datos del equipo · uso interno.</div>
      <button class="btn" onclick="cerrarModal()">Cerrar</button>
    </div>
  `);
}

async function cargarProfesionales() {
  const { data, error } = await sb.from('profesionales').select('*').order('nombre');
  if (error) { mostrarMensaje('Error al cargar', 'error'); return; }

  const cont = document.getElementById('prof-count');
  if (cont) cont.textContent = `Profesionales (${data.length})`;

  const tbody = document.getElementById('tabla-profesionales');
  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="vacio">No hay profesionales cargados</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(p => `
    <tr>
      <td>
        <div class="lista-nombre">
          ${avatarHTML(p.nombre, p.color, p.foto_url, 36)}
          <span class="lista-nombre-txt">${p.nombre}</span>
        </div>
      </td>
      <td>${p.matricula || '—'}</td>
      <td>${p.telefono || '—'}</td>
      <td>
        <span style="display:inline-block; width:18px; height:18px; background:${p.color}; border-radius:4px; vertical-align:middle;"></span>
      </td>
      <td>${p.activo ? '<span class="badge badge-llego">Activo</span>' : '<span class="badge badge-cancelado">Inactivo</span>'}</td>
      <td>
        <div class="lista-acciones">
          <button class="lista-acc-btn" onclick="verFichaProfesional('${p.id}')" title="Ver ficha">${PROF_ICO.ojo}</button>
          <button class="lista-acc-btn" onclick="abrirModalHorarios('${p.id}')" title="Horarios">${PROF_ICO.reloj}</button>
          <button class="lista-acc-btn" onclick="abrirModalProfesional('${p.id}')" title="Editar">${PROF_ICO.lapiz}</button>
          <button class="lista-acc-btn peligro" onclick="eliminarProfesional('${p.id}')" title="Eliminar">${PROF_ICO.tacho}</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function abrirModalProfesional(id) {
  const esAlta = !id;

  // El alta de profesional (login + registro) es solo del dueño.
  if (esAlta && !puede(usuarioActual, 'crear_profesional')) {
    mostrarMensaje('Solo el dueño puede dar de alta profesionales.', 'advertencia');
    return;
  }

  // Tope del plan: solo al CREAR. Si ya llegó al máximo, ni abrimos.
  // De paso nos quedamos con el plan, para saber si mostrar el tilde "full".
  let planNegocio = null;
  if (esAlta) {
    const tope = await topeProfesionalesNegocio();
    if (tope && tope.alcanzado) {
      mostrarMensaje(`Llegaste al límite de tu plan: ${tope.max} profesionales (tenés ${tope.actual}). Para sumar más, cambiá de plan.`, 'error');
      return;
    }
    planNegocio = tope?.plan || null;
  }

  let prof = { nombre:'', matricula:'', telefono:'', color:'#534AB7', activo:true };
  if (id) {
    const { data } = await sb.from('profesionales').select('*').eq('id', id).single();
    if (data) prof = data;
  }

  // El "full (sin login)" solo tiene sentido al crear y en Plan 1.
  // (Si algún día el full se habilita en otro plan o por prueba, se cambia acá.)
  const mostrarFull = esAlta && planNegocio === 'plan_1';

  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">${id ? 'Editar profesional' : 'Nuevo profesional'}</div>
      <button class="modal-cerrar" onclick="cerrarModal()">×</button>
    </div>
    <form id="form-profesional">
      <div class="modal-body">
        <div class="input-group">
          <label>Nombre completo *</label>
          <input type="text" name="nombre" value="${prof.nombre || ''}" required>
        </div>
        <div class="form-row">
          <div class="input-group">
            <label>Matrícula</label>
            <input type="text" name="matricula" value="${prof.matricula || ''}">
          </div>
          <div class="input-group">
            <label>Teléfono</label>
            <input type="text" name="telefono" value="${prof.telefono || ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="input-group">
            <label>Color en agenda</label>
            <input type="color" name="color" value="${prof.color || '#534AB7'}">
          </div>
          <div class="input-group">
            <label>Estado</label>
            <select name="activo">
              <option value="true" ${prof.activo?'selected':''}>Activo</option>
              <option value="false" ${!prof.activo?'selected':''}>Inactivo</option>
            </select>
          </div>
        </div>

        ${esAlta ? `
          ${mostrarFull ? `
            <label style="display:flex; align-items:flex-start; gap:8px; padding:10px 12px; border:1px solid var(--borde); border-radius:var(--radio); margin-bottom:1rem; cursor:pointer;">
              <input type="checkbox" name="es_full" id="check-full" onchange="toggleFullProfesional(this.checked)" style="margin-top:2px;">
              <span>
                <strong>Soy yo (sin login propio)</strong>
                <div style="font-size:12px; color:var(--texto-secundario);">
                  Te suma a la agenda atendiendo con tu propia cuenta de dueño. No crea un usuario nuevo, pero igual cuenta para el tope del plan.
                </div>
              </span>
            </label>
          ` : ''}

          <div id="bloque-credenciales">
            <div class="input-group">
              <label>Email (para que entre a la app) *</label>
              <input type="email" name="email" placeholder="profesional@email.com">
            </div>
            <div class="input-group">
              <label>Contraseña *</label>
              <input type="text" name="password" minlength="6" placeholder="Mínimo 6 caracteres">
              <small style="color: var(--texto-tenue); display:block; margin-top: 4px;">
                Anotala bien: se la pasás al profesional para que entre la primera vez.
              </small>
            </div>
          </div>
        ` : ''}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn" onclick="cerrarModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary-sm" id="btn-guardar-prof">${id ? 'Guardar' : 'Crear profesional'}</button>
      </div>
    </form>
  `);

  document.getElementById('form-profesional').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const d = Object.fromEntries(fd.entries());
    const activo = d.activo === 'true';
    const btn = document.getElementById('btn-guardar-prof');

    // ---------- EDICIÓN: solo datos de agenda, el login NO se toca ----------
    if (id) {
      const datos = {
        nombre: d.nombre.trim(),
        matricula: d.matricula || null,
        telefono: d.telefono || null,
        color: d.color,
        activo
      };
      btn.disabled = true; btn.textContent = 'Guardando...';
      const res = await sb.from('profesionales').update(datos).eq('id', id);
      if (res.error) {
        mostrarMensaje('Error: ' + res.error.message, 'error');
        btn.disabled = false; btn.textContent = 'Guardar';
        return;
      }
      mostrarMensaje('Actualizado', 'exito');
      cerrarModal();
      await cargarProfesionales();
      return;
    }

    // ---------- ALTA ----------
    const esFullNuevo = d.es_full === 'on';

    // Caso full (Plan 1): el dueño aparece en la agenda con su propia cuenta.
    // No crea login nuevo; el registro queda atado a usuarioActual.id.
    if (esFullNuevo) {
      const { data: yaExiste } = await sb.from('profesionales')
        .select('id')
        .eq('negocio_id', usuarioActual.negocio_id)
        .eq('usuario_id', usuarioActual.id)
        .maybeSingle();
      if (yaExiste) {
        mostrarMensaje('Ya figurás como profesional en la agenda.', 'advertencia');
        return;
      }

      btn.disabled = true; btn.textContent = 'Creando...';
      const datos = {
        nombre: d.nombre.trim(),
        matricula: d.matricula || null,
        telefono: d.telefono || null,
        color: d.color,
        activo,
        usuario_id: usuarioActual.id,           // el dueño es quien atiende
        negocio_id: usuarioActual.negocio_id
      };
      const res = await sb.from('profesionales').insert(datos);
      if (res.error) {
        mostrarMensaje('Error: ' + res.error.message, 'error');
        btn.disabled = false; btn.textContent = 'Crear profesional';
        return;
      }
      mostrarMensaje('Listo, ya figurás en la agenda', 'exito');
      cerrarModal();
      await cargarProfesionales();
      return;
    }

    // Caso normal: profesional CON login. Lo crea la Edge Function,
    // que arma el login Y el registro de agenda juntos (atómico).
    const email = (d.email || '').trim().toLowerCase();
    const password = d.password || '';
    if (!email || password.length < 6) {
      mostrarMensaje('Poné email y una contraseña de al menos 6 caracteres.', 'advertencia');
      return;
    }

    btn.disabled = true; btn.textContent = 'Creando...';
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) throw new Error('Sesión expirada');

      const response = await fetch(`${SUPABASE_URL}/functions/v1/crear-usuario`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          email,
          password,
          nombre: d.nombre.trim(),
          rol: 'profesional',
          // Datos del registro de agenda: los crea la MISMA función.
          profesional: {
            matricula: d.matricula || null,
            telefono: d.telefono || null,
            color: d.color,
            activo
          }
        })
      });

      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error || 'Error desconocido');

      mostrarMensaje('Profesional creado (entra a la app y ya aparece en la agenda)', 'exito');
      cerrarModal();
      await cargarProfesionales();
    } catch (error) {
      mostrarMensaje('Error: ' + error.message, 'error');
      btn.disabled = false; btn.textContent = 'Crear profesional';
    }
  });
}

// Muestra/oculta email+contraseña según el tilde "full", y de paso
// completa el nombre con el del dueño si quedó vacío.
function toggleFullProfesional(checked) {
  const bloque = document.getElementById('bloque-credenciales');
  if (bloque) bloque.style.display = checked ? 'none' : 'block';
  if (checked) {
    const nombre = document.querySelector('#form-profesional [name="nombre"]');
    if (nombre && !nombre.value.trim()) nombre.value = usuarioActual.nombre || '';
  }
}

async function eliminarProfesional(id) {
  if (!confirm('¿Eliminar este profesional? (Lo saca de la agenda. Si tiene login propio, esa cuenta queda viva: la desactivás desde Mi equipo o se borra manual.)')) return;
  const { error } = await sb.from('profesionales').delete().eq('id', id);
  if (error) {
    mostrarMensaje('No se puede eliminar: tiene turnos asociados', 'error');
    return;
  }
  mostrarMensaje('Eliminado', 'exito');
  await cargarProfesionales();
}

// ============================================================
// HORARIOS DEL PROFESIONAL (días laborales fijos + días especiales)
// Modal aparte, lo abren dueño y recepción (ambos administran agendas).
// Lee/escribe en: dias_laborales_profesional, dias_especiales_profesional
// ============================================================

const DIAS_SEMANA = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

// Estado en memoria mientras el modal está abierto.
let _horariosProf = null;       // { id, nombre, negocio_id }
let _horariosLaborales = [];    // filas de dias_laborales_profesional
let _horariosEspeciales = [];   // filas de dias_especiales_profesional

async function abrirModalHorarios(profesionalId) {
  const { data: prof, error } = await sb.from('profesionales')
    .select('id, nombre, negocio_id')
    .eq('id', profesionalId)
    .single();

  if (error || !prof) { mostrarMensaje('No se pudo cargar el profesional', 'error'); return; }
  _horariosProf = prof;

  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">Horarios · ${prof.nombre}</div>
      <button class="modal-cerrar" onclick="cerrarModal()">×</button>
    </div>
    <div class="modal-body">
      <div style="margin-bottom: 1.5rem;">
        <div style="font-weight: 600; font-size: 14px; margin-bottom: 0.25rem;">Días laborales (semana fija)</div>
        <div style="font-size: 12px; color: var(--texto-secundario); margin-bottom: 0.75rem;">
          El horario habitual que se repite todas las semanas. Podés agregar más de una franja al mismo día (ej: mañana y tarde).
        </div>
        <div id="lista-laborales"><div class="vacio" style="padding:1rem;">Cargando...</div></div>
        <button class="btn" style="margin-top: 0.75rem; font-size: 12px; padding: 6px 12px;" onclick="agregarFranjaLaboral()">+ Agregar franja</button>
      </div>

      <div style="border-top: 1px solid var(--borde-tenue); padding-top: 1.25rem;">
        <div style="font-weight: 600; font-size: 14px; margin-bottom: 0.25rem;">Días especiales (excepciones)</div>
        <div style="font-size: 12px; color: var(--texto-secundario); margin-bottom: 0.75rem;">
          Una fecha puntual: que venga un día que normalmente no trabaja, o que falte un día que sí.
        </div>
        <div id="lista-especiales"><div class="vacio" style="padding:1rem;">Cargando...</div></div>
        <button class="btn" style="margin-top: 0.75rem; font-size: 12px; padding: 6px 12px;" onclick="agregarDiaEspecial()">+ Agregar día especial</button>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="cerrarModal()">Cerrar</button>
    </div>
  `);

  await cargarHorarios();
}

async function cargarHorarios() {
  const profId = _horariosProf.id;

  const { data: laborales } = await sb.from('dias_laborales_profesional')
    .select('*')
    .eq('profesional_id', profId)
    .order('dia_semana')
    .order('hora_inicio');

  const { data: especiales } = await sb.from('dias_especiales_profesional')
    .select('*')
    .eq('profesional_id', profId)
    .order('fecha');

  _horariosLaborales = laborales || [];
  _horariosEspeciales = especiales || [];

  dibujarLaborales();
  dibujarEspeciales();
}

function dibujarLaborales() {
  const cont = document.getElementById('lista-laborales');
  if (!cont) return;

  if (_horariosLaborales.length === 0) {
    cont.innerHTML = '<div class="vacio" style="padding:1rem;">Sin franjas cargadas. Agregá la primera abajo.</div>';
    return;
  }

  cont.innerHTML = `<div style="display:flex; flex-direction:column; gap:8px;">${
    _horariosLaborales.map(f => `
      <div class="turno-row" style="cursor:default;">
        <div style="min-width: 90px; font-weight: 600; font-size: 13px;">${DIAS_SEMANA[f.dia_semana]}</div>
        <div class="turno-row-info">
          <div style="font-size: 13px;">${f.hora_inicio?.slice(0,5)} a ${f.hora_fin?.slice(0,5)}</div>
        </div>
        <button class="btn-icon" title="Eliminar" style="color: var(--peligro);" onclick="eliminarFranjaLaboral('${f.id}')">×</button>
      </div>
    `).join('')
  }</div>`;
}

function dibujarEspeciales() {
  const cont = document.getElementById('lista-especiales');
  if (!cont) return;

  if (_horariosEspeciales.length === 0) {
    cont.innerHTML = '<div class="vacio" style="padding:1rem;">Sin días especiales.</div>';
    return;
  }

  cont.innerHTML = `<div style="display:flex; flex-direction:column; gap:8px;">${
    _horariosEspeciales.map(e => {
      const fechaTxt = new Date(e.fecha + 'T00:00').toLocaleDateString('es-AR', { weekday:'short', day:'numeric', month:'long' });
      const detalle = e.no_viene
        ? '<span style="color: var(--peligro); font-weight: 600;">No viene (ausencia)</span>'
        : `Viene de ${e.hora_inicio?.slice(0,5)} a ${e.hora_fin?.slice(0,5)}`;
      return `
        <div class="turno-row" style="cursor:default;">
          <div style="min-width: 140px; font-weight: 600; font-size: 13px; text-transform: capitalize;">${fechaTxt}</div>
          <div class="turno-row-info"><div style="font-size: 13px;">${detalle}</div></div>
          <button class="btn-icon" title="Eliminar" style="color: var(--peligro);" onclick="eliminarDiaEspecial('${e.id}')">×</button>
        </div>
      `;
    }).join('')
  }</div>`;
}

// ---- Días laborales: alta ----
function agregarFranjaLaboral() {
  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">Nueva franja · ${_horariosProf.nombre}</div>
      <button class="modal-cerrar" onclick="abrirModalHorarios('${_horariosProf.id}')">×</button>
    </div>
    <form id="form-franja">
      <div class="modal-body">
        <div class="input-group">
          <label>Día de la semana *</label>
          <select name="dia_semana" required>
            ${[1,2,3,4,5,6,0].map(d => `<option value="${d}">${DIAS_SEMANA[d]}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="input-group">
            <label>Desde *</label>
            <input type="time" name="hora_inicio" value="09:00" required>
          </div>
          <div class="input-group">
            <label>Hasta *</label>
            <input type="time" name="hora_fin" value="13:00" required>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn" onclick="abrirModalHorarios('${_horariosProf.id}')">Cancelar</button>
        <button type="submit" class="btn btn-primary-sm">Agregar franja</button>
      </div>
    </form>
  `);

  document.getElementById('form-franja').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const d = Object.fromEntries(fd.entries());

    if (d.hora_fin <= d.hora_inicio) {
      mostrarMensaje('La hora de fin tiene que ser mayor a la de inicio.', 'advertencia');
      return;
    }

    const { error } = await sb.from('dias_laborales_profesional').insert({
      negocio_id: _horariosProf.negocio_id,
      profesional_id: _horariosProf.id,
      dia_semana: parseInt(d.dia_semana),
      hora_inicio: d.hora_inicio,
      hora_fin: d.hora_fin
    });

    if (error) {
      const msg = error.code === '23505'
        ? 'Ya existe una franja para ese día que arranca a esa hora.'
        : error.message;
      mostrarMensaje('Error: ' + msg, 'error');
      return;
    }

    mostrarMensaje('Franja agregada', 'exito');
    abrirModalHorarios(_horariosProf.id); // vuelve a la pantalla de horarios, ya recargada
  });
}

async function eliminarFranjaLaboral(id) {
  const franja = _horariosLaborales.find(f => f.id === id);
  if (!franja) return;
  if (!confirm('¿Eliminar esta franja?\n\nSi el profesional deja de trabajar ese día, se liberan los días futuros sin turnos (los que tienen turnos se mantienen).')) return;

  // 1) Borrar la franja
  const { error } = await sb.from('dias_laborales_profesional').delete().eq('id', id);
  if (error) { mostrarMensaje('Error: ' + error.message, 'error'); return; }

  // 2) ¿Le queda otra franja ese MISMO día de la semana? Si sí, sigue trabajando
  //    ese día y no hay nada que liberar.
  const profId = _horariosProf.id;
  const quedanEseDia = _horariosLaborales.some(
    f => f.id !== id && f.dia_semana === franja.dia_semana
  );

  let res = { liberados: 0, mantenidos: [] };
  if (!quedanEseDia) {
    res = await liberarDiasFuturos(profId, franja.dia_semana);
  }

  await cargarHorarios();

  // 3) Avisar el resultado
  if (res.mantenidos.length > 0) {
    alert(
      `Franja eliminada.\n\n` +
      `Días futuros liberados (sin turnos): ${res.liberados}\n\n` +
      `Estos días se mantuvieron porque tienen turnos o el profesional ya estaba agregado a mano:\n` +
      res.mantenidos.map(f => '· ' + formatearFechaCorta(f)).join('\n')
    );
  } else if (res.liberados > 0) {
    mostrarMensaje(`Franja eliminada. Se liberaron ${res.liberados} día(s) futuros.`, 'exito');
  } else {
    mostrarMensaje('Franja eliminada', 'exito');
  }
}

// Etapa 2.5: cuando un profesional deja de trabajar un día de la semana, soltar
// los días FUTUROS donde estaba sentado por ese patrón, salvo que tengan turnos
// o un día especial "viene" (alta manual desde la agenda). El pasado y hoy no se tocan.
async function liberarDiasFuturos(profId, diaSemana) {
  const hoyStr = hoyLocalStr();

  // Días futuros donde este profesional está sentado
  const { data: futuros } = await sb.from('agenda_dia')
    .select('id, fecha')
    .eq('profesional_id', profId)
    .gt('fecha', hoyStr);

  // Solo los que caen en ese día de la semana
  const candidatos = (futuros || []).filter(
    r => new Date(r.fecha + 'T00:00').getDay() === diaSemana
  );
  if (candidatos.length === 0) return { liberados: 0, mantenidos: [] };

  // Fechas con turnos de este profesional (a futuro) → se respetan
  const { data: turnosFut } = await sb.from('turnos')
    .select('fecha_hora')
    .eq('profesional_id', profId)
    .gte('fecha_hora', hoyStr + 'T00:00:00');
  const fechasConTurno = new Set(
    (turnosFut || []).map(t => fechaLocalStr(new Date(t.fecha_hora)))
  );

  // Fechas con día especial "viene" (lo agregaron a mano en la agenda) → se respetan
  const { data: espFut } = await sb.from('dias_especiales_profesional')
    .select('fecha, no_viene')
    .eq('profesional_id', profId)
    .gt('fecha', hoyStr);
  const fechasEspecial = new Set(
    (espFut || []).filter(e => !e.no_viene).map(e => e.fecha)
  );

  const aLiberar = [];
  const mantenidos = [];
  candidatos.forEach(r => {
    if (fechasConTurno.has(r.fecha) || fechasEspecial.has(r.fecha)) {
      mantenidos.push(r.fecha);
    } else {
      aLiberar.push(r.id);
    }
  });

  if (aLiberar.length > 0) {
    const { error } = await sb.from('agenda_dia').delete().in('id', aLiberar);
    if (error) mostrarMensaje('Error al liberar días: ' + error.message, 'error');
  }

  return { liberados: aLiberar.length, mantenidos };
}

// Helpers de fecha local (YYYY-MM-DD) para no mezclar zonas horarias
function fechaLocalStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function hoyLocalStr() { return fechaLocalStr(new Date()); }
function formatearFechaCorta(fechaStr) {
  return new Date(fechaStr + 'T00:00').toLocaleDateString('es-AR', { weekday:'short', day:'numeric', month:'short' });
}

// ---- Días especiales: alta ----
function agregarDiaEspecial() {
  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">Día especial · ${_horariosProf.nombre}</div>
      <button class="modal-cerrar" onclick="abrirModalHorarios('${_horariosProf.id}')">×</button>
    </div>
    <form id="form-especial">
      <div class="modal-body">
        <div class="input-group">
          <label>Fecha *</label>
          <input type="date" name="fecha" required>
        </div>

        <label style="display:flex; align-items:flex-start; gap:8px; padding:10px 12px; border:1px solid var(--borde); border-radius:var(--radio); margin-bottom:1rem; cursor:pointer;">
          <input type="checkbox" name="no_viene" id="check-no-viene" onchange="toggleNoViene(this.checked)" style="margin-top:2px;">
          <span>
            <strong>No viene este día (ausencia)</strong>
            <div style="font-size:12px; color:var(--texto-secundario);">
              Marcá esto si ese día falta. Si lo dejás sin marcar, es un día extra en que sí viene.
            </div>
          </span>
        </label>

        <div id="bloque-horas-especial">
          <div class="form-row">
            <div class="input-group">
              <label>Desde *</label>
              <input type="time" name="hora_inicio" value="09:00">
            </div>
            <div class="input-group">
              <label>Hasta *</label>
              <input type="time" name="hora_fin" value="13:00">
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn" onclick="abrirModalHorarios('${_horariosProf.id}')">Cancelar</button>
        <button type="submit" class="btn btn-primary-sm">Agregar</button>
      </div>
    </form>
  `);

  document.getElementById('form-especial').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const d = Object.fromEntries(fd.entries());
    const noViene = d.no_viene === 'on';

    const fila = {
      negocio_id: _horariosProf.negocio_id,
      profesional_id: _horariosProf.id,
      fecha: d.fecha,
      no_viene: noViene
    };

    if (noViene) {
      fila.hora_inicio = null;
      fila.hora_fin = null;
    } else {
      if (!d.hora_inicio || !d.hora_fin || d.hora_fin <= d.hora_inicio) {
        mostrarMensaje('Poné un horario válido (fin mayor que inicio).', 'advertencia');
        return;
      }
      fila.hora_inicio = d.hora_inicio;
      fila.hora_fin = d.hora_fin;
    }

    // Si es "no viene", ese día no puede tener turnos (sino quedarían sin profesional).
    if (noViene) {
      const di = new Date(d.fecha + 'T00:00:00');
      const df = new Date(d.fecha + 'T23:59:59');
      const { count } = await sb.from('turnos')
        .select('*', { count: 'exact', head: true })
        .eq('profesional_id', _horariosProf.id)
        .gte('fecha_hora', di.toISOString())
        .lte('fecha_hora', df.toISOString());
      if (count && count > 0) {
        mostrarMensaje(`No se puede marcar ausente: tiene ${count} turno${count !== 1 ? 's' : ''} ese día. Reasignalos o cancelalos primero.`, 'error');
        return;
      }
    }

    const { error } = await sb.from('dias_especiales_profesional').insert(fila);

    if (error) {
      const msg = error.code === '23505'
        ? 'Ya hay un día especial cargado para esa fecha con esos datos.'
        : error.message;
      mostrarMensaje('Error: ' + msg, 'error');
      return;
    }

    // "No viene": además de registrar la ausencia, lo saca del tablero de ese día
    // (libera la columna). Solo hoy/futuro; el pasado no se toca.
    if (noViene && d.fecha >= hoyLocalStr()) {
      await sb.from('agenda_dia')
        .delete()
        .eq('profesional_id', _horariosProf.id)
        .eq('fecha', d.fecha);
    }

    mostrarMensaje(noViene ? 'Ausencia registrada' : 'Día especial agregado', 'exito');
    abrirModalHorarios(_horariosProf.id);
  });
}

// Muestra/oculta las horas según el tilde "no viene".
function toggleNoViene(checked) {
  const bloque = document.getElementById('bloque-horas-especial');
  if (bloque) bloque.style.display = checked ? 'none' : 'block';
}

async function eliminarDiaEspecial(id) {
  if (!confirm('¿Eliminar este día especial?')) return;
  const { error } = await sb.from('dias_especiales_profesional').delete().eq('id', id);
  if (error) { mostrarMensaje('Error: ' + error.message, 'error'); return; }
  mostrarMensaje('Día especial eliminado', 'exito');
  await cargarHorarios();
}

// Calcula el tope de profesionales del plan del negocio actual.
// Devuelve { max, actual, alcanzado, plan } o null si no aplica / sin negocio.
// max = null significa "sin límite" (no frena).
async function topeProfesionalesNegocio() {
  const negId = usuarioActual.negocio_id;
  if (!negId) return null; // super admin u otro caso raro: no frenamos acá

  // La vista nos da el plan y cuántos profesionales tiene el negocio hoy.
  const { data: vista } = await sb.from('vista_uso_negocios')
    .select('plan, profesionales_actuales')
    .eq('id', negId)
    .single();
  if (!vista) return null;

  // El máximo lo leemos del plan (la tabla planes es de lectura pública).
  const { data: plan } = await sb.from('planes')
    .select('max_profesionales')
    .eq('id', vista.plan)
    .single();

  const max = plan?.max_profesionales;
  const actual = vista.profesionales_actuales || 0;
  if (max === null || max === undefined) {
    return { max: null, actual, alcanzado: false, plan: vista.plan };
  }
  return { max, actual, alcanzado: actual >= max, plan: vista.plan };
}
