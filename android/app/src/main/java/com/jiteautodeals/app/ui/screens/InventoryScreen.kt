package com.jiteautodeals.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jiteautodeals.app.data.model.Vehicle
import com.jiteautodeals.app.ui.theme.*
import com.jiteautodeals.app.ui.viewmodel.VehicleViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InventoryScreen(
    viewModel: VehicleViewModel,
    onSelectVehicle: (Vehicle) -> Unit
) {
    val context = LocalContext.current
    val vehicles by viewModel.filteredVehicles.collectAsState()
    val allVehicles by viewModel.rawVehicles.collectAsState()
    val filterState by viewModel.filterState.collectAsState()
    val settings by viewModel.businessSettings.collectAsState()

    // Extract dynamic unique makes from actual database
    val makes = listOf("All") + allVehicles.map { it.make }.filter { it.isNotBlank() }.distinct().sorted()

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Navy950),
        contentPadding = PaddingValues(bottom = 90.dp)
    ) {
        // Sticky Header / Search Bar
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Navy900)
                    .padding(horizontal = 20.dp, vertical = 16.dp)
            ) {
                Text(
                    text = "Vehicle Inventory",
                    color = White,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "${vehicles.size} verified vehicles available",
                    color = Gold400,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium
                )

                Spacer(modifier = Modifier.height(12.dp))

                // Search TextField
                OutlinedTextField(
                    value = filterState.searchQuery,
                    onValueChange = { viewModel.updateSearchQuery(it) },
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text("Search make, model, year, location...", color = Slate500, fontSize = 13.sp) },
                    leadingIcon = {
                        Icon(Icons.Default.Search, contentDescription = null, tint = Gold500)
                    },
                    trailingIcon = {
                        if (filterState.searchQuery.isNotEmpty()) {
                            IconButton(onClick = { viewModel.updateSearchQuery("") }) {
                                Icon(Icons.Default.Clear, contentDescription = "Clear", tint = Slate400)
                            }
                        }
                    },
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = Navy800,
                        unfocusedContainerColor = Navy800,
                        focusedTextColor = White,
                        unfocusedTextColor = White,
                        focusedBorderColor = Gold500,
                        unfocusedBorderColor = Slate700
                    ),
                    singleLine = true
                )

                Spacer(modifier = Modifier.height(12.dp))

                // Brand / Make Filter Chips
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(makes) { make ->
                        val isSelected = if (make == "All") filterState.selectedMake == null else filterState.selectedMake == make
                        FilterChip(
                            selected = isSelected,
                            onClick = {
                                viewModel.selectMakeFilter(if (make == "All") null else make)
                            },
                            label = { Text(make, fontSize = 12.sp, fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = Gold500,
                                selectedLabelColor = Navy950,
                                containerColor = Navy800,
                                labelColor = White
                            ),
                            border = FilterChipDefaults.filterChipBorder(
                                borderColor = if (isSelected) Gold500 else Slate700,
                                enabled = true,
                                selected = isSelected
                            )
                        )
                    }
                }
            }
        }

        // Empty Search Results State
        if (vehicles.isEmpty()) {
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "No vehicles match your criteria",
                        color = White,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Looking for a specific model? Tobor Jite can personally source and inspect verified vehicles from private owners and accredited dealerships nationwide.",
                        color = Slate400,
                        fontSize = 13.sp,
                        lineHeight = 18.sp
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(
                        onClick = {
                            val msg = "Hello Tobor Jite! I searched for '${filterState.searchQuery}' on the Jite Auto Deals Android App. Could you help me source this car?"
                            viewModel.openWhatsApp(context, settings.whatsAppNumber, msg)
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = WhatsAppGreen),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text(
                            text = "Chat with Tobor on WhatsApp",
                            color = White,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        } else {
            items(vehicles) { vehicle ->
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
}
