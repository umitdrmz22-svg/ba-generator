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
private const val PACKAGE_NAME = "com.defidev.ehs"
private const val PRIVACY_URL = "https://umitdrmz22-svg.github.io/defidev-legal/privacy-ehs.html"
private const val DELETE_URL = "https://umitdrmz22-svg.github.io/defidev-legal/delete-ehs-account.html"
private const val LEGACY_ALL_ACCESS_PRODUCT = "ehs_pro_monthly"
private const val FIXED_DE_PRICE = "4,99 € / Monat"

private data class Session(val accessToken: String, val userId: String, val email: String)
private data class Entitlement(
    val productId: String,
    val active: Boolean,
    val status: String,
    val expiresAt: String?,
    val mode: String = "edit",
    val sources: List<String> = emptyList(),
    val works: List<String> = emptyList(),
)
private data class Module(
    val key: String,
    val title: String,
    val subtitle: String,
    val url: String,
    val productId: String,
)

private val modules = listOf(
    Module("ba", "BA Studio", "Betriebsanweisungen", "https://umitdrmz22-svg.github.io/ba-generator/", "ehs_ba_monthly"),
    Module("fluchtplan", "Fluchtplan Studio", "Flucht- und Rettungspläne", "https://umitdrmz22-svg.github.io/fluchtplan-ai/", "ehs_fluchtplan_monthly"),
    Module("brandschutzordnung", "Brandschutzordnung Studio", "Brandschutzordnungen", "https://umitdrmz22-svg.github.io/brandschutzordnung-studio/", "ehs_brandschutzordnung_monthly"),
    Module("gefahrstoffkataster", "Gefahrstoffkataster", "Gefahrstoffe und Sicherheitsdaten", "https://umitdrmz22-svg.github.io/gefahrstoffkataster-online/", "ehs_gefahrstoffkataster_monthly"),
    Module("dokumentmanagement", "Dokumentmanagement", "EHS-Dokumente und Freigaben", "https://umitdrmz22-svg.github.io/dokumentmanagement-studio/", "ehs_dokumentmanagement_monthly"),
    Module("unfallmanagement", "Unfallmanagement", "Unfälle, 5-Why und Maßnahmen", "https://umitdrmz22-svg.github.io/Unfallmanagemet_studio/", "ehs_unfallmanagement_monthly"),
)
private val sellableProductIds = modules.map { it.productId }.toSet()
private val recognizedProductIds = sellableProductIds + LEGACY_ALL_ACCESS_PRODUCT

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
    var productDetails by mutableStateOf<Map<String, ProductDetails>>(emptyMap())
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
                    queryProducts()
                    onReady?.invoke()
                } else {
                    onMessage("Google Play Billing konnte nicht gestartet werden: ${result.debugMessage}")
                }
            }

            override fun onBillingServiceDisconnected() {
                connected = false
            }
        })
    }

    private fun queryProducts() {
        val products = sellableProductIds.map { productId ->
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(productId)
                .setProductType(BillingClient.ProductType.SUBS)
                .build()
        }
        val params = QueryProductDetailsParams.newBuilder().setProductList(products).build()
        client.queryProductDetailsAsync(params) { result, queryResult ->
            if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                productDetails = queryResult.productDetailsList.associateBy { it.productId }
            }
        }
    }

    fun restorePurchases() {
        if (!connected) { start { restorePurchases() }; return }
        val params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.SUBS)
            .build()
        client.queryPurchasesAsync(params) { result, purchases ->
            if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                purchases
                    .filter { purchase ->
                        purchase.purchaseState == Purchase.PurchaseState.PURCHASED &&
                            purchase.products.any { it in recognizedProductIds }
                    }
                    .forEach(onPurchase)
            }
        }
    }

    fun launchSubscription(session: Session, module: Module) {
        if (!connected) { start { launchSubscription(session, module) }; return }
        val details = productDetails[module.productId] ?: run {
            queryProducts()
            onMessage("Abonnementdaten werden geladen. Bitte erneut versuchen.")
            return
        }
        val offerToken = details.subscriptionOfferDetails?.firstOrNull()?.offerToken ?: run {
            onMessage("Für ${module.title} ist in Google Play noch kein aktiver Monats-Basistarif hinterlegt.")
            return
        }
        val productParams = BillingFlowParams.ProductDetailsParams.newBuilder()
            .setProductDetails(details)
            .setOfferToken(offerToken)
            .build()
        val params = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(listOf(productParams))
            .setObfuscatedAccountId(sha256(session.userId))
            .build()
        val result = client.launchBillingFlow(activity, params)
        if (result.responseCode != BillingClient.BillingResponseCode.OK) {
            onMessage(result.debugMessage)
        }
    }

    fun formattedPrice(productId: String): String? = productDetails[productId]
        ?.subscriptionOfferDetails
        ?.firstOrNull()
        ?.pricingPhases
        ?.pricingPhaseList
        ?.lastOrNull()
        ?.formattedPrice

    override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
        when (result.responseCode) {
            BillingClient.BillingResponseCode.OK -> purchases.orEmpty()
                .filter { purchase ->
                    purchase.purchaseState == Purchase.PurchaseState.PURCHASED &&
                        purchase.products.any { it in recognizedProductIds }
                }
                .forEach(onPurchase)
            BillingClient.BillingResponseCode.USER_CANCELED -> Unit
            else -> onMessage("Kauf konnte nicht abgeschlossen werden: ${result.debugMessage}")
        }
    }

    fun close() {
        client.endConnection()
    }
}

