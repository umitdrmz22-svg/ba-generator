package com.defidev.ehs

import android.app.Activity
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.android.billingclient.api.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

private const val SUPABASE_URL = "https://rqvcbjomrjccyuchxpuh.supabase.co"
private const val SUPABASE_KEY = "sb_publishable_iKh-ZfqV3iJpr_9b7SErEA_XhrqnSsY"
private const val PRODUCT_ID = "ehs_pro_monthly"
private const val PACKAGE_NAME = "com.defidev.ehs"
private const val PRIVACY_URL = "https://umitdrmz22-svg.github.io/defidev-legal/privacy-ehs.html"
private const val DELETE_URL = "https://umitdrmz22-svg.github.io/defidev-legal/delete-ehs-account.html"

private data class Session(val accessToken: String, val userId: String, val email: String)
private data class Entitlement(val active: Boolean, val status: String, val expiresAt: String?)
private data class Module(val title: String, val subtitle: String, val url: String)

private val modules = listOf(
    Module("BA Studio", "Betriebsanweisungen", "https://umitdrmz22-svg.github.io/ba-generator/"),
    Module("Fluchtplan Studio", "Flucht- und Rettungspläne", "https://umitdrmz22-svg.github.io/fluchtplan-ai/"),
    Module("Brandschutzordnung Studio", "Brandschutzordnungen", "https://umitdrmz22-svg.github.io/brandschutzordnung-studio/"),
    Module("Gefahrstoffkataster", "Gefahrstoffe und Sicherheitsdaten", "https://umitdrmz22-svg.github.io/gefahrstoffkataster-online/"),
    Module("Dokumentmanagement", "EHS-Dokumente und Freigaben", "https://umitdrmz22-svg.github.io/dokumentmanagement-studio/"),
    Module("Unfallmanagement", "Unfälle, 5-Why und Maßnahmen", "https://umitdrmz22-svg.github.io/Unfallmanagemet_studio/")
)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { MaterialTheme { EhsApp(this) } }
    }
}

private class BillingManager(
    private val activity: Activity,
    private val onPurchase: (Purchase) -> Unit,
    private val onMessage: (String) -> Unit,
) : PurchasesUpdatedListener {
    var productDetails by mutableStateOf<ProductDetails?>(null)
        private set
    var connected by mutableStateOf(false)
        private set

    private val client = BillingClient.newBuilder(activity)
        .setListener(this)
        .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
        .build()

    fun start(onReady: (() -> Unit)? = null) {
        if (connected) { onReady?.invoke(); return }
        client.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                connected = result.responseCode == BillingClient.BillingResponseCode.OK
                if (connected) {
                    queryProduct()
                    onReady?.invoke()
                } else onMessage("Google Play Billing konnte nicht gestartet werden: ${result.debugMessage}")
            }
            override fun onBillingServiceDisconnected() { connected = false }
        })
    }

    private fun queryProduct() {
        val product = QueryProductDetailsParams.Product.newBuilder()
            .setProductId(PRODUCT_ID)
            .setProductType(BillingClient.ProductType.SUBS)
            .build()
        val params = QueryProductDetailsParams.newBuilder().setProductList(listOf(product)).build()
        client.queryProductDetailsAsync(params) { result, queryResult ->
            if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                productDetails = queryResult.productDetailsList.firstOrNull()
            }
        }
    }

    fun restorePurchases() {
        if (!connected) { start { restorePurchases() }; return }
        val params = QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build()
        client.queryPurchasesAsync(params) { result, purchases ->
            if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                purchases.filter { it.products.contains(PRODUCT_ID) && it.purchaseState == Purchase.PurchaseState.PURCHASED }
                    .forEach(onPurchase)
            }
        }
    }

    fun launchSubscription(session: Session) {
        if (!connected) { start { launchSubscription(session) }; return }
        val details = productDetails ?: run { queryProduct(); onMessage("Abonnementdaten werden geladen. Bitte erneut versuchen."); return }
        val offerToken = details.subscriptionOfferDetails?.firstOrNull()?.offerToken
            ?: run { onMessage("Für das Monatsabo ist in Google Play noch kein aktiver Basistarif hinterlegt."); return }
        val productParams = BillingFlowParams.ProductDetailsParams.newBuilder()
            .setProductDetails(details)
            .setOfferToken(offerToken)
            .build()
        val params = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(listOf(productParams))
            .setObfuscatedAccountId(sha256(session.userId))
            .build()
        val result = client.launchBillingFlow(activity, params)
        if (result.responseCode != BillingClient.BillingResponseCode.OK) onMessage(result.debugMessage)
    }

    fun formattedPrice(): String? = productDetails?.subscriptionOfferDetails
        ?.firstOrNull()?.pricingPhases?.pricingPhaseList?.lastOrNull()?.formattedPrice

    override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
        when (result.responseCode) {
            BillingClient.BillingResponseCode.OK -> purchases.orEmpty()
                .filter { it.products.contains(PRODUCT_ID) && it.purchaseState == Purchase.PurchaseState.PURCHASED }
                .forEach(onPurchase)
            BillingClient.BillingResponseCode.USER_CANCELED -> Unit
            else -> onMessage("Kauf konnte nicht abgeschlossen werden: ${result.debugMessage}")
        }
    }

    fun close() { client.endConnection() }
}

