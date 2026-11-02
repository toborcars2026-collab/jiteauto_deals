package com.jiteautodeals.app.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val DarkColorScheme = darkColorScheme(
    primary = Gold500,
    onPrimary = Navy950,
    primaryContainer = Navy800,
    onPrimaryContainer = Gold400,
    secondary = GoldMetallic,
    onSecondary = Navy950,
    background = Navy950,
    onBackground = White,
    surface = Navy900,
    onSurface = White,
    surfaceVariant = Navy800,
    onSurfaceVariant = Slate400,
    outline = Slate700
)

private val LightColorScheme = lightColorScheme(
    primary = Navy900,
    onPrimary = Gold400,
    primaryContainer = Gold500,
    onPrimaryContainer = Navy950,
    secondary = Gold600,
    onSecondary = White,
    background = Slate50,
    onBackground = Navy950,
    surface = White,
    onSurface = Navy950,
    surfaceVariant = Slate100,
    onSurfaceVariant = Slate600,
    outline = Slate200
)

@Composable
fun JiteAutoDealsTheme(
    darkTheme: Boolean = true, // Default to executive deep blue dark theme
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = Navy900.toArgb()
            window.navigationBarColor = Navy900.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}
