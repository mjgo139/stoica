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
import { getStorage } from 'firebase-admin/storage';
import { randomInt, randomUUID } from 'node:crypto';
import { setGlobalOptions } from 'firebase-functions/v2';
import { defineString } from 'firebase-functions/params';
import { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { ROLES, type Rol } from './core/validaciones.js';
import { calcularMetricas, type Cuenta } from './core/admin.js';
import { esCodigo, generarCodigo, MAX_GRUPOS_POR_USUARIO, MAX_MIEMBROS, normalizarCodigo, REACCIONES, validarNombreGrupo, type Grupo, type Miembro, type Reaccion } from './core/comunidad.js';
import { claveDia, minutoActual, ZONA_POR_DEFECTO } from './core/fechas.js';
import { cumplido, esDiaActivo, idRegistro, type Habito, type Registro } from './core/habitos.js';
import { examenCompleto, idTareaHecha, tareaDelDia, tareaHecha, type Examen, type Tarea, type TareaHecha } from './core/rutina.js';
import { limpiarNombre } from './core/validaciones.js';
import { COLECCIONES_CONTADAS, LIMITES_ABUSO, sumarCreacion, topeDeColeccion, type Cuota } from './core/limites.js';
import type { Perfil } from './core/perfil.js';
import {
  CODIGOS_POR_VEZ,
  DIAS_GRACIA_DEFECTO,
  diasGraciaValidos,
  esCodigoPlan,
  estadoPlan,
  extenderPlan,
  FOTO_MAX_BYTES,
  generarCodigoPlan,
  idFotoHabito,
  INTENTOS_CODIGO_HORA,
  MENSAJE_MAX,
  MESES_PLAN,
  MINI_MAX_BYTES,
  normalizarCodigoPlan,
  type CodigoPlan,
  type FotoHabito,
  type MesesPlan,
} from './core/plan.js';

initializeApp();
setGlobalOptions({ region: 'southamerica-east1', maxInstances: 5, memory: '256MiB' });

/** Correo del admin. Se carga desde la variable ADMIN_EMAIL del repositorio al publicar (no está en el código). */
const ADMIN_EMAIL = defineString('ADMIN_EMAIL', { default: '' });

const db = () => getFirestore();

/**
 * App Check: con EXIGIR_APP_CHECK=true (variable del repositorio) las funciones llamables solo aceptan
 * pedidos que vienen de la app publicada. Empieza en false para medir primero y no cortar a nadie.
 */
const EXIGIR_APP_CHECK = process.env.EXIGIR_APP_CHECK === 'true';
const llamable = { enforceAppCheck: EXIGIR_APP_CHECK };

/** Cambia algunos claims sin borrar los demás (rol, bloqueado). */
async function ponerClaims(uid: string, cambios: Record<string, unknown>) {
  const u = await getAuth().getUser(uid);
  await getAuth().setCustomUserClaims(uid, { ...(u.customClaims ?? {}), ...cambios });
}

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
  // Sus fotos y mensajes en el grupo (los archivos se borran con alBorrarFotoGrupo).
  const propias = await Promise.all([db().collection(`groups/${gid}/fotos`).where('de', '==', uid).get(), db().collection(`groups/${gid}/mensajes`).where('de', '==', uid).get()]);
  propias.forEach((q) => q.docs.forEach((p) => borrar.push(p.ref)));
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
  if (!(await ref.get()).exists) {
    await db().recursiveDelete(ref);
    await borrarArchivos(`grupos/${gid}/`);
  }
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
/**
 * Prepara la cuenta: rol (claim y perfil) y ficha no privada para el admin.
 * Nunca baja a nadie de rol: solo lo asigna si falta o lo sube a admin si el correo coincide y está verificado.
 */
async function prepararCuenta(uid: string, nombre: unknown): Promise<Rol | null> {
  let correo: string | undefined;
  let verificado = false;
  let alta = Date.now();
  let claims: Record<string, unknown> = {};
  try {
    const u = await getAuth().getUser(uid);
    correo = u.email;
    verificado = u.emailVerified;
    alta = Date.parse(u.metadata.creationTime) || alta;
    claims = u.customClaims ?? {};
  } catch {
    logger.warn('Usuario sin registro en Auth', { uid });
    return null;
  }
  const perfilRef = db().doc(`users/${uid}`);
  const cuentaRef = db().doc(`accounts/${uid}`);
  const [perfil, cuenta] = await Promise.all([perfilRef.get(), cuentaRef.get()]);
  const actual = (perfil.get('rol') as Rol | undefined) ?? (claims.rol as Rol | undefined);
  const calculado = rolInicial(correo, verificado, ADMIN_EMAIL.value());
  const rol: Rol = calculado === 'admin' ? 'admin' : (actual ?? 'usuario');
  if (claims.rol !== rol) await ponerClaims(uid, { rol });
  const batch = db().batch();
  if (perfil.exists && perfil.get('rol') !== rol) batch.set(perfilRef, { rol }, { merge: true });
  if (!cuenta.exists) {
    batch.set(cuentaRef, {
      nombre: typeof nombre === 'string' ? nombre.slice(0, 40) : '',
      correo: correo ?? '',
      alta,
      ultimoAcceso: Date.now(),
      plataforma: '',
      rol,
      suspendida: false,
      actualizadoPor: 'servidor',
    });
  } else if (cuenta.get('rol') !== rol) {
    batch.set(cuentaRef, { rol, actualizadoPor: 'servidor' }, { merge: true });
  }
  await batch.commit();
  return rol;
}

export const alCrearUsuario = onDocumentCreated('users/{uid}', async (event) => {
  const uid = event.params.uid;
  const rol = await prepararCuenta(uid, event.data?.get('nombre'));
  logger.info('Cuenta creada', { uid, rol });
});

/**
 * La app lo llama una vez por dispositivo si el perfil no tiene rol o es "usuario": arregla las cuentas
 * creadas antes de que existiera el servidor, o cuando el correo del admin se configuró después.
 */
export const asegurarCuenta = onCall(llamable, async (req) => {
  const uid = exigirSesion(req);
  const nombre = (await db().doc(`users/${uid}`).get()).get('nombre');
  const rol = await prepararCuenta(uid, nombre);
  return { rol };
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

export const borrarMiCuenta = onCall(llamable, async (req) => {
  const uid = exigirSesion(req);
  await borrarTodoDeUsuario(uid);
  logger.info('Cuenta borrada por su dueño', { uid });
  return { ok: true };
});

// ---------- Admin ----------
export const asignarRol = onCall(llamable, async (req) => {
  const yo = exigirAdmin(req);
  const { uid, rol } = (req.data ?? {}) as { uid?: unknown; rol?: unknown };
  if (typeof uid !== 'string' || !uid || typeof rol !== 'string' || !(ROLES as readonly string[]).includes(rol)) {
    throw new HttpsError('invalid-argument', 'Faltan datos válidos (uid y rol).');
  }
  if (uid === yo && rol !== 'admin') throw new HttpsError('failed-precondition', 'No podés quitarte tu propio rol de admin.');
  await ponerClaims(uid, { rol });
  const batch = db().batch();
  batch.set(db().doc(`users/${uid}`), { rol }, { merge: true });
  batch.set(db().doc(`accounts/${uid}`), { rol, actualizadoPor: yo }, { merge: true });
  await batch.commit();
  return { ok: true };
});

export const adminSuspender = onCall(llamable, async (req) => {
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

export const adminBorrarCuenta = onCall(llamable, async (req) => {
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
  const [sino, cantidad, medicion, lista] = await Promise.all([contar('sino'), contar('cantidad'), contar('medicion'), contar('lista')]);
  const m = calcularMetricas(cuentas, { sino, cantidad, medicion, lista }, Date.now(), ZONA_POR_DEFECTO);
  await db().doc(`metrics/${m.fecha}`).set(m);
  return m;
}

export const adminCalcularMetricas = onCall(llamable, async (req) => {
  exigirAdmin(req);
  return guardarMetricas();
});

export const metricasNocturnas = onSchedule({ schedule: '10 3 * * *', timeZone: ZONA_POR_DEFECTO, timeoutSeconds: 300 }, async () => {
  const m = await guardarMetricas();
  // Limpieza: marcas de borrado de más de 60 días (los dispositivos se resincronizan completos cada 30).
  const marcas = await db().collectionGroup('borrados').where('actualizado', '<', Date.now() - 60 * 864e5).limit(500).get();
  const loteMarcas = db().bulkWriter();
  marcas.docs.forEach((d) => loteMarcas.delete(d.ref));
  await loteMarcas.close();
  // Limpieza: marcas de avisos de reacciones de más de 3 días.
  const viejas = await db().collection('avisosReaccion').where('creado', '<', Date.now() - 3 * 864e5).limit(500).get();
  const lote = db().bulkWriter();
  viejas.docs.forEach((d) => lote.delete(d.ref));
  await lote.close();
  const planes = await revisarPlanes().catch((e) => (logger.error('Revisión de planes falló', { e: String(e) }), null));
  const deDesafios = await limpiarPublicacionesDeDesafios().catch((e) => (logger.error('Limpieza de desafíos falló', { e: String(e) }), null));
  logger.info('Métricas del día', { fecha: m.fecha, total: m.total, limpiadas: viejas.size, planes, deDesafios });
});

// ---------- Comunidad ----------
export const crearGrupo = onCall(llamable, async (req) => {
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

export const unirseAGrupo = onCall(llamable, async (req) => {
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

export const salirDeGrupo = onCall(llamable, async (req) => {
  const uid = exigirSesion(req);
  const gid = String((req.data as { grupoId?: unknown })?.grupoId ?? '');
  if (!gid) throw new HttpsError('invalid-argument', 'Falta el grupo.');
  const g = await db().doc(`groups/${gid}`).get();
  if (!g.exists || !(g.data() as Grupo).miembros.includes(uid)) return { ok: true };
  await quitarDeGrupo(gid, uid);
  return { ok: true };
});

/** Solo quien creó el grupo le cambia el nombre. */
export const renombrarGrupo = onCall(llamable, async (req) => {
  const uid = exigirSesion(req);
  const { grupoId, nombre } = (req.data ?? {}) as { grupoId?: unknown; nombre?: unknown };
  const ref = db().doc(`groups/${String(grupoId ?? '')}`);
  const g = (await ref.get()).data() as Grupo | undefined;
  if (!g) throw new HttpsError('not-found', 'Ese grupo ya no existe.');
  if (g.creador !== uid) throw new HttpsError('permission-denied', 'Solo quien creó el grupo puede cambiarle el nombre.');
  const n = limpiarNombre(String(nombre ?? ''));
  const err = validarNombreGrupo(n);
  if (err) throw new HttpsError('invalid-argument', err);
  await ref.update({ nombre: n });
  return { ok: true };
});

export const eliminarGrupo = onCall(llamable, async (req) => {
  const uid = exigirSesion(req);
  const gid = String((req.data as { grupoId?: unknown })?.grupoId ?? '');
  const ref = db().doc(`groups/${gid}`);
  const g = await ref.get();
  if (!g.exists) return { ok: true };
  if ((g.data() as Grupo).creador !== uid) throw new HttpsError('permission-denied', 'Solo quien creó el grupo puede eliminarlo.');
  await db().recursiveDelete(ref);
  await borrarArchivos(`grupos/${gid}/`);
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

/**
 * Corre cada minuto: recordatorios de hábitos pendientes, aviso del examen nocturno y avisos de tareas.
 * Cada consulta cuesta al menos 1 lectura aunque no devuelva nada: ~3 por minuto (~4.300 por día, dentro
 * de la cuota gratis de 50.000). Los documentos de versiones anteriores (franjas de 15 min) se siguen
 * buscando en los minutos 0, 15, 30 y 45.
 */
export const enviarRecordatorios = onSchedule({ schedule: 'every 1 minutes', timeZone: 'UTC', retryCount: 0, timeoutSeconds: 50 }, async () => {
  const ahora = new Date();
  const min = minutoActual(ahora);
  const cuarto = min % 15 === 0 ? min / 15 : null;
  const perfiles = new Map<string, Perfil | null>();
  const perfil = async (uid: string) => {
    if (!perfiles.has(uid)) perfiles.set(uid, ((await db().doc(`users/${uid}`).get()).data() as Perfil | undefined) ?? null);
    return perfiles.get(uid)!;
  };

  // ----- Hábitos -----
  const porUsuario = new Map<string, Habito[]>();
  const consultas = [db().collectionGroup('habits').where('avisos', 'array-contains', min).get()];
  if (cuarto !== null) consultas.push(db().collectionGroup('habits').where('recordatorioSlot', '==', cuarto).get());
  const vistos = new Set<string>();
  let nHabitos = 0;
  for (const snap of await Promise.all(consultas)) {
    for (const d of snap.docs) {
      if (vistos.has(d.ref.path)) continue;
      vistos.add(d.ref.path);
      nHabitos++;
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
  }
  let enviados = 0;
  for (const [uid, hs] of porUsuario) {
    enviados += await avisar(uid, {
      titulo: hs.length === 1 ? hs[0].nombre : `${hs.length} prácticas pendientes`,
      cuerpo: hs.length === 1 ? 'Es el momento de tu práctica. Lo que depende de ti, hacelo ahora.' : hs.map((h) => h.nombre).join(' · '),
      url: hs.length === 1 ? `/habitos/${hs[0].id}` : '/',
      tag: `recordatorio-${min}`,
    });
  }

  // ----- Examen nocturno -----
  const examenes = [db().collection('users').where('examenMin', '==', min).get()];
  if (cuarto !== null) examenes.push(db().collection('users').where('examenSlot', '==', cuarto).get());
  const yaExamen = new Set<string>();
  for (const snap of await Promise.all(examenes)) {
    for (const d of snap.docs) {
      const p = d.data() as Perfil;
      if (yaExamen.has(d.id) || !p.notificaciones) continue;
      // Un perfil nuevo tiene examenMin: no se usa su franja vieja.
      if (typeof p.examenMin === 'number' && p.examenMin !== min) continue;
      yaExamen.add(d.id);
      const hoy = claveDia(ahora, p.zonaHoraria);
      const e = (await db().doc(`users/${d.id}/journal/${hoy}`).get()).data() as Examen | undefined;
      if (examenCompleto(e)) continue;
      enviados += await avisar(d.id, { titulo: 'Examen nocturno', cuerpo: '¿Qué mal he corregido hoy? Tomate cinco minutos para cerrar el día.', url: '/examen', tag: 'examen' });
    }
  }

  // ----- Tareas con hora -----
  const tareas = await db().collectionGroup('tasks').where('avisoMin', '==', min).get();
  for (const d of tareas.docs) {
    const t = { id: d.id, ...d.data() } as Tarea;
    const uid = d.ref.parent.parent?.id;
    if (!uid || !t.dependeDeTi) continue;
    const p = await perfil(uid);
    if (!p?.notificaciones) continue;
    const hoy = claveDia(ahora, p.zonaHoraria);
    if (!(t.repetir === 'diaria' ? tareaDelDia(t, hoy) : t.fecha === hoy)) continue;
    const marca = (await db().doc(`users/${uid}/taskDone/${idTareaHecha(t.id, hoy)}`).get()).data() as TareaHecha | undefined;
    const hechas = new Set(marca && marca.hecha !== false ? [idTareaHecha(t.id, hoy)] : []);
    if (tareaHecha(t, hoy, hechas)) continue;
    enviados += await avisar(uid, { titulo: t.titulo.slice(0, 80), cuerpo: 'Tarea para ahora. Si depende de ti, hacela; si no, soltala.', url: '/tareas', tag: `tarea-${t.id}` });
  }

  if (nHabitos || yaExamen.size || tareas.size) logger.info('Recordatorios', { min, habitos: nHabitos, examen: yaExamen.size, tareas: tareas.size, enviados });
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


// ---------- Avisos de la actividad del grupo ----------
type CampoAvisoGrupo = 'notifCumplidos' | 'notifFotos' | 'notifMensajes';

/** Marca de "ya se avisó" (la lee y escribe solo el servidor; se limpia sola a los 3 días). */
async function primeraVez(clave: string): Promise<boolean> {
  try {
    await db().doc(`avisosReaccion/${clave}`).create({ creado: Date.now() });
    return true;
  } catch {
    return false;
  }
}

/** Avisa a los demás integrantes que tengan activado ese tipo de aviso. */
async function avisarAlGrupo(gid: string, de: string, campo: CampoAvisoGrupo, aviso: (g: Grupo, nombreDe: string) => Aviso) {
  const g = (await db().doc(`groups/${gid}`).get()).data() as Grupo | undefined;
  if (!g || !g.miembros.includes(de)) return 0;
  // El nombre se toma de la cuenta (no de lo que escribe la app).
  const nombreDe = String((await db().doc(`accounts/${de}`).get()).get('nombre') || 'Alguien').slice(0, 40);
  const a = aviso(g, nombreDe);
  let enviados = 0;
  await Promise.all(
    g.miembros
      .filter((m) => m !== de)
      .map(async (m) => {
        const p = (await db().doc(`users/${m}`).get()).data() as Perfil | undefined;
        if (!p?.notificaciones || p[campo] === false) return;
        enviados += await avisar(m, a);
      }),
  );
  return enviados;
}

/** Cuando un integrante cumple hoy un hábito que comparte, se avisa al grupo (una vez por hábito y día). */
export const alActualizarMiembro = onDocumentUpdated('groups/{gid}/members/{uid}', async (event) => {
  const antes = event.data?.before.data() as Miembro | undefined;
  const despues = event.data?.after.data() as Miembro | undefined;
  if (!despues) return;
  const { gid, uid } = event.params;
  for (const c of despues.compartidos ?? []) {
    if (!c.hoy) continue;
    const previo = antes?.fecha === despues.fecha ? antes?.compartidos?.find((x) => x.habitId === c.habitId) : undefined;
    if (previo?.hoy) continue;
    if (!(await primeraVez(`cumple_${gid}_${uid}_${c.habitId}_${despues.fecha}`))) continue;
    await avisarAlGrupo(gid, uid, 'notifCumplidos', (g, nombre) => ({
      titulo: `✓ ${nombre} cumplió ${c.nombre}`,
      cuerpo: `${g.nombre}${c.racha > 1 ? ` · racha de ${c.racha} días` : ''}. Dejale una reacción.`,
      url: `/comunidad/${gid}`,
      tag: `cumple-${gid}-${uid}`,
    }));
  }
});

// ---------- Protección contra abuso ----------
async function bloquear(uid: string, motivo: string) {
  await ponerClaims(uid, { bloqueado: true });
  await getAuth().revokeRefreshTokens(uid);
  await db().doc(`accounts/${uid}`).set({ bloqueada: true, motivoBloqueo: motivo, actualizadoPor: 'servidor' }, { merge: true });
  logger.warn('Cuenta bloqueada automáticamente', { uid, motivo });
}

/** Cuenta una creación del día; si se pasa del tope, bloquea la cuenta (una sola vez). */
async function contarCreacion(uid: string) {
  const ref = db().doc(`cuotas/${uid}`);
  const hoy = claveDia(new Date(), ZONA_POR_DEFECTO);
  const c = await db().runTransaction(async (t) => {
    const nueva = sumarCreacion((await t.get(ref)).data() as Cuota | undefined, hoy);
    t.set(ref, { dia: nueva.dia, n: nueva.n });
    return nueva;
  });
  if (c.excedido && c.n === LIMITES_ABUSO.creacionesPorDia + 1) await bloquear(uid, `Más de ${LIMITES_ABUSO.creacionesPorDia} documentos nuevos en un día`);
  return c;
}

/** Vigila lo que se crea en los datos privados: tope diario y tope por colección. */
export const vigilarCreaciones = onDocumentCreated('users/{uid}/{col}/{id}', async (event) => {
  const { uid, col } = event.params;
  if (!(COLECCIONES_CONTADAS as readonly string[]).includes(col)) return;
  await contarCreacion(uid);
  const tope = topeDeColeccion(col);
  if (tope !== null) {
    const cantidad = (await db().collection(`users/${uid}/${col}`).count().get()).data().count;
    if (cantidad > tope) {
      await event.data?.ref.delete();
      logger.warn('Documento borrado por superar el tope', { uid, col, cantidad, tope });
    }
  }
});

/** Desafíos: tope por grupo y cuenta para quien los crea. */
export const vigilarDesafios = onDocumentCreated('groups/{gid}/challenges/{cid}', async (event) => {
  const creador = String(event.data?.get('creador') ?? '');
  if (creador) await contarCreacion(creador);
  const cantidad = (await db().collection(`groups/${event.params.gid}/challenges`).count().get()).data().count;
  if (cantidad > LIMITES_ABUSO.desafiosPorGrupo) await db().recursiveDelete(event.data!.ref);
});

/** Manda un aviso de prueba a tus propios dispositivos (como mucho uno por minuto). */
export const probarNotificacion = onCall({ ...llamable, timeoutSeconds: 30 }, async (req) => {
  const uid = exigirSesion(req);
  const ref = db().doc(`cuotas/${uid}`);
  const ultima = Number((await ref.get()).get('ultimaPrueba') ?? 0);
  const falta = Math.ceil((60_000 - (Date.now() - ultima)) / 1000);
  if (falta > 0) throw new HttpsError('resource-exhausted', `Ya te mandamos uno. Podés probar otra vez en ${falta} segundos.`);
  await ref.set({ ultimaPrueba: Date.now() }, { merge: true });
  // Espera 10 segundos para que la persona alcance a salir de la app o bloquear el celular:
  // con la app abierta, Android suele mostrar el aviso sin ventana ni sonido.
  await new Promise((r) => setTimeout(r, 10_000));
  const dispositivos = (await db().collection(`users/${uid}/devices`).get()).size;
  const enviados = await avisar(uid, { titulo: 'Aviso de prueba', cuerpo: 'Las notificaciones llegan a este dispositivo.', url: '/perfil', tag: `prueba-${Date.now()}` });
  logger.info('Prueba de aviso', { dispositivos, enviados });
  return { enviados, dispositivos };
});

export const adminDesbloquear = onCall(llamable, async (req) => {
  const yo = exigirAdmin(req);
  const { uid } = (req.data ?? {}) as { uid?: unknown };
  if (typeof uid !== 'string' || !uid) throw new HttpsError('invalid-argument', 'Datos inválidos.');
  await ponerClaims(uid, { bloqueado: false });
  await db().doc(`cuotas/${uid}`).delete();
  await db().doc(`accounts/${uid}`).set({ bloqueada: false, motivoBloqueo: '', actualizadoPor: yo }, { merge: true });
  return { ok: true };
});

// ---------- Plan con fotos y chat (pago por grupo) ----------
const MS_DIA = 864e5;

async function diasGracia(): Promise<number> {
  return diasGraciaValidos((await db().doc('config/plan').get()).get('diasGracia') ?? DIAS_GRACIA_DEFECTO);
}

/** Bucket de las fotos (US-EAST1, con cuota gratis). Se nombra explícito: las funciones pueden haberse publicado antes de crearlo. */
const configFirebase = (() => {
  try {
    return JSON.parse(process.env.FIREBASE_CONFIG ?? '{}') as { projectId?: string; storageBucket?: string };
  } catch {
    return {};
  }
})();
const almacen = () => getStorage().bucket(configFirebase.storageBucket || `${configFirebase.projectId || process.env.GCLOUD_PROJECT}.firebasestorage.app`);

const carpetaGrupo = (gid: string) => `grupos/${gid}/`;
const carpetaDesafio = (gid: string, cid: string) => `grupos/${gid}/desafios/${cid}/`; // versión anterior (fotos por desafío)

async function borrarArchivos(prefijo: string) {
  try {
    await almacen().deleteFiles({ prefix: prefijo, force: true });
  } catch (e) {
    logger.warn('No se pudieron borrar archivos', { prefijo, e: String(e) });
  }
}

/** Borra todas las fotos y mensajes del grupo (al vencer la espera o al eliminarlo). */
async function borrarContenidoPlan(gid: string) {
  await db().recursiveDelete(db().collection(`groups/${gid}/fotos`));
  await db().recursiveDelete(db().collection(`groups/${gid}/mensajes`));
  const desafios = await db().collection(`groups/${gid}/challenges`).get();
  for (const d of desafios.docs) await db().recursiveDelete(d.ref.collection('posts')); // versión anterior
  await borrarArchivos(carpetaGrupo(gid));
}

/**
 * Una sola vez (y después no encuentra nada): borra las fotos y mensajes que quedaron dentro de los desafíos
 * de la versión anterior. Ahora las fotos y el chat viven en el grupo.
 */
async function limpiarPublicacionesDeDesafios() {
  const viejas = await db().collectionGroup('posts').limit(400).get();
  if (viejas.empty) return 0;
  const carpetas = new Set<string>();
  const lote = db().bulkWriter();
  for (const d of viejas.docs) {
    const desafio = d.ref.parent.parent;
    const grupo = desafio?.parent.parent;
    if (desafio && grupo) carpetas.add(carpetaDesafio(grupo.id, desafio.id));
    lote.delete(d.ref);
  }
  await lote.close();
  for (const c of carpetas) await borrarArchivos(c);
  return viejas.size;
}

async function exigirMiembro(uid: string, gid: string): Promise<Grupo & { premiumHasta?: number }> {
  if (!gid) throw new HttpsError('invalid-argument', 'Falta el grupo.');
  const g = (await db().doc(`groups/${gid}`).get()).data() as Grupo | undefined;
  if (!g || !g.miembros.includes(uid)) throw new HttpsError('permission-denied', 'No estás en este grupo.');
  return g;
}

/** Admin: genera códigos de habilitación (de un solo uso). */
export const adminCrearCodigos = onCall(llamable, async (req) => {
  exigirAdmin(req);
  const { meses, cantidad, nota } = (req.data ?? {}) as { meses?: unknown; cantidad?: unknown; nota?: unknown };
  const m = Number(meses);
  const n = Math.round(Number(cantidad ?? 1));
  if (!(MESES_PLAN as readonly number[]).includes(m)) throw new HttpsError('invalid-argument', 'Elegí 1, 3, 6 o 12 meses.');
  if (!(n >= 1 && n <= CODIGOS_POR_VEZ)) throw new HttpsError('invalid-argument', `Podés generar de 1 a ${CODIGOS_POR_VEZ} códigos por vez.`);
  const codigos: string[] = [];
  const lote = db().batch();
  while (codigos.length < n) {
    const c = generarCodigoPlan(() => randomInt(0, 1_000_000) / 1_000_000);
    if (codigos.includes(c) || (await db().doc(`codigos/${c}`).get()).exists) continue;
    codigos.push(c);
    const datos: CodigoPlan = { meses: m as MesesPlan, nota: limpiarNombre(String(nota ?? '')).slice(0, 60), creado: Date.now(), usado: false, usadoPor: null, grupoId: null, grupoNombre: null, usadoEn: null };
    lote.create(db().doc(`codigos/${c}`), datos);
  }
  await lote.commit();
  return { codigos };
});

/** Cualquier integrante activa (o extiende) el plan del grupo con un código. */
export const canjearCodigo = onCall(llamable, async (req) => {
  const uid = exigirSesion(req);
  const { grupoId, codigo } = (req.data ?? {}) as { grupoId?: unknown; codigo?: unknown };
  const gid = String(grupoId ?? '');
  await exigirMiembro(uid, gid);

  // Límite de intentos fallidos por hora, para que no se puedan adivinar códigos.
  const cuota = db().doc(`cuotas/${uid}`);
  const c = (await cuota.get()).data() ?? {};
  const ventana = Number(c.ventanaCodigo ?? 0);
  const fallidos = Date.now() - ventana < 3600_000 ? Number(c.intentosCodigo ?? 0) : 0;
  if (fallidos >= INTENTOS_CODIGO_HORA) throw new HttpsError('resource-exhausted', 'Demasiados intentos. Probá de nuevo en una hora.');
  const fallar = async (msg: string) => {
    await cuota.set({ intentosCodigo: fallidos + 1, ventanaCodigo: fallidos === 0 ? Date.now() : ventana }, { merge: true });
    throw new HttpsError('not-found', msg);
  };

  const cod = normalizarCodigoPlan(String(codigo ?? ''));
  if (!esCodigoPlan(cod)) return fallar('Ese código no es válido. Revisá que esté bien escrito.');
  const refCodigo = db().doc(`codigos/${cod}`);
  const refGrupo = db().doc(`groups/${gid}`);
  const r = await db().runTransaction(async (t) => {
    const [sc, sg] = await Promise.all([t.get(refCodigo), t.get(refGrupo)]);
    if (!sc.exists) return { error: 'Ese código no existe.' };
    const k = sc.data() as CodigoPlan;
    if (k.usado) return { error: 'Ese código ya se usó.' };
    const g = sg.data() as Grupo;
    const hasta = extenderPlan(g.premiumHasta, Date.now(), k.meses);
    t.update(refGrupo, { premiumHasta: hasta, premiumBorrado: FieldValue.delete() });
    t.update(refCodigo, { usado: true, usadoPor: uid, grupoId: gid, grupoNombre: g.nombre, usadoEn: Date.now() });
    return { hasta, meses: k.meses };
  });
  if ('error' in r) return fallar(r.error!);
  logger.info('Plan activado', { gid, meses: r.meses });
  return r;
});

/**
 * Sube la foto de hoy de un hábito que la persona comparte en el grupo (reducida en el celular).
 * Queda ligada al hábito y a si ese día se cumplió. Una por hábito y día: si sube otra, reemplaza.
 */
export const subirFotoGrupo = onCall({ ...llamable, memory: '512MiB' }, async (req) => {
  const uid = exigirSesion(req);
  const { grupoId, habitId, foto, mini, texto } = (req.data ?? {}) as { grupoId?: unknown; habitId?: unknown; foto?: unknown; mini?: unknown; texto?: unknown };
  const gid = String(grupoId ?? '');
  const hid = String(habitId ?? '');
  const g = await exigirMiembro(uid, gid);
  if (estadoPlan(g.premiumHasta, Date.now(), await diasGracia()).estado !== 'activo') throw new HttpsError('failed-precondition', 'El grupo no tiene el plan con fotos activo.');
  if (!/^[\w-]{1,40}$/.test(hid)) throw new HttpsError('invalid-argument', 'Falta el hábito.');
  const [miembro, habito, perfilSnap] = await Promise.all([db().doc(`groups/${gid}/members/${uid}`).get(), db().doc(`users/${uid}/habits/${hid}`).get(), db().doc(`users/${uid}`).get()]);
  const compartidos = (miembro.get('compartidos') as Array<{ habitId: string }> | undefined) ?? [];
  if (!habito.exists || !compartidos.some((c) => c.habitId === hid)) throw new HttpsError('permission-denied', 'Solo podés subir fotos de los hábitos que compartís en este grupo.');
  const jpeg = (v: unknown, max: number) => {
    const b = Buffer.from(String(v ?? ''), 'base64');
    if (b.length < 100 || b.length > max || b[0] !== 0xff || b[1] !== 0xd8) throw new HttpsError('invalid-argument', 'La foto no es válida o es muy pesada.');
    return b;
  };
  const bFoto = jpeg(foto, FOTO_MAX_BYTES);
  const bMini = jpeg(mini, MINI_MAX_BYTES);
  const leyenda = limpiarNombre(String(texto ?? '')).slice(0, MENSAJE_MAX);
  const perfil = perfilSnap.data() as Perfil | undefined;
  const dia = claveDia(new Date(), perfil?.zonaHoraria ?? ZONA_POR_DEFECTO);
  const h = habito.data() as Habito;
  const registro = (await db().doc(`users/${uid}/logs/${idRegistro(hid, dia)}`).get()).data() as Registro | undefined;
  const bucket = almacen();
  const guardarArchivo = async (ruta: string, datos: Buffer) => {
    const token = randomUUID();
    await bucket.file(ruta).save(datos, { contentType: 'image/jpeg', resumable: false, metadata: { cacheControl: 'private, max-age=31536000', metadata: { firebaseStorageDownloadTokens: token } } });
    return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(ruta)}?alt=media&token=${token}`;
  };
  // Nombre nuevo cada vez: si reemplaza la de hoy, la dirección vieja deja de funcionar.
  const base = `${carpetaGrupo(gid)}fotos/${uid}/${hid}_${dia}_${Date.now().toString(36)}`;
  const rutas = [`${base}.jpg`, `${base}_mini.jpg`];
  const [fotoUrl, miniUrl] = await Promise.all([guardarArchivo(rutas[0], bFoto), guardarArchivo(rutas[1], bMini)]);
  const ref = db().doc(`groups/${gid}/fotos/${idFotoHabito(uid, hid, dia)}`);
  const previa = (await ref.get()).data() as FotoHabito | undefined;
  const f: FotoHabito = {
    de: uid,
    nombre: String(perfil?.nombre ?? '').slice(0, 40),
    habitId: hid,
    habito: String(h.nombre ?? '').slice(0, 40),
    dia,
    cumplido: cumplido(h, registro),
    texto: leyenda,
    fotoUrl,
    miniUrl,
    rutas,
    creado: previa?.creado ?? Date.now(),
    actualizado: Date.now(),
    actualizadoPor: 'servidor',
  };
  await ref.set(f);
  if (previa?.rutas) await Promise.all(previa.rutas.map((x) => bucket.file(x).delete({ ignoreNotFound: true })));
  await contarCreacion(uid);
  // Aviso al grupo solo la primera foto del día de ese hábito (si la reemplaza, no se repite).
  if (!previa) {
    await avisarAlGrupo(gid, uid, 'notifFotos', (g, nombre) => ({
      titulo: `📷 ${nombre} subió una foto`,
      cuerpo: `${f.habito} · ${f.cumplido ? 'cumplido' : 'no cumplido'}${f.texto ? `: ${f.texto}` : ''} (${g.nombre})`,
      url: `/comunidad/${gid}`,
      tag: `foto-${gid}-${uid}`,
    })).catch((e) => logger.warn('No se pudo avisar la foto', { e: String(e) }));
  }
  return { ok: true, cumplido: f.cumplido };
});

/** Al borrar una foto del grupo, se borran sus archivos. */
export const alBorrarFotoGrupo = onDocumentDeleted('groups/{gid}/fotos/{fid}', async (event) => {
  const rutas = (event.data?.get('rutas') as string[] | undefined) ?? [];
  if (!rutas.length) return;
  const bucket = almacen();
  await Promise.all(rutas.map((x) => bucket.file(x).delete({ ignoreNotFound: true }).catch(() => undefined)));
});

/** Archivos de las fotos de la versión anterior (por desafío), mientras se terminan de limpiar. */
export const alBorrarPublicacion = onDocumentDeleted('groups/{gid}/challenges/{cid}/posts/{pid}', async (event) => {
  const rutas = (event.data?.get('rutas') as string[] | undefined) ?? [];
  if (!rutas.length) return;
  const bucket = almacen();
  await Promise.all(rutas.map((x) => bucket.file(x).delete({ ignoreNotFound: true }).catch(() => undefined)));
});

/** Mensajes del chat del grupo: cuentan para el tope diario de creaciones de quien escribe. */
export const vigilarMensajes = onDocumentCreated('groups/{gid}/mensajes/{mid}', async (event) => {
  const de = String(event.data?.get('de') ?? '');
  if (!de) return;
  const c = await contarCreacion(de);
  if (c.excedido) return void (await event.data?.ref.delete());
  // Aviso al grupo: como mucho uno cada 3 minutos por persona y grupo (si escribe varios seguidos).
  const franja = Math.floor(Date.now() / (3 * 60_000));
  if (!(await primeraVez(`chat_${event.params.gid}_${de}_${franja}`))) return;
  const texto = String(event.data?.get('texto') ?? '').slice(0, 120);
  await avisarAlGrupo(event.params.gid, de, 'notifMensajes', (g, nombre) => ({
    titulo: `${nombre} en ${g.nombre}`,
    cuerpo: texto,
    url: `/comunidad/${event.params.gid}`,
    tag: `chat-${event.params.gid}`,
  }));
});

/** Al borrar un desafío, se borra lo que pudiera quedar de la versión anterior. */
export const alBorrarDesafio = onDocumentDeleted('groups/{gid}/challenges/{cid}', async (event) => {
  const ref = db().doc(`groups/${event.params.gid}/challenges/${event.params.cid}`);
  await db().recursiveDelete(ref.collection('posts'));
  await db().recursiveDelete(ref.collection('progress'));
  await borrarArchivos(carpetaDesafio(event.params.gid, event.params.cid));
});

/** Cualquier integrante puede reportar una publicación: el admin ve solo lo reportado. */
export const reportarPublicacion = onCall(llamable, async (req) => {
  const uid = exigirSesion(req);
  const { grupoId, coleccion, publicacionId, motivo } = (req.data ?? {}) as Record<string, unknown>;
  const gid = String(grupoId ?? '');
  const g = await exigirMiembro(uid, gid);
  if (coleccion !== 'fotos' && coleccion !== 'mensajes') throw new HttpsError('invalid-argument', 'No se sabe qué reportar.');
  const ruta = `groups/${gid}/${coleccion}/${String(publicacionId ?? '')}`;
  const p = (await db().doc(ruta).get()).data() as (Partial<FotoHabito> & { de: string; nombre: string; texto: string }) | undefined;
  if (!p) throw new HttpsError('not-found', 'Esa publicación ya no existe.');
  await db().doc(`reportes/${ruta.replace(/\//g, '_')}`).set({
    ruta,
    grupoNombre: g.nombre,
    autor: p.nombre,
    autorUid: p.de,
    tipo: coleccion === 'fotos' ? 'foto' : 'texto',
    texto: coleccion === 'fotos' ? [p.habito, p.texto].filter(Boolean).join(' · ') : p.texto,
    miniUrl: p.miniUrl ?? null,
    fotoUrl: p.fotoUrl ?? null,
    motivo: limpiarNombre(String(motivo ?? '')).slice(0, 140),
    reportadoPor: uid,
    creado: Date.now(),
  });
  return { ok: true };
});

/** Admin: borra lo reportado (y el reporte) o descarta el reporte. */
export const adminResolverReporte = onCall(llamable, async (req) => {
  exigirAdmin(req);
  const { reporteId, borrar } = (req.data ?? {}) as { reporteId?: unknown; borrar?: unknown };
  const ref = db().doc(`reportes/${String(reporteId ?? '')}`);
  const r = await ref.get();
  if (!r.exists) return { ok: true };
  if (borrar === true) await db().doc(String(r.get('ruta'))).delete();
  await ref.delete();
  return { ok: true };
});

/**
 * Cada noche: avisa a los integrantes cuando el plan está por vencer, cuando venció y el día antes del
 * borrado; y borra fotos y mensajes cuando termina la espera.
 */
async function revisarPlanes() {
  const ahora = Date.now();
  const gracia = await diasGracia();
  const grupos = await db().collection('groups').where('premiumHasta', '>', ahora - (gracia + 30) * MS_DIA).get();
  const fecha = (ms: number) => new Date(ms).toLocaleDateString('es-PY', { day: 'numeric', month: 'long', timeZone: ZONA_POR_DEFECTO });
  const avisarGrupo = async (g: Grupo, aviso: Omit<Aviso, 'url' | 'tag'>, tag: string) => {
    for (const m of g.miembros) {
      const p = (await db().doc(`users/${m}`).get()).data() as Perfil | undefined;
      if (p?.notificaciones) await avisar(m, { ...aviso, url: `/comunidad/${g.id}`, tag });
    }
  };
  let borrados = 0;
  for (const d of grupos.docs) {
    const g = { ...(d.data() as Grupo), id: d.id };
    const hasta = g.premiumHasta!;
    const e = estadoPlan(hasta, ahora, gracia);
    if (e.estado === 'activo' && e.diasRestantes <= 3 && g.avisoPorVencer !== hasta) {
      await avisarGrupo(g, { titulo: `${g.nombre}: el plan vence pronto`, cuerpo: `Las fotos y el chat siguen hasta el ${fecha(hasta)}. Cualquiera del grupo puede renovarlo con un código.` }, `plan-${d.id}`);
      await d.ref.update({ avisoPorVencer: hasta });
    } else if (e.estado === 'gracia') {
      if (g.avisoVencido !== hasta) {
        await avisarGrupo(g, { titulo: `${g.nombre}: el plan venció`, cuerpo: `Las fotos y el chat se borran definitivamente el ${fecha(e.borraEn)}. Renovalo con un código para conservarlos.` }, `plan-${d.id}`);
        await d.ref.update({ avisoVencido: hasta });
      } else if (e.diasParaBorrar <= 1 && g.avisoBorrado !== hasta) {
        await avisarGrupo(g, { titulo: `${g.nombre}: mañana se borran las fotos`, cuerpo: 'Si querés conservarlas, renová el plan con un código hoy.' }, `plan-${d.id}`);
        await d.ref.update({ avisoBorrado: hasta });
      }
    } else if (e.estado === 'borrado' && g.premiumBorrado !== hasta) {
      await borrarContenidoPlan(d.id);
      await d.ref.update({ premiumBorrado: hasta });
      borrados++;
    }
  }
  return { revisados: grupos.size, borrados };
}
