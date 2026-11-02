package com.jiteautodeals.app.ui.viewmodel

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jiteautodeals.app.data.model.BusinessSettings
import com.jiteautodeals.app.data.model.Vehicle
import com.jiteautodeals.app.data.repository.FirestoreRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.net.URLEncoder

data class VehicleFilterState(
    val searchQuery: String = "",
    val selectedMake: String? = null,
    val selectedCondition: String? = null,
    val selectedLocation: String? = null,
    val maxPrice: Long? = null
)

class VehicleViewModel(
    private val repository: FirestoreRepository = FirestoreRepository()
) : ViewModel() {

    private val _filterState = MutableStateFlow(VehicleFilterState())
    val filterState: StateFlow<VehicleFilterState> = _filterState.asStateFlow()

    val rawVehicles: StateFlow<List<Vehicle>> = repository.getVehiclesStream()
        .stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    val businessSettings: StateFlow<BusinessSettings> = repository.getBusinessSettingsStream()
        .stateIn(viewModelScope, SharingStarted.Lazily, BusinessSettings())

    // Filtered vehicles according to search, make, condition, and status
    val filteredVehicles: StateFlow<List<Vehicle>> = combine(rawVehicles, filterState) { list, filter ->
        list.filter { vehicle ->
            // Search query matches make, model, or year
            val queryMatch = if (filter.searchQuery.isBlank()) true else {
                val q = filter.searchQuery.trim().lowercase()
                vehicle.title.lowercase().contains(q) ||
                vehicle.description.lowercase().contains(q) ||
                vehicle.location.lowercase().contains(q)
            }

            val makeMatch = filter.selectedMake == null || vehicle.make.equals(filter.selectedMake, ignoreCase = true)
            val conditionMatch = filter.selectedCondition == null || vehicle.condition.contains(filter.selectedCondition, ignoreCase = true)
            val locationMatch = filter.selectedLocation == null || vehicle.location.contains(filter.selectedLocation, ignoreCase = true)
            val priceMatch = filter.maxPrice == null || vehicle.price <= filter.maxPrice

            queryMatch && makeMatch && conditionMatch && locationMatch && priceMatch
        }
    }.stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    // Selected vehicle for details inspection
    private val _selectedVehicle = MutableStateFlow<Vehicle?>(null)
    val selectedVehicle: StateFlow<Vehicle?> = _selectedVehicle.asStateFlow()

    // Inspection booking modal state
    private val _isInspectionDialogOpen = MutableStateFlow(false)
    val isInspectionDialogOpen: StateFlow<Boolean> = _isInspectionDialogOpen.asStateFlow()

    private val _inspectionTargetVehicle = MutableStateFlow<Vehicle?>(null)
    val inspectionTargetVehicle: StateFlow<Vehicle?> = _inspectionTargetVehicle.asStateFlow()

    private val _bookingSuccessMessage = MutableStateFlow<String?>(null)
    val bookingSuccessMessage: StateFlow<String?> = _bookingSuccessMessage.asStateFlow()

    private val _isBookingSubmitting = MutableStateFlow(false)
    val isBookingSubmitting: StateFlow<Boolean> = _isBookingSubmitting.asStateFlow()

    fun updateSearchQuery(query: String) {
        _filterState.value = _filterState.value.copy(searchQuery = query)
    }

    fun selectMakeFilter(make: String?) {
        _filterState.value = _filterState.value.copy(selectedMake = make)
    }

    fun selectVehicle(vehicle: Vehicle?) {
        _selectedVehicle.value = vehicle
    }

    fun openInspectionBooking(vehicle: Vehicle) {
        _inspectionTargetVehicle.value = vehicle
        _isInspectionDialogOpen.value = true
        _bookingSuccessMessage.value = null
    }

    fun closeInspectionBooking() {
        _isInspectionDialogOpen.value = false
        _inspectionTargetVehicle.value = null
        _bookingSuccessMessage.value = null
    }

    fun submitInspection(
        fullName: String,
        whatsappNumber: String,
        preferredDate: String,
        preferredTime: String,
        context: Context
    ) {
        val vehicle = _inspectionTargetVehicle.value ?: return
        viewModelScope.launch {
            _isBookingSubmitting.value = true
            val result = repository.submitInspectionBooking(
                vehicle = vehicle,
                customerName = fullName,
                whatsappNumber = whatsappNumber,
                preferredDate = preferredDate,
                preferredTime = preferredTime
            )

            _isBookingSubmitting.value = false
            if (result.isSuccess) {
                _bookingSuccessMessage.value = "Inspection scheduled successfully! Reference ID: ${result.getOrNull()}"
                
                // Also prepare direct WhatsApp confirmation handoff
                val settings = businessSettings.value
                val message = "Hello Tobor Jite! I just booked an inspection via the Jite Auto Deals Android App for:\n\n" +
                        "🚗 *${vehicle.title}*\n" +
                        "💰 Price: ${vehicle.formattedPrice}\n" +
                        "📍 Location: ${vehicle.location}\n" +
                        "📅 Date: $preferredDate\n" +
                        "⏰ Time: $preferredTime\n" +
                        "👤 Name: $fullName\n" +
                        "📱 WhatsApp: $whatsappNumber\n\n" +
                        "Looking forward to the physical verification."
                
                openWhatsApp(context, settings.whatsAppNumber, message)
            }
        }
    }

    fun openWhatsApp(context: Context, phoneNumber: String, message: String) {
        try {
            val cleanPhone = phoneNumber.replace("+", "").replace(" ", "").replace("-", "")
            val encodedMsg = URLEncoder.encode(message, "UTF-8")
            val url = "https://api.whatsapp.com/send?phone=$cleanPhone&text=$encodedMsg"
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun callDirect(context: Context, phoneNumber: String) {
        try {
            val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phoneNumber")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
