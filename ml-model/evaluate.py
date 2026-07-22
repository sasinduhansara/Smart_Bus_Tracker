"""
evaluate.py – Gamana.lk ETA Model Evaluation Report

Loads a saved model and runs it against the evaluated predictions stored in
MongoDB (those that have an actualArrivalAt value).  Prints a full report and
optionally saves JSON results.

Usage
-----
  cd ml-model
  python evaluate.py [--model ../backend/eta_model.pkl] [--output report.json]
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, r2_score

from features import FEATURE_NAMES_V2


TARGET = "actual_eta_minutes"
DEFAULT_MODEL = str(ROOT / "backend" / "eta_model.pkl")


def _load_env() -> None:
    env_path = ROOT / "backend" / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


def _load_evaluated_data(limit: int) -> pd.DataFrame:
    from pymongo import MongoClient

    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=8000)
    db = client["smart_bus_db"]

    cursor = db["eta_predictions"].find(
        {"actualArrivalAt": {"$ne": None}},
        {"featureSnapshot": 1, "actualArrivalAt": 1, "generatedAt": 1, "modelVersion": 1},
    ).limit(limit)

    rows: list[dict] = []
    for doc in cursor:
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
        row["model_version"] = doc.get("modelVersion", "unknown")
        rows.append(row)

    client.close()
    print(f"Loaded {len(rows)} evaluated prediction rows")
    return pd.DataFrame(rows)


def _percentile_error(errors: np.ndarray, p: int) -> float:
    return float(np.percentile(errors, p))


def evaluate(model_path: str, output_path: str | None, limit: int) -> None:
    print(f"\nLoading model from {model_path}…")
    try:
        model = joblib.load(model_path)
    except Exception as exc:
        print(f"Cannot load model: {exc}")
        sys.exit(1)

    df = _load_evaluated_data(limit)
    if len(df) < 10:
        print("Not enough evaluated rows to generate a report.")
        sys.exit(1)

    X = df[FEATURE_NAMES_V2].fillna(0)
    y = df[TARGET]
    preds = model.predict(X)
    errors = np.abs(preds - y.values)

    mae = mean_absolute_error(y, preds)
    r2 = r2_score(y, preds)

    within_1 = float(np.mean(errors <= 1.0) * 100)
    within_2 = float(np.mean(errors <= 2.0) * 100)
    within_5 = float(np.mean(errors <= 5.0) * 100)
    within_10 = float(np.mean(errors <= 10.0) * 100)

    print("\n" + "=" * 54)
    print("  Gamana.lk ETA Model Evaluation Report")
    print("=" * 54)
    print(f"  Model file        : {model_path}")
    print(f"  Evaluated samples : {len(df)}")
    print(f"  Mean Absolute Error  : {mae:.3f} min")
    print(f"  R² Score             : {r2:.4f}")
    print(f"  ≤1 min accuracy      : {within_1:.1f}%")
    print(f"  ≤2 min accuracy      : {within_2:.1f}%  (target ≥85%)")
    print(f"  ≤5 min accuracy      : {within_5:.1f}%")
    print(f"  ≤10 min accuracy     : {within_10:.1f}%")
    print(f"  P50 error            : {_percentile_error(errors, 50):.2f} min")
    print(f"  P90 error            : {_percentile_error(errors, 90):.2f} min")
    print(f"  P99 error            : {_percentile_error(errors, 99):.2f} min")
    print("=" * 54)

    # Per model-version breakdown
    if "model_version" in df.columns:
        print("\nPer-version breakdown:")
        for version, grp in df.groupby("model_version"):
            g_errors = np.abs(
                model.predict(grp[FEATURE_NAMES_V2].fillna(0)) - grp[TARGET].values
            )
            print(
                f"  {version:35s}  n={len(grp):5d}  MAE={np.mean(g_errors):.2f}  "
                f"≤2min={np.mean(g_errors <= 2) * 100:.1f}%"
            )

    # Feature importance
    if hasattr(model, "feature_importances_"):
        imp = pd.DataFrame({
            "feature": FEATURE_NAMES_V2,
            "importance": model.feature_importances_,
        }).sort_values("importance", ascending=False)
        print("\nTop-10 Feature Importances:")
        for _, row in imp.head(10).iterrows():
            bar = "█" * int(row["importance"] * 40)
            print(f"  {row['feature']:30s}  {row['importance']:.4f}  {bar}")

    if output_path:
        report = {
            "model_path": model_path,
            "n_samples": len(df),
            "mae": round(mae, 4),
            "r2": round(r2, 4),
            "within_1_pct": round(within_1, 2),
            "within_2_pct": round(within_2, 2),
            "within_5_pct": round(within_5, 2),
            "within_10_pct": round(within_10, 2),
            "p50_error": round(_percentile_error(errors, 50), 3),
            "p90_error": round(_percentile_error(errors, 90), 3),
            "p99_error": round(_percentile_error(errors, 99), 3),
        }
        Path(output_path).write_text(json.dumps(report, indent=2))
        print(f"\nReport saved → {output_path}")


if __name__ == "__main__":
    _load_env()

    parser = argparse.ArgumentParser(description="Evaluate Gamana.lk ETA model")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Path to .pkl model")
    parser.add_argument("--output", default=None, help="Optional JSON report output path")
    parser.add_argument("--limit", type=int, default=50_000, help="Max rows from MongoDB")
    args = parser.parse_args()

    evaluate(args.model, args.output, args.limit)
