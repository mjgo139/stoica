import { describe, expect, it } from 'vitest';
import {
  aRomano,
  citaDelDia,
  claveDia,
  diasRestantesDelAnio,
  esClaveDia,
  esTema,
  fechaLarga,
  inicial,
  momentoDelDia,
  perfilInicial,
  plataformaDe,
  primerNombre,
  saludo,
  validarContrasena,
  validarCorreo,
  validarNombre,
} from './index.js';

describe('fechas con zona horaria', () => {
  // 23 de octubre 2026, 02:30 UTC = 22 de octubre 23:30 en Asunción (UTC-3)
  const f = new Date(Date.UTC(2026, 9, 23, 2, 30));

  it('usa el día del usuario y no el de UTC', () => {
    expect(claveDia(f, 'America/Asuncion')).toBe('2026-10-22');
    expect(claveDia(f, 'UTC')).toBe('2026-10-23');
    expect(claveDia(f, 'Asia/Tokyo')).toBe('2026-10-23');
  });

  it('cae a Asunción si la zona no existe', () => {
    expect(claveDia(f, 'Marte/Olympus')).toBe('2026-10-22');
  });

  it('valida claves de día', () => {
    expect(esClaveDia('2026-10-22')).toBe(true);
    expect(esClaveDia('2026-02-30')).toBe(false);
    expect(esClaveDia('22-10-2026')).toBe(false);
  });

  it('cuenta los días que quedan del año', () => {
    expect(diasRestantesDelAnio(new Date(Date.UTC(2026, 11, 31, 15)), 'UTC')).toBe(0);
    expect(diasRestantesDelAnio(new Date(Date.UTC(2026, 0, 1, 15)), 'UTC')).toBe(364);
    expect(diasRestantesDelAnio(f, 'America/Asuncion')).toBe(70);
  });

  it('escribe la fecha larga en español', () => {
    expect(fechaLarga(f, 'America/Asuncion')).toBe('Jueves 22 de octubre');
  });

  it('saluda según la hora', () => {
    expect(saludo(7)).toBe('Buenos días');
    expect(saludo(15)).toBe('Buenas tardes');
    expect(saludo(23)).toBe('Buenas noches');
    expect(saludo(3)).toBe('Buenas noches');
  });

  it('ordena el día en tres momentos', () => {
    expect(momentoDelDia(6)).toBe(0);
    expect(momentoDelDia(14)).toBe(1);
    expect(momentoDelDia(21)).toBe(2);
    expect(momentoDelDia(0)).toBe(2);
  });
});

describe('números romanos', () => {
  it('convierte rachas', () => {
    expect(aRomano(0)).toBe('0');
    expect(aRomano(4)).toBe('IV');
    expect(aRomano(21)).toBe('XXI');
    expect(aRomano(365)).toBe('CCCLXV');
    expect(aRomano(1994)).toBe('MCMXCIV');
  });
});

describe('validaciones', () => {
  it('nombre', () => {
    expect(validarNombre('  Marco   Aurelio ').ok).toBe(true);
    expect(validarNombre('   ').ok).toBe(false);
    expect(validarNombre('x'.repeat(41)).ok).toBe(false);
  });
  it('correo', () => {
    expect(validarCorreo('epicteto@nicopolis.gr').ok).toBe(true);
    expect(validarCorreo('epicteto@').ok).toBe(false);
  });
  it('contraseña', () => {
    expect(validarContrasena('12345').ok).toBe(false);
    expect(validarContrasena('123456').ok).toBe(true);
  });
  it('tema', () => {
    expect(esTema('oscuro')).toBe(true);
    expect(esTema('azul')).toBe(false);
  });
});

describe('perfil', () => {
  it('arma el perfil inicial sin rol', () => {
    const p = perfilInicial('u1', '  Séneca  el joven ', ' Seneca@Roma.IT ', 'America/Asuncion', 1000);
    expect(p).toEqual({
      nombre: 'Séneca el joven',
      correo: 'seneca@roma.it',
      tema: 'sistema',
      mementoMori: true,
      zonaHoraria: 'America/Asuncion',
      creado: 1000,
      actualizado: 1000,
      actualizadoPor: 'u1',
    });
    expect('rol' in p).toBe(false);
  });
  it('iniciales y primer nombre', () => {
    expect(inicial(' marco aurelio')).toBe('M');
    expect(inicial('')).toBe('S');
    expect(primerNombre('Marco Aurelio')).toBe('Marco');
  });
  it('plataforma', () => {
    expect(plataformaDe('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', true)).toBe('iOS · app');
    expect(plataformaDe('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', false)).toBe('Windows · web');
  });
});

describe('citas', () => {
  it('la misma fecha da la misma cita', () => {
    expect(citaDelDia('2026-10-22')).toEqual(citaDelDia('2026-10-22'));
    expect(citaDelDia('2026-10-22').texto.length).toBeGreaterThan(10);
  });
});
