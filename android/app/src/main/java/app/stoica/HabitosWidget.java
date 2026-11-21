package app.stoica;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONObject;

/** Widget "Hábitos de hoy": la lista del día con el rombo para marcar sin abrir la app. */
public class HabitosWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context contexto, AppWidgetManager manager, int[] ids) {
        for (int id : ids) dibujar(contexto, manager, id);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context contexto, AppWidgetManager manager, int id, android.os.Bundle nuevas) {
        dibujar(contexto, manager, id); // cambió de tamaño: entran más o menos filas
    }

    static void dibujar(Context c, AppWidgetManager manager, int widgetId) {
        RemoteViews v = Lista.nueva(c, "HÁBITOS · HOY");
        v.setOnClickPendingIntent(R.id.w_cabeza, Estado.abrir(c, "/"));
        v.setOnClickPendingIntent(R.id.widget_raiz, Estado.abrir(c, "/"));
        JSONObject d = Estado.datos(c);
        if (!Estado.conDatos(d)) {
            Lista.vacio(v, d.optBoolean("sinSesion") ? "Entrá a StoaHabit para ver tus hábitos." : "Abrí StoaHabit para ver tu día.");
            manager.updateAppWidget(widgetId, v);
            return;
        }
        String hoy = Estado.hoy(d);
        List<JSONObject> deHoy = Estado.habitosDeHoy(d, hoy);
        List<JSONObject> faltan = new ArrayList<>();
        List<JSONObject> listos = new ArrayList<>();
        for (JSONObject h : deHoy) (Estado.cumplido(h, Estado.marca(d, h.optString("id"), hoy)) ? listos : faltan).add(h);
        if (deHoy.isEmpty()) {
            Lista.vacio(v, "Hoy no tenés hábitos programados.");
            manager.updateAppWidget(widgetId, v);
            return;
        }
        v.setTextViewText(R.id.w_cuenta, listos.size() + "/" + deHoy.size());
        Lista.barra(v, listos.size(), deHoy.size());
        List<JSONObject> orden = new ArrayList<>(faltan);
        orden.addAll(listos);
        int cap = Lista.capacidad(manager, widgetId);
        Lista.reservar(v, cap);
        int n = Math.min(cap, orden.size());
        for (int i = 0; i < n; i++) {
            JSONObject h = orden.get(i);
            String id = h.optString("id");
            JSONObject m = Estado.marca(d, id, hoy);
            boolean ok = Estado.cumplido(h, m);
            boolean cantidad = "cantidad".equals(h.optString("tipo"));
            String marca = ok ? Lista.LLENO : Estado.marcable(h) ? (cantidad ? "+1" : Lista.VACIO) : "›";
            boolean marcable = Estado.marcable(h);
            Lista.fila(c, v, i, h.optString("nombre"), Estado.detalleCantidad(h, m), marca, ok,
                Estado.abrir(c, "/habitos/" + id),
                marcable ? Estado.accion(c, "habito", id, widgetId) : Estado.abrir(c, "/habitos/" + id));
        }
        if (orden.size() > n) Lista.pie(v, "+" + (orden.size() - n) + " más en StoaHabit");
        else if (faltan.isEmpty()) Lista.pie(v, "¡Día cumplido! " + d.optString("frase", ""));
        manager.updateAppWidget(widgetId, v);
    }
}
