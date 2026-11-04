package com.jiteautodeals.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.jiteautodeals.app.data.model.Vehicle
import com.jiteautodeals.app.ui.theme.*
import com.jiteautodeals.app.ui.viewmodel.VehicleViewModel

@Composable
fun HomeScreen(
    viewModel: VehicleViewModel,
    onNavigateToInventory: () -> Unit,
    onSelectVehicle: (Vehicle) -> Unit
) {
    val context = LocalContext.current
    val vehicles by viewModel.rawVehicles.collectAsState()
    val settings by viewModel.businessSettings.collectAsState()
    val featuredVehicles = vehicles.filter { it.isFeatured && it.isActive }
    val recentVehicles = vehicles.filter { it.isActive }.take(8)

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Navy950),
        contentPadding = PaddingValues(bottom = 90.dp)
    ) {
        // Executive Jite Auto Deals Banner
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        Brush.verticalGradient(
                            listOf(Navy900, Navy950)
                        )
                    )
                    .padding(horizontal = 20.dp, vertical = 24.dp)
            ) {
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(36.dp)
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(Gold500),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.DirectionsCar,
                                        contentDescription = null,
                                        tint = Navy950,
                                        modifier = Modifier.size(22.dp)
                                    )
                                }
                                Spacer(modifier = Modifier.width(10.dp))
                                Column {
                                    Text(
                                        text = "JITE AUTO DEALS",
                                        color = White,
                                        fontWeight = FontWeight.Black,
                                        fontSize = 18.sp,
                                        letterSpacing = 1.sp
                                    )
                                    Text(
                                        text = "Your Trusted Vehicle Consultant",
                                        color = Gold400,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Medium
                                    )
                                }
                            }
                        }

                        // WhatsApp Quick Action
                        IconButton(
                            onClick = {
                                viewModel.openWhatsApp(
                                    context,
                                    settings.whatsAppNumber,
                                    "Hello Tobor Jite! I am browsing vehicles on the Jite Auto Deals Android App."
                                )
                            },
                            modifier = Modifier
                                .clip(CircleShape)
                                .background(Navy800)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Chat,
                                contentDescription = "WhatsApp Consultant",
                                tint = WhatsAppGreen
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    // Value Proposition Card
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Navy800),
                        shape = RoundedCornerShape(18.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(18.dp)) {
                            Text(
                                text = "VERIFIED INVENTORY • ACCREDITED HUBS",
                                color = Gold400,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Buy with Confidence in Abuja, Lagos & PH",
                                color = White,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = "Every car is verified for authentic customs documentation, clean title history, and engine integrity before recommendation.",
                                color = Slate400,
                                fontSize = 12.sp,
                                lineHeight = 16.sp
                            )
                            Spacer(modifier = Modifier.height(14.dp))
                            Button(
                                onClick = onNavigateToInventory,
                                colors = ButtonDefaults.buttonColors(containerColor = Gold500),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Text(
                                    text = "BROWSE ALL CARS (${vehicles.count { it.isActive }})",
                                    color = Navy950,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp
                                )
                            }
                        }
                    }
                }
            }
        }

        // Featured Vehicles Horizontal Scroller
        if (featuredVehicles.isNotEmpty()) {
            item {
                Column(modifier = Modifier.padding(top = 12.dp)) {
                    PaddingRow(title = "Featured Vehicles", subtitle = "Hand-inspected executive highlights")
                    Spacer(modifier = Modifier.height(10.dp))
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 20.dp),
                        horizontalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        items(featuredVehicles) { vehicle ->
                            FeaturedVehicleCard(
                                vehicle = vehicle,
                                onBookInspection = { viewModel.openInspectionBooking(vehicle) },
                                onViewDetails = { onSelectVehicle(vehicle) }
                            )
                        }
                    }
                }
            }
        }

        // Available Inventory Section
        item {
            Column(modifier = Modifier.padding(top = 24.dp)) {
                PaddingRow(
                    title = "Recently Available Vehicles",
                    subtitle = "Tap 'Book Inspection' or 'View Details'"
                )
                Spacer(modifier = Modifier.height(12.dp))
            }
        }

        items(recentVehicles) { vehicle ->
            Box(modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)) {
                StandardVehicleCard(
                    vehicle = vehicle,
                    onBookInspection = { viewModel.openInspectionBooking(vehicle) },
                    onViewDetails = { onSelectVehicle(vehicle) }
                )
            }
        }
    }
}

