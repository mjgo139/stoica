/**
 * Tests de las reglas de Firestore contra el emulador.
 * Se corren con: npm run test:reglas (levanta el emulador, corre y lo apaga).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;

const perfil = (uid: string, extra: Record<string, unknown> = {}) => ({
  nombre: 'Marco',
  correo: 'marco@ejemplo.com',
  tema: 'sistema',
  mementoMori: true,
  zonaHoraria: 'America/Asuncion',
  creado: Date.now(),
  actualizado: Date.now(),
  actualizadoPor: uid,
  ...extra,
});

beforeAll(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
  env = await initializeTestEnvironment({
    projectId: 'demo-stoica',
    firestore: { rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'), host, port: Number(port) },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

const usuario = (uid: string, rol: 'usuario' | 'admin' = 'usuario') => env.authenticatedContext(uid, { rol }).firestore();
const anonimo = () => env.unauthenticatedContext().firestore();
const sembrar = (ruta: string, datos: Record<string, unknown>) =>
  env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), ruta), datos);
  });

describe('users/{uid}', () => {
  it('el dueño crea su perfil válido sin rol', async () => {
    await assertSucceeds(setDoc(doc(usuario('ana'), 'users/ana'), perfil('ana')));
  });

  it('nadie puede crear su perfil con rol', async () => {
    await assertFails(setDoc(doc(usuario('ana'), 'users/ana'), perfil('ana', { rol: 'admin' })));
  });

  it('no se crea el perfil de otro', async () => {
    await assertFails(setDoc(doc(usuario('ana'), 'users/beto'), perfil('beto')));
  });

  it('rechaza tipos y largos inválidos', async () => {
    const db = usuario('ana');
    await assertFails(setDoc(doc(db, 'users/ana'), perfil('ana', { nombre: '' })));
    await assertFails(setDoc(doc(db, 'users/ana'), perfil('ana', { nombre: 'x'.repeat(41) })));
    await assertFails(setDoc(doc(db, 'users/ana'), perfil('ana', { tema: 'azul' })));
    await assertFails(setDoc(doc(db, 'users/ana'), perfil('ana', { mementoMori: 'si' })));
    await assertFails(setDoc(doc(db, 'users/ana'), perfil('ana', { extra: 1 })));
    await assertFails(setDoc(doc(db, 'users/ana'), perfil('ana', { actualizadoPor: 'beto' })));
  });

  it('solo el dueño lee su perfil; el admin tampoco', async () => {
    await sembrar('users/ana', perfil('ana'));
    await assertSucceeds(getDoc(doc(usuario('ana'), 'users/ana')));
    await assertFails(getDoc(doc(usuario('beto'), 'users/ana')));
    await assertFails(getDoc(doc(usuario('jefe', 'admin'), 'users/ana')));
    await assertFails(getDoc(doc(anonimo(), 'users/ana')));
  });

  it('el dueño cambia tema y nombre, pero no su rol ni su correo', async () => {
    await sembrar('users/ana', perfil('ana', { rol: 'usuario' }));
    const db = usuario('ana');
    await assertSucceeds(updateDoc(doc(db, 'users/ana'), { tema: 'oscuro', nombre: 'Ana', actualizado: Date.now(), actualizadoPor: 'ana' }));
    await assertFails(updateDoc(doc(db, 'users/ana'), { rol: 'admin', actualizado: Date.now(), actualizadoPor: 'ana' }));
    await assertFails(updateDoc(doc(db, 'users/ana'), { correo: 'otro@x.com', actualizado: Date.now(), actualizadoPor: 'ana' }));
  });

  it('no se borra el perfil desde la app', async () => {
    await sembrar('users/ana', perfil('ana'));
    await assertFails(deleteDoc(doc(usuario('ana'), 'users/ana')));
  });
});

describe('users/{uid}/subcolecciones', () => {
  const dato = (uid: string) => ({ nombre: 'Leer', actualizado: Date.now(), actualizadoPor: uid });

  it('el dueño escribe y lee sus hábitos', async () => {
    const db = usuario('ana');
    await assertSucceeds(setDoc(doc(db, 'users/ana/habits/h1'), dato('ana')));
    await assertSucceeds(getDoc(doc(db, 'users/ana/habits/h1')));
  });

  it('nadie más los ve, ni el admin', async () => {
    await sembrar('users/ana/habits/h1', dato('ana'));
    await assertFails(getDoc(doc(usuario('beto'), 'users/ana/habits/h1')));
    await assertFails(getDoc(doc(usuario('jefe', 'admin'), 'users/ana/journal/2026-10-22')));
  });

  it('exige actualizadoPor del dueño y colección conocida', async () => {
    const db = usuario('ana');
    await assertFails(setDoc(doc(db, 'users/ana/habits/h1'), dato('beto')));
    await assertFails(setDoc(doc(db, 'users/ana/inventada/x'), dato('ana')));
  });
});

describe('accounts/{uid}', () => {
  const cuenta = { nombre: 'Ana', correo: 'ana@x.com', alta: 1, ultimoAcceso: Date.now() - 2 * 86400000, plataforma: '', rol: 'usuario', suspendida: false, actualizadoPor: 'servidor' };

  it('solo el admin lee las cuentas', async () => {
    await sembrar('accounts/ana', cuenta);
    await assertSucceeds(getDoc(doc(usuario('jefe', 'admin'), 'accounts/ana')));
    await assertFails(getDoc(doc(usuario('ana'), 'accounts/ana')));
  });

  it('el dueño solo actualiza su último acceso', async () => {
    await sembrar('accounts/ana', cuenta);
    const db = usuario('ana');
    await assertSucceeds(updateDoc(doc(db, 'accounts/ana'), { ultimoAcceso: Date.now(), plataforma: 'Android · app', actualizadoPor: 'ana' }));
    await assertFails(updateDoc(doc(db, 'accounts/ana'), { suspendida: true, actualizadoPor: 'ana' }));
    await assertFails(updateDoc(doc(db, 'accounts/ana'), { rol: 'admin', actualizadoPor: 'ana' }));
    await assertFails(setDoc(doc(db, 'accounts/beto'), cuenta));
  });
});

describe('metrics, catalog, config y groups', () => {
  it('metrics: lee solo el admin, nadie escribe', async () => {
    await sembrar('metrics/2026-10-22', { activos: 3 });
    await assertSucceeds(getDoc(doc(usuario('jefe', 'admin'), 'metrics/2026-10-22')));
    await assertFails(getDoc(doc(usuario('ana'), 'metrics/2026-10-22')));
    await assertFails(setDoc(doc(usuario('jefe', 'admin'), 'metrics/2026-10-23'), { activos: 1 }));
  });

  it('catalog y config: leen todos, escribe el admin', async () => {
    await sembrar('catalog/quotes', { lista: [] });
    await assertSucceeds(getDoc(doc(anonimo(), 'catalog/quotes')));
    await assertSucceeds(getDoc(doc(usuario('ana'), 'config/app')));
    await assertFails(setDoc(doc(usuario('ana'), 'catalog/quotes'), { lista: [1] }));
    await assertSucceeds(setDoc(doc(usuario('jefe', 'admin'), 'config/app'), { paleta: 'bronce' }));
  });

  it('groups: cerrado por ahora', async () => {
    await assertFails(setDoc(doc(usuario('ana'), 'groups/g1'), { nombre: 'Pórtico' }));
  });

  it('cualquier otra ruta está cerrada', async () => {
    await assertFails(setDoc(doc(usuario('ana'), 'cualquiera/x'), { a: 1 }));
  });
});
