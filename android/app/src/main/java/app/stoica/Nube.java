package app.stoica;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.os.Build;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Iterator;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Guardar desde el widget sin abrir la app: con la misma sesión de la app (el permiso de larga duración
 * que Firebase ya guarda en el celular) se pide un acceso de una hora y se escribe en Firestore.
 * Las reglas de seguridad son las mismas que para la app: solo tus documentos y con los mismos campos.
 */
final class Nube {

    private static final String PREFS = "widget_sesion";
    private static final int ESPERA_MS = 8000;

    private Nube() {}

    static final class Fallo extends Exception {
        final int codigo;

        Fallo(int codigo, String mensaje) {
            super(mensaje);
            this.codigo = codigo;
        }
    }

    // ---------- Sesión ----------

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static synchronized void guardarSesion(Context c, JSONObject s) {
        String uid = s.optString("uid", "");
        String renovar = s.optString("renovar", "");
        if (uid.isEmpty() || renovar.isEmpty()) {
            prefs(c).edit().clear().apply();
            return;
        }
        SharedPreferences.Editor e = prefs(c).edit();
        // Otra cuenta: se olvida el acceso anterior.
        if (!uid.equals(prefs(c).getString("uid", ""))) e.remove("acceso").remove("vence");
        e.putString("uid", uid)
            .putString("renovar", renovar)
            .putString("apiKey", s.optString("apiKey", ""))
            .putString("proyecto", s.optString("proyecto", ""))
            .apply();
    }

    static String uid(Context c) {
        return prefs(c).getString("uid", "");
    }

    static boolean haySesion(Context c) {
        return !uid(c).isEmpty() && !prefs(c).getString("renovar", "").isEmpty();
    }

    private static String proyecto(Context c) {
        String p = prefs(c).getString("proyecto", "");
        if (!p.isEmpty()) return p;
        return recurso(c, "project_id");
    }

    private static String recurso(Context c, String nombre) {
        int id = c.getResources().getIdentifier(nombre, "string", c.getPackageName());
        return id == 0 ? "" : c.getString(id);
    }

    /** Acceso de una hora (se renueva solo con el permiso guardado). */
    static synchronized String acceso(Context c) throws Exception {
        SharedPreferences p = prefs(c);
        String guardado = p.getString("acceso", "");
        if (!guardado.isEmpty() && p.getLong("vence", 0) > System.currentTimeMillis() + 60000) return guardado;
        String renovar = p.getString("renovar", "");
        if (renovar.isEmpty()) throw new Fallo(401, "sin sesión");

        String cuerpo = "grant_type=refresh_token&refresh_token=" + URLEncoder.encode(renovar, "UTF-8");
        JSONObject r = null;
        Exception ultimo = null;
        // Primero la clave de Android (con la huella de la app); si está limitada a otra cosa, la de la web.
        String[] claves = { recurso(c, "google_api_key"), p.getString("apiKey", "") };
        for (int i = 0; i < claves.length && r == null; i++) {
            if (claves[i].isEmpty()) continue;
            try {
                HttpURLConnection con = abrir("https://securetoken.googleapis.com/v1/token?key=" + claves[i], "POST");
                con.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
                if (i == 0) {
                    con.setRequestProperty("X-Android-Package", c.getPackageName());
                    con.setRequestProperty("X-Android-Cert", huella(c));
                } else {
                    con.setRequestProperty("Referer", "https://stoica-app.web.app/");
                }
                r = new JSONObject(enviar(con, cuerpo));
            } catch (Exception e) {
                ultimo = e;
            }
        }
        if (r == null) throw ultimo != null ? ultimo : new Fallo(401, "sin clave");
        String acceso = r.optString("id_token", "");
        if (acceso.isEmpty()) throw new Fallo(401, "sin acceso");
        long vence = System.currentTimeMillis() + Math.max(300, r.optLong("expires_in", 3600)) * 1000L;
        SharedPreferences.Editor e = p.edit().putString("acceso", acceso).putLong("vence", vence);
        String nuevo = r.optString("refresh_token", "");
        if (!nuevo.isEmpty()) e.putString("renovar", nuevo);
        e.apply();
        return acceso;
    }

