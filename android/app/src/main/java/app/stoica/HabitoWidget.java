package app.stoica;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONObject;

/** Widget de un solo hábito: cómo vas hoy, la racha y el rombo para marcar (o +1). */
public class HabitoWidget extends AppWidgetProvider {

    static final int[] FILAS = { R.id.h_f0, R.id.h_f1, R.id.h_f2, R.id.h_f3, R.id.h_f4 };
    static final int[][] CAJAS = {
        { R.id.h_b0_0, R.id.h_b0_1, R.id.h_b0_2, R.id.h_b0_3, R.id.h_b0_4, R.id.h_b0_5, R.id.h_b0_6 },
        { R.id.h_b1_0, R.id.h_b1_1, R.id.h_b1_2, R.id.h_b1_3, R.id.h_b1_4, R.id.h_b1_5, R.id.h_b1_6 },
        { R.id.h_b2_0, R.id.h_b2_1, R.id.h_b2_2, R.id.h_b2_3, R.id.h_b2_4, R.id.h_b2_5, R.id.h_b2_6 },
        { R.id.h_b3_0, R.id.h_b3_1, R.id.h_b3_2, R.id.h_b3_3, R.id.h_b3_4, R.id.h_b3_5, R.id.h_b3_6 },
        { R.id.h_b4_0, R.id.h_b4_1, R.id.h_b4_2, R.id.h_b4_3, R.id.h_b4_4, R.id.h_b4_5, R.id.h_b4_6 },
    };
    static final int[] LB = { R.id.h_lb0, R.id.h_lb1, R.id.h_lb2, R.id.h_lb3, R.id.h_lb4, R.id.h_lb5, R.id.h_lb6 };

    @Override
    public void onUpdate(Context contexto, AppWidgetManager manager, int[] ids) {
        for (int id : ids) dibujar(contexto, manager, id);
    }

    @Override
    public void onDeleted(Context contexto, int[] ids) {
        Estado.olvidar(contexto, ids);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context contexto, AppWidgetManager manager, int id, android.os.Bundle nuevas) {
        dibujar(contexto, manager, id); // agrandado o achicado: más o menos semanas
    }

    /** Pinta `filas` semanas (la de abajo es la actual). */
    private static void pintarSemanas(Context c, RemoteViews v, JSONObject d, JSONObject h, String hoy, int filas) {
        String hist = Estado.historia(d, h, hoy, 35);
        int verde = c.getColor(R.color.widget_ok);
        int rojo = c.getColor(R.color.widget_miss);
        for (int r = 0; r < FILAS.length; r++) {
            int fila = r - (FILAS.length - filas); // 0 = la más vieja visible
            v.setViewVisibility(FILAS[r], fila >= 0 ? View.VISIBLE : View.GONE);
            if (fila < 0) continue;
            for (int i = 0; i < 7; i++) {
                int atras = 7 * (filas - 1 - fila) + (6 - i); // días antes de hoy
                char e = atras < hist.length() ? hist.charAt(hist.length() - 1 - atras) : '?';
                int caja = e == 'o' ? R.drawable.dia_ok : e == 'x' ? R.drawable.dia_mal : e == 'i' ? R.drawable.dia_inactivo : atras == 0 ? R.drawable.dia_hoy : R.drawable.dia_vacio;
                v.setInt(CAJAS[r][i], "setBackgroundResource", caja);
                v.setTextViewText(CAJAS[r][i], e == 'o' ? "✓" : e == 'x' ? "×" : "");
                v.setTextColor(CAJAS[r][i], e == 'x' ? rojo : verde);
                v.setTextViewTextSize(CAJAS[r][i], TypedValue.COMPLEX_UNIT_SP, filas >= 3 ? 13 : 10);
            }
        }
        for (int i = 0; i < 7; i++) {
            int ds = Estado.diaSemana(Estado.sumarDias(hoy, i - 6));
            v.setTextViewText(LB[i], ds >= 0 ? Estado.LETRAS[ds] : "");
        }
    }

    static void dibujar(Context c, AppWidgetManager manager, int widgetId) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_habito);
        JSONObject d = Estado.datos(c);
        String hid = Estado.eleccion(c, widgetId);
        JSONObject h = Estado.conDatos(d) ? Estado.habito(d, hid) : null;
        v.setTextColor(R.id.h_marca, c.getColor(R.color.widget_dorado));
        if (h == null) {
            v.setTextViewText(R.id.h_virtud, "STOAHABIT");
            v.setTextViewText(R.id.h_nombre, !Estado.conDatos(d) ? "Entrá a StoaHabit" : hid == null ? "Elegí un hábito" : "Ese hábito ya no está");
            v.setTextViewText(R.id.h_detalle, hid == null ? "Mantené apretado para elegir" : "Mantené apretado para cambiarlo");
            v.setTextViewText(R.id.h_racha, "");
            v.setTextViewText(R.id.h_marca, Lista.VACIO);
            v.setViewVisibility(R.id.h_semana, View.INVISIBLE);
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
        // Según el alto: cuántas semanas entran y letras más grandes.
        android.os.Bundle o = manager.getAppWidgetOptions(widgetId);
        int alto = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        int filas = alto <= 0 ? 1 : Math.max(1, Math.min(5, (alto - 150) / 34));
        pintarSemanas(c, v, d, h, hoy, filas);
        boolean grande = alto >= 260;
        v.setTextViewTextSize(R.id.h_nombre, TypedValue.COMPLEX_UNIT_SP, grande ? 21 : 16);
        v.setTextViewTextSize(R.id.h_detalle, TypedValue.COMPLEX_UNIT_SP, grande ? 15 : 13);
        v.setTextViewTextSize(R.id.h_racha, TypedValue.COMPLEX_UNIT_SP, grande ? 12 : 11);
        v.setTextViewText(R.id.h_virtud, h.optString("virtud", "StoaHabit"));
        v.setTextViewText(R.id.h_nombre, h.optString("nombre"));
        v.setTextViewText(R.id.h_detalle, detalle);
        String textoRacha = racha < 0 ? "" : racha == 1 ? "Racha: 1 día" : "Racha: " + racha + " días";
        if (grande) textoRacha += (textoRacha.isEmpty() ? "" : " · ") + "30 días: " + Estado.porcentaje30(d, h, hoy) + "%";
        v.setTextViewText(R.id.h_racha, textoRacha);
        boolean marcable = Estado.marcable(h);
        String marca = ok ? Lista.LLENO : marcable ? (cantidad ? "+1" : Lista.VACIO) : "›";
        v.setTextViewText(R.id.h_marca, marca);
        v.setTextViewTextSize(R.id.h_marca, TypedValue.COMPLEX_UNIT_SP, "+1".equals(marca) ? 18 : 26);
        if (ok) v.setTextColor(R.id.h_marca, c.getColor(R.color.widget_verde));
        v.setOnClickPendingIntent(R.id.widget_raiz, Estado.abrir(c, "/habitos/" + hid));
        v.setOnClickPendingIntent(R.id.h_marca, marcable ? Estado.accion(c, "habito", hid, widgetId) : Estado.abrir(c, "/habitos/" + hid));
        manager.updateAppWidget(widgetId, v);
    }
}
