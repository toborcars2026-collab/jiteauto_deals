package com.jiteautodeals.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jiteautodeals.app.ui.screens.*
import com.jiteautodeals.app.ui.theme.*
import com.jiteautodeals.app.ui.viewmodel.VehicleViewModel

enum class NavigationItem(val label: String, val icon: ImageVector) {
    HOME("Home", Icons.Default.Home),
    INVENTORY("Inventory", Icons.Default.DirectionsCar),
    INSPECTIONS("Inspections", Icons.Default.CalendarMonth),
    CONSULTANT("Consultant", Icons.Default.Person)
}

class MainActivity : ComponentActivity() {
    private val viewModel: VehicleViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Handle incoming deep link from web catalog (e.g. https://jiteautodeals.vercel.app/vehicle/...)
        intent?.data?.let { uri ->
            val path = uri.path
            if (path != null && path.contains("/vehicle/")) {
                val slug = path.substringAfterLast("/")
                // Match vehicle once loaded
            }
        }

        setContent {
            JiteAutoDealsTheme {
                MainAppScaffold(viewModel = viewModel)
            }
        }
    }
}

@Composable
fun MainAppScaffold(viewModel: VehicleViewModel) {
    var currentNav by remember { mutableStateOf(NavigationItem.HOME) }
    val selectedVehicle by viewModel.selectedVehicle.collectAsState()
    val isInspectionOpen by viewModel.isInspectionDialogOpen.collectAsState()
    val inspectionTargetVehicle by viewModel.inspectionTargetVehicle.collectAsState()

    Scaffold(
        bottomBar = {
            NavigationBar(
                containerColor = Navy900,
                tonalElevation = 8.dp
            ) {
                NavigationItem.values().forEach { item ->
                    val isSelected = currentNav == item
                    NavigationBarItem(
                        selected = isSelected,
                        onClick = { currentNav = item },
                        icon = { Icon(item.icon, contentDescription = item.label) },
                        label = { Text(item.label, fontSize = 11.sp) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = Navy950,
                            selectedTextColor = Gold400,
                            indicatorColor = Gold500,
                            unselectedIconColor = Slate400,
                            unselectedTextColor = Slate400
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(Navy950)
        ) {
            when (currentNav) {
                NavigationItem.HOME -> HomeScreen(
                    viewModel = viewModel,
                    onNavigateToInventory = { currentNav = NavigationItem.INVENTORY },
                    onSelectVehicle = { viewModel.selectVehicle(it) }
                )
                NavigationItem.INVENTORY -> InventoryScreen(
                    viewModel = viewModel,
                    onSelectVehicle = { viewModel.selectVehicle(it) }
                )
                NavigationItem.INSPECTIONS -> InspectionsOverviewScreen(
                    viewModel = viewModel,
                    onBrowseVehicles = { currentNav = NavigationItem.INVENTORY }
                )
                NavigationItem.CONSULTANT -> ConsultantProfileScreen(
                    viewModel = viewModel
                )
            }

            // Vehicle Details Screen Overlay
            selectedVehicle?.let { vehicle ->
                VehicleDetailsScreen(
                    vehicle = vehicle,
                    viewModel = viewModel,
                    onBack = { viewModel.selectVehicle(null) }
                )
            }

            // Inspection Booking Dialog
            if (isInspectionOpen && inspectionTargetVehicle != null) {
                InspectionBookingDialog(
                    vehicle = inspectionTargetVehicle!!,
                    viewModel = viewModel,
                    onDismiss = { viewModel.closeInspectionBooking() }
                )
            }
        }
    }
}

@Composable
fun InspectionsOverviewScreen(
    viewModel: VehicleViewModel,
    onBrowseVehicles: () -> Unit
) {
    val vehicles by viewModel.rawVehicles.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Navy950)
            .padding(20.dp)
    ) {
        Text(
            text = "Vehicle Inspections",
            color = White,
            fontSize = 22.sp,
            fontWeight = androidx.compose.ui.text.font.FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = "Booked physical inspections and vehicle verification status",
            color = Slate400,
            fontSize = 13.sp
        )

        Spacer(modifier = Modifier.height(20.dp))

        Card(
            colors = CardDefaults.cardColors(containerColor = Navy900),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(18.dp)) {
                Text(
                    text = "HOW INSPECTION WORKS",
                    color = Gold400,
                    fontSize = 11.sp,
                    fontWeight = androidx.compose.ui.text.font.FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "1. Select any verified vehicle from the catalog.\n2. Tap 'BOOK INSPECTION' directly on the card.\n3. Choose your date & time in Abuja, Lagos, or PH.\n4. Tobor Jite meets you or represents you with full diagnostic equipment & title verification.",
                    color = Slate300,
                    fontSize = 13.sp,
                    lineHeight = 20.sp
                )

                Spacer(modifier = Modifier.height(16.dp))

                Button(
                    onClick = onBrowseVehicles,
                    colors = ButtonDefaults.buttonColors(containerColor = Gold500),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Select a Car to Inspect", color = Navy950, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
fun ConsultantProfileScreen(
    viewModel: VehicleViewModel
) {
    val settings by viewModel.businessSettings.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Navy950)
            .padding(20.dp)
    ) {
        Text(
            text = "Tobor Jite",
            color = White,
            fontSize = 24.sp,
            fontWeight = androidx.compose.ui.text.font.FontWeight.Bold
        )
        Text(
            text = "Founder & Chief Vehicle Consultant",
            color = Gold400,
            fontSize = 14.sp
        )

        Spacer(modifier = Modifier.height(16.dp))

        Card(
            colors = CardDefaults.cardColors(containerColor = Navy900),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(18.dp)) {
                Text(
                    text = "Official Contact & Operations",
                    color = White,
                    fontSize = 16.sp,
                    fontWeight = androidx.compose.ui.text.font.FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(text = "WhatsApp: +${settings.whatsAppNumber}", color = Slate300, fontSize = 13.sp)
                Text(text = "Phone: ${settings.phoneDisplay}", color = Slate300, fontSize = 13.sp)
                Text(text = "Hubs: ${settings.address}", color = Slate300, fontSize = 13.sp)
                Text(text = "Website: https://jiteautodeals.vercel.app", color = Gold400, fontSize = 13.sp)
            }
        }
    }
}
