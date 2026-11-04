package com.jiteautodeals.app.data.model

import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.IgnoreExtraProperties

@IgnoreExtraProperties
data class Inquiry(
    @DocumentId
    val id: String = "",
    val name: String = "",
    val phone: String = "",
    val vehicleId: String = "",
    val vehicleName: String = "",
    val vehiclePrice: Long? = null,
    val vehicleLocation: String? = null,
    val budget: Long? = null,
    val paymentMethod: String = "Cash",
    val readyToBuy: String = "Immediate",
    val preferredContact: String = "WhatsApp",
    val message: String = "",
    val preferredDate: String = "",
    val preferredTime: String = "",
    val type: String = "inspection",
    val status: String = "New",
    val createdAt: String = ""
)

@IgnoreExtraProperties
data class BusinessSettings(
    val businessName: String = "Jite Auto Deals",
    val brandTagline: String = "Your Trusted Vehicle Consultant",
    val consultantName: String = "Tobor Jite",
    val phoneDisplay: String = "0802 318 4543",
    val phoneCallUrl: String = "tel:+2348023184543",
    val whatsAppNumber: String = "2348023184543",
    val email: String = "info@jiteautodeals.com",
    val address: String = "Abuja • Lagos • Port Harcourt, Nigeria",
    val instagramUrl: String = "https://instagram.com/jiteautodeals",
    val tikTokUrl: String = "https://tiktok.com/@jiteautodeals",
    val facebookUrl: String = "https://facebook.com/jiteautodeals",
    val homepageCtaText: String = "Verify Before You Buy",
    val footerText: String = "Executive automotive advisory & transparent vehicle sourcing across Nigeria."
)
