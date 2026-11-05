package app.stoica;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Toques en los widgets que guardan algo sin abrir la app: marcar un hábito (o sumar 1),
 * marcar una tarea y actualizar el grupo. El widget cambia al instante y después se guarda en la nube;
 * si no se pudo, vuelve como estaba y avisa.
 */
public class AccionReceiver extends BroadcastReceiver {

    static final String ACCION = "app.stoica.WIDGET_ACCION";

    @Override
    public void onReceive(Context contexto, Intent intent) {
        if (!ACCION.equals(intent.getAction())) return;
        final Context c = contexto.getApplicationContext();
        final String que = intent.getStringExtra("que");
        final String id = intent.getStringExtra("id");
        if (que == null || id == null) return;
        final PendingResult pendiente = goAsync();
        new Thread(() -> {
            try {
                if ("habito".equals(que)) marcarHabito(c, id);
                else if ("tarea".equals(que)) marcarTarea(c, id);
                else if ("grupo".equals(que)) GrupoWidget.actualizarDesdeNube(c, id, true);
            } finally {
                pendiente.finish();
            }
        }).start();
    }

    static void avisar(Context c, String texto) {
        new Handler(Looper.getMainLooper()).post(() -> Toast.makeText(c, texto, Toast.LENGTH_SHORT).show());
    }

    private static boolean sinSesion(Context c) {
        if (Nube.haySesion(c) && !Nube.uid(c).isEmpty()) return false;
        avisar(c, "Abrí Stoica una vez para poder marcar desde el widget.");
        return true;
    }

    // ---------- Hábitos ----------

    private static void marcarHabito(Context c, String hid) {
        JSONObject d = Estado.datos(c);
        JSONObject h = Estado.habito(d, hid);
        if (h == null || !Estado.marcable(h) || sinSesion(c)) return;
        String hoy = Estado.hoy(d);
        String clave = hid + "_" + hoy;
        boolean sino = "sino".equals(h.optString("tipo"));
        JSONObject antes = Estado.marca(d, hid, hoy);
        String antesTexto = antes == null ? null : antes.toString();
        boolean hechoQuerido = !(antes != null && antes.optBoolean("h"));
        boolean yaCumplido = Estado.cumplido(h, antes);

        // 1) Al instante en el widget.
        try {
            JSONObject m = antes != null ? new JSONObject(antes.toString()) : new JSONObject().put("h", false).put("v", 0).put("m", 0);
            if (sino) m.put("h", hechoQuerido);
            else m.put("v", Estado.valor(m) + 1);
            ponerMarca(c, clave, m);
        } catch (Exception e) {
            return;
        }

        // 2) En la nube (lo que ya estaba guardado manda: nota, medidas y el valor real).
        try {
            String uid = Nube.uid(c);
            String ruta = "users/" + uid + "/logs/" + clave;
            JSONObject actual = Nube.leer(c, ruta);
            boolean hecho = sino ? hechoQuerido : Nube.leerBooleano(actual, "hecho");
            double valor = Nube.leerNumero(actual, "valor");
            if (!sino) valor = Math.min(200000, valor + 1);
            JSONObject campos = new JSONObject()
                .put("habitId", Nube.texto(hid))
                .put("fecha", Nube.texto(hoy))
                .put("hecho", Nube.booleano(hecho))
                .put("valor", Nube.numero(valor))
                .put("medidas", actual != null && actual.has("medidas") ? actual.getJSONObject("medidas") : Nube.mapaVacio())
                .put("nota", Nube.texto(Nube.leerTexto(actual, "nota")))
                .put("actualizado", Nube.entero(System.currentTimeMillis()))
                .put("actualizadoPor", Nube.texto(uid));
            Nube.escribir(c, ruta, campos, null);
            ponerMarca(c, clave, new JSONObject().put("h", hecho).put("v", valor).put("m", Nube.contarMapa(actual, "medidas")));
            JSONObject despues = new JSONObject().put("h", hecho).put("v", valor);
            if (!yaCumplido && Estado.cumplido(h, despues)) avisar(c, "✓ " + h.optString("nombre") + ": cumplido");
        } catch (Exception e) {
            try {
                ponerMarca(c, clave, antesTexto == null ? null : new JSONObject(antesTexto));
            } catch (Exception ignorado) {
                // nada
            }
            avisar(c, mensajeDeFallo(e));
        }
    }

