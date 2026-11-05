package app.stoica;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;
import org.json.JSONObject;

/** Widget de un solo hábito: cómo vas hoy, la racha y el rombo para marcar (o +1). */
public class HabitoWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context contexto, AppWidgetManager manager, int[] ids) {
        for (int id : ids) dibujar(contexto, manager, id);
    }

    @Override
    public void onDeleted(Context contexto, int[] ids) {
        Estado.olvidar(contexto, ids);
    }

    static void dibujar(Context c, AppWidgetManager manager, int widgetId) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_habito);
        JSONObject d = Estado.datos(c);
        String hid = Estado.eleccion(c, widgetId);
        JSONObject h = Estado.conDatos(d) ? Estado.habito(d, hid) : null;
        v.setTextColor(R.id.h_marca, c.getColor(R.color.widget_dorado));
        if (h == null) {
            v.setTextViewText(R.id.h_virtud, "STOICA");
            v.setTextViewText(R.id.h_nombre, !Estado.conDatos(d) ? "Entrá a Stoica" : hid == null ? "Elegí un hábito" : "Ese hábito ya no está");
            v.setTextViewText(R.id.h_detalle, hid == null ? "Mantené apretado para elegir" : "Mantené apretado para cambiarlo");
            v.setTextViewText(R.id.h_racha, "");
            v.setTextViewText(R.id.h_marca, Lista.VACIO);
            v.setOnClickPendingIntent(R.id.widget_raiz, Estado.abrir(c, "/habitos"));
            v.setOnClickPendingIntent(R.id.h_marca, Estado.abrir(c, "/habitos"));
            manager.updateAppWidget(widgetId, v);
            return;
        }
        String hoy = Estado.hoy(d);
        JSONObject m = Estado.marca(d, hid, hoy);
        boolean activo = Estado.diaActivo(h, hoy);
        boolean ok = Estado.cumplido(h, m);
        boolean cantidad = "cantidad".equals(h.optString("tipo"));
        String cuanto = Estado.detalleCantidad(h, m);
        String detalle;
        if (!activo) detalle = ok ? "Cumplido (hoy libre)" : "Hoy no toca";
        else if (!cuanto.isEmpty()) detalle = (ok ? "Cumplido · " : "Hoy ") + cuanto;
        else detalle = ok ? "Cumplido hoy" : "Falta hoy";
        int racha = Estado.racha(d, h, hoy);
        v.setTextViewText(R.id.h_virtud, h.optString("virtud", "Stoica"));
        v.setTextViewText(R.id.h_nombre, h.optString("nombre"));
        v.setTextViewText(R.id.h_detalle, detalle);
        v.setTextViewText(R.id.h_racha, racha < 0 ? "" : racha == 1 ? "Racha: 1 día" : "Racha: " + racha + " días");
        boolean marcable = Estado.marcable(h);
        String marca = ok ? Lista.LLENO : marcable ? (cantidad ? "+1" : Lista.VACIO) : "›";
        v.setTextViewText(R.id.h_marca, marca);
        v.setTextViewTextSize(R.id.h_marca, android.util.TypedValue.COMPLEX_UNIT_SP, "+1".equals(marca) ? 18 : 26);
        if (ok) v.setTextColor(R.id.h_marca, c.getColor(R.color.widget_verde));
        v.setOnClickPendingIntent(R.id.widget_raiz, Estado.abrir(c, "/habitos/" + hid));
        v.setOnClickPendingIntent(R.id.h_marca, marcable ? Estado.accion(c, "habito", hid, widgetId) : Estado.abrir(c, "/habitos/" + hid));
        manager.updateAppWidget(widgetId, v);
    }
}
