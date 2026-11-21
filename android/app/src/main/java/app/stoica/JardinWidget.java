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

    private static final int ANCHO = 180;
    private static final int ALTO = 200;

    @Override
    public void onUpdate(Context contexto, AppWidgetManager manager, int[] ids) {
        for (int id : ids) dibujar(contexto, manager, id);
    }

    static void dibujar(Context c, AppWidgetManager manager, int widgetId) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_jardin);
        v.setOnClickPendingIntent(R.id.widget_raiz, Estado.abrir(c, "/jardin"));
        JSONObject d = Estado.datos(c);
        JSONArray plantas = Estado.conDatos(d) ? d.optJSONArray("jardin") : null;
        if (plantas == null || plantas.length() == 0) {
            v.setViewVisibility(R.id.j_plantas, View.GONE);
            v.setTextViewText(R.id.j_resumen, plantas == null ? "Abrí StoaHabit para ver tu jardín." : "Creá un hábito y aparece su semilla en tu jardín.");
            v.setTextViewText(R.id.j_nombres, "");
            manager.updateAppWidget(widgetId, v);
            return;
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
        v.setImageViewBitmap(R.id.j_plantas, componer(c, plantas));
        String resumen = plantas.length() + (plantas.length() == 1 ? " planta" : " plantas");
        if (flor > 0) resumen += " · " + flor + " al 100 %";
        resumen += peligro > 0 ? " · " + peligro + (peligro == 1 ? " necesita" : " necesitan") + " que cumplas hoy" : " · todo en orden";
        v.setTextViewText(R.id.j_resumen, resumen);
        v.setTextViewText(R.id.j_nombres, nombres.toString());
        manager.updateAppWidget(widgetId, v);
    }

    private static Bitmap recurso(Context c, String nombre) {
        Resources r = c.getResources();
        int id = r.getIdentifier(nombre, "drawable", c.getPackageName());
        return id == 0 ? null : BitmapFactory.decodeResource(r, id);
    }

    /** Una fila de macetas con su planta encima. */
    private static Bitmap componer(Context c, JSONArray plantas) {
        int n = plantas.length();
        Bitmap b = Bitmap.createBitmap(ANCHO * n, ALTO, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(b);
        Paint suave = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
        Bitmap maceta = recurso(c, "jardin_maceta");
        Paint oro = new Paint(Paint.ANTI_ALIAS_FLAG);
        oro.setColor(c.getColor(R.color.widget_dorado));
        Paint aviso = new Paint(Paint.ANTI_ALIAS_FLAG);
        aviso.setColor(0xFFB5473A);
        Paint borde = new Paint(Paint.ANTI_ALIAS_FLAG);
        borde.setStyle(Paint.Style.STROKE);
        borde.setStrokeWidth(4);
        borde.setColor(0xFFFFFFFF);
        for (int i = 0; i < n; i++) {
            JSONObject p = plantas.optJSONObject(i);
            if (p == null) continue;
            int x0 = i * ANCHO;
            int mw = (int) (ANCHO * 0.78f);
            int mh = maceta == null ? mw * 320 / 416 : mw * maceta.getHeight() / maceta.getWidth();
            int mx = x0 + (ANCHO - mw) / 2;
            int my = ALTO - mh;
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
                cv.drawCircle(cx, cy, 16, oro);
                cv.drawCircle(cx, cy, 16, borde);
            }
            if (p.optBoolean("peligro")) {
                float cx = mx + mw * 0.12f;
                float cy = my + mh * 0.22f;
                cv.drawCircle(cx, cy, 13, aviso);
                cv.drawCircle(cx, cy, 13, borde);
            }
        }
        return b;
    }
}
