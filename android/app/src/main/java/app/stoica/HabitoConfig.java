package app.stoica;

import android.appwidget.AppWidgetManager;
import org.json.JSONArray;
import org.json.JSONObject;

/** Elegir el hábito del widget de un hábito. */
public class HabitoConfig extends ElegirWidget {

    @Override
    protected String titulo() {
        return "¿Qué hábito querés en el widget?";
    }

    @Override
    protected String sinOpciones() {
        return "Abrí Stoica primero (y creá un hábito) para elegirlo acá.";
    }

    @Override
    protected void cargar() {
        JSONObject d = Estado.datos(this);
        JSONArray hs = Estado.conDatos(d) ? d.optJSONArray("habitos") : null;
        if (hs == null) return;
        for (int i = 0; i < hs.length(); i++) {
            JSONObject h = hs.optJSONObject(i);
            if (h == null) continue;
            ids.add(h.optString("id"));
            nombres.add(h.optString("nombre"));
        }
    }

    @Override
    protected void alElegir(String id) {
        HabitoWidget.dibujar(this, AppWidgetManager.getInstance(this), widgetId);
    }
}
