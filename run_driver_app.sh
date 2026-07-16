#!/bin/bash
# Simple script to build and install the DriverApp on the emulator
export JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home

echo "Building DriverApp..."
cd "$(dirname "$0")/DriverApp"

# Build APK
./android/gradlew -p android app:assembleDebug -Dorg.gradle.java.home=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home
echo "Installing on emulator..."
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

echo " Done! App installed."

