package com.jiteautodeals.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.jiteautodeals.app.data.model.Vehicle
import com.jiteautodeals.app.ui.theme.*
import com.jiteautodeals.app.ui.viewmodel.VehicleViewModel
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InspectionBookingDialog(
    vehicle: Vehicle,
    viewModel: VehicleViewModel,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val isSubmitting by viewModel.isBookingSubmitting.collectAsState()
    val successMessage by viewModel.bookingSuccessMessage.collectAsState()

    var fullName by remember { mutableStateOf("") }
    var whatsappNumber by remember { mutableStateOf("") }

    // Default inspection date (tomorrow)
    val defaultDate = remember {
        val cal = Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, 1) }
        SimpleDateFormat("yyyy-MM-dd", Locale.US).format(cal.time)
    }
    var inspectionDate by remember { mutableStateOf(defaultDate) }
    var preferredTime by remember { mutableStateOf("11:00 AM") }
    var validationError by remember { mutableStateOf<String?>(null) }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.7f))
                .padding(16.dp),
            contentAlignment = Alignment.Center
        ) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .wrapContentHeight(),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = Navy900)
            ) {
                Column(
                    modifier = Modifier
                        .padding(20.dp)
                        .verticalScroll(rememberScrollState())
                ) {
                    // Header with close button
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "Book a Vehicle Inspection",
                                color = White,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = "Interested in this vehicle? Choose a convenient time and we'll arrange your inspection.",
                                color = Slate400,
                                fontSize = 12.sp,
                                lineHeight = 16.sp
                            )
                        }

                        IconButton(onClick = onDismiss) {
                            Icon(Icons.Default.Close, contentDescription = "Close", tint = Slate400)
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // Vehicle Card Info Summary (Dynamically identified)
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(Navy800)
                            .padding(14.dp)
                    ) {
                        Column {
                            Text(
                                text = vehicle.title,
                                color = White,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    text = vehicle.formattedPrice,
                                    color = Gold400,
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.ExtraBold
                                )
                                Text(
                                    text = "📍 ${vehicle.location}",
                                    color = Slate300,
                                    fontSize = 12.sp
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    if (successMessage != null) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(Emerald600.copy(alpha = 0.2f))
                                .padding(14.dp)
                        ) {
                            Column {
                                Text(
                                    text = "✓ Inspection Request Confirmed",
                                    color = Emerald500,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = successMessage ?: "",
                                    color = White,
                                    fontSize = 12.sp
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        Button(
                            onClick = onDismiss,
                            colors = ButtonDefaults.buttonColors(containerColor = Gold500),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Done", color = Navy950, fontWeight = FontWeight.Bold)
                        }
                    } else {
                        // Required Field: Full Name
                        Text("Full Name", color = Slate300, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                        Spacer(modifier = Modifier.height(4.dp))
                        OutlinedTextField(
                            value = fullName,
                            onValueChange = {
                                fullName = it
                                validationError = null
                            },
                            placeholder = { Text("e.g. Adeyemi Adeleke", color = Slate500, fontSize = 13.sp) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedContainerColor = Navy800,
                                unfocusedContainerColor = Navy800,
                                focusedTextColor = White,
                                unfocusedTextColor = White,
                                focusedBorderColor = Gold500,
                                unfocusedBorderColor = Slate700
                            )
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        // Required Field: WhatsApp Number
                        Text("WhatsApp Number", color = Slate300, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                        Spacer(modifier = Modifier.height(4.dp))
                        OutlinedTextField(
                            value = whatsappNumber,
                            onValueChange = {
                                whatsappNumber = it
                                validationError = null
                            },
                            placeholder = { Text("e.g. 0803 123 4567", color = Slate500, fontSize = 13.sp) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedContainerColor = Navy800,
                                unfocusedContainerColor = Navy800,
                                focusedTextColor = White,
                                unfocusedTextColor = White,
                                focusedBorderColor = Gold500,
                                unfocusedBorderColor = Slate700
                            )
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        // Required Field: Inspection Date
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Inspection Date", color = Slate300, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                                Spacer(modifier = Modifier.height(4.dp))
                                OutlinedTextField(
                                    value = inspectionDate,
                                    onValueChange = { inspectionDate = it },
                                    placeholder = { Text("YYYY-MM-DD", color = Slate500, fontSize = 13.sp) },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(10.dp),
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedContainerColor = Navy800,
                                        unfocusedContainerColor = Navy800,
                                        focusedTextColor = White,
                                        unfocusedTextColor = White,
                                        focusedBorderColor = Gold500,
                                        unfocusedBorderColor = Slate700
                                    )
                                )
                            }

                            Column(modifier = Modifier.weight(1f)) {
                                Text("Preferred Time", color = Slate300, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                                Spacer(modifier = Modifier.height(4.dp))
                                OutlinedTextField(
                                    value = preferredTime,
                                    onValueChange = { preferredTime = it },
                                    placeholder = { Text("e.g. 11:00 AM", color = Slate500, fontSize = 13.sp) },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(10.dp),
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedContainerColor = Navy800,
                                        unfocusedContainerColor = Navy800,
                                        focusedTextColor = White,
                                        unfocusedTextColor = White,
                                        focusedBorderColor = Gold500,
                                        unfocusedBorderColor = Slate700
                                    )
                                )
                            }
                        }

                        if (validationError != null) {
                            Spacer(modifier = Modifier.height(10.dp))
                            Text(
                                text = validationError ?: "",
                                color = MaterialTheme.colorScheme.error,
                                fontSize = 12.sp
                            )
                        }

                        Spacer(modifier = Modifier.height(20.dp))

                        // PRIMARY BUTTON: "BOOK INSPECTION" (Not "Continue to WhatsApp")
                        Button(
                            onClick = {
                                if (fullName.trim().length < 2) {
                                    validationError = "Please enter your full name."
                                    return@Button
                                }
                                if (whatsappNumber.trim().length < 8) {
                                    validationError = "Please enter a valid WhatsApp phone number."
                                    return@Button
                                }
                                if (inspectionDate.trim().isEmpty()) {
                                    validationError = "Please specify an inspection date."
                                    return@Button
                                }
                                if (preferredTime.trim().isEmpty()) {
                                    validationError = "Please specify your preferred time."
                                    return@Button
                                }

                                viewModel.submitInspection(
                                    fullName = fullName,
                                    whatsappNumber = whatsappNumber,
                                    preferredDate = inspectionDate,
                                    preferredTime = preferredTime,
                                    context = context
                                )
                            },
                            enabled = !isSubmitting,
                            colors = ButtonDefaults.buttonColors(containerColor = Gold500),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(50.dp)
                        ) {
                            if (isSubmitting) {
                                CircularProgressIndicator(color = Navy950, modifier = Modifier.size(20.dp))
                            } else {
                                Text(
                                    text = "BOOK INSPECTION",
                                    color = Navy950,
                                    fontWeight = FontWeight.Black,
                                    fontSize = 14.sp
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
