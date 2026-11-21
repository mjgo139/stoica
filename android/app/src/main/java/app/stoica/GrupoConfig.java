package app.stoica;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;

/** Elegir el grupo del widget de comunidad. */
public class GrupoConfig extends ElegirWidget {

    @Override
    protected String titulo() {
        return "¿Qué grupo querés en el widget?";
    }

    @Override
    protected String sinOpciones() {
        return "Abrí la pestaña Comunidad en StoaHabit primero para elegir el grupo acá.";
    }

    @Override
    protected void cargar() {
        JSONObject d = Estado.datos(this);
        JSONArray gs = Estado.conDatos(d) ? d.optJSONArray("grupos") : null;
        if (gs == null) return;
        for (int i = 0; i < gs.length(); i++) {
            JSONObject g = gs.optJSONObject(i);
            if (g == null) continue;
            ids.add(g.optString("id"));
            nombres.add(g.optString("nombre"));
        }
    }

    @Override
    protected void alElegir(String id) {
        GrupoWidget.dibujar(this, AppWidgetManager.getInstance(this), widgetId);
        final Context c = getApplicationContext();
        new Thread(() -> GrupoWidget.actualizarDesdeNube(c, id, false)).start();
    }
}
