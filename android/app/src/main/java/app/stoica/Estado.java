package app.stoica;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Lo que la app le pasó a los widgets (hábitos con sus días, marcas de hoy y ayer, tareas y grupos)
 * y las cuentas del día que hace el celular solo: qué toca hoy, qué está cumplido y la racha.
 */
final class Estado {

    static final String PREFS = "widget_stoica";
    static final String ELECCION = "widget_eleccion";
    /** Metas de cantidad más grandes que esto se cargan en la app (sumar de a uno no tiene sentido). */
    static final int META_GRANDE = 50;

    private Estado() {}

    // ---------- Datos guardados ----------

    static synchronized JSONObject datos(Context c) {
        try {
            String crudo = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("datos", null);
            if (crudo != null) return new JSONObject(crudo);
        } catch (Exception e) {
            // dato dañado: como si no hubiera nada
        }
        return new JSONObject();
    }

    static synchronized void guardar(Context c, JSONObject d) {
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("datos", d.toString()).apply();
    }

    static boolean conDatos(JSONObject d) {
        return d.optInt("v") >= 2 && !d.optBoolean("sinSesion");
    }

    static String eleccion(Context c, int widgetId) {
        return c.getSharedPreferences(ELECCION, Context.MODE_PRIVATE).getString("w" + widgetId, null);
    }

    static void elegir(Context c, int widgetId, String id) {
        c.getSharedPreferences(ELECCION, Context.MODE_PRIVATE).edit().putString("w" + widgetId, id).apply();
    }

    static void olvidar(Context c, int[] ids) {
        SharedPreferences.Editor e = c.getSharedPreferences(ELECCION, Context.MODE_PRIVATE).edit();
        for (int id : ids) e.remove("w" + id);
        e.apply();
    }

    // ---------- Fechas (en la zona horaria del perfil) ----------

    static TimeZone zona(JSONObject d) {
        return TimeZone.getTimeZone(d.optString("zona", "America/Asuncion"));
    }

    static String hoy(JSONObject d) {
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        f.setTimeZone(zona(d));
        return f.format(new Date());
    }

    static String sumarDias(String clave, int n) {
        try {
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            f.setTimeZone(TimeZone.getTimeZone("UTC"));
            Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
            cal.setTime(f.parse(clave));
            cal.add(Calendar.DAY_OF_MONTH, n);
            return f.format(cal.getTime());
        } catch (Exception e) {
            return clave;
        }
    }

    static int diaSemana(String clave) {
        try {
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            f.setTimeZone(TimeZone.getTimeZone("UTC"));
            Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
            cal.setTime(f.parse(clave));
            return cal.get(Calendar.DAY_OF_WEEK) - 1; // 0 = domingo, igual que en la app
        } catch (Exception e) {
            return -1;
        }
    }

    // ---------- Hábitos ----------

    static boolean diaActivo(JSONObject h, String fecha) {
        if (fecha.compareTo(h.optString("inicio", "0000-00-00")) < 0) return false;
        JSONArray dias = h.optJSONArray("dias");
        if (dias == null) return false;
        int d = diaSemana(fecha);
        for (int i = 0; i < dias.length(); i++) if (dias.optInt(i, -9) == d) return true;
        return false;
    }

    static JSONObject marca(JSONObject d, String habitoId, String fecha) {
        JSONObject m = d.optJSONObject("marcas");
        return m == null ? null : m.optJSONObject(habitoId + "_" + fecha);
    }

    static boolean cumplido(JSONObject h, JSONObject m) {
        if (m == null) return false;
        String tipo = h.optString("tipo");
        if ("sino".equals(tipo)) return m.optBoolean("h");
        if ("cantidad".equals(tipo) || "lista".equals(tipo)) return m.optDouble("v", 0) >= Math.max(1, h.optDouble("meta", 1));
        return m.optInt("m") > 0;
    }

    /** Valor de hoy (cantidad o ítems de la lista). */
    static double valor(JSONObject m) {
        return m == null ? 0 : m.optDouble("v", 0);
    }

    /** ¿Se puede marcar tocando una vez? (sí/no, o cantidad de a uno con meta chica) */
    static boolean marcable(JSONObject h) {
        String tipo = h.optString("tipo");
        if ("sino".equals(tipo)) return true;
        return "cantidad".equals(tipo) && h.optDouble("meta", 1) <= META_GRANDE;
    }

    static JSONObject habito(JSONObject d, String id) {
        JSONArray hs = d.optJSONArray("habitos");
        if (hs == null || id == null) return null;
        for (int i = 0; i < hs.length(); i++) {
            JSONObject h = hs.optJSONObject(i);
            if (h != null && id.equals(h.optString("id"))) return h;
        }
        return null;
    }

    static List<JSONObject> habitosDeHoy(JSONObject d, String hoy) {
        List<JSONObject> l = new ArrayList<>();
        JSONArray hs = d.optJSONArray("habitos");
        if (hs == null) return l;
        for (int i = 0; i < hs.length(); i++) {
            JSONObject h = hs.optJSONObject(i);
            if (h != null && diaActivo(h, hoy)) l.add(h);
        }
        return l;
    }

