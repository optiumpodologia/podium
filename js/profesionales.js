async function renderProfesionales(container) {
  if (!puedeVerModulo(usuarioActual, 'profesionales')) {
    container.innerHTML = '<div class="vacio">Acceso restringido</div>';
    return;
  }

  // Crear un profesional ahora crea también su login, así que el alta es del
  // dueño (rol 'negocio'). Recepción ve la lista y puede editar, pero no crear.
  const puedeCrear = usuarioActual.rol === 'negocio';

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Profesionales</div>
        <div class="page-subtitle" id="prof-count">Cargando...</div>
      </div>
      ${puedeCrear ? `
        <button class="btn btn-primary-sm" onclick="abrirModalProfesional()">
          <span>+</span> Nuevo profesional
        </button>
      ` : ''}
    </div>

    <div class="card">
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

  await cargarProfesionales();
}

async function cargarProfesionales() {
  const { data, error } = await sb.from('profesionales').select('*').order('nombre');
  if (error) { mostrarMensaje('Error al cargar', 'error'); return; }

  document.getElementById('prof-count').textContent =
    `${data.length} profesional${data.length !== 1 ? 'es' : ''}`;

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
  if (esAlta && usuarioActual.rol !== 'negocio') {
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
  if (!confirm('¿Eliminar este profesional? (Lo saca de la agenda. Si tiene login propio, esa cuenta queda viva: la desactivás desde Usuarios.)')) return;
  const { error } = await sb.from('profesionales').delete().eq('id', id);
  if (error) {
    mostrarMensaje('No se puede eliminar: tiene turnos asociados', 'error');
    return;
  }
  mostrarMensaje('Eliminado', 'exito');
  await cargarProfesionales();
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
