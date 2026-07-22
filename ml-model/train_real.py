"""
train_real.py – Gamana.lk ETA v2 Training Pipeline

Reads real trip data from MongoDB (location_history + trips + eta_predictions),
builds the 25-feature vectors defined in features.py, trains a Random Forest
and GradientBoost ensemble, evaluates performance, and saves the winning model.

Usage
-----
  cd ml-model
  python train_real.py [--output eta_model_v2.pkl] [--limit 100000]

Environment variables (loaded from backend/.env)
  MONGO_URI    MongoDB connection string
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Allow importing backend config without Flask
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import cross_val_score, train_test_split

from features import FEATURE_NAMES_V2, build_feature_vector

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

TARGET = "actual_eta_minutes"
DEFAULT_OUTPUT = str(ROOT / "backend" / "eta_model.pkl")
RANDOM_STATE = 42


def _load_env() -> None:
    env_path = ROOT / "backend" / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def _load_training_data(limit: int) -> pd.DataFrame:
    """
    Pull rows from eta_predictions (evaluated records with actual_arrival_at).
    Falls back to building synthetic rows from location_history if too few
    evaluated predictions exist.
    """
    from pymongo import MongoClient

    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=8000)
    db = client["smart_bus_db"]

    print("Connecting to MongoDB…")
    try:
        client.admin.command("ping")
        print("  ✓ Connected")
    except Exception as exc:
        print(f"  ✗ Cannot connect: {exc}")
        sys.exit(1)

    # ----- Evaluated ETA predictions -----
    print("Loading evaluated ETA predictions…")
    eval_cursor = db["eta_predictions"].find(
        {"actualArrivalAt": {"$ne": None}},
        {
            "featureSnapshot": 1,
            "predictedEtaMinutes": 1,
            "actualArrivalAt": 1,
            "estimatedArrivalAt": 1,
            "generatedAt": 1,
        },
    ).limit(limit)

    rows: list[dict] = []
    for doc in eval_cursor:
        feat = doc.get("featureSnapshot") or {}
        actual_at = doc.get("actualArrivalAt")
        generated_at = doc.get("generatedAt")

        if not isinstance(actual_at, datetime) or not isinstance(generated_at, datetime):
            continue

        actual_eta = (actual_at - generated_at).total_seconds() / 60.0
        if actual_eta < 0 or actual_eta > 180:
            continue

        row = {k: feat.get(k, 0) for k in FEATURE_NAMES_V2}
        row[TARGET] = round(actual_eta, 2)
        rows.append(row)

    print(f"  Loaded {len(rows)} evaluated prediction rows")

    # ----- Supplement from location_history if needed -----
    if len(rows) < 500:
        print(
            "  < 500 evaluated rows — supplementing from legacy bus_trip_data.csv…"
        )
        csv_path = Path(__file__).parent / "bus_trip_data.csv"
        if csv_path.exists():
            legacy_df = pd.read_csv(csv_path)
            legacy_df = legacy_df.rename(columns={"eta_minutes": TARGET})
            # Map legacy 6 features to v2 slots; fill extras with 0
            mapped: list[dict] = []
            for _, r in legacy_df.iterrows():
                row = {k: 0 for k in FEATURE_NAMES_V2}
                row["distance_km"] = float(r.get("distance_km", 0))
                row["current_speed_kmh"] = float(r.get("current_speed_kmh", 25))
                row["speed_ewma_kmh"] = float(r.get("current_speed_kmh", 25))
                row["hour_of_day"] = int(r.get("hour_of_day", 12))
                row["minute_of_hour"] = 0
                row["day_of_week"] = int(r.get("day_of_week", 2))
                row["is_weekend"] = int(r.get("is_weekend", 0))
                row["traffic_level"] = float(r.get("traffic_level", 0.3))
                row[TARGET] = float(r.get(TARGET, 30))
                mapped.append(row)
            rows.extend(mapped)
            print(f"  Supplemented to {len(rows)} rows total")

    client.close()
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def _evaluate(name: str, model, X_test, y_test) -> dict:
    preds = model.predict(X_test)
    mae = mean_absolute_error(y_test, preds)
    r2 = r2_score(y_test, preds)
    errors = np.abs(preds - y_test.values)
    within_2 = np.mean(errors <= 2.0) * 100
    within_5 = np.mean(errors <= 5.0) * 100

    print(f"\n  [{name}]")
    print(f"    MAE          : {mae:.3f} min")
    print(f"    R²           : {r2:.4f}")
    print(f"    ≤2 min       : {within_2:.1f}%  (target ≥85%)")
    print(f"    ≤5 min       : {within_5:.1f}%")

    return {
        "name": name,
        "model": model,
        "mae": mae,
        "r2": r2,
        "within_2_pct": within_2,
    }


def train(output_path: str, limit: int) -> None:
    df = _load_training_data(limit)

    if len(df) < 50:
        print(
            f"Only {len(df)} training rows found — cannot train a reliable model.\n"
            "Collect more real trip data first (see docs/DEPLOYMENT.md)."
        )
        sys.exit(1)

    print(f"\nTraining on {len(df)} rows × {len(FEATURE_NAMES_V2)} features")

    X = df[FEATURE_NAMES_V2].fillna(0)
    y = df[TARGET]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE
    )

    rf = RandomForestRegressor(
        n_estimators=300,
        max_depth=15,
        min_samples_leaf=3,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    gb = GradientBoostingRegressor(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.08,
        subsample=0.8,
        random_state=RANDOM_STATE,
    )

    print("\nFitting Random Forest…")
    rf.fit(X_train, y_train)

    print("Fitting Gradient Boosting…")
    gb.fit(X_train, y_train)

    print("\n=== Evaluation ===")
    rf_result = _evaluate("RandomForest", rf, X_test, y_test)
    gb_result = _evaluate("GradientBoost", gb, X_test, y_test)

    # Pick winner by MAE
    winner = rf if rf_result["mae"] <= gb_result["mae"] else gb
    winner_name = rf_result["name"] if winner is rf else gb_result["name"]
    print(f"\n✓ Saving {winner_name} to {output_path}")

    joblib.dump(winner, output_path)

    # Feature importance
    if hasattr(winner, "feature_importances_"):
        imp = pd.DataFrame({
            "feature": FEATURE_NAMES_V2,
            "importance": winner.feature_importances_,
        }).sort_values("importance", ascending=False)
        print("\n=== Top-10 Feature Importances ===")
        print(imp.head(10).to_string(index=False))


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    _load_env()

    parser = argparse.ArgumentParser(description="Train Gamana.lk ETA model v2")
    parser.add_argument(
        "--output", default=DEFAULT_OUTPUT, help="Output .pkl path"
    )
    parser.add_argument(
        "--limit", type=int, default=200_000,
        help="Max evaluated prediction rows to load from MongoDB"
    )
    args = parser.parse_args()

    train(args.output, args.limit)
