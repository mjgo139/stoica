package app.stoica;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Widget de un grupo: cómo van hoy tus compañeros (hábitos compartidos cumplidos).
 * Se actualiza solo cada media hora (lee los resúmenes del grupo) y con el botón ↻.
 */
public class GrupoWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context contexto, AppWidgetManager manager, int[] ids) {
        for (int id : ids) dibujar(contexto, manager, id);
        final Context c = contexto.getApplicationContext();
        final List<String> grupos = new ArrayList<>();
        for (int id : ids) {
            String gid = Estado.eleccion(c, id);
            if (gid != null && !grupos.contains(gid)) grupos.add(gid);
        }
        if (grupos.isEmpty() || !Nube.haySesion(c)) return;
        final PendingResult pendiente = goAsync();
        new Thread(() -> {
            try {
                for (String gid : grupos) actualizarDesdeNube(c, gid, false);
            } finally {
                pendiente.finish();
            }
        }).start();
    }

    @Override
    public void onDeleted(Context contexto, int[] ids) {
        Estado.olvidar(contexto, ids);
    }

    /** Lee los resúmenes de los compañeros (una lectura por compañero) y redibuja. */
    static void actualizarDesdeNube(Context c, String gid, boolean manual) {
        if (!Nube.haySesion(c)) {
            if (manual) AccionReceiver.avisar(c, "Abrí Stoica una vez para actualizar el grupo.");
            return;
        }
        try {
            JSONArray docs = Nube.listar(c, "groups/" + gid + "/members");
            JSONArray miembros = new JSONArray();
            for (int i = 0; i < docs.length(); i++) {
                JSONObject doc = docs.optJSONObject(i);
                if (doc == null) continue;
                String nombreDoc = doc.optString("name", "");
                JSONObject f = doc.optJSONObject("fields");
                JSONObject comp = f == null ? null : f.optJSONObject("compartidos");
                JSONObject arr = comp == null ? null : comp.optJSONObject("arrayValue");
                JSONArray valores = arr == null ? null : arr.optJSONArray("values");
                int total = valores == null ? 0 : valores.length();
                int hechos = 0;
                for (int j = 0; j < total; j++) {
                    JSONObject mv = valores.optJSONObject(j);
                    JSONObject campos = mv == null || mv.optJSONObject("mapValue") == null ? null : mv.optJSONObject("mapValue").optJSONObject("fields");
                    if (Nube.leerBooleano(campos, "hoy")) hechos++;
                }
                miembros.put(new JSONObject()
                    .put("uid", nombreDoc.substring(nombreDoc.lastIndexOf('/') + 1))
                    .put("nombre", Nube.leerTexto(f, "nombre"))
                    .put("fecha", Nube.leerTexto(f, "fecha"))
                    .put("hechos", hechos)
                    .put("total", total));
            }
            synchronized (Estado.class) {
                JSONObject d = Estado.datos(c);
                JSONObject g = Estado.grupo(d, gid);
                if (g == null) return;
                g.put("miembros", miembros);
                g.put("leido", System.currentTimeMillis());
                Estado.guardar(c, d);
            }
            Estado.refrescarTodos(c);
        } catch (Exception e) {
            if (manual) AccionReceiver.avisar(c, AccionReceiver.mensajeDeFallo(e));
        }
    }

    @Override
    public void onAppWidgetOptionsChanged(Context contexto, AppWidgetManager manager, int id, android.os.Bundle nuevas) {
        dibujar(contexto, manager, id); // cambió de tamaño: entran más o menos filas
    }

    static void dibujar(Context c, AppWidgetManager manager, int widgetId) {
        JSONObject d = Estado.datos(c);
        String gid = Estado.eleccion(c, widgetId);
        JSONObject g = Estado.conDatos(d) ? Estado.grupo(d, gid) : null;
        RemoteViews v = Lista.nueva(c, g == null ? "GRUPO · STOICA" : g.optString("nombre").toUpperCase(Locale.getDefault()));
        String ruta = g == null ? "/comunidad" : "/comunidad/" + gid;
        v.setOnClickPendingIntent(R.id.widget_raiz, Estado.abrir(c, ruta));
        v.setOnClickPendingIntent(R.id.w_titulo, Estado.abrir(c, ruta));
        if (g == null) {
            Lista.vacio(v, !Estado.conDatos(d) ? "Entrá a Stoica para ver tu grupo." : gid == null ? "Mantené apretado el widget para elegir el grupo." : "Ya no estás en ese grupo.");
            manager.updateAppWidget(widgetId, v);
            return;
        }
        v.setTextViewText(R.id.w_cuenta, "↻");
        v.setOnClickPendingIntent(R.id.w_cuenta, Estado.accion(c, "grupo", gid, widgetId));
        String hoy = Estado.hoy(d);
        String yo = d.optString("yo");
        JSONArray ms = g.optJSONArray("miembros");
        List<JSONObject> lista = new ArrayList<>();
        if (ms != null) for (int i = 0; i < ms.length(); i++) if (ms.optJSONObject(i) != null) lista.add(ms.optJSONObject(i));
        if (lista.isEmpty()) {
            Lista.vacio(v, "Abrí el grupo en Stoica o tocá ↻.");
            manager.updateAppWidget(widgetId, v);
            return;
        }
        // Primero vos, después los que más cumplieron hoy.
        Collections.sort(lista, (a, b) -> {
            if (yo.equals(a.optString("uid"))) return -1;
            if (yo.equals(b.optString("uid"))) return 1;
            return Float.compare(avance(b, hoy), avance(a, hoy));
        });
        int hechos = 0;
        int total = 0;
        for (JSONObject m : lista) {
            total += m.optInt("total");
            if (hoy.equals(m.optString("fecha"))) hechos += m.optInt("hechos");
        }
        Lista.barra(v, hechos, total);
        int cap = Lista.capacidad(manager, widgetId);
        Lista.reservar(v, cap);
        int n = Math.min(cap, lista.size());
        for (int i = 0; i < n; i++) {
            JSONObject m = lista.get(i);
            boolean alDia = hoy.equals(m.optString("fecha"));
            int h = alDia ? m.optInt("hechos") : 0;
            int t = m.optInt("total");
            boolean completo = t > 0 && h >= t;
            String nombre = yo.equals(m.optString("uid")) ? "Vos" : m.optString("nombre", "Compañero");
            Lista.fila(c, v, i, nombre, alDia || t == 0 ? "" : "sin abrir hoy", t == 0 ? "—" : (completo ? Lista.LLENO + " " : "") + h + "/" + t, completo,
                Estado.abrir(c, ruta), Estado.abrir(c, ruta));
        }
        long leido = g.optLong("leido", 0);
        String pie = lista.size() > n ? "+" + (lista.size() - n) + " más · " : "";
        if (leido > 0) pie += "Actualizado " + new SimpleDateFormat("HH:mm", Locale.US).format(new Date(leido));
        Lista.pie(v, pie);
        manager.updateAppWidget(widgetId, v);
    }

    private static float avance(JSONObject m, String hoy) {
        int t = m.optInt("total");
        if (t == 0 || !hoy.equals(m.optString("fecha"))) return 0;
        return m.optInt("hechos") / (float) t;
    }
}
