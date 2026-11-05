package app.stoica;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Complemento propio: la app web le pasa al widget los hábitos de hoy.
        registerPlugin(WidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
