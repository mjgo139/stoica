package app.stoica;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.res.Resources;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Rect;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Widget del Jardín estoico: las plantas de tus primeros hábitos en sus macetas, como están en el jardín
 * (con la medalla de laurel si están al 100 % y un punto si hoy necesitan que cumplas). Tocarlo abre el jardín.
 */
public class JardinWidget extends AppWidgetProvider {

    // Más píxeles por maceta (v2.8.0): las plantas nuevas vienen al doble de resolución
    private static final int ANCHO = 300;
    private static final int ALTO = 334;

    @Override
    public void onUpdate(Context contexto, AppWidgetManager manager, int[] ids) {
        for (int id : ids) dibujar(contexto, manager, id);
    }

    static void dibujar(Context c, AppWidgetManager manager, int widgetId) {
        dibujar(c, manager, widgetId, R.layout.widget_jardin, 0, 5, false);
    }

    /**
     * columnas = 0: todas en una fila (widget ancho); 2: grilla de 2 columnas (widget chico de 2×2).
     * corto = resumen breve para el widget chico.
     */
    static void dibujar(Context c, AppWidgetManager manager, int widgetId, int layout, int columnas, int maximo, boolean corto) {
        RemoteViews v = new RemoteViews(c.getPackageName(), layout);
        v.setOnClickPendingIntent(R.id.widget_raiz, Estado.abrir(c, "/jardin"));
        JSONObject d = Estado.datos(c);
        JSONArray plantas = Estado.conDatos(d) ? d.optJSONArray("jardin") : null;
        if (plantas == null || plantas.length() == 0) {
            v.setViewVisibility(R.id.j_plantas, View.GONE);
            v.setTextViewText(R.id.j_resumen, plantas == null ? (corto ? "Abrí StoaHabit" : "Abrí StoaHabit para ver tu jardín.") : (corto ? "Creá un hábito" : "Creá un hábito y aparece su semilla en tu jardín."));
            v.setTextViewText(R.id.j_nombres, "");
            manager.updateAppWidget(widgetId, v);
            return;
        }
        if (plantas.length() > maximo) {
            JSONArray menos = new JSONArray();
            for (int i = 0; i < maximo; i++) menos.put(plantas.opt(i));
            plantas = menos;
        }
        int flor = 0;
        int peligro = 0;
        StringBuilder nombres = new StringBuilder();
        for (int i = 0; i < plantas.length(); i++) {
            JSONObject p = plantas.optJSONObject(i);
            if (p == null) continue;
            if (p.optBoolean("cien")) flor++;
            if (p.optBoolean("peligro")) peligro++;
            if (nombres.length() > 0) nombres.append(" · ");
            nombres.append(p.optString("nombre"));
        }
        v.setViewVisibility(R.id.j_plantas, View.VISIBLE);
        v.setImageViewBitmap(R.id.j_plantas, componer(c, plantas, columnas));
        String resumen;
        if (corto) {
            resumen = peligro > 0 ? peligro + (peligro == 1 ? " te necesita hoy" : " te necesitan hoy") : flor > 0 ? flor + " al 100 % · en orden" : "Todo en orden";
        } else {
            resumen = plantas.length() + (plantas.length() == 1 ? " planta" : " plantas");
            if (flor > 0) resumen += " · " + flor + " al 100 %";
            resumen += peligro > 0 ? " · " + peligro + (peligro == 1 ? " necesita" : " necesitan") + " que cumplas hoy" : " · todo en orden";
        }
        v.setTextViewText(R.id.j_resumen, resumen);
        v.setTextViewText(R.id.j_nombres, nombres.toString());
        manager.updateAppWidget(widgetId, v);
    }

    private static Bitmap recurso(Context c, String nombre) {
        Resources r = c.getResources();
        int id = r.getIdentifier(nombre, "drawable", c.getPackageName());
        return id == 0 ? null : BitmapFactory.decodeResource(r, id);
    }

    /** Macetas con su planta encima: en una fila (columnas = 0) o en grilla. */
    private static Bitmap componer(Context c, JSONArray plantas, int columnas) {
        int n = plantas.length();
        int cols = columnas <= 0 ? n : Math.min(columnas, n);
        int filas = (n + cols - 1) / cols;
        Bitmap b = Bitmap.createBitmap(ANCHO * cols, ALTO * filas, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(b);
        Paint suave = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
        Bitmap maceta = recurso(c, "jardin_maceta");
        Paint oro = new Paint(Paint.ANTI_ALIAS_FLAG);
        oro.setColor(c.getColor(R.color.widget_dorado));
        Paint aviso = new Paint(Paint.ANTI_ALIAS_FLAG);
        aviso.setColor(0xFFB5473A);
        Paint borde = new Paint(Paint.ANTI_ALIAS_FLAG);
        borde.setStyle(Paint.Style.STROKE);
        borde.setStrokeWidth(6);
        borde.setColor(0xFFFFFFFF);
        for (int i = 0; i < n; i++) {
            JSONObject p = plantas.optJSONObject(i);
            if (p == null) continue;
            int fila = i / cols;
            int col = i % cols;
            // La última fila incompleta queda centrada
            int enFila = Math.min(cols, n - fila * cols);
            int x0 = col * ANCHO + (cols - enFila) * ANCHO / 2;
            int y0 = fila * ALTO;
            int mw = (int) (ANCHO * 0.78f);
            int mh = maceta == null ? mw * 320 / 416 : mw * maceta.getHeight() / maceta.getWidth();
            int mx = x0 + (ANCHO - mw) / 2;
            int my = y0 + ALTO - mh;
            if (maceta != null) cv.drawBitmap(maceta, null, new Rect(mx, my, mx + mw, my + mh), suave);
            Bitmap planta = recurso(c, "planta_" + p.optString("especie") + "_" + p.optInt("etapa"));
            if (planta != null) {
                int pw = (int) (mw * 0.95f);
                int ph = pw * planta.getHeight() / planta.getWidth();
                int maxAlto = (int) (ALTO - mh * 0.55f);
                if (ph > maxAlto) {
                    ph = maxAlto;
                    pw = ph * planta.getWidth() / planta.getHeight();
                }
                int base = (int) (my + mh * 0.40f);
                int px = mx + (mw - pw) / 2;
                cv.drawBitmap(planta, null, new Rect(px, base - ph, px + pw, base), suave);
            }
            // Medalla de laurel (100 %) y punto rojo (hoy hay que cumplir)
            if (p.optBoolean("cien")) {
                float cx = mx + mw * 0.86f;
                float cy = my + mh * 0.78f;
                cv.drawCircle(cx, cy, 26, oro);
                cv.drawCircle(cx, cy, 26, borde);
            }
            if (p.optBoolean("peligro")) {
                float cx = mx + mw * 0.12f;
                float cy = my + mh * 0.22f;
                cv.drawCircle(cx, cy, 21, aviso);
                cv.drawCircle(cx, cy, 21, borde);
            }
        }
        return b;
    }
}
