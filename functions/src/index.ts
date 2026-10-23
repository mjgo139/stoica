/**
 * Cloud Functions de Stoica (v2, región São Paulo, la misma que Firestore).
 *
 * alCrearUsuario: cuando la app crea users/{uid} por primera vez, el servidor
 *   le asigna el rol, guarda el rol en el token (custom claim) y crea accounts/{uid}
 *   con los datos no privados que ve el admin.
 * asignarRol: el admin cambia el rol de otra cuenta.
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { defineString } from 'firebase-functions/params';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { ROLES, type Rol } from './core/validaciones.js';

initializeApp();
setGlobalOptions({ region: 'southamerica-east1', maxInstances: 5, memory: '256MiB' });

/** Correo del admin. Se carga desde la variable ADMIN_EMAIL del repositorio al publicar (no está en el código). */
const ADMIN_EMAIL = defineString('ADMIN_EMAIL', { default: '' });

const db = () => getFirestore();

export async function rolInicial(correo: string | undefined, verificado: boolean, adminEmail: string): Promise<Rol> {
  const a = adminEmail.trim().toLowerCase();
  if (a && verificado && correo && correo.trim().toLowerCase() === a) return 'admin';
  return 'usuario';
}

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
  } catch (e) {
    logger.warn('Usuario sin registro en Auth', { uid });
    return;
  }

  const rol = await rolInicial(correo, verificado, ADMIN_EMAIL.value());
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
      actualizado: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  await batch.commit();
  logger.info('Cuenta creada', { uid, rol });
});

export const asignarRol = onCall(async (req) => {
  if (!req.auth || req.auth.token.rol !== 'admin') throw new HttpsError('permission-denied', 'Solo el admin puede cambiar roles.');
  const { uid, rol } = (req.data ?? {}) as { uid?: unknown; rol?: unknown };
  if (typeof uid !== 'string' || !uid || typeof rol !== 'string' || !(ROLES as readonly string[]).includes(rol)) {
    throw new HttpsError('invalid-argument', 'Faltan datos válidos (uid y rol).');
  }
  if (uid === req.auth.uid && rol !== 'admin') throw new HttpsError('failed-precondition', 'No podés quitarte tu propio rol de admin.');

  await getAuth().setCustomUserClaims(uid, { rol });
  const batch = db().batch();
  batch.set(db().doc(`users/${uid}`), { rol }, { merge: true });
  batch.set(db().doc(`accounts/${uid}`), { rol, actualizadoPor: req.auth.uid, actualizado: FieldValue.serverTimestamp() }, { merge: true });
  await batch.commit();
  return { ok: true };
});
