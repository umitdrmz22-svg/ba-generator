from pathlib import Path
import re

p = Path('mobile-android/app/src/main/java/com/defidev/ehs/MainActivity.kt')
s = p.read_text()

old = '''private data class Entitlement(
    val productId: String,
    val active: Boolean,
    val status: String,
    val expiresAt: String?,
)'''
new = '''private data class Entitlement(
    val productId: String,
    val active: Boolean,
    val status: String,
    val expiresAt: String?,
    val mode: String = "edit",
    val sources: List<String> = emptyList(),
    val works: List<String> = emptyList(),
)'''
if old in s:
    s = s.replace(old, new, 1)
elif 'val sources: List<String> = emptyList()' not in s:
    raise SystemExit('Entitlement data class pattern not found')

old = '''                    if (verified != null) {
                        entitlements = entitlements + (verified.productId to verified)
                        val moduleTitle = modules.firstOrNull { it.productId == verified.productId }?.title ?: "EHS"
                        message = if (verified.active) "$moduleTitle wurde freigeschaltet." else "Abonnementstatus wurde aktualisiert."
                    } else {'''
new = '''                    if (verified != null) {
                        entitlements = SupabaseApi.getEntitlements(activeSession)
                        val moduleTitle = modules.firstOrNull { it.productId == verified.productId }?.title ?: "EHS"
                        message = if (verified.active) "$moduleTitle wurde freigeschaltet." else "Abonnementstatus wurde aktualisiert."
                    } else {'''
if old in s:
    s = s.replace(old, new, 1)
elif 'entitlements = SupabaseApi.getEntitlements(activeSession)' not in s:
    raise SystemExit('Purchase handler pattern not found')

s = s.replace(
    'Text("EHS-Module einzeln abonnieren", color = MaterialTheme.colorScheme.onSurfaceVariant)',
    'Text("Einzelabo oder Firmen-/Werk-Lizenz", color = MaterialTheme.colorScheme.onSurfaceVariant)',
    1,
)
s = s.replace(
    'val legacyAccess = entitlements[LEGACY_ALL_ACCESS_PRODUCT]?.active == true',
    'val legacyAccess = entitlements.values.any { "legacy_all_access" in it.sources }',
    1,
)

old = '''                            Text(
                                entitlement?.expiresAt?.let { "Abo aktiv bis $it" } ?: "Monatsabo aktiv",
                                style = MaterialTheme.typography.bodySmall,
                            )'''
new = '''                            val accessText = when {
                                entitlement == null -> "Lizenz aktiv"
                                "corporate_werk" in entitlement.sources && entitlement.mode == "read" ->
                                    "Firmenlizenz · Leser${entitlement.works.firstOrNull()?.let { " · $it" } ?: ""}"
                                "corporate_werk" in entitlement.sources ->
                                    "Firmenlizenz · Bearbeiter${entitlement.works.firstOrNull()?.let { " · $it" } ?: ""}"
                                "legacy_all_access" in entitlement.sources -> "Legacy EHS Pro"
                                entitlement.expiresAt != null -> "Google-Play-Abo aktiv bis ${entitlement.expiresAt}"
                                else -> "Google-Play-Monatsabo aktiv"
                            }
                            Text(accessText, style = MaterialTheme.typography.bodySmall)'''
if old in s:
    s = s.replace(old, new, 1)
elif 'val accessText = when {' not in s:
    raise SystemExit('Dashboard active-license block not found')

old = '''        activeModules.forEach { module ->
            Text("• ${module.title}", style = MaterialTheme.typography.bodySmall)
        }'''
new = '''        activeModules.forEach { module ->
            val access = entitlements[module.productId]
            val suffix = when {
                access == null -> ""
                "corporate_werk" in access.sources && access.mode == "read" -> " · Firmenlizenz / Leser"
                "corporate_werk" in access.sources -> " · Firmenlizenz / Bearbeiter"
                else -> " · Google Play"
            }
            Text("• ${module.title}$suffix", style = MaterialTheme.typography.bodySmall)
        }'''
if old in s:
    s = s.replace(old, new, 1)
elif 'Firmenlizenz / Leser' not in s:
    raise SystemExit('Account active-module block not found')

pattern = re.compile(
    r'''    suspend fun getEntitlements\(session: Session\): Map<String, Entitlement> = withContext\(Dispatchers.IO\) \{.*?\n    \}\n\n    suspend fun verifyPurchase''',
    re.S,
)
replacement = '''    suspend fun getEntitlements(session: Session): Map<String, Entitlement> = withContext(Dispatchers.IO) {
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

    suspend fun verifyPurchase'''
if '/functions/v1/get-ehs-entitlements' not in s:
    s2, n = pattern.subn(replacement, s, count=1)
    if n != 1:
        raise SystemExit(f'getEntitlements replacement count={n}')
    s = s2

p.write_text(s)
print('Corporate Android patch applied')
