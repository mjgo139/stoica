package app.stoica;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;
import java.util.List;
import org.json.JSONObject;

/** Widget "Tareas de hoy": atrasadas, las de hoy y las sin fecha; el rombo las completa. */
public class TareasWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context contexto, AppWidgetManager manager, int[] ids) {
        for (int id : ids) dibujar(contexto, manager, id);
    }

    static void dibujar(Context c, AppWidgetManager manager, int widgetId) {
        RemoteViews v = Lista.nueva(c, "TAREAS · HOY");
        v.setOnClickPendingIntent(R.id.w_cabeza, Estado.abrir(c, "/tareas"));
        v.setOnClickPendingIntent(R.id.widget_raiz, Estado.abrir(c, "/tareas"));
        JSONObject d = Estado.datos(c);
        if (!Estado.conDatos(d)) {
            Lista.vacio(v, d.optBoolean("sinSesion") ? "Entrá a Stoica para ver tus tareas." : "Abrí Stoica para ver tus tareas.");
            manager.updateAppWidget(widgetId, v);
            return;
        }
        String hoy = Estado.hoy(d);
        List<JSONObject> ts = Estado.tareasDeHoy(d, hoy);
        if (ts.isEmpty()) {
            Lista.vacio(v, "No tenés tareas para hoy.");
            manager.updateAppWidget(widgetId, v);
            return;
        }
        int hechas = 0;
        for (JSONObject t : ts) if (Estado.tareaHecha(d, t, hoy)) hechas++;
        v.setTextViewText(R.id.w_cuenta, hechas + "/" + ts.size());
        Lista.barra(v, hechas, ts.size());
        int n = Math.min(Lista.MAX, ts.size());
        for (int i = 0; i < n; i++) {
            JSONObject t = ts.get(i);
            boolean ok = Estado.tareaHecha(d, t, hoy);
            String fecha = t.isNull("fecha") ? "" : t.optString("fecha", "");
            String hora = t.isNull("hora") ? "" : t.optString("hora", "");
            String detalle = hora;
            if (!ok && !t.optBoolean("diaria") && !fecha.isEmpty() && fecha.compareTo(hoy) < 0) detalle = "atrasada";
            Lista.fila(c, v, i, t.optString("titulo"), detalle, ok ? Lista.LLENO : Lista.VACIO, ok,
                Estado.abrir(c, "/tareas"), Estado.accion(c, "tarea", t.optString("id"), widgetId));
        }
        if (ts.size() > n) Lista.pie(v, "+" + (ts.size() - n) + " más en Stoica");
        manager.updateAppWidget(widgetId, v);
    }
}
