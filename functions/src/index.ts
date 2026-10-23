/**
 * Cloud Functions de Stoica (v2, región São Paulo, la misma que Firestore).
 *
 * Cuentas:      alCrearUsuario, alCambiarPerfil, borrarMiCuenta
 * Admin:        asignarRol, adminSuspender, adminBorrarCuenta, adminCalcularMetricas, metricasNocturnas
 * Comunidad:    crearGrupo, unirseAGrupo, salirDeGrupo, eliminarGrupo, alReaccionar
 * Avisos:       enviarRecordatorios
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, type DocumentReference } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { setGlobalOptions } from 'firebase-functions/v2';
import { defineString } from 'firebase-functions/params';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { ROLES, type Rol } from './core/validaciones.js';
import { calcularMetricas, type Cuenta } from './core/admin.js';
import { esCodigo, generarCodigo, MAX_GRUPOS_POR_USUARIO, MAX_MIEMBROS, normalizarCodigo, REACCIONES, validarNombreGrupo, type Grupo, type Reaccion } from './core/comunidad.js';
import { claveDia, franjaActual, ZONA_POR_DEFECTO } from './core/fechas.js';
import { cumplido, esDiaActivo, idRegistro, type Habito, type Registro } from './core/habitos.js';
import { examenCompleto, type Examen } from './core/rutina.js';
import { limpiarNombre } from './core/validaciones.js';
import type { Perfil } from './core/perfil.js';

initializeApp();
setGlobalOptions({ region: 'southamerica-east1', maxInstances: 5, memory: '256MiB' });

/** Correo del admin. Se carga desde la variable ADMIN_EMAIL del repositorio al publicar (no está en el código). */
const ADMIN_EMAIL = defineString('ADMIN_EMAIL', { default: '' });

const db = () => getFirestore();

// ---------- Utilidades ----------
function exigirSesion(req: CallableRequest): string {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Tenés que entrar primero.');
  return req.auth.uid;
}

function exigirAdmin(req: CallableRequest): string {
  const uid = exigirSesion(req);
  if (req.auth?.token.rol !== 'admin') throw new HttpsError('permission-denied', 'Solo el admin puede hacer esto.');
  return uid;
}

export function rolInicial(correo: string | undefined, verificado: boolean, adminEmail: string): Rol {
  const a = adminEmail.trim().toLowerCase();
  if (a && verificado && correo && correo.trim().toLowerCase() === a) return 'admin';
  return 'usuario';
}

/** Saca a una persona de un grupo: su resumen, sus progresos y las reacciones de y para ella. */
async function quitarDeGrupo(gid: string, uid: string) {
  const ref = db().doc(`groups/${gid}`);
  const borrar: DocumentReference[] = [db().doc(`groups/${gid}/members/${uid}`)];
  const [de, para, desafios] = await Promise.all([
    db().collection(`groups/${gid}/reactions`).where('de', '==', uid).get(),
    db().collection(`groups/${gid}/reactions`).where('para', '==', uid).get(),
    db().collection(`groups/${gid}/challenges`).get(),
  ]);
  de.docs.forEach((d) => borrar.push(d.ref));
  para.docs.forEach((d) => borrar.push(d.ref));
  desafios.docs.forEach((d) => borrar.push(d.ref.collection('progress').doc(uid)));
  await db().runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists) return;
    const g = snap.data() as Grupo;
    const quedan = g.miembros.filter((m) => m !== uid);
    if (quedan.length === 0) t.delete(ref);
    else t.update(ref, { miembros: quedan, creador: g.creador === uid ? quedan[0] : g.creador });
  });
  const lote = db().bulkWriter();
  borrar.forEach((r) => lote.delete(r));
  await lote.close();
  // Si el grupo quedó vacío, se borra entero.
  if (!(await ref.get()).exists) await db().recursiveDelete(ref);
}

async function borrarTodoDeUsuario(uid: string) {
  const grupos = await db().collection('groups').where('miembros', 'array-contains', uid).get();
  for (const g of grupos.docs) await quitarDeGrupo(g.id, uid);
  await db().recursiveDelete(db().doc(`users/${uid}`));
  await db().doc(`accounts/${uid}`).delete();
  await getAuth()
    .deleteUser(uid)
    .catch((e) => logger.warn('No se pudo borrar el usuario de Auth', { uid, e: String(e) }));
}

