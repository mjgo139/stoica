package app.stoica;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONObject;

/** Widget "Hoy": cuántos hábitos llevás y cuáles faltan. Tocarlo abre la app. */
public class HoyWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context contexto, AppWidgetManager manager, int[] ids) {
        for (int id : ids) dibujar(contexto, manager, id);
    }

    static void refrescarTodos(Context contexto) {
        Estado.refrescarTodos(contexto);
    }

    static void dibujar(Context contexto, AppWidgetManager manager, int id) {
        RemoteViews v = new RemoteViews(contexto.getPackageName(), R.layout.widget_hoy);
        String numero = "—";
        String detalle = "";
        String texto = "Abrí Stoica para ver tu día.";
        String frase = "Victoria sobre ti mismo.";
        int avance = 0;
        try {
            JSONObject d = Estado.datos(contexto);
            if (!d.optString("frase", "").isEmpty()) frase = d.optString("frase");
            if (d.optBoolean("sinSesion")) {
                texto = "Entrá a Stoica para ver tus hábitos.";
            } else if (Estado.conDatos(d)) {
                // El celular calcula el día solo (también pasada la medianoche).
                String hoy = Estado.hoy(d);
                List<JSONObject> deHoy = Estado.habitosDeHoy(d, hoy);
                List<String> faltan = new ArrayList<>();
                for (JSONObject h : deHoy) if (!Estado.cumplido(h, Estado.marca(d, h.optString("id"), hoy))) faltan.add(h.optString("nombre"));
                int total = deHoy.size();
                int hecho = total - faltan.size();
                if (total > 0) {
                    numero = hecho + "/" + total;
                    detalle = total == 1 ? "hábito" : "hábitos";
                    avance = Math.round(hecho * 100f / total);
                    if (faltan.isEmpty()) texto = "¡Día cumplido!";
                    else {
                        StringBuilder sb = new StringBuilder("Falta: ");
                        for (int i = 0; i < Math.min(4, faltan.size()); i++) {
                            if (i > 0) sb.append(" · ");
                            sb.append(faltan.get(i));
                        }
                        if (faltan.size() > 4) sb.append(" y ").append(faltan.size() - 4).append(" más");
                        texto = sb.toString();
                    }
                } else {
                    numero = "0";
                    detalle = "hábitos hoy";
                    texto = "Hoy no tenés hábitos programados.";
                }
            }
        } catch (Exception e) {
            // Si el dato guardado no se entiende, queda la invitación a abrir la app.
        }
        v.setTextViewText(R.id.w_numero, numero);
        v.setTextViewText(R.id.w_detalle, detalle);
        v.setTextViewText(R.id.w_texto, texto);
        v.setTextViewText(R.id.w_frase, frase);
        v.setProgressBar(R.id.w_barra, 100, avance, false);

        v.setOnClickPendingIntent(R.id.widget_raiz, Estado.abrir(contexto, "/"));
        manager.updateAppWidget(id, v);
    }
}
