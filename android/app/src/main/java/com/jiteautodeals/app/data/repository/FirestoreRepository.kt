package com.jiteautodeals.app.data.repository

import android.util.Log
import com.google.firebase.FirebaseApp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.jiteautodeals.app.data.model.BusinessSettings
import com.jiteautodeals.app.data.model.Inquiry
import com.jiteautodeals.app.data.model.Vehicle
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class FirestoreRepository {
    private val tag = "FirestoreRepository"

    // Primary Firestore Database ID shared with Jite Auto Deals website
    private val firestoreDbId = "ai-studio-jiteautodeals-74aa2960-b1e2-41ac-9714-42ee44c5712a"

    private val firestore: FirebaseFirestore by lazy {
        try {
            val app = FirebaseApp.getInstance()
            FirebaseFirestore.getInstance(app, firestoreDbId)
        } catch (e: Exception) {
            Log.w(tag, "Fallback to default Firestore instance: ${e.message}")
            FirebaseFirestore.getInstance()
        }
    }

    /**
     * Real-time stream of all vehicles from Firestore /vehicles collection.
     * Automatically stays in sync when vehicles are added, updated, or marked sold on the website.
     */
    fun getVehiclesStream(): Flow<List<Vehicle>> = callbackFlow {
        val collection = firestore.collection("vehicles")
            .orderBy("createdAt", Query.Direction.DESCENDING)

        val listener = collection.addSnapshotListener { snapshot, error ->
            if (error != null) {
                Log.e(tag, "Error listening to vehicles: ${error.message}")
                trySend(emptyList())
                return@addSnapshotListener
            }

            if (snapshot != null) {
                val vehicles = snapshot.documents.mapNotNull { doc ->
                    try {
                        doc.toObject(Vehicle::class.java)?.copy(id = doc.id)
                    } catch (e: Exception) {
                        Log.e(tag, "Failed to parse vehicle ${doc.id}: ${e.message}")
                        null
                    }
                }
                trySend(vehicles)
            }
        }

        awaitClose { listener.remove() }
    }

    /**
     * Real-time stream of central business settings from Firestore /settings/business
     */
    fun getBusinessSettingsStream(): Flow<BusinessSettings> = callbackFlow {
        val docRef = firestore.collection("settings").document("business")

        val listener = docRef.addSnapshotListener { snapshot, error ->
            if (error != null) {
                Log.e(tag, "Error listening to settings: ${error.message}")
                trySend(BusinessSettings())
                return@addSnapshotListener
            }

            if (snapshot != null && snapshot.exists()) {
                val settings = snapshot.toObject(BusinessSettings::class.java) ?: BusinessSettings()
                trySend(settings)
            } else {
                trySend(BusinessSettings())
            }
        }

        awaitClose { listener.remove() }
    }

    /**
     * Submit an inspection booking directly to the shared /inquiries Firestore collection.
     * The admin dashboard and email/WhatsApp pipelines receive this instantly.
     */
    suspend fun submitInspectionBooking(
        vehicle: Vehicle,
        customerName: String,
        whatsappNumber: String,
        preferredDate: String,
        preferredTime: String
    ): Result<String> {
        return try {
            val nowIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }.format(Date())

            val inquiryData = hashMapOf(
                "name" to customerName.trim(),
                "phone" to whatsappNumber.trim(),
                "vehicleId" to vehicle.id,
                "vehicleName" to vehicle.title,
                "vehiclePrice" to vehicle.price,
                "vehicleLocation" to vehicle.location,
                "type" to "inspection",
                "preferredDate" to preferredDate,
                "preferredTime" to preferredTime,
                "preferredContact" to "WhatsApp",
                "readyToBuy" to "Immediate",
                "status" to "New",
                "createdAt" to nowIso,
                "message" to "Android App Inspection Booking for ${vehicle.title} (₦${vehicle.price}) in ${vehicle.location} on $preferredDate at $preferredTime."
            )

            val docRef = firestore.collection("inquiries").add(inquiryData).await()
            Log.d(tag, "Inspection inquiry saved with ID: ${docRef.id}")
            Result.success(docRef.id)
        } catch (e: Exception) {
            Log.e(tag, "Error saving inspection booking: ${e.message}", e)
            Result.failure(e)
        }
    }
}