// ---------- Cuentas ----------
export const alCrearUsuario = onDocumentCreated('users/{uid}', async (event) => {
  const uid = event.params.uid;
  const datos = event.data?.data() ?? {};
  let correo: string | undefined;
  let verificado = false;
  let alta = Date.now();
  try {
    const u = await getAuth().getUser(uid);
    correo = u.email;
    verificado = u.emailVerified;
    alta = Date.parse(u.metadata.creationTime) || alta;
  } catch {
    logger.warn('Usuario sin registro en Auth', { uid });
    return;
  }
  const rol = rolInicial(correo, verificado, ADMIN_EMAIL.value());
  await getAuth().setCustomUserClaims(uid, { rol });
  const batch = db().batch();
  batch.set(event.data!.ref, { rol }, { merge: true });
  batch.set(
    db().doc(`accounts/${uid}`),
    {
      nombre: typeof datos.nombre === 'string' ? datos.nombre.slice(0, 40) : '',
      correo: correo ?? '',
      alta,
      ultimoAcceso: Date.now(),
      plataforma: '',
      rol,
      suspendida: false,
      actualizadoPor: 'servidor',
    },
    { merge: true },
  );
  await batch.commit();
  logger.info('Cuenta creada', { uid, rol });
});

/** Mantiene el nombre de accounts/{uid} igual al del perfil. */
export const alCambiarPerfil = onDocumentUpdated('users/{uid}', async (event) => {
  const antes = event.data?.before.data();
  const despues = event.data?.after.data();
  if (!antes || !despues || antes.nombre === despues.nombre) return;
  await db()
    .doc(`accounts/${event.params.uid}`)
    .set({ nombre: String(despues.nombre).slice(0, 40), actualizadoPor: 'servidor' }, { merge: true });
});

export const borrarMiCuenta = onCall(async (req) => {
  const uid = exigirSesion(req);
  await borrarTodoDeUsuario(uid);
  logger.info('Cuenta borrada por su dueño', { uid });
  return { ok: true };
});

// ---------- Admin ----------
export const asignarRol = onCall(async (req) => {
  const yo = exigirAdmin(req);
  const { uid, rol } = (req.data ?? {}) as { uid?: unknown; rol?: unknown };
  if (typeof uid !== 'string' || !uid || typeof rol !== 'string' || !(ROLES as readonly string[]).includes(rol)) {
    throw new HttpsError('invalid-argument', 'Faltan datos válidos (uid y rol).');
  }
  if (uid === yo && rol !== 'admin') throw new HttpsError('failed-precondition', 'No podés quitarte tu propio rol de admin.');
  await getAuth().setCustomUserClaims(uid, { rol });
  const batch = db().batch();
  batch.set(db().doc(`users/${uid}`), { rol }, { merge: true });
  batch.set(db().doc(`accounts/${uid}`), { rol, actualizadoPor: yo }, { merge: true });
  await batch.commit();
  return { ok: true };
});

export const adminSuspender = onCall(async (req) => {
  const yo = exigirAdmin(req);
  const { uid, suspender } = (req.data ?? {}) as { uid?: unknown; suspender?: unknown };
  if (typeof uid !== 'string' || !uid || typeof suspender !== 'boolean') throw new HttpsError('invalid-argument', 'Datos inválidos.');
  if (uid === yo) throw new HttpsError('failed-precondition', 'No podés suspender tu propia cuenta.');
  await getAuth().updateUser(uid, { disabled: suspender });
  if (suspender) await getAuth().revokeRefreshTokens(uid);
  await db().doc(`accounts/${uid}`).set({ suspendida: suspender, actualizadoPor: yo }, { merge: true });
  logger.info(suspender ? 'Cuenta suspendida' : 'Cuenta reactivada', { uid, por: yo });
  return { ok: true };
});

export const adminBorrarCuenta = onCall(async (req) => {
  const yo = exigirAdmin(req);
  const { uid } = (req.data ?? {}) as { uid?: unknown };
  if (typeof uid !== 'string' || !uid) throw new HttpsError('invalid-argument', 'Datos inválidos.');
  if (uid === yo) throw new HttpsError('failed-precondition', 'Para borrar tu cuenta usá Perfil › Borrar mi cuenta.');
  await borrarTodoDeUsuario(uid);
  logger.info('Cuenta borrada por el admin', { uid, por: yo });
  return { ok: true };
});

async function guardarMetricas() {
  const cuentas = (await db().collection('accounts').get()).docs.map((d) => d.data() as Cuenta);
  const contar = async (tipo: string) => (await db().collectionGroup('habits').where('tipo', '==', tipo).count().get()).data().count;
  const [sino, cantidad, medicion] = await Promise.all([contar('sino'), contar('cantidad'), contar('medicion')]);
  const m = calcularMetricas(cuentas, { sino, cantidad, medicion }, Date.now(), ZONA_POR_DEFECTO);
  await db().doc(`metrics/${m.fecha}`).set(m);
  return m;
}

export const adminCalcularMetricas = onCall(async (req) => {
  exigirAdmin(req);
  return guardarMetricas();
});