@Composable
private fun EhsApp(activity: Activity) {
    val scope = rememberCoroutineScope()
    var session by remember { mutableStateOf<Session?>(null) }
    var entitlement by remember { mutableStateOf(Entitlement(false, "none", null)) }
    var message by remember { mutableStateOf("") }
    var selectedModule by remember { mutableStateOf<Module?>(null) }
    var accountScreen by remember { mutableStateOf(false) }

    val billing = remember {
        BillingManager(
            activity,
            onPurchase = purchaseHandler@{ purchase ->
                val active = session ?: return@purchaseHandler
                scope.launch {
                    val verified = SupabaseApi.verifyPurchase(active, purchase.purchaseToken)
                    entitlement = verified ?: entitlement
                    message = if (verified?.active == true) "EHS Pro wurde freigeschaltet." else "Der Kauf konnte noch nicht verifiziert werden."
                }
            },
            onMessage = { message = it },
        )
    }
    DisposableEffect(Unit) { billing.start(); onDispose { billing.close() } }

    selectedModule?.let { module ->
        ModuleWebView(module) { selectedModule = null }
        return
    }

    if (session == null) {
        LoginScreen(
            message = message,
            onLogin = { email, password ->
                scope.launch {
                    message = "Anmeldung wird geprüft…"
                    val result = SupabaseApi.signIn(email, password)
                    if (result != null) {
                        session = result
                        entitlement = SupabaseApi.getEntitlement(result)
                        message = ""
                        billing.restorePurchases()
                    } else message = "Anmeldung fehlgeschlagen. E-Mail und Passwort prüfen."
                }
            },
            onSignup = { email, password ->
                scope.launch {
                    message = SupabaseApi.signUp(email, password)
                }
            }
        )
        return
    }

    val currentSession = session!!
    if (accountScreen) {
        AccountScreen(
            session = currentSession,
            entitlement = entitlement,
            message = message,
            onBack = { accountScreen = false },
            onRestore = { billing.restorePurchases() },
            onDelete = {
                scope.launch {
                    val ok = SupabaseApi.deleteAccount(currentSession)
                    if (ok) {
                        session = null
                        entitlement = Entitlement(false, "none", null)
                        accountScreen = false
                        message = "Konto wurde gelöscht. Ein Google-Play-Abo muss separat in Google Play gekündigt werden."
                    } else message = "Kontolöschung konnte nicht abgeschlossen werden. Bitte Support kontaktieren."
                }
            },
            onLogout = {
                session = null
                entitlement = Entitlement(false, "none", null)
                accountScreen = false
                message = ""
            }
        )
        return
    }

    if (!entitlement.active) {
        PaywallScreen(
            email = currentSession.email,
            price = billing.formattedPrice(),
            status = entitlement.status,
            message = message,
            onBuy = { billing.launchSubscription(currentSession) },
            onRestore = { billing.restorePurchases() },
            onRefresh = {
                scope.launch {
                    entitlement = SupabaseApi.getEntitlement(currentSession)
                    if (!entitlement.active) billing.restorePurchases()
                }
            },
            onAccount = { accountScreen = true }
        )
        return
    }

    Dashboard(
        email = currentSession.email,
        entitlement = entitlement,
        onModule = { selectedModule = it },
        onAccount = { accountScreen = true }
    )
}

