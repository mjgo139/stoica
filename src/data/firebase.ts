/**
 * Driver real: Firebase Authentication + Firestore (con caché sin conexión).
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserPopupRedirectResolver,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  initializeAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type Auth,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDocsFromCache,
  initializeFirestore,
  limit,
  onSnapshot,
  orderBy,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  setDoc,
  updateDoc,
  where,
  type Firestore,
  type QueryConstraint,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import type { Perfil } from '@core/perfil';
import { traducirError } from './errores';
import { ErrorStoica, type Consulta, type Driver, type UsuarioSesion } from './tipos';

/** Los documentos leídos traen su `id`; no es un campo guardado y las reglas lo rechazan. */
function sinId<T extends object>(datos: T): T {
  if (!('id' in datos)) return datos;
  const { id: _id, ...resto } = datos as T & { id?: unknown };
  void _id;
  return resto as T;
}

/** Espera al servidor como mucho unos segundos: sin conexión, la escritura queda en cola y se envía sola. */
const sinBloquear = (p: Promise<unknown>, ms = 3500) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);

function configuracion() {
  const e = import.meta.env;
  const c = {
    apiKey: e.VITE_FIREBASE_API_KEY,
    authDomain: e.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: e.VITE_FIREBASE_PROJECT_ID,
    storageBucket: e.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: e.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: e.VITE_FIREBASE_APP_ID,
  };
  const falta = Object.entries(c).filter(([, v]) => !v).map(([k]) => k);
  if (falta.length) throw new ErrorStoica(`Falta configurar Firebase (${falta.join(', ')}).`, 'config');
  return c;
}