    private static void ponerMarca(Context c, String clave, JSONObject m) throws Exception {
        synchronized (Estado.class) {
            JSONObject d = Estado.datos(c);
            JSONObject marcas = d.optJSONObject("marcas");
            if (marcas == null) {
                marcas = new JSONObject();
                d.put("marcas", marcas);
            }
            if (m == null) marcas.remove(clave);
            else marcas.put(clave, m);
            Estado.guardar(c, d);
        }
        Estado.refrescarTodos(c);
    }

    // ---------- Tareas ----------

    private static void marcarTarea(Context c, String tid) {
        JSONObject d = Estado.datos(c);
        JSONObject t = Estado.tarea(d, tid);
        if (t == null || sinSesion(c)) return;
        String hoy = Estado.hoy(d);
        boolean diaria = t.optBoolean("diaria");
        boolean hecha = !Estado.tareaHecha(d, t, hoy);
        Object completadaAntes = t.opt("completada");
        try {
            ponerTarea(c, tid, hoy, diaria, hecha, null);
            String uid = Nube.uid(c);
            long ahora = System.currentTimeMillis();
            if (diaria) {
                JSONObject campos = new JSONObject()
                    .put("taskId", Nube.texto(tid))
                    .put("fecha", Nube.texto(hoy))
                    .put("hecha", Nube.booleano(hecha))
                    .put("actualizado", Nube.entero(ahora))
                    .put("actualizadoPor", Nube.texto(uid));
                Nube.escribir(c, "users/" + uid + "/taskDone/" + tid + "_" + hoy, campos, null);
            } else {
                JSONObject campos = new JSONObject()
                    .put("completada", hecha ? Nube.texto(hoy) : Nube.nulo())
                    .put("actualizado", Nube.entero(ahora))
                    .put("actualizadoPor", Nube.texto(uid));
                Nube.escribir(c, "users/" + uid + "/tasks/" + tid, campos, new String[] { "completada", "actualizado", "actualizadoPor" });
            }
        } catch (Exception e) {
            try {
                ponerTarea(c, tid, hoy, diaria, !hecha, completadaAntes);
            } catch (Exception ignorado) {
                // nada
            }
            avisar(c, mensajeDeFallo(e));
        }
    }

    private static void ponerTarea(Context c, String tid, String hoy, boolean diaria, boolean hecha, Object completadaAntes) throws Exception {
        synchronized (Estado.class) {
            JSONObject d = Estado.datos(c);
            if (diaria) {
                JSONArray hs = d.optJSONArray("hechas");
                JSONArray nuevo = new JSONArray();
                String clave = tid + "_" + hoy;
                if (hs != null) for (int i = 0; i < hs.length(); i++) if (!clave.equals(hs.optString(i))) nuevo.put(hs.optString(i));
                if (hecha) nuevo.put(clave);
                d.put("hechas", nuevo);
            } else {
                JSONObject t = Estado.tarea(d, tid);
                if (t != null) t.put("completada", completadaAntes != null ? completadaAntes : (hecha ? hoy : JSONObject.NULL));
            }
            Estado.guardar(c, d);
        }
        Estado.refrescarTodos(c);
    }

    static String mensajeDeFallo(Exception e) {
        if (e instanceof Nube.Fallo) {
            int codigo = ((Nube.Fallo) e).codigo;
            if (codigo == 400 || codigo == 401) return "Tu sesión del widget venció: abrí Stoica una vez.";
            if (codigo == 403) return "No se pudo guardar desde el widget. Marcalo en Stoica.";
            if (codigo == 404) return "Eso ya no existe. Abrí Stoica para actualizar el widget.";
        }
        return "Sin conexión: no se guardó. Probá de nuevo.";
    }
}
