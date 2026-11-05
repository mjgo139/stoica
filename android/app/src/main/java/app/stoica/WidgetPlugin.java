package app.stoica;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Puente entre la app y los widgets: la app manda tus hábitos, marcas, tareas y grupos; se guardan en el
 * celular y los widgets se vuelven a dibujar. `sesion` deja que el widget guarde marcas con tu cuenta.
 */
@CapacitorPlugin(name = "WidgetStoica")
public class WidgetPlugin extends Plugin {

    @PluginMethod
    public void actualizar(PluginCall call) {
        JSObject datos = call.getData();
        synchronized (Estado.class) {
            conservarGruposLeidos(Estado.datos(getContext()), datos);
            Estado.guardar(getContext(), datos);
        }
        Estado.refrescarTodos(getContext());
        call.resolve();
    }

    @PluginMethod
    public void sesion(PluginCall call) {
        Nube.guardarSesion(getContext(), call.getData());
        call.resolve();
    }

    /** Marcas hechas en el widget que no se pudieron subir: la app las sube y quedan borradas acá. */
    @PluginMethod
    public void tomarPendientes(PluginCall call) {
        JSONObject r = Estado.tomarPendientes(getContext());
        JSObject res = new JSObject();
        res.put("lista", r.optJSONArray("lista") != null ? r.optJSONArray("lista") : new JSONArray());
        res.put("error", r.optString("error", ""));
        call.resolve(res);
    }

    /** Si el widget leyó el grupo de la nube después de lo último que viste en la app, se queda con eso. */
    private static void conservarGruposLeidos(JSONObject antes, JSONObject nuevo) {
        JSONArray gs = nuevo.optJSONArray("grupos");
        if (gs == null) return;
        try {
            for (int i = 0; i < gs.length(); i++) {
                JSONObject g = gs.optJSONObject(i);
                if (g == null) continue;
                JSONObject viejo = Estado.grupo(antes, g.optString("id"));
                if (viejo == null) continue;
                long leido = viejo.optLong("leido", 0);
                if (leido > g.optLong("visto", 0) && viejo.optJSONArray("miembros") != null) {
                    g.put("miembros", viejo.getJSONArray("miembros"));
                    g.put("leido", leido);
                }
            }
        } catch (Exception e) {
            // se queda con lo nuevo
        }
    }
}