export const metricasNocturnas = onSchedule({ schedule: '10 3 * * *', timeZone: ZONA_POR_DEFECTO }, async () => {
  const m = await guardarMetricas();
  // Limpieza: marcas de avisos de reacciones de más de 3 días.
  const viejas = await db().collection('avisosReaccion').where('creado', '<', Date.now() - 3 * 864e5).limit(500).get();
  const lote = db().bulkWriter();
  viejas.docs.forEach((d) => lote.delete(d.ref));
  await lote.close();
  logger.info('Métricas del día', { fecha: m.fecha, total: m.total, limpiadas: viejas.size });
});

// ---------- Comunidad ----------
export const crearGrupo = onCall(async (req) => {
  const uid = exigirSesion(req);
  const nombre = limpiarNombre(String((req.data as { nombre?: unknown })?.nombre ?? ''));
  const err = validarNombreGrupo(nombre);
  if (err) throw new HttpsError('invalid-argument', err);
  const mios = await db().collection('groups').where('miembros', 'array-contains', uid).count().get();
  if (mios.data().count >= MAX_GRUPOS_POR_USUARIO) throw new HttpsError('resource-exhausted', `Podés estar en hasta ${MAX_GRUPOS_POR_USUARIO} grupos.`);
  let codigo = generarCodigo();
  for (let i = 0; i < 5 && !(await db().collection('groups').where('codigo', '==', codigo).limit(1).get()).empty; i++) codigo = generarCodigo();
  const ref = db().collection('groups').doc();
  await ref.set({ nombre, creador: uid, codigo, miembros: [uid], creado: Date.now() });
  return { id: ref.id, codigo };
});

export const unirseAGrupo = onCall(async (req) => {
  const uid = exigirSesion(req);
  const codigo = normalizarCodigo(String((req.data as { codigo?: unknown })?.codigo ?? ''));
  if (!esCodigo(codigo)) throw new HttpsError('invalid-argument', 'Ese código no es válido.');
  const q = await db().collection('groups').where('codigo', '==', codigo).limit(1).get();
  if (q.empty) throw new HttpsError('not-found', 'No encontramos un grupo con ese código.');
  const ref = q.docs[0].ref;
  const mios = await db().collection('groups').where('miembros', 'array-contains', uid).count().get();
  await db().runTransaction(async (t) => {
    const g = (await t.get(ref)).data() as Grupo;
    if (g.miembros.includes(uid)) return;
    if (g.miembros.length >= MAX_MIEMBROS) throw new HttpsError('resource-exhausted', `El grupo ya tiene ${MAX_MIEMBROS} integrantes.`);
    if (mios.data().count >= MAX_GRUPOS_POR_USUARIO) throw new HttpsError('resource-exhausted', `Podés estar en hasta ${MAX_GRUPOS_POR_USUARIO} grupos.`);
    t.update(ref, { miembros: FieldValue.arrayUnion(uid) });
  });
  return { id: ref.id };
});

export const salirDeGrupo = onCall(async (req) => {
  const uid = exigirSesion(req);
  const gid = String((req.data as { grupoId?: unknown })?.grupoId ?? '');
  if (!gid) throw new HttpsError('invalid-argument', 'Falta el grupo.');
  const g = await db().doc(`groups/${gid}`).get();
  if (!g.exists || !(g.data() as Grupo).miembros.includes(uid)) return { ok: true };
  await quitarDeGrupo(gid, uid);
  return { ok: true };
});

export const eliminarGrupo = onCall(async (req) => {
  const uid = exigirSesion(req);
  const gid = String((req.data as { grupoId?: unknown })?.grupoId ?? '');
  const ref = db().doc(`groups/${gid}`);
  const g = await ref.get();
  if (!g.exists) return { ok: true };
  if ((g.data() as Grupo).creador !== uid) throw new HttpsError('permission-denied', 'Solo quien creó el grupo puede eliminarlo.');
  await db().recursiveDelete(ref);
  return { ok: true };
});

// ---------- Notificaciones ----------
interface Aviso {
  titulo: string;
  cuerpo: string;
  url: string;
  tag: string;
}

/** Envía a todos los dispositivos de una persona y limpia los tokens que ya no sirven. */
async function avisar(uid: string, aviso: Aviso) {
  const dispositivos = await db().collection(`users/${uid}/devices`).get();
  if (dispositivos.empty) return 0;
  const tokens = dispositivos.docs.map((d) => String(d.get('token') ?? '')).filter(Boolean);
  if (!tokens.length) return 0;
  const r = await getMessaging().sendEachForMulticast({
    tokens,
    data: { ...aviso },
    webpush: { headers: { Urgency: 'high', TTL: '3600' } },
  });
  const malos: Array<Promise<unknown>> = [];
  r.responses.forEach((x, i) => {
    const codigo = x.error?.code ?? '';
    if (codigo.includes('registration-token-not-registered') || codigo.includes('invalid-registration-token') || codigo.includes('invalid-argument')) {
      malos.push(dispositivos.docs[i].ref.delete());
    }
  });
  await Promise.all(malos);
  return r.successCount;
}

