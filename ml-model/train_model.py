"""
train_model.py
Trains a Random Forest Regressor to predict bus ETA (in minutes).
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
import joblib

df = pd.read_csv("bus_trip_data.csv")

FEATURES = [
    "distance_km",
    "current_speed_kmh",
    "hour_of_day",
    "day_of_week",
    "is_weekend",
    "traffic_level",
]
TARGET = "eta_minutes"

X = df[FEATURES]
y = df[TARGET]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

model = RandomForestRegressor(
    n_estimators=200,
    max_depth=12,
    min_samples_leaf=3,
    random_state=42,
    n_jobs=-1,
)
model.fit(X_train, y_train)

predictions = model.predict(X_test)

mae = mean_absolute_error(y_test, predictions)
r2 = r2_score(y_test, predictions)

errors = np.abs(predictions - y_test.values)
within_2_min = np.mean(errors <= 2.0) * 100

print("=== Model Evaluation ===")
print(f"Mean Absolute Error (MAE): {mae:.2f} minutes")
print(f"R^2 Score: {r2:.3f}")
print(f"Predictions within ±2 minutes: {within_2_min:.1f}%")
print(f"(Project target: 85% within ±2 minutes)")

importance_df = pd.DataFrame({
    "feature": FEATURES,
    "importance": model.feature_importances_
}).sort_values("importance", ascending=False)

print("\n=== Feature Importance ===")
print(importance_df.to_string(index=False))

joblib.dump(model, "eta_model.pkl")
print("\nModel saved as eta_model.pkl")
