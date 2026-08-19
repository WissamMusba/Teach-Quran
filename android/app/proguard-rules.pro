# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# ============================================================
# [PERF-CHANGE-2] — rules attached to enabling R8 in release builds
# (build.gradle: enableProguardInReleaseBuilds = true). These keep rules
# cover the native modules whose classes are looked up by REFLECTION from
# the React Native bridge (R8 would otherwise rename/strip them and the
# bridge would fail to find them on a low-end device -> native crash at
# module init). EASY TO REVERT: set enableProguardInReleaseBuilds = false
# in android/app/build.gradle (as it was in release v87, commit bed0baf).
# ============================================================

# --- React Native core + bridge internals ---
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keepclassmembers class * { @com.facebook.react.uimanager.annotations.ReactProp <methods>; }
-keepclassmembers class * { @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>; }

# --- Native modules (package names verified from each library's build.gradle namespace) ---
-keep class org.pgsqlite.** { *; }
-keep class io.liteglue.** { *; }
-keep class com.rnfs.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.swmansion.rnscreens.** { *; }
-keep class com.th3rdwave.safeareacontext.** { *; }
-keep class com.horcrux.svg.** { *; }
-keep class org.linusu.** { *; }
-keep class com.dooboolab.audiorecorderplayer.** { *; }
-keep class com.reactnativecommunity.slider.** { *; }
-keep class com.reactnativecommunity.asyncstorage.** { *; }
-keep class com.mkuczera.haptic.** { *; }
-keep class com.BV.LinearGradient.** { *; }
-keep class fr.greweb.reactnativeviewshot.** { *; }
-keep class cl.json.** { *; }
-keep class io.invertase.googlemobileads.** { *; }

# --- Firebase (auth / firestore / storage) ---
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# --- OkHttp / Okio (Firebase networking) ---
-dontwarn okhttp3.**
-dontwarn okio.**

# --- Debug-only support classes that otherwise trip R8 ---
-dontwarn com.facebook.react.devsupport.**
-dontwarn com.facebook.debug.**

# --- Native methods on every module ---
-keepclasseswithmembers class * { native <methods>; }