/** Corre cada 15 minutos: recordatorios de hábitos pendientes y aviso del examen nocturno. */
export const enviarRecordatorios = onSchedule({ schedule: 'every 15 minutes', timeZone: 'UTC' }, async () => {
  const ahora = new Date();
  const franja = franjaActual(ahora);
  const perfiles = new Map<string, Perfil | null>();
  const perfil = async (uid: string) => {
    if (!perfiles.has(uid)) perfiles.set(uid, ((await db().doc(`users/${uid}`).get()).data() as Perfil | undefined) ?? null);
    return perfiles.get(uid)!;
  };
  const porUsuario = new Map<string, Habito[]>();

  const habitos = await db().collectionGroup('habits').where('recordatorioSlot', '==', franja).get();
  for (const d of habitos.docs) {
    const h = { id: d.id, ...d.data() } as Habito;
    const uid = d.ref.parent.parent?.id;
    if (!uid || h.archivado) continue;
    const p = await perfil(uid);
    if (!p?.notificaciones) continue;
    const hoy = claveDia(ahora, p.zonaHoraria);
    if (!esDiaActivo(h, hoy)) continue;
    const r = (await db().doc(`users/${uid}/logs/${idRegistro(h.id, hoy)}`).get()).data() as Registro | undefined;
    if (cumplido(h, r)) continue;
    porUsuario.set(uid, [...(porUsuario.get(uid) ?? []), h]);
  }
  let enviados = 0;
  for (const [uid, hs] of porUsuario) {
    enviados += await avisar(uid, {
      titulo: hs.length === 1 ? hs[0].nombre : `${hs.length} prácticas pendientes`,
      cuerpo: hs.length === 1 ? 'Es el momento de tu práctica. Lo que depende de ti, hacelo ahora.' : hs.map((h) => h.nombre).join(' · '),
      url: hs.length === 1 ? `/habitos/${hs[0].id}` : '/',
      tag: `recordatorio-${franja}`,
    });
  }

  const examen = await db().collection('users').where('examenSlot', '==', franja).get();
  for (const d of examen.docs) {
    const p = d.data() as Perfil;
    if (!p.notificaciones) continue;
    const hoy = claveDia(ahora, p.zonaHoraria);
    const e = (await db().doc(`users/${d.id}/journal/${hoy}`).get()).data() as Examen | undefined;
    if (examenCompleto(e)) continue;
    enviados += await avisar(d.id, { titulo: 'Examen nocturno', cuerpo: '¿Qué mal he corregido hoy? Tomate cinco minutos para cerrar el día.', url: '/examen', tag: 'examen' });
  }
  logger.info('Recordatorios', { franja, habitos: habitos.size, examen: examen.size, enviados });
});

/** Aviso cuando alguien reacciona a tu día (v0.9). */
export const alReaccionar = onDocumentCreated('groups/{gid}/reactions/{rid}', async (event) => {
  const r = event.data?.data() as Reaccion | undefined;
  if (!r || r.de === r.para) return;
  // Un solo aviso por día, por quien reacciona y por destinatario (aunque borre y vuelva a reaccionar).
  // avisosReaccion/** lo escribe solo el servidor: las reglas no lo abren a la app.
  const marca = db().doc(`avisosReaccion/${event.params.gid}_${event.params.rid}`);
  try {
    await marca.create({ creado: Date.now() });
  } catch {
    return; // ya se avisó hoy
  }
  const p = (await db().doc(`users/${r.para}`).get()).data() as Perfil | undefined;
  if (!p || p.notifReacciones === false || !p.notificaciones) return;
  const g = (await db().doc(`groups/${event.params.gid}`).get()).data() as Grupo | undefined;
  if (!g || !g.miembros.includes(r.para) || !g.miembros.includes(r.de)) return;
  const tipo = REACCIONES.find((x) => x.id === r.tipo);
  // El nombre se toma de la cuenta (no del documento de la reacción, que lo escribe el cliente).
  const nombreDe = String((await db().doc(`accounts/${r.de}`).get()).get('nombre') || 'Alguien').slice(0, 40);
  await avisar(r.para, {
    titulo: `${tipo?.simbolo ?? '🌿'} ${nombreDe}`,
    cuerpo: `Te dejó «${tipo?.texto ?? 'una reacción'}» en ${g.nombre}.`,
    url: `/comunidad/${event.params.gid}`,
    tag: `reaccion-${event.params.gid}`,
  });
});
