package app.stoica;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.graphics.Typeface;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.TextView;
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
        // Colores propios (los de Stoica, claros u oscuros según el celular): el tema del sistema
        // dejaba letras blancas sobre fondo blanco.
        final int texto = getColor(R.color.widget_texto);
        final float dp = getResources().getDisplayMetrics().density;
        getWindow().setBackgroundDrawableResource(R.drawable.widget_fondo);
        LinearLayout raiz = new LinearLayout(this);
        raiz.setOrientation(LinearLayout.VERTICAL);
        raiz.setPadding((int) (16 * dp), (int) (18 * dp), (int) (16 * dp), (int) (12 * dp));
        TextView encabezado = new TextView(this);
        encabezado.setText(titulo());
        encabezado.setTextColor(getColor(R.color.widget_dorado));
        encabezado.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        encabezado.setTypeface(Typeface.SERIF, Typeface.BOLD);
        encabezado.setPadding(0, 0, 0, (int) (10 * dp));
        raiz.addView(encabezado);
        ListView lista = new ListView(this);
        lista.setDivider(null);
        lista.setDividerHeight((int) (6 * dp));
        lista.setAdapter(new ArrayAdapter<String>(this, android.R.layout.simple_list_item_1, nombres) {
            @Override
            public View getView(int pos, View reciclada, ViewGroup padre) {
                TextView t = (TextView) super.getView(pos, reciclada, padre);
                t.setTextColor(texto);
                t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
                t.setBackgroundResource(R.drawable.widget_fila);
                t.setPadding((int) (14 * dp), (int) (12 * dp), (int) (14 * dp), (int) (12 * dp));
                return t;
            }
        });
        raiz.addView(lista, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        lista.setOnItemClickListener((padre, vista, pos, fila) -> {
            String id = ids.get(pos);
            Estado.elegir(this, widgetId, id);
            alElegir(id);
            setResult(RESULT_OK, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId));
            finish();
        });
        setContentView(raiz);
    }
}
