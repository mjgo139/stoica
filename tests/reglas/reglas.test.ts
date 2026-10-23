/**
 * Tests de seguridad de las reglas de Firestore, contra el emulador.
 * Se corren con: npm run test:reglas (en GitHub, en cada push).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

let env: RulesTestEnvironment;
const ahora = () => Date.now();
const dia = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const HOY = dia(0);
const MANANA = dia(1);
const HACE20 = dia(-20);

const perfil = (uid: string, extra: Record<string, unknown> = {}) => ({
  nombre: 'Marco',
  correo: 'marco@ejemplo.com',
  tema: 'sistema',
  mementoMori: true,
  zonaHoraria: 'America/Asuncion',
  notificaciones: false,
  examenHora: '22:00',
  examenSlot: null,
  notifReacciones: true,
  creado: ahora(),
  actualizado: ahora(),
  actualizadoPor: uid,
  ...extra,
});

const habito = (uid: string, extra: Record<string, unknown> = {}) => ({
  nombre: 'Meditar',
  tipo: 'sino',
  virtud: 'sabiduria',
  icono: 'med',
  momento: 0,
  dias: [0, 1, 2, 3, 4, 5, 6],
  meta: 1,
  unidad: '',
  variables: [],
  recordatorio: '06:30',
  recordatorioSlot: 38,
  inicio: `${HACE20}`,
  archivado: false,
  orden: 0,
  racha: 0,
  mejorRacha: 0,
  creado: ahora(),
  actualizado: ahora(),
  actualizadoPor: uid,
  ...extra,
});

const registro = (uid: string, extra: Record<string, unknown> = {}) => ({
  habitId: 'h1',
  fecha: `${HOY}`,
  hecho: true,
  valor: 0,
  medidas: {},
  nota: '',
  actualizado: ahora(),
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

const usuario = (uid: string, rol: 'usuario' | 'admin' = 'usuario', extra: Record<string, unknown> = {}) => env.authenticatedContext(uid, { rol, ...extra }).firestore();
const anonimo = () => env.unauthenticatedContext().firestore();
const sembrar = (ruta: string, datos: Record<string, unknown>) =>
  env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), ruta), datos);
  });

// =====================================================================
describe('users/{uid} · perfil', () => {
  it('el dueño crea su perfil válido sin rol', async () => {
    await assertSucceeds(setDoc(doc(usuario('ana'), 'users/ana'), perfil('ana')));
  });
  it('acepta perfiles de la v0.1 (sin campos de notificaciones)', async () => {
    const p = perfil('ana');
    delete (p as Record<string, unknown>).notificaciones;
    delete (p as Record<string, unknown>).examenHora;
    delete (p as Record<string, unknown>).examenSlot;
    delete (p as Record<string, unknown>).notifReacciones;
    await assertSucceeds(setDoc(doc(usuario('ana'), 'users/ana'), p));
  });
  it('nadie puede darse el rol de admin', async () => {
    await assertFails(setDoc(doc(usuario('ana'), 'users/ana'), perfil('ana', { rol: 'admin' })));
    await sembrar('users/ana', perfil('ana', { rol: 'usuario' }));
    await assertFails(updateDoc(doc(usuario('ana'), 'users/ana'), { rol: 'admin', actualizado: ahora(), actualizadoPor: 'ana' }));
  });
  it('no se crea ni lee el perfil de otro', async () => {
    await assertFails(setDoc(doc(usuario('ana'), 'users/beto'), perfil('beto')));
    await sembrar('users/beto', perfil('beto'));
    await assertFails(getDoc(doc(usuario('ana'), 'users/beto')));
    await assertFails(getDoc(doc(anonimo(), 'users/beto')));
  });
  it('el admin tampoco lee perfiles ajenos', async () => {
    await sembrar('users/ana', perfil('ana'));
    await assertFails(getDoc(doc(usuario('jefe', 'admin'), 'users/ana')));
  });
  it('rechaza tipos, largos y campos extra', async () => {
    const db = usuario('ana');
    for (const malo of [{ nombre: '' }, { nombre: 'x'.repeat(41) }, { tema: 'azul' }, { mementoMori: 'si' }, { extra: 1 }, { actualizadoPor: 'beto' }, { examenHora: '25:00' }, { examenSlot: 96 }, { notificaciones: 'si' }]) {
      await assertFails(setDoc(doc(db, 'users/ana'), perfil('ana', malo)));
    }
  });
  it('no deja poner fechas en el futuro', async () => {
    await assertFails(setDoc(doc(usuario('ana'), 'users/ana'), perfil('ana', { actualizado: ahora() + 5 * 86400000 })));
  });
  it('cambia tema y notificaciones, pero no correo ni creado; no se borra', async () => {
    await sembrar('users/ana', perfil('ana', { rol: 'usuario' }));
    const db = usuario('ana');
    await assertSucceeds(updateDoc(doc(db, 'users/ana'), { tema: 'oscuro', notificaciones: true, examenSlot: 4, actualizado: ahora(), actualizadoPor: 'ana' }));
    await assertFails(updateDoc(doc(db, 'users/ana'), { correo: 'otro@x.com', actualizado: ahora(), actualizadoPor: 'ana' }));
    await assertFails(updateDoc(doc(db, 'users/ana'), { creado: 1, actualizado: ahora(), actualizadoPor: 'ana' }));
    await assertFails(deleteDoc(doc(db, 'users/ana')));
  });
});

// =====================================================================
describe('users/{uid}/habits', () => {
  it('crea, edita y borra sus hábitos', async () => {
    const db = usuario('ana');
    await assertSucceeds(setDoc(doc(db, 'users/ana/habits/h1'), habito('ana')));
    await assertSucceeds(updateDoc(doc(db, 'users/ana/habits/h1'), { racha: 3, actualizado: ahora(), actualizadoPor: 'ana' }));
    await assertSucceeds(deleteDoc(doc(db, 'users/ana/habits/h1')));
  });
  it('valida la forma del hábito', async () => {
    const db = usuario('ana');
    for (const malo of [{ tipo: 'otro' }, { virtud: 'fama' }, { momento: 3 }, { dias: [] }, { meta: 0 }, { meta: 5000 }, { recordatorio: '7am' }, { recordatorioSlot: 200 }, { variables: [1, 2, 3, 4, 5] }, { nombre: '' }, { inicio: 'ayer' }, { actualizadoPor: 'beto' }, { secreto: 1 }]) {
      await assertFails(setDoc(doc(db, 'users/ana/habits/h1'), habito('ana', malo)));
    }
  });
  it('no se puede cambiar el tipo de un hábito existente', async () => {
    await sembrar('users/ana/habits/h1', habito('ana'));
    await assertFails(updateDoc(doc(usuario('ana'), 'users/ana/habits/h1'), { tipo: 'cantidad', actualizado: ahora(), actualizadoPor: 'ana' }));
  });
  it('nadie más los ve ni los toca, ni el admin', async () => {
    await sembrar('users/ana/habits/h1', habito('ana'));
    await assertFails(getDoc(doc(usuario('beto'), 'users/ana/habits/h1')));
    await assertFails(getDoc(doc(usuario('jefe', 'admin'), 'users/ana/habits/h1')));
    await assertFails(setDoc(doc(usuario('beto'), 'users/ana/habits/h2'), habito('beto')));
    await assertFails(deleteDoc(doc(usuario('beto'), 'users/ana/habits/h1')));
    await assertFails(getDocs(collection(usuario('beto'), 'users/ana/habits')));
  });
});

// =====================================================================
describe('users/{uid}/logs', () => {
  it('guarda el registro del día con el id correcto', async () => {
    const db = usuario('ana');
    await assertSucceeds(setDoc(doc(db, `users/ana/logs/h1_${HOY}`), registro('ana')));
    await assertSucceeds(setDoc(doc(db, `users/ana/logs/h1_${HOY}`), registro('ana', { hecho: false, valor: 8, medidas: { peso: 80.4 } })));
  });
  it('rechaza ids que no coinciden, valores fuera de rango y notas largas', async () => {
    const db = usuario('ana');
    await assertFails(setDoc(doc(db, 'users/ana/logs/otro_id'), registro('ana')));
    await assertFails(setDoc(doc(db, `users/ana/logs/h1_${HOY}`), registro('ana', { valor: -1 })));
    await assertFails(setDoc(doc(db, `users/ana/logs/h1_${HOY}`), registro('ana', { valor: 20000 })));
    await assertFails(setDoc(doc(db, `users/ana/logs/h1_${HOY}`), registro('ana', { nota: 'x'.repeat(501) })));
    await assertFails(setDoc(doc(db, `users/ana/logs/h1_${HOY}`), registro('ana', { medidas: { a: 1, b: 2, c: 3, d: 4, e: 5 } })));
    await assertFails(setDoc(doc(db, `users/ana/logs/h1_${HOY}`), registro('ana', { hecho: 'si' })));
  });
  it('el admin no puede leer registros ni mediciones', async () => {
    await sembrar(`users/ana/logs/h1_${HOY}`, registro('ana', { medidas: { peso: 80 } }));
    await assertFails(getDoc(doc(usuario('jefe', 'admin'), `users/ana/logs/h1_${HOY}`)));
    await assertFails(getDocs(query(collection(usuario('jefe', 'admin'), 'users/ana/logs'), where('habitId', '==', 'h1'))));
  });
});

// =====================================================================
describe('tareas, enfoque, examen, hitos y dispositivos', () => {
  it('tareas', async () => {
    const db = usuario('ana');
    const t = { titulo: 'Llamar', dependeDeTi: true, momento: 1, fecha: `${HOY}`, repetir: 'no', creado: ahora(), actualizado: ahora(), actualizadoPor: 'ana' };
    await assertSucceeds(setDoc(doc(db, 'users/ana/tasks/t1'), t));
    await assertFails(setDoc(doc(db, 'users/ana/tasks/t2'), { ...t, titulo: '' }));
    await assertFails(setDoc(doc(db, 'users/ana/tasks/t2'), { ...t, repetir: 'semanal' }));
    await assertFails(setDoc(doc(db, 'users/ana/tasks/t2'), { ...t, dependeDeTi: 'quizas' }));
    await assertSucceeds(setDoc(doc(db, `users/ana/taskDone/t1_${HOY}`), { taskId: 't1', fecha: `${HOY}`, actualizado: ahora(), actualizadoPor: 'ana' }));
    await assertFails(setDoc(doc(db, 'users/ana/taskDone/cualquiera'), { taskId: 't1', fecha: `${HOY}`, actualizado: ahora(), actualizadoPor: 'ana' }));
  });
  it('enfoque', async () => {
    const db = usuario('ana');
    const f = { tipo: 'enfoque', minutos: 25, etiqueta: '', fecha: `${HOY}`, inicio: ahora(), actualizado: ahora(), actualizadoPor: 'ana' };
    await assertSucceeds(setDoc(doc(db, 'users/ana/focus/f1'), f));
    await assertFails(setDoc(doc(db, 'users/ana/focus/f2'), { ...f, minutos: 999 }));
    await assertFails(setDoc(doc(db, 'users/ana/focus/f2'), { ...f, tipo: 'siesta' }));
  });
  it('examen nocturno: privado y con forma fija', async () => {
    const db = usuario('ana');
    const e = { fecha: `${HOY}`, respuestas: { p1: 'a', p2: '', p3: '' }, libre: '', actualizado: ahora(), actualizadoPor: 'ana' };
    await assertSucceeds(setDoc(doc(db, `users/ana/journal/${HOY}`), e));
    await assertFails(setDoc(doc(db, `users/ana/journal/${MANANA}`), e));
    await assertFails(setDoc(doc(db, `users/ana/journal/${HOY}`), { ...e, respuestas: { p1: 'x'.repeat(1001), p2: '', p3: '' } }));
    await assertFails(setDoc(doc(db, `users/ana/journal/${HOY}`), { ...e, respuestas: { p1: '', p2: '', p3: '', p4: '' } }));
    await assertFails(getDoc(doc(usuario('jefe', 'admin'), `users/ana/journal/${HOY}`)));
  });
  it('hitos y dispositivos', async () => {
    const db = usuario('ana');
    await assertSucceeds(setDoc(doc(db, 'users/ana/milestones/h1_7'), { habitId: 'h1', dias: 7, fecha: `${HOY}`, actualizado: ahora(), actualizadoPor: 'ana' }));
    await assertFails(setDoc(doc(db, 'users/ana/milestones/h1_8'), { habitId: 'h1', dias: 7, fecha: `${HOY}`, actualizado: ahora(), actualizadoPor: 'ana' }));
    await assertSucceeds(setDoc(doc(db, 'users/ana/devices/d1'), { token: 'x'.repeat(150), plataforma: 'celular', actualizado: ahora(), actualizadoPor: 'ana' }));
    await assertFails(getDoc(doc(usuario('beto'), 'users/ana/devices/d1')));
  });
  it('colecciones desconocidas están cerradas', async () => {
    await assertFails(setDoc(doc(usuario('ana'), 'users/ana/inventada/x'), { actualizado: ahora(), actualizadoPor: 'ana' }));
    await assertFails(setDoc(doc(usuario('ana'), 'users/ana/notes/x'), { actualizado: ahora(), actualizadoPor: 'ana' }));
  });
});

// =====================================================================
describe('accounts y metrics', () => {
  const cuenta = { nombre: 'Ana', correo: 'ana@x.com', alta: 1, ultimoAcceso: ahora() - 2 * 86400000, plataforma: '', rol: 'usuario', suspendida: false, actualizadoPor: 'servidor' };
  it('solo el admin lee las cuentas', async () => {
    await sembrar('accounts/ana', cuenta);
    await assertSucceeds(getDoc(doc(usuario('jefe', 'admin'), 'accounts/ana')));
    await assertSucceeds(getDocs(collection(usuario('jefe', 'admin'), 'accounts')));
    await assertFails(getDoc(doc(usuario('ana'), 'accounts/ana')));
    await assertFails(getDocs(collection(usuario('ana'), 'accounts')));
  });
  it('el dueño solo actualiza su último acceso; no se suspende ni se reactiva solo', async () => {
    await sembrar('accounts/ana', { ...cuenta, suspendida: true });
    const db = usuario('ana');
    await assertSucceeds(updateDoc(doc(db, 'accounts/ana'), { ultimoAcceso: ahora(), plataforma: 'Android · app', actualizadoPor: 'ana' }));
    await assertFails(updateDoc(doc(db, 'accounts/ana'), { suspendida: false, actualizadoPor: 'ana' }));
    await assertFails(updateDoc(doc(db, 'accounts/ana'), { rol: 'admin', actualizadoPor: 'ana' }));
    await assertFails(setDoc(doc(db, 'accounts/beto'), cuenta));
  });
  it('ni el admin escribe cuentas o métricas desde la app (solo el servidor)', async () => {
    await sembrar('accounts/ana', cuenta);
    await assertFails(updateDoc(doc(usuario('jefe', 'admin'), 'accounts/ana'), { suspendida: true }));
    await assertFails(setDoc(doc(usuario('jefe', 'admin'), `metrics/${MANANA}`), { total: 1 }));
  });
  it('métricas: lee solo el admin', async () => {
    await sembrar(`metrics/${HOY}`, { total: 3 });
    await assertSucceeds(getDoc(doc(usuario('jefe', 'admin'), `metrics/${HOY}`)));
    await assertFails(getDoc(doc(usuario('ana'), `metrics/${HOY}`)));
  });
});

// =====================================================================
describe('catalog y config', () => {
  it('leen todos, escribe el admin', async () => {
    await sembrar('catalog/quotes', { lista: [] });
    await assertSucceeds(getDoc(doc(anonimo(), 'catalog/quotes')));
    await assertSucceeds(getDoc(doc(usuario('ana'), 'config/app')));
    await assertFails(setDoc(doc(usuario('ana'), 'catalog/quotes'), { lista: [1] }));
    await assertSucceeds(setDoc(doc(usuario('jefe', 'admin'), 'config/app'), { paleta: 'bronce' }));
  });
});

// =====================================================================
describe('groups · comunidad', () => {
  const grupo = { nombre: 'Pórtico', creador: 'ana', codigo: 'STOA2026', miembros: ['ana', 'beto'], creado: 1 };
  const miembro = (uid: string, extra: Record<string, unknown> = {}) => ({ nombre: uid, compartidos: [], fecha: `${HOY}`, actualizado: ahora(), actualizadoPor: uid, ...extra });
  const reaccion = (de: string, para: string, extra: Record<string, unknown> = {}) => ({ de, para, dia: `${HOY}`, tipo: 'laurel', nombreDe: de, actualizado: ahora(), actualizadoPor: de, ...extra });
  const desafio = (uid: string, extra: Record<string, unknown> = {}) => ({ titulo: '21 días', virtud: 'sabiduria', duracion: 21, meta: 18, inicio: `${HOY}`, creador: uid, actualizado: ahora(), actualizadoPor: uid, ...extra });

  beforeEach(async () => {
    await sembrar('groups/g1', grupo);
  });

  it('solo los integrantes ven el grupo; nadie lo escribe desde la app', async () => {
    await assertSucceeds(getDoc(doc(usuario('ana'), 'groups/g1')));
    await assertFails(getDoc(doc(usuario('carla'), 'groups/g1')));
    await assertSucceeds(getDocs(query(collection(usuario('beto'), 'groups'), where('miembros', 'array-contains', 'beto'))));
    await assertFails(getDocs(collection(usuario('carla'), 'groups')));
    // Nadie puede agregarse solo ni cambiar el código.
    await assertFails(updateDoc(doc(usuario('carla'), 'groups/g1'), { miembros: ['ana', 'beto', 'carla'] }));
    await assertFails(updateDoc(doc(usuario('ana'), 'groups/g1'), { codigo: 'XXXXXXXX' }));
    await assertFails(setDoc(doc(usuario('carla'), 'groups/g2'), { ...grupo, miembros: ['carla'] }));
  });

  it('cada integrante escribe solo su resumen', async () => {
    await assertSucceeds(setDoc(doc(usuario('ana'), 'groups/g1/members/ana'), miembro('ana')));
    await assertFails(setDoc(doc(usuario('ana'), 'groups/g1/members/beto'), miembro('beto')));
    await assertFails(setDoc(doc(usuario('carla'), 'groups/g1/members/carla'), miembro('carla')));
    await assertFails(setDoc(doc(usuario('ana'), 'groups/g1/members/ana'), miembro('ana', { examen: 'secreto' })));
    await assertFails(setDoc(doc(usuario('ana'), 'groups/g1/members/ana'), miembro('ana', { compartidos: Array(13).fill({}) })));
    await sembrar('groups/g1/members/beto', miembro('beto'));
    await assertSucceeds(getDoc(doc(usuario('ana'), 'groups/g1/members/beto')));
    await assertFails(getDoc(doc(usuario('carla'), 'groups/g1/members/beto')));
  });

  it('reacciones: solo predefinidas, a otro integrante, con el id correcto', async () => {
    const db = usuario('ana');
    await assertSucceeds(setDoc(doc(db, `groups/g1/reactions/${HOY}_ana_beto`), reaccion('ana', 'beto')));
    await assertSucceeds(setDoc(doc(db, `groups/g1/reactions/${HOY}_ana_beto`), reaccion('ana', 'beto', { tipo: 'fuerza' })));
    await assertFails(setDoc(doc(db, `groups/g1/reactions/${HOY}_ana_beto`), reaccion('ana', 'beto', { tipo: 'insulto' })));
    await assertFails(setDoc(doc(db, `groups/g1/reactions/${HOY}_ana_beto`), reaccion('ana', 'beto', { mensaje: 'hola' })));
    await assertFails(setDoc(doc(db, `groups/g1/reactions/${HOY}_ana_ana`), reaccion('ana', 'ana')));
    await assertFails(setDoc(doc(db, `groups/g1/reactions/${HOY}_ana_carla`), reaccion('ana', 'carla')));
    await assertFails(setDoc(doc(db, 'groups/g1/reactions/otro'), reaccion('ana', 'beto')));
    // Nadie reacciona en nombre de otro
    await assertFails(setDoc(doc(db, `groups/g1/reactions/${HOY}_beto_ana`), reaccion('beto', 'ana')));
    // Quien no está en el grupo no reacciona
    await assertFails(setDoc(doc(usuario('carla'), `groups/g1/reactions/${HOY}_carla_ana`), reaccion('carla', 'ana')));
    // Borrar: solo la propia
    await assertFails(deleteDoc(doc(usuario('beto'), `groups/g1/reactions/${HOY}_ana_beto`)));
    await assertSucceeds(deleteDoc(doc(db, `groups/g1/reactions/${HOY}_ana_beto`)));
  });

  it('desafíos: los crea un integrante; los edita o borra solo quien los creó', async () => {
    await assertSucceeds(setDoc(doc(usuario('beto'), 'groups/g1/challenges/c1'), desafio('beto')));
    await assertFails(setDoc(doc(usuario('carla'), 'groups/g1/challenges/c2'), desafio('carla')));
    await assertFails(setDoc(doc(usuario('beto'), 'groups/g1/challenges/c3'), desafio('beto', { duracion: 2 })));
    await assertFails(setDoc(doc(usuario('beto'), 'groups/g1/challenges/c3'), desafio('beto', { meta: 30 })));
    await assertFails(setDoc(doc(usuario('beto'), 'groups/g1/challenges/c3'), desafio('ana')));
    await assertFails(deleteDoc(doc(usuario('ana'), 'groups/g1/challenges/c1')));
    await assertSucceeds(deleteDoc(doc(usuario('beto'), 'groups/g1/challenges/c1')));
  });

  it('progreso: cada uno el suyo', async () => {
    await sembrar('groups/g1/challenges/c1', desafio('beto'));
    const p = (uid: string) => ({ nombre: uid, habitId: 'h1', cumplidos: 3, actualizado: ahora(), actualizadoPor: uid });
    await assertSucceeds(setDoc(doc(usuario('ana'), 'groups/g1/challenges/c1/progress/ana'), p('ana')));
    await assertFails(setDoc(doc(usuario('ana'), 'groups/g1/challenges/c1/progress/beto'), p('beto')));
    await assertFails(setDoc(doc(usuario('carla'), 'groups/g1/challenges/c1/progress/carla'), p('carla')));
    await assertFails(setDoc(doc(usuario('ana'), 'groups/g1/challenges/c1/progress/ana'), { ...p('ana'), cumplidos: 999 }));
  });
});

describe('protección contra abuso', () => {
  it('no acepta registros con fechas lejanas o inventadas', async () => {
    const db = usuario('ana');
    await assertFails(setDoc(doc(db, 'users/ana/logs/h1_2019-01-01'), registro('ana', { fecha: '2019-01-01' })));
    await assertFails(setDoc(doc(db, 'users/ana/logs/h1_2099-01-01'), registro('ana', { fecha: '2099-01-01' })));
    await assertFails(setDoc(doc(db, 'users/ana/journal/2099-12-31'), { fecha: '2099-12-31', respuestas: { p1: '', p2: '', p3: '' }, libre: '', actualizado: ahora(), actualizadoPor: 'ana' }));
    await assertSucceeds(setDoc(doc(db, `users/ana/logs/h1_${dia(-300)}`), registro('ana', { fecha: dia(-300) })));
  });
  it('una cuenta bloqueada no puede escribir nada', async () => {
    const db = usuario('ana', 'usuario', { bloqueado: true });
    await assertFails(setDoc(doc(db, 'users/ana'), perfil('ana')));
    await assertFails(setDoc(doc(db, 'users/ana/habits/h1'), habito('ana')));
    await assertFails(setDoc(doc(db, `users/ana/logs/h1_${HOY}`), registro('ana')));
    // pero sí puede leer lo suyo (por ejemplo, para exportarlo)
    await sembrar('users/ana/habits/h1', habito('ana'));
    await assertSucceeds(getDoc(doc(db, 'users/ana/habits/h1')));
  });
  it('marcas de borrado: solo propias, con forma fija', async () => {
    const db = usuario('ana');
    const m = { col: 'tasks', docId: 't1', actualizado: ahora(), actualizadoPor: 'ana' };
    await assertSucceeds(setDoc(doc(db, 'users/ana/borrados/tasks_t1'), m));
    await assertFails(setDoc(doc(db, 'users/ana/borrados/otro'), m));
    await assertFails(setDoc(doc(db, 'users/ana/borrados/logs_t1'), { ...m, col: 'logs' }));
    await assertFails(deleteDoc(doc(db, 'users/ana/borrados/tasks_t1')));
    await assertFails(getDoc(doc(usuario('beto'), 'users/ana/borrados/tasks_t1')));
  });
  it('tarea desmarcada se guarda con hecha: false', async () => {
    await assertSucceeds(setDoc(doc(usuario('ana'), `users/ana/taskDone/t1_${HOY}`), { taskId: 't1', fecha: HOY, hecha: false, actualizado: ahora(), actualizadoPor: 'ana' }));
    await assertFails(setDoc(doc(usuario('ana'), `users/ana/taskDone/t1_${HOY}`), { taskId: 't1', fecha: HOY, hecha: 'no', actualizado: ahora(), actualizadoPor: 'ana' }));
  });
  it('los contadores del vigilante son solo del servidor', async () => {
    await assertFails(setDoc(doc(usuario('ana'), 'cuotas/ana'), { dia: HOY, n: 0 }));
    await assertFails(getDoc(doc(usuario('ana'), 'cuotas/ana')));
  });
});

describe('todo lo demás está cerrado', () => {
  it('rutas inventadas', async () => {
    await assertFails(setDoc(doc(usuario('ana'), 'cualquiera/x'), { a: 1 }));
    await assertFails(getDoc(doc(usuario('jefe', 'admin'), 'cualquiera/x')));
    await assertFails(setDoc(doc(usuario('ana'), 'avisosReaccion/g1_x'), { creado: 1 }));
    await assertFails(getDoc(doc(usuario('jefe', 'admin'), 'avisosReaccion/g1_x')));
  });
});
