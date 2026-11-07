package app.stoica;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.view.View;
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

    static final int[] LINEAS = { R.id.w_l0, R.id.w_l1, R.id.w_l2, R.id.w_l3, R.id.w_l4, R.id.w_l5 };

    @Override
    public void onAppWidgetOptionsChanged(Context contexto, AppWidgetManager manager, int id, android.os.Bundle nuevas) {
        dibujar(contexto, manager, id);
    }

    static void dibujar(Context c, AppWidgetManager manager, int id) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_hoy);
        v.setOnClickPendingIntent(R.id.widget_raiz, Estado.abrir(c, "/"));
        for (int l : LINEAS) v.setViewVisibility(l, View.GONE);
        v.setViewVisibility(R.id.w_texto, View.VISIBLE);
        JSONObject d = Estado.datos(c);
        v.setTextViewText(R.id.w_frase, d.optString("frase", "").isEmpty() ? "Victoria sobre ti mismo." : d.optString("frase"));
        v.setTextViewText(R.id.w_numero, "—");
        v.setTextViewText(R.id.w_detalle, "");
        v.setProgressBar(R.id.w_barra, 100, 0, false);
        if (!Estado.conDatos(d)) {
            v.setTextViewText(R.id.w_texto, d.optBoolean("sinSesion") ? "Entrá a Stoica para ver tus hábitos." : "Abrí Stoica para ver tu día.");
            manager.updateAppWidget(id, v);
            return;
        }
        // El celular calcula el día solo (también pasada la medianoche).
        String hoy = Estado.hoy(d);
        List<JSONObject> deHoy = Estado.habitosDeHoy(d, hoy);
        List<JSONObject> faltan = new ArrayList<>();
        List<JSONObject> listos = new ArrayList<>();
        for (JSONObject h : deHoy) (Estado.cumplido(h, Estado.marca(d, h.optString("id"), hoy)) ? listos : faltan).add(h);
        int total = deHoy.size();
        if (total == 0) {
            v.setTextViewText(R.id.w_numero, "0");
            v.setTextViewText(R.id.w_detalle, "hábitos hoy");
            v.setTextViewText(R.id.w_texto, "Hoy no tenés hábitos programados.");
            manager.updateAppWidget(id, v);
            return;
        }
        v.setTextViewText(R.id.w_numero, listos.size() + "/" + total);
        v.setTextViewText(R.id.w_detalle, total == 1 ? "hábito" : "hábitos");
        v.setProgressBar(R.id.w_barra, 100, Math.round(listos.size() * 100f / total), false);
        v.setViewVisibility(R.id.w_texto, View.GONE);

        // Cuántas líneas entran según el alto (cada una ~26dp).
        android.os.Bundle o = manager.getAppWidgetOptions(id);
        int alto = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        int cap = alto <= 0 ? 4 : Math.max(1, Math.min(LINEAS.length, (alto - 120) / 26));
        List<JSONObject> orden = new ArrayList<>(faltan);
        orden.addAll(listos);
        boolean sobran = orden.size() > cap;
        int n = sobran ? cap - 1 : orden.size();
        int dorado = c.getColor(R.color.widget_dorado);
        int verde = c.getColor(R.color.widget_verde);
        for (int i = 0; i < n; i++) {
            JSONObject h = orden.get(i);
            String hid = h.optString("id");
            JSONObject m = Estado.marca(d, hid, hoy);
            boolean ok = Estado.cumplido(h, m);
            boolean cantidad = "cantidad".equals(h.optString("tipo"));
            String marca = ok ? Lista.LLENO : (Estado.marcable(h) && cantidad ? "+1" : Lista.VACIO);
            String cuanto = Estado.detalleCantidad(h, m);
            String texto = marca + "   " + h.optString("nombre") + (cuanto.isEmpty() ? "" : "  ·  " + cuanto);
            SpannableString sp = new SpannableString(texto);
            sp.setSpan(new ForegroundColorSpan(ok ? verde : dorado), 0, marca.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            if (ok) sp.setSpan(new ForegroundColorSpan(c.getColor(R.color.widget_suave)), marca.length(), texto.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            v.setViewVisibility(LINEAS[i], View.VISIBLE);
            v.setTextViewText(LINEAS[i], sp);
            v.setOnClickPendingIntent(LINEAS[i], Estado.marcable(h) ? Estado.accion(c, "habito", hid, id) : Estado.abrir(c, "/habitos/" + hid));
        }
        if (sobran) {
            v.setViewVisibility(LINEAS[n], View.VISIBLE);
            v.setTextViewText(LINEAS[n], "      +" + (orden.size() - n) + " más en Stoica");
            v.setTextColor(LINEAS[n], c.getColor(R.color.widget_suave));
            v.setOnClickPendingIntent(LINEAS[n], Estado.abrir(c, "/"));
        }
        if (faltan.isEmpty()) v.setTextViewText(R.id.w_detalle, "hábitos · ¡día cumplido!");
        manager.updateAppWidget(id, v);
    }
}