    /**
     * Racha mostrando hoy. La app manda la racha "sin contar hoy" del día en que se armaron los datos;
     * si pasó la medianoche, se corre un día con la marca de ayer. -1 = no se sabe (hace días que no se abre).
     */
    static int racha(JSONObject d, JSONObject h, String hoy) {
        String base = d.optString("fecha");
        int r = h.optInt("racha");
        String id = h.optString("id");
        if (!base.equals(hoy)) {
            if (!sumarDias(base, 1).equals(hoy)) return -1;
            if (diaActivo(h, base)) r = cumplido(h, marca(d, id, base)) ? r + 1 : 0;
        }
        if (diaActivo(h, hoy) && cumplido(h, marca(d, id, hoy))) r++;
        return r;
    }

    static String detalleCantidad(JSONObject h, JSONObject m) {
        String tipo = h.optString("tipo");
        if ("cantidad".equals(tipo)) {
            String u = h.optString("unidad", "");
            return numero(valor(m)) + "/" + numero(h.optDouble("meta", 1)) + (u.isEmpty() ? "" : " " + u);
        }
        if ("lista".equals(tipo)) return numero(valor(m)) + "/" + h.optInt("items");
        return "";
    }

    static String numero(double n) {
        if (n == Math.rint(n)) return String.valueOf((long) n);
        return String.format(Locale.US, "%.1f", n).replace('.', ',');
    }

    // ---------- Tareas ----------

    static boolean tareaHecha(JSONObject d, JSONObject t, String hoy) {
        if (t.optBoolean("diaria")) {
            JSONArray hs = d.optJSONArray("hechas");
            String clave = t.optString("id") + "_" + hoy;
            if (hs != null) for (int i = 0; i < hs.length(); i++) if (clave.equals(hs.optString(i))) return true;
            return false;
        }
        return !t.isNull("completada") && !t.optString("completada", "").isEmpty();
    }

    /** Tareas de hoy: vencidas, las de hoy y las sin fecha; primero las que faltan. */
    static List<JSONObject> tareasDeHoy(JSONObject d, String hoy) {
        List<JSONObject> faltan = new ArrayList<>();
        List<JSONObject> listas = new ArrayList<>();
        JSONArray ts = d.optJSONArray("tareas");
        if (ts == null) return faltan;
        List<JSONObject> vencidas = new ArrayList<>();
        List<JSONObject> deHoy = new ArrayList<>();
        List<JSONObject> sinFecha = new ArrayList<>();
        for (int i = 0; i < ts.length(); i++) {
            JSONObject t = ts.optJSONObject(i);
            if (t == null) continue;
            String fecha = t.isNull("fecha") ? "" : t.optString("fecha", "");
            boolean hecha = tareaHecha(d, t, hoy);
            if (t.optBoolean("diaria")) {
                if (fecha.isEmpty() || fecha.compareTo(hoy) <= 0) (hecha ? listas : deHoy).add(t);
                continue;
            }
            if (hecha) {
                if (hoy.equals(t.optString("completada"))) listas.add(t);
                continue;
            }
            if (fecha.isEmpty()) sinFecha.add(t);
            else if (fecha.compareTo(hoy) < 0) vencidas.add(t);
            else if (fecha.equals(hoy)) deHoy.add(t);
        }
        faltan.addAll(vencidas);
        faltan.addAll(deHoy);
        faltan.addAll(sinFecha);
        faltan.addAll(listas);
        return faltan;
    }

    static JSONObject tarea(JSONObject d, String id) {
        JSONArray ts = d.optJSONArray("tareas");
        if (ts == null || id == null) return null;
        for (int i = 0; i < ts.length(); i++) {
            JSONObject t = ts.optJSONObject(i);
            if (t != null && id.equals(t.optString("id"))) return t;
        }
        return null;
    }

    // ---------- Grupos ----------

    static JSONObject grupo(JSONObject d, String id) {
        JSONArray gs = d.optJSONArray("grupos");
        if (gs == null || id == null) return null;
        for (int i = 0; i < gs.length(); i++) {
            JSONObject g = gs.optJSONObject(i);
            if (g != null && id.equals(g.optString("id"))) return g;
        }
        return null;
    }

    // ---------- Toques ----------

    /** Abre la app en una pantalla (por ejemplo "/habitos/ID"). */
    static PendingIntent abrir(Context c, String ruta) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("app.stoica://abrir" + ruta), c, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(c, ruta.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Marca sin abrir la app (lo hace AccionReceiver). */
    static PendingIntent accion(Context c, String que, String id, int widgetId) {
        Intent i = new Intent(c, AccionReceiver.class);
        i.setAction(AccionReceiver.ACCION);
        i.setData(Uri.parse("stoica-widget://" + que + "/" + id + "?w=" + widgetId));
        i.putExtra("que", que);
        i.putExtra("id", id);
        i.putExtra("widget", widgetId);
        return PendingIntent.getBroadcast(c, (que + id + widgetId).hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    // ---------- Redibujar ----------

    static int[] ids(Context c, Class<?> clase) {
        return AppWidgetManager.getInstance(c).getAppWidgetIds(new ComponentName(c, clase));
    }

    static void refrescarTodos(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        for (int id : ids(c, HoyWidget.class)) HoyWidget.dibujar(c, m, id);
        for (int id : ids(c, HabitosWidget.class)) HabitosWidget.dibujar(c, m, id);
        for (int id : ids(c, HabitoWidget.class)) HabitoWidget.dibujar(c, m, id);
        for (int id : ids(c, TareasWidget.class)) TareasWidget.dibujar(c, m, id);
        for (int id : ids(c, GrupoWidget.class)) GrupoWidget.dibujar(c, m, id);
    }
}
