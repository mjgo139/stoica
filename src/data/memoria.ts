/**
 * Driver en memoria ("modo prueba"): todo vive en esta pestaña y se pierde al recargar.
 * Simula Firestore (consultas en vivo) y las funciones del servidor, sin tocar Firebase.
 * No aplica las reglas de seguridad: esas se prueban aparte, contra el emulador.
 */
import type { CambiosPerfil, Perfil } from '@core/perfil';
import { validarContrasena, validarCorreo } from '@core/validaciones';
import { calcularMetricas, type Cuenta } from '@core/admin';
import { esCodigo, generarCodigo, MAX_GRUPOS_POR_USUARIO, MAX_MIEMBROS, normalizarCodigo, validarNombreGrupo, type Grupo } from '@core/comunidad';
import { limpiarNombre } from '@core/validaciones';
import { esCodigoPlan, estadoPlan, extenderPlan, generarCodigoPlan, idFoto, MESES_PLAN, normalizarCodigoPlan, type CodigoPlan } from '@core/plan';
import { claveDia } from '@core/fechas';
import { ErrorStoica, type Cancelar, type ConId, type Consulta, type Driver, type NombreFuncion, type UsuarioSesion } from './tipos';
import { sembrarEjemplo } from './ejemplo';

type Datos = Record<string, unknown>;

interface CuentaAuth {
  uid: string;
  correo: string;
  nombre: string;
  contrasena: string;
  suspendida?: boolean;
}

const espera = (ms = 80) => new Promise((r) => setTimeout(r, ms));
const clonar = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const dividir = (ruta: string) => {
  const p = ruta.split('/');
  return { col: p.slice(0, -1).join('/'), id: p[p.length - 1] };
};

