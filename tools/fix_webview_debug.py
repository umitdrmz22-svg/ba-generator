from pathlib import Path
p=Path('mobile-android/app/src/main/java/com/defidev/ehs/MainActivity.kt')
s=p.read_text()
old='WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)'
new='WebView.setWebContentsDebuggingEnabled((context.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0)'
if old not in s:
    raise SystemExit('BuildConfig WebView debug expression not found')
p.write_text(s.replace(old,new,1))
