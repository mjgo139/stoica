package app.stoica;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.widget.RemoteViews;
import java.util.Locale;
import org.json.JSONObject;

/** Widget "tarjeta": la tarjeta del hábito como en la app (ícono, racha, la semana y el 30 días). */
public class TarjetaWidget extends AppWidgetProvider {

    static final int[] CP = { R.id.c_cp0, R.id.c_cp1, R.id.c_cp2, R.id.c_cp3, R.id.c_cp4, R.id.c_cp5, R.id.c_cp6 };
    static final int[] BX = { R.id.c_bx0, R.id.c_bx1, R.id.c_bx2, R.id.c_bx3, R.id.c_bx4, R.id.c_bx5, R.id.c_bx6 };
    static final int[] LB = { R.id.c_lb0, R.id.c_lb1, R.id.c_lb2, R.id.c_lb3, R.id.c_lb4, R.id.c_lb5, R.id.c_lb6 };

    @Override
    public void onUpdate(Context contexto, AppWidgetManager manager, int[] ids) {
        for (int id : ids) dibujar(contexto, manager, id);
    }

    @Override
    public void onDeleted(Context contexto, int[] ids) {
        Estado.olvidar(contexto, ids);
    }

    private static int recurso(Context c, String tipo, String nombre, int siNo) {
        int id = c.getResources().getIdentifier(nombre, tipo, c.getPackageName());
        return id == 0 ? siNo : id;
    }

    static void dibujar(Context c, AppWidgetManager manager, int widgetId) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_tarjeta);
        JSONObject d = Estado.datos(c);
        String hid = Estado.eleccion(c, widgetId);
        JSONObject h = Estado.conDatos(d) ? Estado.habito(d, hid) : null;
        String hoy = Estado.hoy(d);
        if (h == null) {
            v.setTextViewText(R.id.c_nombre, !Estado.conDatos(d) ? "Entrá a Stoica" : hid == null ? "Elegí un hábito" : "Ese hábito ya no está");
            v.setTextViewText(R.id.c_virtud, "MANTENÉ APRETADO PARA ELEGIR");
            for (int i = 0; i < 7; i++) v.setTextViewText(LB[i], "");
            v.setTextViewText(R.id.c_pct, "");
            v.setTextViewText(R.id.c_accion, "");
            v.setOnClickPendingIntent(R.id.widget_raiz, Estado.abrir(c, "/habitos"));
            manager.updateAppWidget(widgetId, v);
            return;
        }

        // Ícono y color de la virtud.
        String virtud = h.optString("virtudId", "justicia");
        int color = c.getColor(recurso(c, "color", "virtud_" + virtud, R.color.widget_dorado));
        v.setInt(R.id.c_circulo, "setBackgroundResource", recurso(c, "drawable", "circulo_" + virtud, R.drawable.circulo_justicia));
        v.setImageViewResource(R.id.c_icono, recurso(c, "drawable", "hab_" + h.optString("icono", "med").toLowerCase(Locale.US), R.drawable.hab_med));
        v.setInt(R.id.c_icono, "setColorFilter", color);

        v.setTextViewText(R.id.c_nombre, h.optString("nombre"));
        String nombreVirtud = h.optString("virtud", "").toUpperCase(Locale.getDefault());
        String tipo = h.optString("tipoNombre", "").toUpperCase(Locale.getDefault());
        SpannableString sub = new SpannableString(nombreVirtud + (tipo.isEmpty() ? "" : " · " + tipo));
        sub.setSpan(new ForegroundColorSpan(color), 0, nombreVirtud.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        v.setTextViewText(R.id.c_virtud, sub);
        int racha = Estado.racha(d, h, hoy);
        v.setTextViewText(R.id.c_racha, racha < 0 ? "—" : Estado.romano(racha));

        // La semana: barrita de color, cajita con ✓ / × y la letra del día.
        String semana = Estado.semana(d, h, hoy);
        int verde = c.getColor(R.color.widget_ok);
        int rojo = c.getColor(R.color.widget_miss);
        for (int i = 0; i < 7; i++) {
            String dia = Estado.sumarDias(hoy, i - 6);
            char e = semana.charAt(i);
            int caja;
            int barra;
            String marca = "";
            if (e == 'o') {
                caja = R.drawable.dia_ok;
                barra = R.drawable.cp_ok;
                marca = "✓";
            } else if (e == 'x') {
                caja = R.drawable.dia_mal;
                barra = R.drawable.cp_mal;
                marca = "×";
            } else if (e == 'i') {
                caja = R.drawable.dia_inactivo;
                barra = R.drawable.cp_vacio;
            } else {
                caja = i == 6 ? R.drawable.dia_hoy : R.drawable.dia_vacio;
                barra = i == 6 ? R.drawable.cp_hoy : R.drawable.cp_vacio;
            }
            v.setInt(BX[i], "setBackgroundResource", caja);
            v.setInt(CP[i], "setBackgroundResource", barra);
            v.setTextViewText(BX[i], marca);
            v.setTextColor(BX[i], e == 'x' ? rojo : verde);
            int ds = Estado.diaSemana(dia);
            v.setTextViewText(LB[i], ds >= 0 ? Estado.LETRAS[ds] : "");
        }

        v.setTextViewText(R.id.c_pct, "30 DÍAS · " + Estado.porcentaje30(d, h, hoy) + "%");

        // Marcar hoy desde la tarjeta (tocando la cajita de hoy o el botón de abajo).
        JSONObject m = Estado.marca(d, hid, hoy);
        boolean ok = Estado.cumplido(h, m);
        boolean marcable = Estado.marcable(h);
        boolean cantidad = "cantidad".equals(h.optString("tipo"));
        String accion;
        if (marcable) {
            if (cantidad) accion = Estado.detalleCantidad(h, m) + "  +1";
            else accion = ok ? "Hecho hoy " + Lista.LLENO : "Marcar hoy " + Lista.VACIO;
        } else {
            accion = "Ver detalle ›";
        }
        v.setTextViewText(R.id.c_accion, accion);
        v.setTextColor(R.id.c_accion, ok ? verde : c.getColor(R.color.widget_dorado));
        android.app.PendingIntent tocarHoy = marcable ? Estado.accion(c, "habito", hid, widgetId) : Estado.abrir(c, "/habitos/" + hid);
        v.setOnClickPendingIntent(R.id.c_accion, tocarHoy);
        v.setOnClickPendingIntent(BX[6], tocarHoy);
        v.setOnClickPendingIntent(R.id.widget_raiz, Estado.abrir(c, "/habitos/" + hid));
        manager.updateAppWidget(widgetId, v);
    }
}
