package com.jiteautodeals.app.data.model

import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.IgnoreExtraProperties
import java.text.NumberFormat
import java.util.Locale

@IgnoreExtraProperties
data class Vehicle(
    @DocumentId
    val id: String = "",
    val make: String = "",
    val model: String = "",
    val year: Int = 0,
    val price: Long = 0L,
    val mileage: Long? = null,
    val transmission: String = "Automatic",
    val fuelType: String = "Petrol",
    val bodyType: String = "Sedan",
    val location: String = "Abuja",
    val dealership: String? = null,
    val images: List<String> = emptyList(),
    val description: String = "",
    val engine: String? = null,
    val color: String = "",
    val condition: String = "Foreign Used",
    val isFeatured: Boolean = false,
    val inSlideshow: Boolean = false,
    val slideshowOrder: Int? = null,
    val status: String = "Available",
    val createdAt: String? = null,
    val updatedAt: String? = null
) {
    val title: String
        get() = "$year $make $model".trim()

    val formattedPrice: String
        get() {
            val formatter = NumberFormat.getCurrencyInstance(Locale("en", "NG"))
            formatter.maximumFractionDigits = 0
            val formatted = formatter.format(price)
            return if (formatted.startsWith("NGN")) {
                formatted.replace("NGN", "₦").trim()
            } else {
                "₦" + NumberFormat.getNumberInstance(Locale.US).format(price)
            }
        }

    val primaryImageUrl: String?
        get() = images.firstOrNull { it.isNotBlank() }

    val isActive: Boolean
        get() = status.equals("Available", ignoreCase = true) || 
                status.equals("Active", ignoreCase = true)
}
