package app.stoica;

import android.content.Context;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Puente entre la app y el widget: la app manda el resumen de hoy (cuántos hábitos, cuáles faltan),
 * se guarda en el celular y el widget se vuelve a dibujar. No usa internet ni Firebase.
 */
@CapacitorPlugin(name = "WidgetStoica")
public class WidgetPlugin extends Plugin {

    @PluginMethod
    public void actualizar(PluginCall call) {
        JSObject datos = call.getData();
        getContext().getSharedPreferences(HoyWidget.PREFS, Context.MODE_PRIVATE).edit().putString("hoy", datos.toString()).apply();
        HoyWidget.refrescarTodos(getContext());
        call.resolve();
    }
}
