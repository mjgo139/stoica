/**
 * Driver real: Firebase Authentication + Firestore (con caché sin conexión).
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserPopupRedirectResolver,
  createUserWithEmailAndPassword,
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
  doc,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import type { Perfil } from '@core/perfil';
import { traducirError } from './errores';
import { ErrorStoica, type Driver, type UsuarioSesion } from './tipos';

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
  const auth: Auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    popupRedirectResolver: browserPopupRedirectResolver,
  });
  auth.languageCode = 'es';
  const db: Firestore = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });

  let nombrePendiente = '';

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
  };
}
