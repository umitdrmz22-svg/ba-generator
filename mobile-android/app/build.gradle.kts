plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.defidev.ehs"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.defidev.ehs"
        minSdk = 29
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures { compose = true }
}

val releaseKeystorePath = System.getenv("ANDROID_KEYSTORE_PATH").orEmpty()
val releaseKeystorePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD").orEmpty()
val releaseKeyAlias = System.getenv("ANDROID_KEY_ALIAS").orEmpty()
val releaseKeyPassword = System.getenv("ANDROID_KEY_PASSWORD").orEmpty()
val releaseSigningReady = listOf(releaseKeystorePath, releaseKeystorePassword, releaseKeyAlias, releaseKeyPassword).all { it.isNotBlank() }

android {
    if (releaseSigningReady) {
        val uploadSigning = signingConfigs.create("release") {
            storeFile = file(releaseKeystorePath)
            storePassword = releaseKeystorePassword
            keyAlias = releaseKeyAlias
            keyPassword = releaseKeyPassword
        }
        buildTypes.named("release") { signingConfig = uploadSigning }
    }
}

kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2026.04.01")
    implementation(composeBom)
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("com.android.billingclient:billing:9.1.0")
    testImplementation("junit:junit:4.13.2")
    debugImplementation("androidx.compose.ui:ui-tooling")
}
