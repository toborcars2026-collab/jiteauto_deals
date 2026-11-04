package com.jiteautodeals.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import coil.compose.AsyncImage
import com.jiteautodeals.app.data.model.Vehicle
import com.jiteautodeals.app.ui.theme.*
import com.jiteautodeals.app.ui.viewmodel.VehicleViewModel

@Composable
fun VehicleDetailsScreen(
    vehicle: Vehicle,
    viewModel: VehicleViewModel,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val settings by viewModel.businessSettings.collectAsState()
    val images = if (vehicle.images.isNotEmpty()) vehicle.images else listOf("https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&q=80&w=1200")
    var activeImageIndex by remember { mutableIntStateOf(0) }
    var isFullscreenPhotoViewerOpen by remember { mutableStateOf(false) }

    Box(modifier = Modifier.fillMaxSize().background(Navy950)) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 100.dp)
        ) {
            // Top Bar with Back Button
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Button(
                        onClick = onBack,
                        colors = ButtonDefaults.buttonColors(containerColor = Navy800),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Gold400, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Back", color = White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }

                    Text(
                        text = "Vehicle Profile",
                        color = Gold400,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp
                    )
                }
            }

            // Main Photo Display with "TAP TO VIEW FULL PHOTO" Overlay
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(280.dp)
                        .background(Color.Black)
                        .clickable { isFullscreenPhotoViewerOpen = true }
                ) {
                    AsyncImage(
                        model = images[activeImageIndex],
                        contentDescription = vehicle.title,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )

                    // Clear "TAP TO VIEW FULL PHOTO" Overlay Indication
                    Box(
                        modifier = Modifier
                            .align(Alignment.BottomStart)
                            .padding(14.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Navy950.copy(alpha = 0.85f))
                            .clickable { isFullscreenPhotoViewerOpen = true }
                            .padding(horizontal = 10.dp, vertical = 6.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Default.OpenInFull,
                                contentDescription = null,
                                tint = Gold400,
                                modifier = Modifier.size(12.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "TAP TO VIEW FULL PHOTO",
                                color = White,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Black,
                                letterSpacing = 0.5.sp
                            )
                        }
                    }

                    // Photo Counter Indicator
                    Box(
                        modifier = Modifier
                            .align(Alignment.BottomEnd)
                            .padding(14.dp)
                            .clip(RoundedCornerShape(6.dp))
                            .background(Color.Black.copy(alpha = 0.75f))
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = "${activeImageIndex + 1} / ${images.size}",
                            color = White,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            // Thumbnails Gallery
            if (images.size > 1) {
                item {
                    LazyRow(
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        itemsIndexed(images) { index, imgUrl ->
                            Box(
                                modifier = Modifier
                                    .size(60.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(Navy900)
                                    .clickable { activeImageIndex = index }
                            ) {
                                AsyncImage(
                                    model = imgUrl,
                                    contentDescription = null,
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier.fillMaxSize()
                                )
                                if (activeImageIndex == index) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxSize()
                                            .background(Gold500.copy(alpha = 0.25f))
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Vehicle Heading & Pricing
            item {
                Column(modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.Top
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = vehicle.title,
                                color = White,
                                fontSize = 22.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = "📍 ${vehicle.location} • ${vehicle.condition}",
                                color = Slate400,
                                fontSize = 13.sp
                            )
                        }

                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (vehicle.isActive) Emerald600.copy(alpha = 0.2f) else Slate800)
                                .padding(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = vehicle.status,
                                color = if (vehicle.isActive) Emerald500 else Slate400,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    Text(
                        text = vehicle.formattedPrice,
                        color = Gold400,
                        fontSize = 26.sp,
                        fontWeight = FontWeight.ExtraBold
                    )
                }
            }

            // Primary Booking Action Card
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 8.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Navy900)
                ) {
                    Column(modifier = Modifier.padding(18.dp)) {
                        Text(
                            text = "PRE-PURCHASE INSPECTION",
                            color = Gold400,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Book a Physical Vehicle Inspection",
                            color = White,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Inspect the engine, transmission, bodywork, OBD diagnostics, and customs clearance documents before making payment.",
                            color = Slate400,
                            fontSize = 12.sp,
                            lineHeight = 16.sp
                        )
                        Spacer(modifier = Modifier.height(14.dp))

                        // PRIMARY BOOK INSPECTION CTA
                        Button(
                            onClick = { viewModel.openInspectionBooking(vehicle) },
                            colors = ButtonDefaults.buttonColors(containerColor = Gold500),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(Icons.Default.CalendarMonth, contentDescription = null, tint = Navy950)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "BOOK INSPECTION",
                                color = Navy950,
                                fontWeight = FontWeight.Black,
                                fontSize = 13.sp
                            )
                        }
                    }
                }
            }

            // Specs Section
            item {
                Column(modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp)) {
                    Text(
                        text = "Technical Specifications",
                        color = White,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(10.dp))

                    val specsList = listOf(
                        "Condition" to vehicle.condition,
                        "Hub Location" to vehicle.location,
                        "Transmission" to vehicle.transmission,
                        "Fuel Compound" to vehicle.fuelType,
                        "Body Category" to vehicle.bodyType,
                        "Exterior Color" to (vehicle.color.ifBlank { "Standard" }),
                        "Engine Spec" to (vehicle.engine ?: "V-Engine / In-line"),
                        "Mileage" to (if (vehicle.mileage != null) "${vehicle.mileage} km" else "Verified Clean Odometer")
                    )

                    specsList.chunked(2).forEach { rowPairs ->
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            rowPairs.forEach { (label, value) ->
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(Navy900)
                                        .padding(12.dp)
                                ) {
                                    Column {
                                        Text(text = label, color = Slate400, fontSize = 10.sp)
                                        Spacer(modifier = Modifier.height(2.dp))
                                        Text(text = value, color = White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Description Section
            if (vehicle.description.isNotBlank()) {
                item {
                    Column(modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp)) {
                        Text(
                            text = "Consultant Commentary & Vehicle Overview",
                            color = White,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = vehicle.description,
                            color = Slate300,
                            fontSize = 13.sp,
                            lineHeight = 20.sp
                        )
                    }
                }
            }

            // Direct WhatsApp & Phone Action Buttons
            item {
                Column(modifier = Modifier.padding(horizontal = 20.dp, vertical = 16.dp)) {
                    Button(
                        onClick = {
                            val msg = "Hello Tobor Jite! I am interested in this vehicle on the Jite Auto Deals Android App:\n\n" +
                                    "🚗 *${vehicle.title}*\n" +
                                    "💰 Price: ${vehicle.formattedPrice}\n" +
                                    "📍 Location: ${vehicle.location}\n\n" +
                                    "Could you confirm its current availability?"
                            viewModel.openWhatsApp(context, settings.whatsAppNumber, msg)
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = WhatsAppGreen),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.Chat, contentDescription = null, tint = White)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Chat with Tobor on WhatsApp",
                            color = White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedButton(
                        onClick = { viewModel.callDirect(context, settings.phoneDisplay) },
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.Phone, contentDescription = null, tint = Gold400)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Call Direct: ${settings.phoneDisplay}",
                            color = White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp
                        )
                    }
                }
            }
        }

        // Fullscreen Lightbox Photo Viewer
        if (isFullscreenPhotoViewerOpen) {
            Dialog(onDismissRequest = { isFullscreenPhotoViewerOpen = false }) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black)
                ) {
                    AsyncImage(
                        model = images[activeImageIndex],
                        contentDescription = vehicle.title,
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.fillMaxSize()
                    )

                    IconButton(
                        onClick = { isFullscreenPhotoViewerOpen = false },
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(16.dp)
                            .clip(CircleShape)
                            .background(Navy900)
                    ) {
                        Icon(Icons.Default.Close, contentDescription = "Close", tint = White)
                    }
                }
            }
        }
    }
}
val Slate300 = Color(0xFFCBD5E1)