private fun hasAccess(module: Module, entitlements: Map<String, Entitlement>): Boolean =
    entitlements[LEGACY_ALL_ACCESS_PRODUCT]?.active == true ||
        entitlements[module.productId]?.active == true

@Composable
private fun EhsApp(activity: Activity) {
    val scope = rememberCoroutineScope()
    var session by remember { mutableStateOf<Session?>(null) }
    var entitlements by remember { mutableStateOf<Map<String, Entitlement>>(emptyMap()) }
    var message by remember { mutableStateOf("") }
    var selectedModule by remember { mutableStateOf<Module?>(null) }
    var accountScreen by remember { mutableStateOf(false) }

    val billing = remember {
        BillingManager(
            activity,
            onPurchase = purchaseHandler@{ purchase ->
                val activeSession = session ?: return@purchaseHandler
                val productId = purchase.products.firstOrNull { it in recognizedProductIds }
                    ?: return@purchaseHandler
                scope.launch {
                    val verified = SupabaseApi.verifyPurchase(activeSession, productId, purchase.purchaseToken)
                    if (verified != null) {
                        entitlements = SupabaseApi.getEntitlements(activeSession)
                        val moduleTitle = modules.firstOrNull { it.productId == verified.productId }?.title ?: "EHS"
                        message = if (verified.active) "$moduleTitle wurde freigeschaltet." else "Abonnementstatus wurde aktualisiert."
                    } else {
                        message = "Der Kauf konnte noch nicht verifiziert werden."
                    }
                }
            },
            onMessage = { message = it },
        )
    }

    DisposableEffect(Unit) {
        billing.start()
        onDispose { billing.close() }
    }

    selectedModule?.let { module ->
        ModuleWebView(module, session?.accessToken.orEmpty()) { selectedModule = null }
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
                        entitlements = SupabaseApi.getEntitlements(result)
                        message = ""
                        billing.restorePurchases()
                    } else {
                        message = "Anmeldung fehlgeschlagen. E-Mail und Passwort prüfen."
                    }
                }
            },
            onSignup = { email, password ->
                scope.launch { message = SupabaseApi.signUp(email, password) }
            },
        )
        return
    }

    val currentSession = session!!
    if (accountScreen) {
        AccountScreen(
            session = currentSession,
            entitlements = entitlements,
            message = message,
            onBack = { accountScreen = false },
            onRestore = { billing.restorePurchases() },
            onRefresh = {
                scope.launch {
                    entitlements = SupabaseApi.getEntitlements(currentSession)
                    billing.restorePurchases()
                }
            },
            onDelete = {
                scope.launch {
                    val ok = SupabaseApi.deleteAccount(currentSession)
                    if (ok) {
                        session = null
                        entitlements = emptyMap()
                        accountScreen = false
                        message = "Konto wurde gelöscht. Laufende Google-Play-Abos müssen separat in Google Play gekündigt werden."
                    } else {
                        message = "Kontolöschung konnte nicht abgeschlossen werden. Bitte Support kontaktieren."
                    }
                }
            },
            onLogout = {
                session = null
                entitlements = emptyMap()
                accountScreen = false
                message = ""
            },
        )
        return
    }

    Dashboard(
        email = currentSession.email,
        entitlements = entitlements,
        message = message,
        priceFor = { productId -> billing.formattedPrice(productId) },
        onModule = { module ->
            if (hasAccess(module, entitlements)) selectedModule = module
        },
        onSubscribe = { module -> billing.launchSubscription(currentSession, module) },
        onRestore = { billing.restorePurchases() },
        onRefresh = {
            scope.launch {
                entitlements = SupabaseApi.getEntitlements(currentSession)
                billing.restorePurchases()
            }
        },
        onAccount = { accountScreen = true },
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
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text("DefiDev EHS", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
            Text("Einzelabo oder Firmen-/Werk-Lizenz", color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(24.dp))
            OutlinedTextField(
                value = email,
                onValueChange = { email = it.trim().take(160) },
                label = { Text("E-Mail") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(
                value = password,
                onValueChange = { password = it.take(128) },
                label = { Text("Passwort") },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(14.dp))
            Button(
                onClick = { onLogin(email, password) },
                enabled = email.contains('@') && password.length >= 6,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Anmelden") }
            OutlinedButton(
                onClick = { onSignup(email, password) },
                enabled = email.contains('@') && password.length >= 8,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Konto erstellen") }
            if (message.isNotBlank()) {
                Spacer(Modifier.height(12.dp))
                Text(message, style = MaterialTheme.typography.bodySmall)
            }
            Spacer(Modifier.height(18.dp))
            Text(
                "Mit der Registrierung gelten Datenschutzerklärung und Nutzungsbedingungen.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun Dashboard(
    email: String,
    entitlements: Map<String, Entitlement>,
    message: String,
    priceFor: (String) -> String?,
    onModule: (Module) -> Unit,
    onSubscribe: (Module) -> Unit,
    onRestore: () -> Unit,
    onRefresh: () -> Unit,
    onAccount: () -> Unit,
) {
    val legacyAccess = entitlements.values.any { "legacy_all_access" in it.sources }
    val activeCount = modules.count { hasAccess(it, entitlements) }
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("DefiDev EHS", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
                Text("$activeCount von ${modules.size} Modulen aktiv · $email", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            TextButton(onClick = onAccount) { Text("Konto") }
        }
        if (legacyAccess) {
            Spacer(Modifier.height(8.dp))
            Text("Legacy EHS Pro: Alle Module freigeschaltet", style = MaterialTheme.typography.bodySmall)
        }
        if (message.isNotBlank()) {
            Spacer(Modifier.height(8.dp))
            Text(message, style = MaterialTheme.typography.bodySmall)
        }
        Spacer(Modifier.height(12.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(modules) { module ->
                val active = hasAccess(module, entitlements)
                val entitlement = entitlements[module.productId]
                Card(
                    onClick = { if (active) onModule(module) },
                    shape = RoundedCornerShape(20.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(module.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                                Text(module.subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Text(if (active) "Aktiv" else "Gesperrt", style = MaterialTheme.typography.labelLarge)
                        }
                        if (active) {
                            val accessText = when {
                                entitlement == null -> "Lizenz aktiv"
                                "corporate_werk" in entitlement.sources && entitlement.mode == "read" ->
                                    "Firmenlizenz · Leser${entitlement.works.firstOrNull()?.let { " · $it" } ?: ""}"
                                "corporate_werk" in entitlement.sources ->
                                    "Firmenlizenz · Bearbeiter${entitlement.works.firstOrNull()?.let { " · $it" } ?: ""}"
                                "legacy_all_access" in entitlement.sources -> "Legacy EHS Pro"
                                entitlement.expiresAt != null -> "Google-Play-Abo aktiv bis ${entitlement.expiresAt}"
                                else -> "Google-Play-Monatsabo aktiv"
                            }
                            Text(accessText, style = MaterialTheme.typography.bodySmall)
                            Button(onClick = { onModule(module) }, modifier = Modifier.fillMaxWidth()) {
                                Text("Modul öffnen")
                            }
                        } else {
                            val price = priceFor(module.productId)
                            Text(
                                price?.let { "$it / Monat" } ?: FIXED_DE_PRICE,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                            )
                            Text(
                                "Monatlich kündbar. Automatische Verlängerung gemäß Google-Play-Kaufdialog.",
                                style = MaterialTheme.typography.bodySmall,
                            )
                            Button(onClick = { onSubscribe(module) }, modifier = Modifier.fillMaxWidth()) {
                                Text("${module.title} abonnieren")
                            }
                        }
                    }
                }
            }
            item {
                Spacer(Modifier.height(4.dp))
                OutlinedButton(onClick = onRestore, modifier = Modifier.fillMaxWidth()) {
                    Text("Google-Play-Abos wiederherstellen")
                }
                TextButton(onClick = onRefresh, modifier = Modifier.fillMaxWidth()) {
                    Text("Lizenzstatus aktualisieren")
                }
            }
        }
    }
}

@Composable
private fun AccountScreen(
    session: Session,
    entitlements: Map<String, Entitlement>,
    message: String,
    onBack: () -> Unit,
    onRestore: () -> Unit,
    onRefresh: () -> Unit,
    onDelete: () -> Unit,
    onLogout: () -> Unit,
) {
    var confirmDelete by remember { mutableStateOf(false) }
    val activeModules = modules.filter { hasAccess(it, entitlements) }
    Column(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        TextButton(onClick = onBack) { Text("‹ Zurück") }
        Text("Konto", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
        Text(session.email)
        Text("Aktive Module: ${activeModules.size} / ${modules.size}")
        activeModules.forEach { module ->
            val access = entitlements[module.productId]
            val suffix = when {
                access == null -> ""
                "corporate_werk" in access.sources && access.mode == "read" -> " · Firmenlizenz / Leser"
                "corporate_werk" in access.sources -> " · Firmenlizenz / Bearbeiter"
                else -> " · Google Play"
            }
            Text("• ${module.title}$suffix", style = MaterialTheme.typography.bodySmall)
        }
        OutlinedButton(onClick = onRestore, modifier = Modifier.fillMaxWidth()) {
            Text("Google-Play-Abos wiederherstellen")
        }
        TextButton(onClick = onRefresh, modifier = Modifier.fillMaxWidth()) {
            Text("Status aktualisieren")
        }
        OutlinedButton(onClick = onLogout, modifier = Modifier.fillMaxWidth()) {
            Text("Abmelden")
        }
        HorizontalDivider()
        val context = androidx.compose.ui.platform.LocalContext.current
        OutlinedButton(
            onClick = { runCatching { context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(PRIVACY_URL))) } },
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Datenschutz öffnen") }
        OutlinedButton(
            onClick = { runCatching { context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(DELETE_URL))) } },
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Externen Löschweg öffnen") }
        Button(
            onClick = { if (confirmDelete) onDelete() else confirmDelete = true },
            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(if (confirmDelete) "Löschung endgültig bestätigen" else "Konto endgültig löschen")
        }
        if (confirmDelete) {
            Text(
                "Achtung: Die Kontolöschung kann nicht rückgängig gemacht werden. Laufende Play-Abos werden dadurch nicht automatisch gekündigt.",
                style = MaterialTheme.typography.bodySmall,
            )
        }
        if (message.isNotBlank()) Text(message, style = MaterialTheme.typography.bodySmall)
    }
}

private fun isAllowedModuleNavigation(module: Module, uri: android.net.Uri): Boolean {
    val root = android.net.Uri.parse(module.url)
    val rootPath = root.path.orEmpty().ifBlank { "/" }
    val path = uri.path.orEmpty().ifBlank { "/" }
    return uri.scheme.equals("https", ignoreCase = true) &&
        uri.host.equals(root.host, ignoreCase = true) &&
        path.startsWith(rootPath)
}

private fun openExternalModuleLink(context: android.content.Context, uri: android.net.Uri) {
    if (uri.scheme.equals("https", ignoreCase = true) || uri.scheme.equals("mailto", ignoreCase = true)) {
        runCatching {
            context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, uri).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK))
        }
    }
}

@Composable
private fun ModuleWebView(module: Module, accessToken: String, onBack: () -> Unit) {
    var activeWebView by remember(module.key) { mutableStateOf<WebView?>(null) }
    DisposableEffect(module.key) {
        onDispose {
            activeWebView?.apply {
                stopLoading()
                loadUrl("about:blank")
                clearHistory()
                removeAllViews()
                destroy()
            }
            activeWebView = null
        }
    }
    Column(Modifier.fillMaxSize()) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 8.dp)) {
            TextButton(onClick = onBack) { Text("‹ Module") }
            Text(module.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        }
        AndroidView(
            factory = { context ->
                WebView(context).apply {
                    activeWebView = this
                    webViewClient = object : WebViewClient() {
                        private fun handle(uri: android.net.Uri): Boolean {
                            if (isAllowedModuleNavigation(module, uri)) return false
                            openExternalModuleLink(context.applicationContext, uri)
                            return true
                        }
                        override fun shouldOverrideUrlLoading(view: WebView?, request: android.webkit.WebResourceRequest?): Boolean =
                            request?.url?.let(::handle) ?: true
                        @Suppress("DEPRECATION")
                        override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean =
                            url?.let { runCatching { android.net.Uri.parse(it) }.getOrNull() }?.let(::handle) ?: true
                    }
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    settings.allowFileAccess = false
                    settings.allowContentAccess = false
                    @Suppress("DEPRECATION")
                    settings.allowFileAccessFromFileURLs = false
                    @Suppress("DEPRECATION")
                    settings.allowUniversalAccessFromFileURLs = false
                    settings.javaScriptCanOpenWindowsAutomatically = false
                    settings.setSupportMultipleWindows(false)
                    settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
                    settings.mediaPlaybackRequiresUserGesture = true
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) settings.safeBrowsingEnabled = true
                    WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
                    val targetUrl = if (accessToken.isBlank()) module.url else
                        "${module.url}#ehs_token=${android.net.Uri.encode(accessToken)}"
                    loadUrl(targetUrl)
                }
            },
            modifier = Modifier.fillMaxSize(),
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
                if (json.optString("access_token").isNotBlank()) {
                    "Konto erstellt. Du kannst dich jetzt anmelden."
                } else {
                    "Konto erstellt. Bitte bestätige die E-Mail, falls Supabase eine Bestätigung versendet."
                }
            }
            else -> runCatching { JSONObject(response.second).optString("msg") }
                .getOrDefault("Registrierung fehlgeschlagen.")
                .ifBlank { "Registrierung fehlgeschlagen." }
        }
    }

    suspend fun getEntitlements(session: Session): Map<String, Entitlement> = withContext(Dispatchers.IO) {
        val response = request(
            "$SUPABASE_URL/functions/v1/get-ehs-entitlements",
            "GET",
            null,
            session.accessToken,
        )
        if (response.first !in 200..299) return@withContext emptyMap()
        val root = runCatching { JSONObject(response.second) }.getOrNull() ?: return@withContext emptyMap()
        val rows = root.optJSONArray("modules") ?: return@withContext emptyMap()
        buildMap {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                val productId = row.optString("productId")
                if (productId !in sellableProductIds) continue
                val sourcesArray = row.optJSONArray("sources") ?: JSONArray()
                val sources = buildList {
                    for (i in 0 until sourcesArray.length()) add(sourcesArray.optString(i))
                }.filter { it.isNotBlank() }
                val worksArray = row.optJSONArray("works") ?: JSONArray()
                val works = buildList {
                    for (i in 0 until worksArray.length()) {
                        val werk = worksArray.optJSONObject(i) ?: continue
                        val name = werk.optString("name")
                        val code = werk.optString("code")
                        val label = if (code.isNotBlank()) "$name ($code)" else name
                        if (label.isNotBlank()) add(label)
                    }
                }
                val active = row.optBoolean("active", false)
                val expiresAt = row.optString("expiresAt").takeIf { it.isNotBlank() && it != "null" }
                put(
                    productId,
                    Entitlement(
                        productId = productId,
                        active = active,
                        status = if (active) "active" else "none",
                        expiresAt = expiresAt,
                        mode = row.optString("mode", if (active) "edit" else "none"),
                        sources = sources,
                        works = works,
                    ),
                )
            }
        }
    }

    suspend fun verifyPurchase(
        session: Session,
        productId: String,
        purchaseToken: String,
    ): Entitlement? = withContext(Dispatchers.IO) {
        if (productId !in recognizedProductIds) return@withContext null
        val body = JSONObject()
            .put("packageName", PACKAGE_NAME)
            .put("productId", productId)
            .put("purchaseToken", purchaseToken)
        val response = request(
            "$SUPABASE_URL/functions/v1/verify-play-subscription",
            "POST",
            body,
            session.accessToken,
        )
        if (response.first !in 200..299) return@withContext null
        val json = JSONObject(response.second)
        val verifiedProduct = json.optString("productId")
        if (verifiedProduct !in recognizedProductIds) return@withContext null
        Entitlement(
            productId = verifiedProduct,
            active = json.optBoolean("entitled", false),
            status = json.optString("status", "none"),
            expiresAt = json.optString("expiresAt").takeIf { it.isNotBlank() && it != "null" },
        )
    }

    suspend fun deleteAccount(session: Session): Boolean = withContext(Dispatchers.IO) {
        val response = request(
            "$SUPABASE_URL/functions/v1/delete-my-account",
            "POST",
            JSONObject(),
            session.accessToken,
        )
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