    /** Huella SHA-1 de la firma de esta APK (la pide Google si la clave está limitada a la app). */
    @SuppressWarnings("deprecation")
    private static String huella(Context c) {
        try {
            PackageManager pm = c.getPackageManager();
            Signature[] firmas;
            if (Build.VERSION.SDK_INT >= 28) {
                PackageInfo pi = pm.getPackageInfo(c.getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
                firmas = pi.signingInfo.getApkContentsSigners();
            } else {
                PackageInfo pi = pm.getPackageInfo(c.getPackageName(), PackageManager.GET_SIGNATURES);
                firmas = pi.signatures;
            }
            byte[] sha = MessageDigest.getInstance("SHA-1").digest(firmas[0].toByteArray());
            StringBuilder sb = new StringBuilder();
            for (byte b : sha) sb.append(String.format("%02X", b));
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }

    // ---------- Firestore ----------

    private static String base(Context c) {
        return "https://firestore.googleapis.com/v1/projects/" + proyecto(c) + "/databases/(default)/documents/";
    }

    /** Lee un documento (los campos en formato de Firestore) o null si no existe. */
    static JSONObject leer(Context c, String ruta) throws Exception {
        HttpURLConnection con = abrir(base(c) + ruta, "GET");
        con.setRequestProperty("Authorization", "Bearer " + acceso(c));
        try {
            JSONObject d = new JSONObject(enviar(con, null));
            JSONObject campos = d.optJSONObject("fields");
            return campos != null ? campos : new JSONObject();
        } catch (Fallo f) {
            if (f.codigo == 404) return null;
            throw f;
        }
    }

    /** Lista los documentos de una colección (hasta 50). */
    static JSONArray listar(Context c, String ruta) throws Exception {
        HttpURLConnection con = abrir(base(c) + ruta + "?pageSize=50", "GET");
        con.setRequestProperty("Authorization", "Bearer " + acceso(c));
        JSONObject r = new JSONObject(enviar(con, null));
        JSONArray docs = r.optJSONArray("documents");
        return docs != null ? docs : new JSONArray();
    }

    /**
     * Escribe un documento. Sin `campos` a cambiar (mascara null) lo reemplaza entero (o lo crea);
     * con máscara cambia solo esos campos y exige que el documento exista.
     */
    static void escribir(Context c, String ruta, JSONObject campos, String[] mascara) throws Exception {
        StringBuilder url = new StringBuilder(base(c)).append(ruta);
        if (mascara != null) {
            url.append("?currentDocument.exists=true");
            for (String m : mascara) url.append("&updateMask.fieldPaths=").append(URLEncoder.encode(m, "UTF-8"));
        }
        // HttpURLConnection no sabe hacer PATCH: Google acepta POST con este aviso.
        HttpURLConnection con = abrir(url.toString(), "POST");
        con.setRequestProperty("X-HTTP-Method-Override", "PATCH");
        con.setRequestProperty("Authorization", "Bearer " + acceso(c));
        con.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        enviar(con, new JSONObject().put("fields", campos).toString());
    }

    // Valores en el formato de Firestore.
    static JSONObject texto(String s) throws Exception {
        return new JSONObject().put("stringValue", s);
    }

    static JSONObject booleano(boolean b) throws Exception {
        return new JSONObject().put("booleanValue", b);
    }

    static JSONObject entero(long n) throws Exception {
        return new JSONObject().put("integerValue", String.valueOf(n));
    }

    static JSONObject numero(double n) throws Exception {
        if (n == Math.rint(n) && Math.abs(n) < 1e15) return entero((long) n);
        return new JSONObject().put("doubleValue", n);
    }

    static JSONObject nulo() throws Exception {
        return new JSONObject().put("nullValue", JSONObject.NULL);
    }

    static JSONObject mapaVacio() throws Exception {
        return new JSONObject().put("mapValue", new JSONObject());
    }

    static double leerNumero(JSONObject campos, String nombre) {
        JSONObject v = campos == null ? null : campos.optJSONObject(nombre);
        if (v == null) return 0;
        if (v.has("integerValue")) return Double.parseDouble(v.optString("integerValue", "0"));
        return v.optDouble("doubleValue", 0);
    }

    static boolean leerBooleano(JSONObject campos, String nombre) {
        JSONObject v = campos == null ? null : campos.optJSONObject(nombre);
        return v != null && v.optBoolean("booleanValue", false);
    }

    static String leerTexto(JSONObject campos, String nombre) {
        JSONObject v = campos == null ? null : campos.optJSONObject(nombre);
        return v == null ? "" : v.optString("stringValue", "");
    }

    static int contarMapa(JSONObject campos, String nombre) {
        JSONObject v = campos == null ? null : campos.optJSONObject(nombre);
        JSONObject m = v == null ? null : v.optJSONObject("mapValue");
        JSONObject f = m == null ? null : m.optJSONObject("fields");
        if (f == null) return 0;
        int n = 0;
        for (Iterator<String> it = f.keys(); it.hasNext(); it.next()) n++;
        return n;
    }

    // ---------- HTTP ----------

    private static HttpURLConnection abrir(String url, String metodo) throws Exception {
        HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
        con.setRequestMethod(metodo);
        con.setConnectTimeout(ESPERA_MS);
        con.setReadTimeout(ESPERA_MS);
        con.setUseCaches(false);
        return con;
    }

    private static String enviar(HttpURLConnection con, String cuerpo) throws Exception {
        try {
            if (cuerpo != null) {
                con.setDoOutput(true);
                OutputStream os = con.getOutputStream();
                os.write(cuerpo.getBytes(StandardCharsets.UTF_8));
                os.close();
            }
            int codigo = con.getResponseCode();
            InputStream is = codigo >= 400 ? con.getErrorStream() : con.getInputStream();
            String texto = leerTodo(is);
            if (codigo >= 400) throw new Fallo(codigo, texto.length() > 300 ? texto.substring(0, 300) : texto);
            return texto;
        } finally {
            con.disconnect();
        }
    }

    private static String leerTodo(InputStream is) throws Exception {
        if (is == null) return "";
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        int n;
        while ((n = is.read(buf)) > 0) out.write(buf, 0, n);
        is.close();
        return new String(out.toByteArray(), StandardCharsets.UTF_8);
    }
}
