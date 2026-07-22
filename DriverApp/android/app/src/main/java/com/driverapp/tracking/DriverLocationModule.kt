package com.driverapp.tracking

import android.content.Intent
import android.os.Build
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class DriverLocationModule(
    reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "DriverLocationModule"
    }

    @ReactMethod
    fun startTracking(
        baseUrl: String,
        accessToken: String,
        tripId: String?,
        promise: Promise,
    ) {
        val normalizedBaseUrl = baseUrl.trim()
        val normalizedAccessToken = accessToken.trim()

        if (normalizedBaseUrl.isEmpty()) {
            promise.reject(
                "BACKGROUND_TRACKING_INVALID_URL",
                "The backend base URL is required.",
            )
            return
        }

        if (normalizedAccessToken.isEmpty()) {
            promise.reject(
                "BACKGROUND_TRACKING_TOKEN_REQUIRED",
                "An authenticated access token is required.",
            )
            return
        }

        val serviceIntent = Intent(
            reactApplicationContext,
            DriverLocationService::class.java,
        ).apply {
            action = DriverLocationService.ACTION_START

            putExtra(
                DriverLocationService.EXTRA_BASE_URL,
                normalizedBaseUrl,
            )

            putExtra(
                DriverLocationService.EXTRA_ACCESS_TOKEN,
                normalizedAccessToken,
            )

            putExtra(
                DriverLocationService.EXTRA_TRIP_ID,
                tripId?.trim(),
            )
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(
                    reactApplicationContext,
                    serviceIntent,
                )
            } else {
                reactApplicationContext.startService(
                    serviceIntent,
                )
            }

            promise.resolve(true)
        } catch (error: Exception) {
            promise.reject(
                "BACKGROUND_TRACKING_START_FAILED",
                "Could not start the foreground location service.",
                error,
            )
        }
    }

    @ReactMethod
    fun stopTracking(
        promise: Promise,
    ) {
        try {
            val stopped = reactApplicationContext.stopService(
                Intent(
                    reactApplicationContext,
                    DriverLocationService::class.java,
                ),
            )

            promise.resolve(stopped)
        } catch (error: Exception) {
            promise.reject(
                "BACKGROUND_TRACKING_STOP_FAILED",
                "Could not stop the foreground location service.",
                error,
            )
        }
    }
}