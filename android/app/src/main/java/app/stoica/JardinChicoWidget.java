package app.stoica;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

/**
 * Widget chico del Jardín (2×2, v2.8.0, pedido del dueño): hasta 4 plantas en una grilla de 2 columnas
 * y un resumen corto. El dibujo es el mismo que el del widget ancho (JardinWidget).
 */
public class JardinChicoWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context contexto, AppWidgetManager manager, int[] ids) {
        for (int id : ids) dibujar(contexto, manager, id);
    }

    static void dibujar(Context c, AppWidgetManager manager, int widgetId) {
        JardinWidget.dibujar(c, manager, widgetId, R.layout.widget_jardin_chico, 2, 4, true);
    }
}