@Composable
fun PaddingRow(title: String, subtitle: String) {
    Column(modifier = Modifier.padding(horizontal = 20.dp)) {
        Text(
            text = title,
            color = White,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = subtitle,
            color = Slate400,
            fontSize = 12.sp
        )
    }
}

@Composable
fun FeaturedVehicleCard(
    vehicle: Vehicle,
    onBookInspection: () -> Unit,
    onViewDetails: () -> Unit
) {
    Card(
        modifier = Modifier
            .width(280.dp)
            .clickable { onViewDetails() },
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Navy900)
    ) {
        Column {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(160.dp)
            ) {
                AsyncImage(
                    model = vehicle.primaryImageUrl,
                    contentDescription = vehicle.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )
                // Featured Tag
                Box(
                    modifier = Modifier
                        .padding(10.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(Gold500)
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "FEATURED",
                        color = Navy950,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Black
                    )
                }
            }

            Column(modifier = Modifier.padding(14.dp)) {
                Text(
                    text = vehicle.title,
                    color = White,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = vehicle.formattedPrice,
                    color = Gold400,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.ExtraBold
                )
                Row(
                    modifier = Modifier.padding(top = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.LocationOn,
                        contentDescription = null,
                        tint = Slate400,
                        modifier = Modifier.size(13.dp)
                    )
                    Spacer(modifier = Modifier.width(3.dp))
                    Text(
                        text = vehicle.location,
                        color = Slate400,
                        fontSize = 11.sp
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                // EXACT CTA FLOW: [ BOOK INSPECTION ] (Primary Yellow) + [ View Details ↗ ]
                Button(
                    onClick = onBookInspection,
                    colors = ButtonDefaults.buttonColors(containerColor = Gold500),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "BOOK INSPECTION",
                        color = Navy950,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp
                    )
                }

                Spacer(modifier = Modifier.height(6.dp))

                OutlinedButton(
                    onClick = onViewDetails,
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "View Details ↗",
                        color = White,
                        fontSize = 12.sp
                    )
                }
            }
        }
    }
}

@Composable
fun StandardVehicleCard(
    vehicle: Vehicle,
    onBookInspection: () -> Unit,
    onViewDetails: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onViewDetails() },
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Navy900)
    ) {
        Column {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(180.dp)
            ) {
                AsyncImage(
                    model = vehicle.primaryImageUrl,
                    contentDescription = vehicle.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )
                // Condition & Location Badges
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(Navy950.copy(alpha = 0.85f))
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = vehicle.condition,
                            color = Gold400,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(Navy950.copy(alpha = 0.85f))
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = "📍 ${vehicle.location}",
                            color = White,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = vehicle.title,
                    color = White,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = vehicle.formattedPrice,
                    color = Gold400,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.ExtraBold
                )

                Spacer(modifier = Modifier.height(14.dp))

                // EXACT CTA FLOW: Primary Yellow [ BOOK INSPECTION ] and [ View Details ↗ ]
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Button(
                        onClick = onBookInspection,
                        colors = ButtonDefaults.buttonColors(containerColor = Gold500),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1.3f)
                    ) {
                        Text(
                            text = "BOOK INSPECTION",
                            color = Navy950,
                            fontWeight = FontWeight.Black,
                            fontSize = 12.sp
                        )
                    }

                    OutlinedButton(
                        onClick = onViewDetails,
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(
                            text = "View Details ↗",
                            color = White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp
                        )
                    }
                }
            }
        }
    }
}
