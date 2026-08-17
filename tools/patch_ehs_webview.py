from pathlib import Path

p = Path('mobile-android/app/src/main/java/com/defidev/ehs/MainActivity.kt')
s = p.read_text()

old = '''        HorizontalDivider()
        Text("Datenschutz: $PRIVACY_URL", style = MaterialTheme.typography.bodySmall)
        Text("Externer Löschweg: $DELETE_URL", style = MaterialTheme.typography.bodySmall)
        Button(
'''
new = '''        HorizontalDivider()
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
'''
if old not in s:
    raise SystemExit('account block not found')
s = s.replace(old, new, 1)

old2 = '''@Composable
private fun ModuleWebView(module: Module, accessToken: String, onBack: () -> Unit) {
    Column(Modifier.fillMaxSize()) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 8.dp)) {
            TextButton(onClick = onBack) { Text("‹ Module") }
            Text(module.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        }
        AndroidView(
            factory = { context ->
                WebView(context).apply {
                    webViewClient = WebViewClient()
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    settings.allowFileAccess = false
                    settings.allowContentAccess = false
                    val targetUrl = if (accessToken.isBlank()) module.url else
                        "${module.url}#ehs_token=${android.net.Uri.encode(accessToken)}"
                    loadUrl(targetUrl)
                }
            },
            modifier = Modifier.fillMaxSize(),
        )
    }
}
'''
new2 = '''private fun isAllowedModuleNavigation(module: Module, uri: android.net.Uri): Boolean {
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
'''
if old2 not in s:
    raise SystemExit('webview block not found')
s = s.replace(old2, new2, 1)
p.write_text(s)