export function crearDriverFirebase(): Driver {
  const app: FirebaseApp = initializeApp(configuracion());
  // App Check: prueba ante Firebase que los pedidos vienen de esta app (y no de un programa suelto).
  const claveRecaptcha = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  if (claveRecaptcha) {
    try {
      initializeAppCheck(app, { provider: new ReCaptchaV3Provider(claveRecaptcha), isTokenAutoRefreshEnabled: true });
    } catch {
      /* si falla, la app sigue; mientras no se exija, no corta nada */
    }
  }
  const auth: Auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    popupRedirectResolver: browserPopupRedirectResolver,
  });
  auth.languageCode = 'es';
  const db: Firestore = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });

  let nombrePendiente = '';
  const funciones = getFunctions(app, 'southamerica-east1');
  const armar = (c: Consulta) => {
    const partes: QueryConstraint[] = [];
    for (const [campo, op, valor] of c.filtros ?? []) partes.push(where(campo, op, valor));
    if (c.orden) partes.push(orderBy(c.orden[0], c.orden[1]));
    if (c.limite) partes.push(limit(c.limite));
    return query(collection(db, c.ruta), ...partes);
  };
  let tokenPush: string | null = null;

  const aSesion = (u: NonNullable<Auth['currentUser']>): UsuarioSesion => ({
    uid: u.uid,
    correo: u.email ?? '',
    nombre: u.displayName || nombrePendiente,
    proveedor: u.providerData.some((p) => p.providerId === 'google.com') ? 'google' : 'password',
  });

  const envolver = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (e) {
      throw traducirError(e);
    }
  };

  return {
    nombre: 'firebase',
    observarSesion(cb) {
      return onAuthStateChanged(auth, (u) => cb(u ? aSesion(u) : null));
    },
    entrar: (correo, contrasena) => envolver(async () => {
      await signInWithEmailAndPassword(auth, correo.trim(), contrasena);
    }),
    registrar: (nombre, correo, contrasena) => envolver(async () => {
      nombrePendiente = nombre;
      const cred = await createUserWithEmailAndPassword(auth, correo.trim(), contrasena);
      await updateProfile(cred.user, { displayName: nombre });
    }),
    entrarConGoogle: () => envolver(async () => {
      const p = new GoogleAuthProvider();
      p.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, p);
    }),
    recuperarContrasena: (correo) => envolver(async () => {
      await sendPasswordResetEmail(auth, correo.trim());
    }),
    async cambiarContrasena(actual, nueva) {
      const u = auth.currentUser;
      if (!u?.email) throw new ErrorStoica('Tu cuenta no usa contraseña.', 'auth/operation-not-allowed');
      try {
        await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, actual));
      } catch (e) {
        const c = (e as { code?: string }).code;
        if (c === 'auth/invalid-credential' || c === 'auth/wrong-password') throw new ErrorStoica('La contraseña actual no es correcta.', 'auth/wrong-password');
        throw traducirError(e);
      }
      await envolver(() => updatePassword(u, nueva));
    },
    salir: () => envolver(async () => {
      nombrePendiente = '';
      await signOut(auth);
    }),
    observarPerfil(uid, cb, alFallar) {
      return onSnapshot(
        doc(db, 'users', uid),
        { includeMetadataChanges: false },
        (snap) => {
          if (snap.exists()) cb(snap.data() as Perfil);
          // Solo decimos "no existe" si lo confirma el servidor (no la caché local).
          else if (!snap.metadata.fromCache) cb(null);
        },
        (e) => alFallar(traducirError(e)),
      );
    },
    crearPerfil: (uid, perfil) => envolver(async () => {
      await setDoc(doc(db, 'users', uid), perfil);
    }),
    actualizarPerfil: (uid, cambios) => envolver(async () => {
      // Sin await del servidor: con caché local el cambio se ve al instante y se envía cuando haya conexión.
      const escritura = updateDoc(doc(db, 'users', uid), { ...cambios, actualizado: Date.now(), actualizadoPor: uid });
      escritura.catch(() => undefined);
      if (navigator.onLine) await escritura;
    }),
    registrarAcceso: (uid, plataforma) => envolver(async () => {
      await updateDoc(doc(db, 'accounts', uid), { ultimoAcceso: Date.now(), plataforma, actualizadoPor: uid });
    }),

    nuevoId: () => doc(collection(db, '_')).id,
    observarDoc(ruta, cb, alFallar) {
      return onSnapshot(
        doc(db, ruta),
        (snap) => cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as never) : null),
        (e) => alFallar(traducirError(e)),
      );
    },
    observarLista(c, cb, alFallar) {
      return onSnapshot(
        armar(c),
        { includeMetadataChanges: true },
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as never), { desdeServidor: !snap.metadata.fromCache }),
        (e) => alFallar(traducirError(e)),
      );
    },
    leerLista: (c) => envolver(async () => (await getDocs(armar(c))).docs.map((d) => ({ id: d.id, ...d.data() }) as never)),
    async leerListaLocal(c) {
      try {
        return (await getDocsFromCache(armar(c))).docs.map((d) => ({ id: d.id, ...d.data() }) as never);
      } catch {
        return [];
      }
    },
    guardar: (ruta, datos, opciones) => envolver(async () => {
      await sinBloquear(setDoc(doc(db, ruta), sinId(datos), { merge: !!opciones?.combinar }));
    }),
    borrar: (ruta) => envolver(async () => {
      await sinBloquear(deleteDoc(doc(db, ruta)));
    }),
    llamar: (nombre, datos) => envolver(async () => {
      if (!navigator.onLine) throw new ErrorStoica('Para esto necesitás conexión a internet.', 'unavailable');
      const r = await httpsCallable(funciones, nombre)(datos ?? {});
      return r.data as never;
    }),
    refrescarToken: async () => {
      await auth.currentUser?.getIdToken(true).catch(() => undefined);
    },
    async activarNotificaciones() {
      const vapid = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      if (!vapid) return { error: 'Las notificaciones todavía no están configuradas en el servidor.' };
      if (!('Notification' in window) || !('serviceWorker' in navigator)) return { error: 'Este navegador no permite notificaciones. En iPhone, primero instalá la app.' };
      const m = await import('firebase/messaging');
      if (!(await m.isSupported())) return { error: 'Este navegador no permite notificaciones. En iPhone, primero instalá la app.' };
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') return { error: 'No diste permiso para notificaciones. Podés activarlo en los ajustes del navegador.' };
      try {
        const reg = await navigator.serviceWorker.ready;
        tokenPush = await m.getToken(m.getMessaging(app), { vapidKey: vapid, serviceWorkerRegistration: reg });
        return tokenPush ? { token: tokenPush } : { error: 'No se pudo registrar este dispositivo.' };
      } catch {
        return { error: 'No se pudo registrar este dispositivo para notificaciones.' };
      }
    },
    async desactivarNotificaciones() {
      try {
        const m = await import('firebase/messaging');
        if (await m.isSupported()) await m.deleteToken(m.getMessaging(app));
      } catch {
        /* nada */
      }
      tokenPush = null;
    },
  };
}
