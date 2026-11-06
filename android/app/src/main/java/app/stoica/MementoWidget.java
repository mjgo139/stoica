package app.stoica;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.view.View;
import android.widget.RemoteViews;
import java.text.NumberFormat;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Widget Memento mori: días que probablemente quedan, cuánto de la vida probable ya pasó y tus años
 * como puntos (dorados los vividos). Se calcula en el celular cada día, con tu fecha de nacimiento.
 */
public class MementoWidget extends AppWidgetProvider {

    private static final String[] FRASES = {
        "“No vivas como si fueras a vivir diez mil años.” — Marco Aurelio",
        "“Mientras aplazamos, la vida pasa.” — Séneca",
        "“Pensá en la muerte cada día y no desearás nada con exceso.” — Epicteto",
        "“No es que tengamos poco tiempo, es que perdemos mucho.” — Séneca",
        "“Hacé cada cosa como si fuera la última de tu vida.” — Marco Aurelio",
    };

    @Override
    public void onUpdate(Context contexto, AppWidgetManager manager, int[] ids) {
        for (int id : ids) dibujar(contexto, manager, id);
    }

    private static String mil(long n) {
        return NumberFormat.getIntegerInstance(new Locale("es", "PY")).format(n);
    }

    static void dibujar(Context c, AppWidgetManager manager, int widgetId) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_memento);
        v.setOnClickPendingIntent(R.id.widget_raiz, Estado.abrir(c, "/memento"));
        JSONObject d = Estado.datos(c);
        JSONObject mm = Estado.conDatos(d) ? d.optJSONObject("memento") : null;
        String hoy = Estado.hoy(d);
        int anioHoy = Integer.parseInt(hoy.substring(0, 4));
        long faltaAnio = Estado.diferencia(hoy, (anioHoy + 1) + "-01-01");
        int dia = (int) (Estado.diferencia("2020-01-01", hoy) % FRASES.length);
        v.setTextViewText(R.id.m_frase, FRASES[Math.max(0, dia)]);
        String nacimiento = mm == null || mm.isNull("nacimiento") ? "" : mm.optString("nacimiento", "");

        if (nacimiento.length() != 10) {
            // Sin fecha de nacimiento: lo que falta para el año nuevo.
            v.setTextViewText(R.id.m_numero, mil(faltaAnio));
            v.setTextViewText(R.id.m_unidad, (faltaAnio == 1 ? "día falta" : "días faltan") + " para " + (anioHoy + 1));
            int pasado = Math.round(1000f * (365 - faltaAnio) / 365);
            v.setProgressBar(R.id.m_barra, 1000, Math.max(0, Math.min(1000, pasado)), false);
            v.setTextViewText(R.id.m_pct, mm == null ? "Abrí Stoica para ver tu memento mori." : "Agregá tu fecha de nacimiento en Memento mori.");
            v.setViewVisibility(R.id.m_anios, View.GONE);
            v.setTextViewText(R.id.m_extra, "");
            manager.updateAppWidget(widgetId, v);
            return;
        }

        int esperanza = mm.optInt("esperanza", 73);
        String fin = Estado.sumarAnios(nacimiento, esperanza);
        long vividos = Math.max(0, Estado.diferencia(nacimiento, hoy));
        long quedan = Math.max(0, Estado.diferencia(hoy, fin));
        long total = Math.max(1, Estado.diferencia(nacimiento, fin));
        float porcentaje = Math.min(100f, Math.round(vividos * 1000f / total) / 10f);
        int anios = Estado.aniosCumplidos(nacimiento, hoy);

        v.setTextViewText(R.id.m_numero, mil(quedan));
        v.setTextViewText(R.id.m_unidad, (quedan == 1 ? "día te queda" : "días te quedan") + " probablemente (hasta los " + esperanza + ")");
        v.setProgressBar(R.id.m_barra, 1000, Math.round(porcentaje * 10), false);
        v.setTextViewText(R.id.m_pct, String.format(new Locale("es", "PY"), "%.1f%% de tu vida probable ya pasó", porcentaje));
        v.setViewVisibility(R.id.m_anios, View.VISIBLE);
        v.setImageViewBitmap(R.id.m_anios, puntos(c, esperanza, anios));

        // Abajo: tu edad en semanas y lo próximo que esperás (año nuevo o uno de tus contadores).
        String extra = anios + (anios == 1 ? " año" : " años") + " · " + mil(vividos / 7) + " semanas vividas";
        String proximo = (anioHoy + 1) + " en " + mil(faltaAnio) + (faltaAnio == 1 ? " día" : " días");
        long mejor = faltaAnio;
        JSONArray cs = mm.optJSONArray("contadores");
        if (cs != null) {
            for (int i = 0; i < cs.length(); i++) {
                JSONObject ct = cs.optJSONObject(i);
                if (ct == null) continue;
                long dd = Estado.diferencia(hoy, ct.optString("fecha"));
                if (dd >= 0 && dd < mejor) {
                    mejor = dd;
                    proximo = ct.optString("nombre") + (dd == 0 ? ": ¡hoy!" : " en " + mil(dd) + (dd == 1 ? " día" : " días"));
                }
            }
        }
        v.setTextViewText(R.id.m_extra, extra + " · " + proximo);
        manager.updateAppWidget(widgetId, v);
    }

    /** Un punto por año de vida probable: dorados los vividos, el actual a medias, los que faltan en contorno. */
    private static Bitmap puntos(Context c, int esperanza, int vividos) {
        float dens = c.getResources().getDisplayMetrics().density;
        int porFila = esperanza > 80 ? 30 : 25;
        int filas = (esperanza + porFila - 1) / porFila;
        float celda = 9 * dens;
        float lado = 6.5f * dens;
        int ancho = Math.round(porFila * celda);
        int alto = Math.round(filas * celda);
        Bitmap b = Bitmap.createBitmap(ancho, alto, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(b);
        Paint lleno = new Paint(Paint.ANTI_ALIAS_FLAG);
        lleno.setColor(c.getColor(R.color.widget_dorado));
        Paint borde = new Paint(Paint.ANTI_ALIAS_FLAG);
        borde.setStyle(Paint.Style.STROKE);
        borde.setStrokeWidth(1.2f * dens);
        borde.setColor(c.getColor(R.color.widget_ln3));
        Paint actual = new Paint(borde);
        actual.setColor(c.getColor(R.color.widget_dorado));
        float radio = 1.6f * dens;
        for (int i = 0; i < esperanza; i++) {
            float x = (i % porFila) * celda + (celda - lado) / 2;
            float y = (i / porFila) * celda + (celda - lado) / 2;
            RectF r = new RectF(x, y, x + lado, y + lado);
            if (i < vividos) cv.drawRoundRect(r, radio, radio, lleno);
            else if (i == vividos) {
                cv.drawRoundRect(r, radio, radio, actual);
                cv.drawRoundRect(new RectF(x, y + lado / 2, x + lado, y + lado), radio, radio, lleno);
            } else {
                RectF ri = new RectF(x + dens * 0.6f, y + dens * 0.6f, x + lado - dens * 0.6f, y + lado - dens * 0.6f);
                cv.drawRoundRect(ri, radio, radio, borde);
            }
        }
        return b;
    }
}
