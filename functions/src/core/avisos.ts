/** Canal de Android de cada aviso (la APK los crea con prioridad alta: ventanita y sonido). */
export type CanalAviso = 'recordatorios' | 'grupo' | 'comentarios';

export function canalDeAviso(tag: string): CanalAviso {
  if (tag.startsWith('coment')) return 'comentarios';
  if (/^(cumple|foto|reaccion|plan)-/.test(tag)) return 'grupo';
  return 'recordatorios';
}
