package com.driverapp.tracking

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.driverapp.MainActivity
import com.driverapp.R
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class DriverLocationService : Service() {

    companion object {
        private const val TAG = "DriverLocationService"

        const val ACTION_START =
            "com.driverapp.tracking.action.START"

        const val ACTION_STOP =
            "com.driverapp.tracking.action.STOP"

        const val EXTRA_BASE_URL =
            "com.driverapp.tracking.extra.BASE_URL"

        const val EXTRA_ACCESS_TOKEN =
            "com.driverapp.tracking.extra.ACCESS_TOKEN"

        const val EXTRA_TRIP_ID =
            "com.driverapp.tracking.extra.TRIP_ID"

        private const val NOTIFICATION_CHANNEL_ID =
            "gamana_driver_live_tracking"

        private const val NOTIFICATION_CHANNEL_NAME =
            "Live bus tracking"

        private const val NOTIFICATION_ID = 4101

        private const val LOCATION_INTERVAL_MS =  20_000L
        private const val LOCATION_FASTEST_INTERVAL_MS = 10_000L
        private const val LOCATION_MIN_DISTANCE_METERS = 0f

        private const val CONNECTION_TIMEOUT_MS = 15_000
        private const val READ_TIMEOUT_MS = 15_000
    }

    private lateinit var fusedLocationClient: FusedLocationProviderClient

    private val networkExecutor =
        Executors.newSingleThreadExecutor()

    private val requestInProgress =
        AtomicBoolean(false)

    private var baseUrl: String? = null
    private var accessToken: String? = null
    private var tripId: String? = null
    private var locationUpdatesRunning = false

    private val locationRequest: LocationRequest by lazy {
        LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            LOCATION_INTERVAL_MS,
        )
            .setMinUpdateIntervalMillis(
                LOCATION_FASTEST_INTERVAL_MS,
            )
            .setMinUpdateDistanceMeters(
                LOCATION_MIN_DISTANCE_METERS,
            )
            .setWaitForAccurateLocation(false)
            .build()
    }

    private val locationCallback =
        object : LocationCallback() {
            override fun onLocationResult(
                locationResult: LocationResult,
            ) {
                val latestLocation =
                    locationResult.lastLocation ?: return

                sendLocationToBackend(latestLocation)
            }
        }

    override fun onCreate() {
        super.onCreate()

        fusedLocationClient =
            LocationServices.getFusedLocationProviderClient(this)

        createNotificationChannel()
    }

    override fun onStartCommand(
        intent: Intent?,
        flags: Int,
        startId: Int,
    ): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopTrackingAndService()
            }

            ACTION_START -> {
                val suppliedBaseUrl = intent.getStringExtra(
                    EXTRA_BASE_URL,
                )

                val suppliedAccessToken = intent.getStringExtra(
                    EXTRA_ACCESS_TOKEN,
                )

                val suppliedTripId = intent.getStringExtra(
                    EXTRA_TRIP_ID,
                )

                if (
                    suppliedBaseUrl.isNullOrBlank() ||
                    suppliedAccessToken.isNullOrBlank()
                ) {
                    Log.e(
                        TAG,
                        "Cannot start tracking without backend URL and access token",
                    )

                    stopSelf()
                    return START_NOT_STICKY
                }

                baseUrl = suppliedBaseUrl.trimEnd('/')
                accessToken = suppliedAccessToken
                tripId = suppliedTripId

                startAsForegroundService()
                startLocationUpdates()
            }

            else -> {
                Log.w(
                    TAG,
                    "Service received an unsupported or empty action",
                )

                stopSelf()
            }
        }

        /*
         * The service is restarted only through the authenticated
         * Driver App trip flow. A system restart must not recreate
         * it without a valid in-memory access token.
         */
        return START_NOT_STICKY
    }

    private fun startAsForegroundService() {
        val notification = buildTrackingNotification(
            "Sharing the bus location with passengers",
        )

        try {
            ServiceCompat.startForeground(
                this,
                NOTIFICATION_ID,
                notification,
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
                } else {
                    0
                },
            )
        } catch (error: SecurityException) {
            Log.e(
                TAG,
                "Foreground location service permission was rejected",
                error,
            )

            stopSelf()
        }
    }

    private fun startLocationUpdates() {
        if (locationUpdatesRunning) {
            return
        }

        val finePermissionGranted =
            ActivityCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_FINE_LOCATION,
            ) == PackageManager.PERMISSION_GRANTED

        val coarsePermissionGranted =
            ActivityCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_COARSE_LOCATION,
            ) == PackageManager.PERMISSION_GRANTED

        if (!finePermissionGranted && !coarsePermissionGranted) {
            Log.e(
                TAG,
                "Location permission is unavailable",
            )

            stopTrackingAndService()
            return
        }

        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                mainLooper,
            )

            locationUpdatesRunning = true

            Log.i(
                TAG,
                "Foreground location tracking started",
            )
        } catch (error: SecurityException) {
            Log.e(
                TAG,
                "Could not request location updates",
                error,
            )

            stopTrackingAndService()
        }
    }

    private fun sendLocationToBackend(
        location: Location,
    ) {
        val currentBaseUrl = baseUrl ?: return
        val currentToken = accessToken ?: return

        if (!requestInProgress.compareAndSet(false, true)) {
            return
        }

        networkExecutor.execute {
            var connection: HttpURLConnection? = null

            try {
                val endpoint = URL(
                    "$currentBaseUrl/api/location",
                )

                connection =
                    endpoint.openConnection() as HttpURLConnection

                connection.requestMethod = "POST"
                connection.connectTimeout =
                    CONNECTION_TIMEOUT_MS
                connection.readTimeout =
                    READ_TIMEOUT_MS
                connection.doOutput = true

                connection.setRequestProperty(
                    "Content-Type",
                    "application/json",
                )

                connection.setRequestProperty(
                    "Accept",
                    "application/json",
                )

                connection.setRequestProperty(
                    "Authorization",
                    "Bearer $currentToken",
                )

                val payload = JSONObject().apply {
                    put("lat", location.latitude)
                    put("lng", location.longitude)

                    put(
                        "speed",
                        if (
                            location.hasSpeed() &&
                            location.speed >= 0
                        ) {
                            location.speed * 3.6
                        } else {
                            0.0
                        },
                    )

                    put(
                        "heading",
                        if (
                            location.hasBearing() &&
                            location.bearing >= 0
                        ) {
                            location.bearing.toDouble()
                        } else {
                            0.0
                        },
                    )

                    put(
                        "accuracy",
                        if (
                            location.hasAccuracy() &&
                            location.accuracy >= 0
                        ) {
                            location.accuracy.toDouble()
                        } else {
                            0.0
                        },
                    )

                    put(
                        "timestamp",
                        Instant.ofEpochMilli(
                            location.time,
                        ).toString(),
                    )
                }

                connection.outputStream.use { outputStream ->
                    outputStream.write(
                        payload.toString()
                            .toByteArray(Charsets.UTF_8),
                    )
                }

                val responseCode =
                    connection.responseCode

                when {
                    responseCode in 200..299 -> {
                        Log.d(
                            TAG,
                            "Location uploaded successfully for trip ${tripId.orEmpty()}",
                        )
                    }

                    responseCode == 401 ||
                        responseCode == 403 ||
                        responseCode == 409 -> {
                        Log.e(
                            TAG,
                            "Backend rejected tracking with HTTP $responseCode",
                        )

                        stopTrackingAndService()
                    }

                    else -> {
                        Log.w(
                            TAG,
                            "Location upload failed with HTTP $responseCode",
                        )
                    }
                }
            } catch (error: Exception) {
                /*
                 * Temporary network failures must not terminate the
                 * foreground service. The next location callback retries.
                 */
                Log.w(
                    TAG,
                    "Could not upload the latest location",
                    error,
                )
            } finally {
                connection?.disconnect()
                requestInProgress.set(false)
            }
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return
        }

        val channel = NotificationChannel(
            NOTIFICATION_CHANNEL_ID,
            NOTIFICATION_CHANNEL_NAME,
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description =
                "Shows when Gamana.lk Driver is sharing live bus location"
            setShowBadge(false)
        }

        val notificationManager =
            getSystemService(
                NotificationManager::class.java,
            )

        notificationManager.createNotificationChannel(
            channel,
        )
    }

    private fun buildTrackingNotification(
        message: String,
    ): Notification {
        val openAppIntent = Intent(
            this,
            MainActivity::class.java,
        ).apply {
            flags =
                Intent.FLAG_ACTIVITY_SINGLE_TOP or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        val pendingIntentFlags =
            PendingIntent.FLAG_UPDATE_CURRENT or
                if (
                    Build.VERSION.SDK_INT >=
                    Build.VERSION_CODES.M
                ) {
                    PendingIntent.FLAG_IMMUTABLE
                } else {
                    0
                }

        val openAppPendingIntent =
            PendingIntent.getActivity(
                this,
                0,
                openAppIntent,
                pendingIntentFlags,
            )

        return NotificationCompat.Builder(
            this,
            NOTIFICATION_CHANNEL_ID,
        )
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(
                "Gamana.lk live trip",
            )
            .setContentText(message)
            .setContentIntent(openAppPendingIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(
                NotificationCompat.CATEGORY_SERVICE,
            )
            .setPriority(
                NotificationCompat.PRIORITY_LOW,
            )
            .build()
    }

    private fun stopTrackingAndService() {
        if (locationUpdatesRunning) {
            fusedLocationClient.removeLocationUpdates(
                locationCallback,
            )

            locationUpdatesRunning = false
        }

        baseUrl = null
        accessToken = null
        tripId = null

        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()

        Log.i(
            TAG,
            "Foreground location tracking stopped",
        )
    }

    override fun onDestroy() {
        if (locationUpdatesRunning) {
            fusedLocationClient.removeLocationUpdates(
                locationCallback,
            )

            locationUpdatesRunning = false
        }

        networkExecutor.shutdownNow()

        baseUrl = null
        accessToken = null
        tripId = null

        super.onDestroy()
    }

    override fun onBind(
        intent: Intent?,
    ): IBinder? = null
}