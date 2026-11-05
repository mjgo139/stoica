package app.stoica;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.os.Bundle;
import android.widget.ArrayAdapter;
import android.widget.ListView;
import android.widget.Toast;
import java.util.ArrayList;
import java.util.List;

/** Pantallita que aparece al poner el widget: elegir qué hábito o qué grupo muestra. */
abstract class ElegirWidget extends Activity {

    protected int widgetId = AppWidgetManager.INVALID_APPWIDGET_ID;
    protected final List<String> ids = new ArrayList<>();
    protected final List<String> nombres = new ArrayList<>();

    protected abstract String titulo();

    protected abstract String sinOpciones();

    /** Llena `ids` y `nombres`. */
    protected abstract void cargar();

    protected abstract void alElegir(String id);

    @Override
    protected void onCreate(Bundle guardado) {
        super.onCreate(guardado);
        setResult(RESULT_CANCELED);
        Bundle extras = getIntent().getExtras();
        if (extras != null) widgetId = extras.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish();
            return;
        }
        cargar();
        if (ids.isEmpty()) {
            Toast.makeText(this, sinOpciones(), Toast.LENGTH_LONG).show();
            finish();
            return;
        }
        setTitle(titulo());
        ListView lista = new ListView(this);
        lista.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_list_item_1, nombres));
        lista.setOnItemClickListener((padre, vista, pos, fila) -> {
            String id = ids.get(pos);
            Estado.elegir(this, widgetId, id);
            alElegir(id);
            setResult(RESULT_OK, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId));
            finish();
        });
        setContentView(lista);
    }
}
