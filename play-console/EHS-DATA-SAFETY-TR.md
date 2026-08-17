# DefiDev EHS – Google Play Data Safety taslağı

**Kontrol tarihi:** 17.08.2026  
**Android package:** `com.defidev.ehs`

## Mimari
DefiDev EHS reklam göstermez ve Android uygulamasında AdMob/Google Mobile Ads SDK bulunmaz. Uygulama Supabase tabanlı kimlik doğrulama/kurumsal veri altyapısı ve Google Play Billing kullanır. Web ve Android istemciler aynı kullanıcı hesabı, Werk yetkileri ve EHS verileriyle çalışır.

## Google Play Data Safety – toplanan veri kategorileri
Aşağıdaki veriler kullanıcı EHS hesabını ve ilgili modülleri kullandığında cihaz dışındaki DefiDev/Supabase altyapısına iletilir; bu nedenle Play formunda **toplanan veri** olarak değerlendirilmelidir:

- **Kişisel bilgiler → E-posta adresi**: kayıt, giriş, davet, hesap/lisans yönetimi. Amaçlar: **Uygulama işlevselliği**, **Hesap yönetimi**, **Dolandırıcılığı önleme, güvenlik ve uyumluluk**.
- **Kişisel bilgiler → Kullanıcı kimlikleri (User IDs)**: Supabase kullanıcı kimliği ve kullanıcı/Werk üyelik ilişkisi. Amaçlar: **Uygulama işlevselliği**, **Hesap yönetimi**, **Güvenlik/uyumluluk**.
- **Dosyalar ve dokümanlar**: kullanıcı tarafından DMS/EHS modüllerine yüklenen veya oluşturulan belgeler, sürümler ve dosya adları. Amaç: **Uygulama işlevselliği**.
- **Diğer kullanıcı tarafından oluşturulan içerik / uygulama içeriği**: Betriebsanweisung, Gefahrstoff, Brandschutz-/Fluchtplan, Unfall-/Maßnahmen ve diğer EHS kayıtlarının kullanıcı tarafından girilen metinsel/işletmesel içeriği. Amaç: **Uygulama işlevselliği**.

Kurumsal kullanıcılar kendi işletmelerine ait personel/olay verisi girebilir. Uygulama yalnız ilgili Werk/rol/lisans bağlamındaki veriyi erişilebilir kılar. Hassas veya özel nitelikli kişisel veriler yalnız gerekli hukuki/betriebliche yetki bulunduğunda girilmelidir.

## Google Play Billing
Ödeme kartı/banka bilgisi DefiDev tarafından toplanmaz. Google Play ödemeyi işler. DefiDev sunucusu yalnız ürün kimliği, purchase token/kaufnachweis, abonelik durumu ve süre bilgilerini lisans doğrulama ve kötüye kullanım önleme amacıyla işler.

## Paylaşım
Supabase altyapısı DefiDev adına hizmet sağlayıcı/işleyen olarak kullanılır. Google Play Data Safety formundaki **sharing** cevabı, yayın anındaki geçerli sözleşme/DPA ve Google Play'in hizmet sağlayıcı istisnası kullanılarak kesinleştirilmelidir. Kurumsal EHS verileri reklamcılarla paylaşılmaz ve reklam profillemesi yapılmaz.

## Güvenlik
- Android manifestinde cleartext trafik kapalıdır; ağ iletişimi HTTPS/TLS üzerinden yapılır.
- Werk/rol/lisans yetkileri backend RLS ve server-side entitlement kontrolleriyle uygulanır.
- Google Play satın alma hakkı backend'de doğrulanmadan entitlement verilmez.
- Android WebView yalnız ilgili EHS GitHub Pages modül köküne HTTPS navigasyona izin verir; file/content access ve mixed content kapalıdır; harici HTTPS/mail bağlantıları sistem uygulamasına çıkarılır.
- `allowBackup=false`.

## Hesap silme
- Uygulama içinde kalıcı hesap silme akışı vardır.
- Harici web silme yolu: `defidev-legal/delete-ehs-account.html`.
- Kişisel, paylaşılmayan EHS organizasyonu ve kişisel DMS dosyaları hesapla birlikte temizlenir.
- Firma/Werk kayıtları bir çalışan hesabı silindi diye yok edilmez; kullanıcı üyeliği/referansı kaldırılır veya anonimleştirilir, işletme kaydı gerekli saklama amacı kapsamında korunabilir.
- Google Play aboneliği hesap silmeyle otomatik iptal olmaz; Play üzerinden ayrıca yönetilir.

## Console için başlangıç cevapları
- Uygulama kullanıcı verisi topluyor mu? → **Evet**.
- Uygulama reklam içeriyor mu? → **Hayır**.
- Veri aktarım sırasında şifreleniyor mu? → **Evet**.
- Kullanıcı veri silme talebi oluşturabiliyor mu? → **Evet**, uygulama içi + harici web.
- E-posta / User IDs → **Toplanır**, hesap ve uygulama işlevi için.
- Files and docs / EHS kullanıcı içeriği → **Toplanır**, uygulama işlevi için.
- Hassas EHS içeriğinin kesin Play kategorileri, final AAB ve gerçekten etkin modüllerle Console gönderiminden hemen önce son kez eşleştirilmelidir.

## Son kontrol
Bu dosya Console formunun taslağıdır. Gönderimden önce `privacy-ehs.html`, Supabase DPA/alt işleyen bilgileri, Google Play Billing veri akışı, yüklenen AAB ve Play'in güncel Data Safety tanımları birlikte kontrol edilmelidir.
