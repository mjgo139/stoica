package app.stoica;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/** Widget "Hoy": cuántos hábitos llevás y cuáles faltan. Tocarlo abre la app. */
public class HoyWidget extends AppWidgetProvider {

    static final String PREFS = "widget_stoica";

    @Override
    public void onUpdate(Context contexto, AppWidgetManager manager, int[] ids) {
        for (int id : ids) dibujar(contexto, manager, id);
    }

    static void refrescarTodos(Context contexto) {
        AppWidgetManager manager = AppWidgetManager.getInstance(contexto);
        int[] ids = manager.getAppWidgetIds(new ComponentName(contexto, HoyWidget.class));
        for (int id : ids) dibujar(contexto, manager, id);
    }

    static void dibujar(Context contexto, AppWidgetManager manager, int id) {
        RemoteViews v = new RemoteViews(contexto.getPackageName(), R.layout.widget_hoy);
        String hoy = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        String numero = "—";
        String detalle = "";
        String texto = "Abrí Stoica para ver tu día.";
        int avance = 0;
        try {
            String crudo = contexto.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("hoy", null);
            if (crudo != null) {
                JSONObject d = new JSONObject(crudo);
                if (d.optBoolean("sinSesion")) {
                    texto = "Entrá a Stoica para ver tus hábitos.";
                } else if (hoy.equals(d.optString("fecha"))) {
                    int hecho = d.optInt("hecho");
                    int total = d.optInt("total");
                    if (total > 0) {
                        numero = hecho + "/" + total;
                        detalle = total == 1 ? "hábito" : "hábitos";
                        avance = Math.round(hecho * 100f / total);
                        JSONArray faltan = d.optJSONArray("pendientes");
                        if (hecho >= total) {
                            texto = "¡Día cumplido! " + d.optString("frase", "");
                        } else if (faltan != null && faltan.length() > 0) {
                            StringBuilder sb = new StringBuilder("Falta: ");
                            for (int i = 0; i < faltan.length(); i++) {
                                if (i > 0) sb.append(" · ");
                                sb.append(faltan.optString(i));
                            }
                            texto = sb.toString();
                        } else {
                            texto = "";
                        }
                    } else {
                        numero = "0";
                        detalle = "hábitos hoy";
                        texto = "Hoy no tenés hábitos programados.";
                    }
                }
            }
        } catch (Exception e) {
            // Si el dato guardado no se entiende, queda la invitación a abrir la app.
        }
        v.setTextViewText(R.id.w_numero, numero);
        v.setTextViewText(R.id.w_detalle, detalle);
        v.setTextViewText(R.id.w_texto, texto);
        v.setProgressBar(R.id.w_barra, 100, avance, false);

        Intent abrir = new Intent(contexto, MainActivity.class);
        abrir.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent alTocar = PendingIntent.getActivity(contexto, 0, abrir, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.widget_raiz, alTocar);
        manager.updateAppWidget(id, v);
    }
}
