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
              <button class="btn-icon" title="${r.activo ? 'Desactivar' : 'Activar'}"
                onclick="toggleRecepcionActiva('${r.id}', ${!r.activo})"
                style="color: ${r.activo ? 'var(--peligro)' : 'var(--exito)'};">
                ${r.activo ? '🚫' : '✓'}
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
      <td><strong>${p.nombre}</strong></td>
      <td>${p.matricula || '—'}</td>
      <td>${p.telefono || '—'}</td>
      <td>
        <span style="display:inline-block; width:18px; height:18px; background:${p.color}; border-radius:4px; vertical-align:middle;"></span>
      </td>
      <td>${p.activo ? '<span class="badge badge-llego">Activo</span>' : '<span class="badge badge-cancelado">Inactivo</span>'}</td>
      <td>
        <div class="tabla-acciones">
          <button class="btn-icon" onclick="abrirModalHorarios('${p.id}')" title="Horarios">🕐</button>
          <button class="btn-icon" onclick="abrirModalProfesional('${p.id}')" title="Editar">✎</button>
          <button class="btn-icon" onclick="eliminarProfesional('${p.id}')" title="Eliminar" style="color: var(--peligro);">×</button>
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

  // Duración por defecto del negocio (para mostrarla como referencia / placeholder)
  const { data: cfgDur } = await sb.from('configuracion').select('duracion_turno_minutos').eq('id', 1).single();
  const durDefaultNegocio = parseInt(cfgDur?.duracion_turno_minutos) || 45;

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

        ${id ? `
        <div class="input-group">
          <label>Duración del turno (min)</label>
          <input type="number" name="duracion_turno_minutos" min="5" step="5"
            value="${prof.duracion_turno_minutos ?? ''}"
            placeholder="Por defecto del negocio: ${durDefaultNegocio}">
          <small style="color: var(--texto-tenue); display:block; margin-top:4px;">
            Vacío = usa la duración del negocio (${durDefaultNegocio} min). Poné un número para que este profesional atienda con turnos de otra duración.
          </small>
        </div>
        ` : ''}

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
      const durNueva = d.duracion_turno_minutos ? parseInt(d.duracion_turno_minutos) : null;
      const durVieja = prof.duracion_turno_minutos ?? null;

      // Si cambió la duración y tiene turnos a futuro, avisar (los viejos no se tocan).
      if (durNueva !== durVieja) {
        const ahora = new Date().toISOString();
        const { count } = await sb.from('turnos')
          .select('*', { count: 'exact', head: true })
          .eq('profesional_id', id)
          .gte('fecha_hora', ahora)
          .in('estado', ['agendado', 'llego', 'en_atencion']);
        if (count && count > 0) {
          const ok = confirm(
            `Este profesional tiene ${count} turno${count !== 1 ? 's' : ''} a futuro.\n\n` +
            `Esos turnos se mantienen tal cual (con la duración que ya tenían). ` +
            `La nueva duración solo se aplica a los turnos nuevos.\n\n¿Guardar igual?`
          );
          if (!ok) return;
        }
      }

      const datos = {
        nombre: d.nombre.trim(),
        matricula: d.matricula || null,
        telefono: d.telefono || null,
        color: d.color,
        activo,
        duracion_turno_minutos: durNueva
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
  if (!confirm('¿Eliminar esta franja?')) return;
  const { error } = await sb.from('dias_laborales_profesional').delete().eq('id', id);
  if (error) { mostrarMensaje('Error: ' + error.message, 'error'); return; }
  mostrarMensaje('Franja eliminada', 'exito');
  await cargarHorarios();
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

    const { error } = await sb.from('dias_especiales_profesional').insert(fila);

    if (error) {
      const msg = error.code === '23505'
        ? 'Ya hay un día especial cargado para esa fecha con esos datos.'
        : error.message;
      mostrarMensaje('Error: ' + msg, 'error');
      return;
    }

    mostrarMensaje('Día especial agregado', 'exito');
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
