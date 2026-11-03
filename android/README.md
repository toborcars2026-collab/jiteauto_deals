# Jite Auto Deals — Official Native Android Mobile Application

**Slogan:** Your Trusted Vehicle Consultant  
**Package:** `com.jiteautodeals.app`  
**Target SDK:** Android 14 (API 34)  
**Min SDK:** Android 8.0 Oreo (API 26)  
**Architecture:** Kotlin • Jetpack Compose • Material 3 • Coroutines Flow • MVVM  
**Backend:** Firebase Cloud Firestore (Shared database: `ai-studio-jiteautodeals-74aa2960-b1e2-41ac-9714-42ee44c5712a`)

---

## 🏗️ Architecture & Shared Firebase Backend

The Android application operates as a native client connected directly to the **existing live Jite Auto Deals web infrastructure**:

| Entity | Firestore Collection | Action in Android App |
|---|---|---|
| **Vehicles** | `/vehicles` | Real-time live snapshot stream; any changes in the web admin panel reflect instantly in the app |
| **Inspection Bookings** | `/inquiries` | Direct booking creation with exact vehicle details, date, time, and customer WhatsApp number |
| **Consulting Leads** | `/leads` | Customer car sourcing and procurement requests |
| **Business Settings** | `/settings/business` | Dynamic phone, WhatsApp number, hub locations, and consultant profile |

---

## 🚀 Building & Exporting the App

### 1. Open in Android Studio
1. Open **Android Studio** (Electric Eel, Giraffe, Hedgehog, or newer).
2. Select **Open an existing project** and navigate to the `/android` folder.
3. Allow Gradle to sync dependencies automatically.

### 2. Build Release APK (app-release.apk)
Run the following in the terminal or use Android Studio Build Menu:
```bash
cd android
./gradlew assembleRelease
```
The generated release APK will be at:
`android/app/build/outputs/apk/release/app-release.apk`

### 3. Build Debug APK (app-debug.apk)
Run:
```bash
cd android
./gradlew assembleDebug
```
The generated APK will be at:
`android/app/build/outputs/apk/debug/app-debug.apk`

### 4. Generate Production Android App Bundle (AAB) for Google Play
Run:
```bash
./gradlew bundleRelease
```
The production bundle will be generated at:
`android/app/build/outputs/bundle/release/app-release.aab`

---

## 🎨 Brand Design Tokens
- **Deep Blue 900:** `#0A1424`
- **Deep Blue 950:** `#070D18`
- **Luxury Gold Accent:** `#D4AF37` / `#F59E0B`
- **Pure White:** `#FFFFFF`
- **WhatsApp Green:** `#25D366`

---

## 📱 Core Features
1. **Home Screen:** Jite Auto Deals branding, featured vehicles, accredited Nigerian hubs (Abuja, Lagos, Port Harcourt).
2. **Real-time Inventory:** Live search, dynamic make/model chips, and vehicle cards with **[ BOOK INSPECTION ]** and **[ View Details ↗ ]**.
3. **Vehicle Details:** Photo gallery with tap-to-view fullscreen lightbox, technical specification matrix, and pre-purchase inspection promise.
4. **Inspection Booking System:** Streamlined 4-field modal automatically capturing vehicle ID, make, model, price, and location.
5. **Direct WhatsApp Handoff:** Seamless prefilled WhatsApp chats directly to Tobor Jite.
