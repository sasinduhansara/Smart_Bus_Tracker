"""
generate_data.py
Generates synthetic training data for the Bus ETA prediction model.
"""

import numpy as np
import pandas as pd

np.random.seed(42)

N_SAMPLES = 5000

def generate_trip():
    distance_km = np.random.uniform(0.5, 15.0)
    hour = np.random.randint(0, 24)
    day_of_week = np.random.randint(0, 7)
    is_weekend = 1 if day_of_week >= 5 else 0

    if not is_weekend and (7 <= hour <= 9 or 16 <= hour <= 19):
        traffic_level = np.random.uniform(0.6, 1.0)
    elif not is_weekend and (10 <= hour <= 15):
        traffic_level = np.random.uniform(0.3, 0.6)
    else:
        traffic_level = np.random.uniform(0.0, 0.3)

    base_speed = 40
    current_speed = base_speed * (1 - traffic_level * 0.7)
    current_speed = max(current_speed, 5)
    current_speed += np.random.normal(0, 1.5)
    current_speed = max(current_speed, 3)

    base_time_minutes = (distance_km / current_speed) * 60
    stop_delay = np.random.uniform(0, 2.5) 
    eta_minutes = base_time_minutes + stop_delay

    return {
        "distance_km": round(distance_km, 3),
        "current_speed_kmh": round(current_speed, 2),
        "hour_of_day": hour,
        "day_of_week": day_of_week,
        "is_weekend": is_weekend,
        "traffic_level": round(traffic_level, 3),
        "eta_minutes": round(eta_minutes, 2),
    }

def main():
    rows = [generate_trip() for _ in range(N_SAMPLES)]
    df = pd.DataFrame(rows)
    df.to_csv("bus_trip_data.csv", index=False)
    print(f"Generated {len(df)} synthetic trip records -> bus_trip_data.csv")
    print(df.head())
    print("\nSummary stats:")
    print(df.describe())

if __name__ == "__main__":
    main()