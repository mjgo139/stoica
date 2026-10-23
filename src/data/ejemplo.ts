/**
 * Datos de ejemplo para el modo prueba. Todo es inventado y vive solo en memoria.
 */
import { claveDia, sumarDias, ZONA_POR_DEFECTO } from '@core/fechas';
import { perfilInicial } from '@core/perfil';
import { idRegistro, type Habito, type Registro } from '@core/habitos';
import { idReaccion } from '@core/comunidad';

type Escribir = (ruta: string, datos: Record<string, unknown>) => void;
type CrearCuenta = (correo: string, uid: string, nombre: string) => void;

let semilla = 7;
const azar = () => {
  semilla = (semilla * 16807) % 2147483647;
  return semilla / 2147483647;
};

export function sembrarEjemplo(escribir: Escribir, crearCuenta: CrearCuenta) {
  const ahora = Date.now();
  const hoy = claveDia(new Date(ahora), ZONA_POR_DEFECTO);
  const yo = 'u-prueba';
  const perfil = { ...perfilInicial(yo, 'Marco Aurelio', 'prueba@stoica.app', ZONA_POR_DEFECTO, ahora - 40 * 864e5), rol: 'admin' };
  escribir(`users/${yo}`, perfil);

  const base = (h: Partial<Habito>): Habito => ({
    id: '',
    nombre: '',
    tipo: 'sino',
    virtud: 'sabiduria',
    icono: 'med',
    momento: 0,
    dias: [0, 1, 2, 3, 4, 5, 6],
    meta: 1,
    unidad: '',
    variables: [],
    recordatorio: null,
    recordatorioSlot: null,
    inicio: sumarDias(hoy, -35),
    archivado: false,
    orden: 0,
    racha: 0,
    mejorRacha: 0,
    creado: ahora,
    actualizado: ahora,
    actualizadoPor: yo,
    ...h,
  });
  const habitos: Habito[] = [
    base({ id: 'h-meditar', nombre: 'Meditar', virtud: 'sabiduria', icono: 'med', momento: 0, orden: 0, recordatorio: '06:30' }),
    base({ id: 'h-fria', nombre: 'Ducha fría', virtud: 'coraje', icono: 'cold', momento: 0, orden: 1, dias: [1, 2, 3, 4, 5] }),
    base({ id: 'h-agua', nombre: 'Beber agua', tipo: 'cantidad', virtud: 'templanza', icono: 'water', momento: 1, meta: 8, unidad: 'vasos', orden: 2 }),
    base({
      id: 'h-peso',
      nombre: 'Bajar de peso',
      tipo: 'medicion',
      virtud: 'templanza',
      icono: 'scale',
      momento: 0,
      orden: 3,
      dias: [1, 4],
      variables: [
        { id: 'peso', nombre: 'Peso', unidad: 'kg', inicial: 86, meta: 78, direccion: 'bajar' },
        { id: 'cintura', nombre: 'Cintura', unidad: 'cm', inicial: 96, meta: 88, direccion: 'bajar' },
      ],
    }),
    base({ id: 'h-leer', nombre: 'Leer', tipo: 'cantidad', virtud: 'sabiduria', icono: 'read', momento: 2, meta: 20, unidad: 'páginas', orden: 4 }),
    base({ id: 'h-familia', nombre: 'Tiempo con la familia', virtud: 'justicia', icono: 'family', momento: 2, orden: 5 }),
  ];
  for (const h of habitos) escribir(`users/${yo}/habits/${h.id}`, h as never);

  const reg = (h: Habito, fecha: string, r: Partial<Registro>) =>
    escribir(`users/${yo}/logs/${idRegistro(h.id, fecha)}`, { habitId: h.id, fecha, hecho: false, valor: 0, medidas: {}, nota: '', actualizado: ahora, actualizadoPor: yo, ...r });
  let peso = 86;
  let cintura = 96;
  for (let i = 35; i >= 1; i--) {
    const f = sumarDias(hoy, -i);
    const dow = new Date(f + 'T12:00:00Z').getUTCDay();
    if (i < 12 || azar() > 0.25) reg(habitos[0], f, { hecho: true });
    if ([1, 2, 3, 4, 5].includes(dow) && azar() > 0.3) reg(habitos[1], f, { hecho: true });
    reg(habitos[2], f, { valor: azar() > 0.3 ? 8 : Math.floor(azar() * 7) + 1 });
    if (dow === 1 || dow === 4) {
      peso -= 0.3 + azar() * 0.4;
      cintura -= 0.2 + azar() * 0.3;
      reg(habitos[3], f, { medidas: { peso: Math.round(peso * 10) / 10, cintura: Math.round(cintura * 10) / 10 } });
    }
    if (azar() > 0.35) reg(habitos[4], f, { valor: azar() > 0.4 ? 20 : 12 });
    if (azar() > 0.2) reg(habitos[5], f, { hecho: true });
  }
  reg(habitos[0], hoy, { hecho: true });
  reg(habitos[2], hoy, { valor: 3 });

  // Tareas, enfoque y examen
  const t = (id: string, titulo: string, dependeDeTi: boolean, momento: number, fecha: string | null, repetir = 'no') =>
    escribir(`users/${yo}/tasks/${id}`, { titulo, dependeDeTi, momento, fecha, repetir, creado: ahora, actualizado: ahora, actualizadoPor: yo });
  t('t1', 'Preparar la reunión del lunes', true, 0, hoy);
  t('t2', 'Que el cliente apruebe el presupuesto', false, 1, hoy);
  t('t3', 'Llamar a mamá', true, 2, hoy);
  t('t4', 'Ordenar el escritorio', true, 1, null, 'diaria');
  t('t5', 'Pagar la cuota del club', true, 1, sumarDias(hoy, 2));
  escribir(`users/${yo}/taskDone/t3_${hoy}`, { taskId: 't3', fecha: hoy, actualizado: ahora, actualizadoPor: yo });
  for (let i = 0; i < 4; i++) {
    const f = sumarDias(hoy, -i);
    escribir(`users/${yo}/focus/f${i}`, { tipo: i % 3 === 2 ? 'meditacion' : 'enfoque', minutos: i % 3 === 2 ? 10 : 25, etiqueta: i === 0 ? 'Informe' : '', fecha: f, inicio: ahora - i * 864e5, actualizado: ahora, actualizadoPor: yo });
  }
  escribir(`users/${yo}/journal/${sumarDias(hoy, -1)}`, {
    fecha: sumarDias(hoy, -1),
    respuestas: { p1: 'Dejé de postergar la llamada difícil.', p2: 'El enojo en el tránsito.', p3: 'Escuché más de lo que hablé.' },
    libre: '',
    actualizado: ahora,
    actualizadoPor: yo,
  });
  escribir(`users/${yo}/milestones/h-meditar_7`, { habitId: 'h-meditar', dias: 7, fecha: sumarDias(hoy, -5), actualizado: ahora, actualizadoPor: yo });

  // Otras cuentas (inventadas) para el panel de admin y la comunidad
  const otras: Array<[string, string, string, number, number, string]> = [
    ['u-seneca', 'Lucio Séneca', 'seneca@ejemplo.com', 30, 0, 'Android · app'],
    ['u-epicteto', 'Epicteto', 'epicteto@ejemplo.com', 25, 1, 'iOS · app'],
    ['u-zenon', 'Zenón de Citio', 'zenon@ejemplo.com', 20, 4, 'Windows · web'],
    ['u-musonio', 'Musonio Rufo', 'musonio@ejemplo.com', 12, 12, 'Android · web'],
    ['u-cleantes', 'Cleantes', 'cleantes@ejemplo.com', 3, 0, 'macOS · web'],
    ['u-porcia', 'Porcia', 'porcia@ejemplo.com', 0, 0, 'iOS · web'],
  ];
  escribir(`accounts/${yo}`, { nombre: 'Marco Aurelio', correo: 'prueba@stoica.app', alta: ahora - 40 * 864e5, ultimoAcceso: ahora, plataforma: 'Windows · web', rol: 'admin', suspendida: false });
  for (const [uid, nombre, correo, alta, acceso, plataforma] of otras) {
    crearCuenta(correo, uid, nombre);
    escribir(`accounts/${uid}`, { nombre, correo, alta: ahora - alta * 864e5, ultimoAcceso: ahora - acceso * 864e5, plataforma, rol: 'usuario', suspendida: false });
    escribir(`users/${uid}`, { ...perfilInicial(uid, nombre, correo, ZONA_POR_DEFECTO, ahora - alta * 864e5), rol: 'usuario' });
    escribir(`users/${uid}/habits/h1`, base({ id: 'h1', nombre: 'Leer', tipo: alta % 2 ? 'cantidad' : 'sino', meta: alta % 2 ? 10 : 1, actualizadoPor: uid }) as never);
  }

  // Grupo de ejemplo
  const g = 'g-portico';
  escribir(`groups/${g}`, { nombre: 'El Pórtico', creador: 'u-seneca', codigo: 'STOA2026', miembros: [yo, 'u-seneca', 'u-epicteto', 'u-zenon'], creado: ahora - 10 * 864e5 });
  const m = (uid: string, nombre: string, compartidos: unknown[]) => escribir(`groups/${g}/members/${uid}`, { nombre, compartidos, fecha: hoy, actualizado: ahora, actualizadoPor: uid });
  m('u-seneca', 'Lucio Séneca', [
    { habitId: 'a', nombre: 'Escribir cartas', icono: 'write', virtud: 'sabiduria', hoy: true, racha: 21, porcentaje: 92 },
    { habitId: 'b', nombre: 'Ayuno', icono: 'food', virtud: 'templanza', hoy: false, racha: 4, porcentaje: 70 },
  ]);
  m('u-epicteto', 'Epicteto', [{ habitId: 'a', nombre: 'Meditar', icono: 'med', virtud: 'sabiduria', hoy: true, racha: 40, porcentaje: 98 }]);
  m('u-zenon', 'Zenón de Citio', [{ habitId: 'a', nombre: 'Caminar', icono: 'walk', virtud: 'coraje', hoy: false, racha: 2, porcentaje: 55 }]);
  escribir(`groups/${g}/reactions/${idReaccion(hoy, 'u-seneca', yo)}`, { de: 'u-seneca', para: yo, dia: hoy, tipo: 'laurel', nombreDe: 'Lucio Séneca', actualizado: ahora, actualizadoPor: 'u-seneca' });
  escribir(`groups/${g}/challenges/c1`, { titulo: '21 días meditando', virtud: 'sabiduria', duracion: 21, meta: 18, inicio: sumarDias(hoy, -6), creador: 'u-seneca', actualizado: ahora, actualizadoPor: 'u-seneca' });
  escribir(`groups/${g}/challenges/c1/progress/u-seneca`, { nombre: 'Lucio Séneca', habitId: 'a', cumplidos: 6, actualizado: ahora, actualizadoPor: 'u-seneca' });
  escribir(`groups/${g}/challenges/c1/progress/u-epicteto`, { nombre: 'Epicteto', habitId: 'a', cumplidos: 7, actualizado: ahora, actualizadoPor: 'u-epicteto' });
  escribir(`metrics/${sumarDias(hoy, -1)}`, {
    fecha: sumarDias(hoy, -1), total: 7, activosHoy: 3, activos7: 5, activos30: 7, altasHoy: 1, altas7: 2, altas30: 5, retencion7: 75, suspendidas: 0,
    porTipo: { sino: 5, cantidad: 4, medicion: 1 }, porPlataforma: { Android: 2, iOS: 2, Windows: 2, macOS: 1 }, calculado: ahora - 864e5,
  });
}