export function crearDriverMemoria(): Driver {
  const colecciones = new Map<string, Map<string, Datos>>();
  const oyentesDoc = new Map<string, Set<() => void>>();
  const oyentesCol = new Map<string, Set<() => void>>();
  const cuentas = new Map<string, CuentaAuth>();
  const oyentesSesion = new Set<(u: UsuarioSesion | null) => void>();
  let sesion: UsuarioSesion | null = null;
  let contador = 0;

  const col = (ruta: string) => {
    if (!colecciones.has(ruta)) colecciones.set(ruta, new Map());
    return colecciones.get(ruta)!;
  };
  const leerDoc = (ruta: string): Datos | undefined => {
    const { col: c, id } = dividir(ruta);
    return colecciones.get(c)?.get(id);
  };
  const avisar = (ruta: string) => {
    const { col: c } = dividir(ruta);
    queueMicrotask(() => {
      oyentesDoc.get(ruta)?.forEach((f) => f());
      oyentesCol.get(c)?.forEach((f) => f());
    });
  };
  const escribir = (ruta: string, datos: Datos | null, combinar = false) => {
    const { col: c, id } = dividir(ruta);
    if (datos === null) col(c).delete(id);
    else col(c).set(id, combinar ? { ...(col(c).get(id) ?? {}), ...clonar(datos) } : clonar(datos));
    avisar(ruta);
  };
  const borrarArbol = (prefijo: string) => {
    for (const [ruta, m] of colecciones) {
      if (ruta === prefijo || ruta.startsWith(prefijo + '/')) {
        for (const id of [...m.keys()]) escribir(`${ruta}/${id}`, null);
      }
    }
  };
  const ejecutar = (c: Consulta): Array<ConId<Datos>> => {
    let docs = [...(colecciones.get(c.ruta) ?? new Map()).entries()].map(([id, d]) => ({ id, ...clonar(d) }) as ConId<Datos>);
    for (const [campo, op, valor] of c.filtros ?? []) {
      docs = docs.filter((d) => {
        const v = d[campo] as never;
        if (op === '==') return v === valor;
        if (op === '>=') return v >= (valor as never);
        if (op === '<=') return v <= (valor as never);
        return Array.isArray(v) && (v as unknown[]).includes(valor);
      });
    }
    if (c.orden) {
      const [campo, dir] = c.orden;
      docs.sort((a, b) => ((a[campo] as never) < (b[campo] as never) ? -1 : (a[campo] as never) > (b[campo] as never) ? 1 : 0) * (dir === 'asc' ? 1 : -1));
    }
    if (c.limite) docs = docs.slice(0, c.limite);
    return docs;
  };

  const emitirSesion = () => oyentesSesion.forEach((cb) => cb(sesion));
  const iniciar = (c: CuentaAuth, proveedor: UsuarioSesion['proveedor']) => {
    if (c.suspendida) throw new ErrorStoica('Esta cuenta está suspendida.', 'auth/user-disabled');
    sesion = { uid: c.uid, correo: c.correo, nombre: c.nombre, proveedor };
    emitirSesion();
  };
  const yo = () => {
    if (!sesion) throw new ErrorStoica('Tenés que entrar primero.', 'unauthenticated');
    return sesion.uid;
  };
  const esAdmin = () => (leerDoc(`users/${yo()}`) as Partial<Perfil> | undefined)?.rol === 'admin';

  // Cuenta de ejemplo con datos para probar (admin, para ver el panel).
  cuentas.set('prueba@stoica.app', { uid: 'u-prueba', correo: 'prueba@stoica.app', nombre: 'Marco Aurelio', contrasena: 'stoica' });
  sembrarEjemplo((ruta, datos) => escribir(ruta, datos), (correo, uid, nombre) => cuentas.set(correo, { uid, correo, nombre, contrasena: 'stoica' }));

  const funciones: Record<NombreFuncion, (d: Datos) => unknown> = {
    crearGrupo(d) {
      const uid = yo();
      const err = validarNombreGrupo(String(d.nombre ?? ''));
      if (err) throw new ErrorStoica(err, 'invalid-argument');
      const mios = ejecutar({ ruta: 'groups', filtros: [['miembros', 'array-contains', uid]] });
      if (mios.length >= MAX_GRUPOS_POR_USUARIO) throw new ErrorStoica(`Podés estar en hasta ${MAX_GRUPOS_POR_USUARIO} grupos.`, 'resource-exhausted');
      const id = `g-${++contador}`;
      const g: Omit<Grupo, 'id'> = { nombre: limpiarNombre(String(d.nombre)), creador: uid, codigo: generarCodigo(), miembros: [uid], creado: Date.now() };
      escribir(`groups/${id}`, g as never);
      return { id, codigo: g.codigo };
    },
    unirseAGrupo(d) {
      const uid = yo();
      const codigo = normalizarCodigo(String(d.codigo ?? ''));
      if (!esCodigo(codigo)) throw new ErrorStoica('Ese código no es válido.', 'invalid-argument');
      const g = ejecutar({ ruta: 'groups', filtros: [['codigo', '==', codigo]] })[0] as unknown as ConId<Grupo> | undefined;
      if (!g) throw new ErrorStoica('No encontramos un grupo con ese código.', 'not-found');
      if (g.miembros.includes(uid)) return { id: g.id };
      if (g.miembros.length >= MAX_MIEMBROS) throw new ErrorStoica(`El grupo ya tiene ${MAX_MIEMBROS} integrantes.`, 'resource-exhausted');
      escribir(`groups/${g.id}`, { miembros: [...g.miembros, uid] }, true);
      return { id: g.id };
    },
    salirDeGrupo(d) {
      const uid = yo();
      const g = leerDoc(`groups/${d.grupoId}`) as Grupo | undefined;
      if (!g || !g.miembros.includes(uid)) return { ok: true };
      const quedan = g.miembros.filter((m) => m !== uid);
      escribir(`groups/${d.grupoId}/members/${uid}`, null);
      if (quedan.length === 0) borrarArbol(`groups/${d.grupoId}`), escribir(`groups/${d.grupoId}`, null);
      else escribir(`groups/${d.grupoId}`, { miembros: quedan, creador: g.creador === uid ? quedan[0] : g.creador }, true);
      return { ok: true };
    },
    renombrarGrupo(d) {
      const uid = yo();
      const g = leerDoc(`groups/${d.grupoId}`) as Grupo | undefined;
      if (!g) throw new ErrorStoica('Ese grupo ya no existe.', 'not-found');
      if (g.creador !== uid) throw new ErrorStoica('Solo quien creó el grupo puede cambiarle el nombre.', 'permission-denied');
      const err = validarNombreGrupo(String(d.nombre ?? ''));
      if (err) throw new ErrorStoica(err, 'invalid-argument');
      escribir(`groups/${d.grupoId}`, { nombre: limpiarNombre(String(d.nombre)) }, true);
      return { ok: true };
    },
    eliminarGrupo(d) {
      const uid = yo();
      const g = leerDoc(`groups/${d.grupoId}`) as Grupo | undefined;
      if (!g) return { ok: true };
      if (g.creador !== uid) throw new ErrorStoica('Solo quien creó el grupo puede eliminarlo.', 'permission-denied');
      borrarArbol(`groups/${d.grupoId}`);
      escribir(`groups/${d.grupoId}`, null);
      return { ok: true };
    },
    borrarMiCuenta() {
      const uid = yo();
      for (const g of ejecutar({ ruta: 'groups', filtros: [['miembros', 'array-contains', uid]] })) funciones.salirDeGrupo({ grupoId: g.id });
      borrarArbol(`users/${uid}`);
      escribir(`users/${uid}`, null);
      escribir(`accounts/${uid}`, null);
      for (const [k, c] of cuentas) if (c.uid === uid) cuentas.delete(k);
      sesion = null;
      emitirSesion();
      return { ok: true };
    },
    adminSuspender(d) {
      if (!esAdmin()) throw new ErrorStoica('Solo el admin puede hacer esto.', 'permission-denied');
      if (d.uid === yo()) throw new ErrorStoica('No podés suspender tu propia cuenta.', 'failed-precondition');
      escribir(`accounts/${d.uid}`, { suspendida: !!d.suspender }, true);
      for (const c of cuentas.values()) if (c.uid === d.uid) c.suspendida = !!d.suspender;
      return { ok: true };
    },
    adminBorrarCuenta(d) {
      if (!esAdmin()) throw new ErrorStoica('Solo el admin puede hacer esto.', 'permission-denied');
      if (d.uid === yo()) throw new ErrorStoica('Para borrar tu cuenta usá Perfil › Borrar mi cuenta.', 'failed-precondition');
      borrarArbol(`users/${d.uid}`);
      escribir(`users/${d.uid}`, null);
      escribir(`accounts/${d.uid}`, null);
      for (const [k, c] of cuentas) if (c.uid === d.uid) cuentas.delete(k);
      return { ok: true };
    },
    asegurarCuenta() {
      return { rol: esAdmin() ? 'admin' : 'usuario' };
    },
    adminCrearCodigos(d) {
      if (!esAdmin()) throw new ErrorStoica('Solo el admin puede hacer esto.', 'permission-denied');
      const meses = Number(d.meses);
      if (!(MESES_PLAN as readonly number[]).includes(meses)) throw new ErrorStoica('Elegí 1, 3, 6 o 12 meses.', 'invalid-argument');
      const codigos = Array.from({ length: Math.max(1, Math.min(20, Number(d.cantidad ?? 1))) }, () => generarCodigoPlan(Math.random));
      for (const c of codigos) escribir(`codigos/${c}`, { meses: meses as CodigoPlan['meses'], nota: String(d.nota ?? ''), creado: Date.now(), usado: false, usadoPor: null, grupoId: null, grupoNombre: null, usadoEn: null } satisfies CodigoPlan);
      return { codigos };
    },
    canjearCodigo(d) {
      const uid = yo();
      const g = leerDoc(`groups/${d.grupoId}`) as Grupo | undefined;
      if (!g || !g.miembros.includes(uid)) throw new ErrorStoica('No estás en este grupo.', 'permission-denied');
      const cod = normalizarCodigoPlan(String(d.codigo ?? ''));
      if (!esCodigoPlan(cod)) throw new ErrorStoica('Ese código no es válido. Revisá que esté bien escrito.', 'not-found');
      const k = leerDoc(`codigos/${cod}`) as CodigoPlan | undefined;
      if (!k) throw new ErrorStoica('Ese código no existe.', 'not-found');
      if (k.usado) throw new ErrorStoica('Ese código ya se usó.', 'not-found');
      const hasta = extenderPlan(g.premiumHasta, Date.now(), k.meses);
      escribir(`groups/${d.grupoId}`, { premiumHasta: hasta }, true);
      escribir(`codigos/${cod}`, { usado: true, usadoPor: uid, grupoId: d.grupoId, grupoNombre: g.nombre, usadoEn: Date.now() }, true);
      return { hasta, meses: k.meses };
    },
    subirFotoDesafio(d) {
      const uid = yo();
      const g = leerDoc(`groups/${d.grupoId}`) as Grupo | undefined;
      if (!g || !g.miembros.includes(uid)) throw new ErrorStoica('No estás en este grupo.', 'permission-denied');
      if (estadoPlan(g.premiumHasta, Date.now()).estado !== 'activo') throw new ErrorStoica('El grupo no tiene el plan con fotos activo.', 'failed-precondition');
      if (!leerDoc(`groups/${d.grupoId}/challenges/${d.desafioId}/progress/${uid}`)) throw new ErrorStoica('Sumate al desafío para subir fotos.', 'permission-denied');
      const dia = claveDia(new Date(), 'America/Asuncion');
      const perfil = leerDoc(`users/${uid}`) as Partial<Perfil> | undefined;
      escribir(`groups/${d.grupoId}/challenges/${d.desafioId}/posts/${idFoto(uid, dia)}`, {
        de: uid,
        nombre: perfil?.nombre ?? '',
        tipo: 'foto',
        texto: String(d.texto ?? '').slice(0, 280),
        dia,
        fotoUrl: `data:image/jpeg;base64,${d.foto}`,
        miniUrl: `data:image/jpeg;base64,${d.mini}`,
        rutas: [],
        creado: Date.now(),
        actualizado: Date.now(),
        actualizadoPor: 'servidor',
      });
      return { ok: true };
    },
    reportarPublicacion(d) {
      const ruta = `groups/${d.grupoId}/challenges/${d.desafioId}/posts/${d.publicacionId}`;
      const p = leerDoc(ruta) as Record<string, unknown> | undefined;
      if (!p) throw new ErrorStoica('Esa publicación ya no existe.', 'not-found');
      escribir(`reportes/${ruta.replace(/\//g, '_')}`, { ruta, grupoNombre: (leerDoc(`groups/${d.grupoId}`) as unknown as Grupo).nombre, autor: p.nombre, autorUid: p.de, tipo: p.tipo, texto: p.texto, miniUrl: p.miniUrl ?? null, fotoUrl: p.fotoUrl ?? null, motivo: String(d.motivo ?? ''), reportadoPor: yo(), creado: Date.now() });
      return { ok: true };
    },
    adminResolverReporte(d) {
      if (!esAdmin()) throw new ErrorStoica('Solo el admin puede hacer esto.', 'permission-denied');
      const r = leerDoc(`reportes/${d.reporteId}`) as { ruta: string } | undefined;
      if (r && d.borrar === true) escribir(r.ruta, null);
      escribir(`reportes/${d.reporteId}`, null);
      return { ok: true };
    },
    probarNotificacion() {
      return { enviados: 1, dispositivos: 1 };
    },
    adminDesbloquear(d) {
      if (!esAdmin()) throw new ErrorStoica('Solo el admin puede hacer esto.', 'permission-denied');
      escribir(`accounts/${d.uid}`, { bloqueada: false, motivoBloqueo: '' }, true);
      return { ok: true };
    },
    adminCalcularMetricas() {
      if (!esAdmin()) throw new ErrorStoica('Solo el admin puede hacer esto.', 'permission-denied');
      const porTipo = { sino: 0, cantidad: 0, medicion: 0 };
      for (const [ruta, m] of colecciones) {
        if (!/^users\/[^/]+\/habits$/.test(ruta)) continue;
        for (const h of m.values()) porTipo[h.tipo as keyof typeof porTipo]++;
      }
      const lista = ejecutar({ ruta: 'accounts' }) as unknown as Cuenta[];
      const m = calcularMetricas(lista, porTipo, Date.now(), 'America/Asuncion');
      escribir(`metrics/${m.fecha}`, m as never);
      return m;
    },
    asignarRol(d) {
      if (!esAdmin()) throw new ErrorStoica('Solo el admin puede cambiar roles.', 'permission-denied');
      escribir(`users/${d.uid}`, { rol: d.rol }, true);
      escribir(`accounts/${d.uid}`, { rol: d.rol }, true);
      return { ok: true };
    },
  };

  return {
    nombre: 'memoria',
    observarSesion(cb) {
      oyentesSesion.add(cb);
      setTimeout(() => cb(sesion), 0);
      return () => oyentesSesion.delete(cb);
    },
    async entrar(correo, contrasena) {
      await espera();
      const c = cuentas.get(correo.trim().toLowerCase());
      if (!c || c.contrasena !== contrasena) throw new ErrorStoica('El correo o la contraseña no coinciden.', 'auth/invalid-credential');
      iniciar(c, 'password');
    },
    async registrar(nombre, correo, contrasena) {
      await espera();
      const k = correo.trim().toLowerCase();
      const vc = validarCorreo(k);
      if (!vc.ok) throw new ErrorStoica(vc.error, 'auth/invalid-email');
      const vp = validarContrasena(contrasena);
      if (!vp.ok) throw new ErrorStoica(vp.error, 'auth/weak-password');
      if (cuentas.has(k)) throw new ErrorStoica('Ya hay una cuenta con ese correo. Probá entrar.', 'auth/email-already-in-use');
      const c = { uid: `u-${++contador}`, correo: k, nombre, contrasena };
      cuentas.set(k, c);
      iniciar(c, 'password');
    },
    async entrarConGoogle() {
      await espera(200);
      const k = 'google@stoica.app';
      if (!cuentas.has(k)) cuentas.set(k, { uid: 'u-google', correo: k, nombre: 'Lucio Séneca', contrasena: '' });
      iniciar(cuentas.get(k)!, 'google');
    },
    async recuperarContrasena(correo) {
      await espera();
      const v = validarCorreo(correo);
      if (!v.ok) throw new ErrorStoica(v.error, 'auth/invalid-email');
    },
    async salir() {
      await espera(40);
      sesion = null;
      emitirSesion();
    },
    observarPerfil(uid, cb) {
      return this.observarDoc<Perfil>(`users/${uid}`, (p) => cb(p as Perfil | null), () => undefined);
    },
    async crearPerfil(uid, perfil) {
      await espera(40);
      if (leerDoc(`users/${uid}`)) return;
      // En Firebase el rol y accounts/{uid} los pone la función alCrearUsuario.
      escribir(`users/${uid}`, { ...perfil, rol: uid === 'u-prueba' ? 'admin' : 'usuario' } as never);
      escribir(`accounts/${uid}`, { nombre: perfil.nombre, correo: perfil.correo, alta: Date.now(), ultimoAcceso: Date.now(), plataforma: '', rol: 'usuario', suspendida: false });
    },
    async actualizarPerfil(uid, cambios: CambiosPerfil) {
      if (!leerDoc(`users/${uid}`)) throw new ErrorStoica('Tu perfil todavía no está listo.', 'not-found');
      escribir(`users/${uid}`, { ...cambios, actualizado: Date.now(), actualizadoPor: uid } as never, true);
      if (cambios.nombre) escribir(`accounts/${uid}`, { nombre: cambios.nombre }, true);
    },
    async registrarAcceso(uid, plataforma) {
      if (leerDoc(`accounts/${uid}`)) escribir(`accounts/${uid}`, { ultimoAcceso: Date.now(), plataforma }, true);
    },

    nuevoId: () => `id${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    observarDoc<T>(ruta: string, cb: (d: ConId<T> | null) => void): Cancelar {
      const f = () => {
        const d = leerDoc(ruta);
        cb(d ? ({ id: dividir(ruta).id, ...clonar(d) } as ConId<T>) : null);
      };
      if (!oyentesDoc.has(ruta)) oyentesDoc.set(ruta, new Set());
      oyentesDoc.get(ruta)!.add(f);
      setTimeout(f, 0);
      return () => oyentesDoc.get(ruta)?.delete(f);
    },
    observarLista<T>(c: Consulta, cb: (docs: Array<ConId<T>>, info: { desdeServidor: boolean }) => void): Cancelar {
      const f = () => cb(ejecutar(c) as Array<ConId<T>>, { desdeServidor: true });
      if (!oyentesCol.has(c.ruta)) oyentesCol.set(c.ruta, new Set());
      oyentesCol.get(c.ruta)!.add(f);
      setTimeout(f, 0);
      return () => oyentesCol.get(c.ruta)?.delete(f);
    },
    async leerLista<T>(c: Consulta) {
      await espera(20);
      return ejecutar(c) as Array<ConId<T>>;
    },
    async leerListaLocal<T>(c: Consulta) {
      return ejecutar(c) as Array<ConId<T>>;
    },
    async guardar(ruta, datos, opciones) {
      yo();
      escribir(ruta, datos, !!opciones?.combinar);
    },
    async borrar(ruta) {
      yo();
      escribir(ruta, null);
    },
    async llamar<T>(nombre: NombreFuncion, datos?: Datos) {
      await espera(120);
      return funciones[nombre](datos ?? {}) as T;
    },
    async refrescarToken() {},
    async activarNotificaciones() {
      return { token: `token-prueba-${sesion?.uid ?? 'x'}` };
    },
    async desactivarNotificaciones() {},
  };
}