@Composable
private fun LoginScreen(
    message: String,
    onLogin: (String, String) -> Unit,
    onSignup: (String, String) -> Unit,
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    Surface(Modifier.fillMaxSize()) {
        Column(
            Modifier.fillMaxSize().padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text("DefiDev EHS", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
            Text("Professionelle EHS-Werkzeuge in einer App", color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(24.dp))
            OutlinedTextField(email, { email = it.trim().take(160) }, label = { Text("E-Mail") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(password, { password = it.take(128) }, label = { Text("Passwort") }, singleLine = true, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(14.dp))
            Button(onClick = { onLogin(email, password) }, enabled = email.contains('@') && password.length >= 6, modifier = Modifier.fillMaxWidth()) { Text("Anmelden") }
            OutlinedButton(onClick = { onSignup(email, password) }, enabled = email.contains('@') && password.length >= 8, modifier = Modifier.fillMaxWidth()) { Text("Konto erstellen") }
            if (message.isNotBlank()) { Spacer(Modifier.height(12.dp)); Text(message, style = MaterialTheme.typography.bodySmall) }
            Spacer(Modifier.height(18.dp))
            Text("Mit der Registrierung gelten Datenschutzerklärung und Nutzungsbedingungen.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun PaywallScreen(
    email: String,
    price: String?,
    status: String,
    message: String,
    onBuy: () -> Unit,
    onRestore: () -> Unit,
    onRefresh: () -> Unit,
    onAccount: () -> Unit,
) {
    Column(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) { Text("EHS Pro", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold); Text(email) }
            TextButton(onClick = onAccount) { Text("Konto") }
        }
        Card(shape = RoundedCornerShape(24.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Ein Monatsabo für alle EHS-Module", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Text("BA Studio · Fluchtplan · Brandschutzordnung · Gefahrstoffkataster · Dokumentmanagement · Unfallmanagement")
                Text(price?.let { "$it / Monat" } ?: "Preis wird direkt aus Google Play geladen", style = MaterialTheme.typography.titleLarge)
                Text("Das Abo verlängert sich automatisch gemäß Google-Play-Kaufdialog und kann jederzeit in Google Play gekündigt werden.", style = MaterialTheme.typography.bodySmall)
                Button(onClick = onBuy, modifier = Modifier.fillMaxWidth()) { Text("EHS Pro abonnieren") }
                OutlinedButton(onClick = onRestore, modifier = Modifier.fillMaxWidth()) { Text("Kauf wiederherstellen") }
                TextButton(onClick = onRefresh, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text("Status aktualisieren") }
            }
        }
        Text("Aktueller Lizenzstatus: $status", style = MaterialTheme.typography.bodySmall)
        if (message.isNotBlank()) Text(message, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun Dashboard(email: String, entitlement: Entitlement, onModule: (Module) -> Unit, onAccount: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("DefiDev EHS", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
                Text("EHS Pro aktiv · $email", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            TextButton(onClick = onAccount) { Text("Konto") }
        }
        Spacer(Modifier.height(12.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(modules) { module ->
                Card(onClick = { onModule(module) }, shape = RoundedCornerShape(20.dp), modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(18.dp)) {
                        Text(module.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                        Text(module.subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
            item {
                Spacer(Modifier.height(8.dp))
                Text("Lizenz: ${entitlement.status}${entitlement.expiresAt?.let { " · bis $it" } ?: ""}", style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun AccountScreen(
    session: Session,
    entitlement: Entitlement,
    message: String,
    onBack: () -> Unit,
    onRestore: () -> Unit,
    onDelete: () -> Unit,
    onLogout: () -> Unit,
) {
    var confirmDelete by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        TextButton(onClick = onBack) { Text("‹ Zurück") }
        Text("Konto", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
        Text(session.email)
        Text("Abo-Status: ${entitlement.status}")
        OutlinedButton(onClick = onRestore, modifier = Modifier.fillMaxWidth()) { Text("Google-Play-Kauf wiederherstellen") }
        OutlinedButton(onClick = onLogout, modifier = Modifier.fillMaxWidth()) { Text("Abmelden") }
        HorizontalDivider()
        Text("Datenschutz: $PRIVACY_URL", style = MaterialTheme.typography.bodySmall)
        Text("Externer Löschweg: $DELETE_URL", style = MaterialTheme.typography.bodySmall)
        Button(
            onClick = { if (confirmDelete) onDelete() else confirmDelete = true },
            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
            modifier = Modifier.fillMaxWidth()
        ) { Text(if (confirmDelete) "Löschung endgültig bestätigen" else "Konto endgültig löschen") }
        if (confirmDelete) Text("Achtung: Die Kontolöschung kann nicht rückgängig gemacht werden. Ein Play-Abo wird dadurch nicht automatisch gekündigt.", style = MaterialTheme.typography.bodySmall)
        if (message.isNotBlank()) Text(message, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun ModuleWebView(module: Module, onBack: () -> Unit) {
    var webView: WebView? by remember { mutableStateOf(null) }
Column(Modifier.fillMaxSize()) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 8.dp)) {
            TextButton(onClick = onBack) { Text("‹ Module") }
            Text(module.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        }
        AndroidView(
            factory = { context ->
                WebView(context).apply {
                    webView = this
                    webViewClient = WebViewClient()
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    settings.allowFileAccess = false
                    settings.allowContentAccess = false
                    loadUrl(module.url)
                }
            },
            modifier = Modifier.fillMaxSize()
        )
    }
}

private object SupabaseApi {
    suspend fun signIn(email: String, password: String): Session? = withContext(Dispatchers.IO) {
        val body = JSONObject().put("email", email).put("password", password)
        val response = request("$SUPABASE_URL/auth/v1/token?grant_type=password", "POST", body, null)
        if (response.first !in 200..299) return@withContext null
        val json = JSONObject(response.second)
        val token = json.optString("access_token")
        val user = json.optJSONObject("user") ?: return@withContext null
        if (token.isBlank()) return@withContext null
        Session(token, user.optString("id"), user.optString("email", email))
    }

    suspend fun signUp(email: String, password: String): String = withContext(Dispatchers.IO) {
        val body = JSONObject().put("email", email).put("password", password)
        val response = request("$SUPABASE_URL/auth/v1/signup", "POST", body, null)
        when (response.first) {
            in 200..299 -> {
                val json = JSONObject(response.second)
                if (json.optString("access_token").isNotBlank()) "Konto erstellt. Du kannst dich jetzt anmelden."
                else "Konto erstellt. Bitte bestätige die E-Mail, falls Supabase eine Bestätigung versendet."
            }
            else -> runCatching { JSONObject(response.second).optString("msg") }.getOrDefault("Registrierung fehlgeschlagen.").ifBlank { "Registrierung fehlgeschlagen." }
        }
    }

    suspend fun getEntitlement(session: Session): Entitlement = withContext(Dispatchers.IO) {
        val url = "$SUPABASE_URL/rest/v1/ehs_subscriptions?select=status,expires_at&user_id=eq.${session.userId}&limit=1"
        val response = request(url, "GET", null, session.accessToken)
        if (response.first !in 200..299) return@withContext Entitlement(false, "none", null)
        val rows = JSONArray(response.second)
        if (rows.length() == 0) return@withContext Entitlement(false, "none", null)
        val row = rows.getJSONObject(0)
        val status = row.optString("status", "none")
        val expiry = row.optString("expires_at").takeIf { it.isNotBlank() && it != "null" }
        val active = status in setOf("active", "grace", "canceled") && (expiry == null || runCatching { java.time.Instant.parse(expiry).isAfter(java.time.Instant.now()) }.getOrDefault(false))
        Entitlement(active, status, expiry)
    }

    suspend fun verifyPurchase(session: Session, purchaseToken: String): Entitlement? = withContext(Dispatchers.IO) {
        val body = JSONObject().put("packageName", PACKAGE_NAME).put("purchaseToken", purchaseToken)
        val response = request("$SUPABASE_URL/functions/v1/verify-play-subscription", "POST", body, session.accessToken)
        if (response.first !in 200..299) return@withContext null
        val json = JSONObject(response.second)
        Entitlement(json.optBoolean("entitled", false), json.optString("status", "none"), json.optString("expiresAt").takeIf { it.isNotBlank() && it != "null" })
    }

    suspend fun deleteAccount(session: Session): Boolean = withContext(Dispatchers.IO) {
        val response = request("$SUPABASE_URL/functions/v1/delete-my-account", "POST", JSONObject(), session.accessToken)
        response.first in 200..299
    }

    private fun request(url: String, method: String, body: JSONObject?, token: String?): Pair<Int, String> {
        return runCatching {
            val connection = URL(url).openConnection() as HttpURLConnection
            connection.requestMethod = method
            connection.connectTimeout = 12_000
            connection.readTimeout = 12_000
            connection.setRequestProperty("apikey", SUPABASE_KEY)
            connection.setRequestProperty("Content-Type", "application/json")
            if (!token.isNullOrBlank()) connection.setRequestProperty("Authorization", "Bearer $token")
            if (body != null && method != "GET") {
                connection.doOutput = true
                connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            connection.disconnect()
            code to text
        }.getOrElse { 599 to "" }
    }
}

private fun sha256(value: String): String = MessageDigest.getInstance("SHA-256")
    .digest(value.toByteArray(Charsets.UTF_8))
    .joinToString("") { "%02x".format(it) }
