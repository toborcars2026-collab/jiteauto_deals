# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /Users/android/sdk/tools/proguard/proguard-android.txt

# Keep Firebase Firestore models from being obfuscated or stripped
-keepattributes *Annotation*
-keepclassmembers class * {
    @com.google.firebase.firestore.** *;
}
-keep class com.jiteautodeals.app.data.model.** { *; }
-keepclassmembers class com.jiteautodeals.app.data.model.** {
    <fields>;
    <init>(...);
}

# Kotlin Coroutines and Reflection rules
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
