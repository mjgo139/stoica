package app.stoica;

import android.app.PendingIntent;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

/** Piezas comunes de los widgets en lista (hábitos de hoy, tareas y grupo): hasta 6 filas. */
final class Lista {

    static final int MAX = 6;
    static final int[] FILAS = { R.id.w_fila0, R.id.w_fila1, R.id.w_fila2, R.id.w_fila3, R.id.w_fila4, R.id.w_fila5 };
    static final int[] NOMBRES = { R.id.w_nombre0, R.id.w_nombre1, R.id.w_nombre2, R.id.w_nombre3, R.id.w_nombre4, R.id.w_nombre5 };
    static final int[] DETALLES = { R.id.w_detalle0, R.id.w_detalle1, R.id.w_detalle2, R.id.w_detalle3, R.id.w_detalle4, R.id.w_detalle5 };
    static final int[] MARCAS = { R.id.w_marca0, R.id.w_marca1, R.id.w_marca2, R.id.w_marca3, R.id.w_marca4, R.id.w_marca5 };

    static final String LLENO = "◆";
    static final String VACIO = "◇";

    private Lista() {}

    static RemoteViews nueva(Context c, String titulo) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_lista);
        v.setTextViewText(R.id.w_titulo, titulo);
        v.setTextViewText(R.id.w_cuenta, "");
        v.setViewVisibility(R.id.w_barra, View.GONE);
        v.setViewVisibility(R.id.w_vacio, View.GONE);
        v.setViewVisibility(R.id.w_pie, View.GONE);
        for (int f : FILAS) v.setViewVisibility(f, View.GONE);
        return v;
    }

    static void vacio(RemoteViews v, String texto) {
        v.setViewVisibility(R.id.w_vacio, View.VISIBLE);
        v.setTextViewText(R.id.w_vacio, texto);
    }

    static void barra(RemoteViews v, int hecho, int total) {
        if (total <= 0) return;
        v.setViewVisibility(R.id.w_barra, View.VISIBLE);
        v.setProgressBar(R.id.w_barra, 100, Math.round(hecho * 100f / total), false);
    }

    static void pie(RemoteViews v, String texto) {
        if (texto == null || texto.isEmpty()) return;
        v.setViewVisibility(R.id.w_pie, View.VISIBLE);
        v.setTextViewText(R.id.w_pie, texto);
    }

    /** Una fila: nombre, detalle chiquito y la marca a la derecha (con su propio toque). */
    static void fila(Context c, RemoteViews v, int i, String nombre, String detalle, String marca, boolean lista, PendingIntent alTocarFila, PendingIntent alTocarMarca) {
        v.setViewVisibility(FILAS[i], View.VISIBLE);
        v.setTextViewText(NOMBRES[i], nombre);
        v.setTextColor(NOMBRES[i], c.getColor(lista ? R.color.widget_suave : R.color.widget_texto));
        v.setTextViewText(DETALLES[i], detalle == null ? "" : detalle);
        v.setViewVisibility(DETALLES[i], detalle == null || detalle.isEmpty() ? View.GONE : View.VISIBLE);
        v.setTextViewText(MARCAS[i], marca);
        v.setTextColor(MARCAS[i], c.getColor(lista ? R.color.widget_verde : R.color.widget_dorado));
        if (alTocarFila != null) v.setOnClickPendingIntent(FILAS[i], alTocarFila);
        if (alTocarMarca != null) v.setOnClickPendingIntent(MARCAS[i], alTocarMarca);
    }
}
