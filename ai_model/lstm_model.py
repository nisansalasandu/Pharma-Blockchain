"""
lstm_model.py
─────────────
Sri Lankan Pharmaceutical Supply Chain — LSTM Risk Prediction Model

PURPOSE:
  Predicts drug shortage risk, demand, and supply chain risk scores
  for each medicine. Output is sent to the blockchain via the oracle server.

MODEL ARCHITECTURE:
  Input  → LSTM(64 units) → Dropout(0.2) → LSTM(32 units) → Dense(5 outputs)
  Outputs: [stockRisk, demandForecast, coldChainRisk, counterfeitRisk, overallRisk]

INSTALL DEPENDENCIES:
  pip install tensorflow numpy pandas scikit-learn requests

RUN:
  python ai_model/lstm_model.py

The model trains on synthetic Sri Lankan pharmaceutical data,
then sends predictions to oracle_server.js via HTTP POST.
"""

import numpy as np
import pandas as pd
import json
import requests
import time
import os
from datetime import datetime, timedelta

# ── Try importing TensorFlow ───────────────────────────────────────────────
try:
    import tensorflow as tf
    from tensorflow.keras.models import Sequential, load_model
    from tensorflow.keras.layers import LSTM, Dense, Dropout
    from tensorflow.keras.callbacks import EarlyStopping
    from sklearn.preprocessing import MinMaxScaler
    TF_AVAILABLE = True
    print("✅ TensorFlow", tf.__version__, "loaded")
except ImportError:
    TF_AVAILABLE = False
    print("⚠️  TensorFlow not found — running in SIMULATION mode")
    print("   Install: pip install tensorflow")

# ── Configuration ─────────────────────────────────────────────────────────
ORACLE_SERVER_URL = "http://localhost:3001/submit-prediction"
SEQUENCE_LENGTH   = 12    # 12 weeks of history
PREDICTION_WEEKS  = 4     # forecast 4 weeks ahead
RETRAIN_INTERVAL  = 3600  # retrain every 1 hour (seconds)
MODEL_PATH        = "ai_model/lstm_weights.h5"

# ── Sri Lanka Essential Medicines List (subset) ───────────────────────────
MEDICINES = [
    {"name": "paracetamol",    "baseStock": 500000, "baseDemand": 45000, "coldChain": False},
    {"name": "amoxicillin",    "baseStock": 120000, "baseDemand": 12000, "coldChain": False},
    {"name": "metformin",      "baseStock": 80000,  "baseDemand": 8500,  "coldChain": False},
    {"name": "insulin",        "baseStock": 15000,  "baseDemand": 3200,  "coldChain": True},
    {"name": "amlodipine",     "baseStock": 95000,  "baseDemand": 9800,  "coldChain": False},
    {"name": "atorvastatin",   "baseStock": 70000,  "baseDemand": 7200,  "coldChain": False},
    {"name": "salbutamol",     "baseStock": 45000,  "baseDemand": 4100,  "coldChain": False},
    {"name": "omeprazole",     "baseStock": 60000,  "baseDemand": 6300,  "coldChain": False},
]

# ─────────────────────────────────────────────────────────────────────────────
# DATA GENERATION
# Generates realistic Sri Lankan pharmaceutical supply chain data
# In production: replace with real SPC/MSD inventory data
# ─────────────────────────────────────────────────────────────────────────────

def generate_training_data(medicine: dict, weeks: int = 104) -> pd.DataFrame:
    """
    Generate 2 years (104 weeks) of synthetic supply chain data
    for a single medicine.

    Features generated:
      - stock_level     : current stock in units
      - weekly_demand   : units dispensed per week
      - orders_placed   : procurement orders that week
      - supply_received : units received from SPC/MSD
      - stockout_flag   : 1 if stock fell below safety level
      - price_index     : relative price (inflation proxy)
      - seasonal_factor : seasonal demand variation
    """
    np.random.seed(42)
    dates = [datetime(2023, 1, 1) + timedelta(weeks=i) for i in range(weeks)]

    # Seasonal pattern: higher demand in monsoon (June-October) for some medicines
    seasonal = np.array([
        1.0 + 0.3 * np.sin(2 * np.pi * (d.month - 1) / 12) for d in dates
    ])

    base_demand   = medicine["baseDemand"]
    base_stock    = medicine["baseStock"]

    demand        = (base_demand * seasonal * np.random.uniform(0.85, 1.15, weeks)).astype(int)
    supply        = (demand * np.random.uniform(0.90, 1.10, weeks)).astype(int)
    stock         = np.zeros(weeks)
    stock[0]      = base_stock

    for i in range(1, weeks):
        stock[i] = stock[i-1] + supply[i] - demand[i]
        # Inject shortage events (3 random weeks)
        if i in np.random.choice(weeks, 3, replace=False):
            stock[i] *= 0.15  # sudden drop to 15%
        stock[i] = max(0, stock[i])

    safety_level  = base_demand * 4  # 4 weeks safety stock
    stockout_flag = (stock < safety_level).astype(int)
    price_index   = 1.0 + 0.02 * np.cumsum(np.random.normal(0, 0.01, weeks))

    df = pd.DataFrame({
        "date":           dates,
        "stock_level":    stock,
        "weekly_demand":  demand,
        "supply_received": supply,
        "stockout_flag":  stockout_flag,
        "price_index":    price_index,
        "seasonal_factor": seasonal,
    })
    return df


def compute_risk_scores(row: pd.Series, medicine: dict) -> dict:
    """
    Compute risk scores from a single data row.
    Returns values 0.0 - 1.0 (scaled to 0-1000 before blockchain submission).
    """
    base_demand  = medicine["baseDemand"]
    safety_level = base_demand * 4

    # Stock depletion risk: how close to safety threshold
    stock_ratio      = row["stock_level"] / safety_level if safety_level > 0 else 1
    stock_risk       = max(0.0, min(1.0, 1.0 - stock_ratio / 2))

    # Demand forecast deviation (high deviation = more risk)
    demand_risk      = min(1.0, abs(row["weekly_demand"] - base_demand) / base_demand)

    # Cold chain risk: higher for cold-chain medicines
    cold_chain_risk  = 0.3 if medicine["coldChain"] else 0.05

    # Counterfeit risk: proxy via price deviation
    price_deviation  = abs(row["price_index"] - 1.0)
    counterfeit_risk = min(1.0, price_deviation * 5)

    # Overall risk: weighted combination
    overall = (
        0.45 * stock_risk      +
        0.25 * demand_risk     +
        0.20 * cold_chain_risk +
        0.10 * counterfeit_risk
    )
    overall = min(1.0, overall)

    return {
        "stockRisk":       round(stock_risk, 4),
        "demandForecast":  int(row["weekly_demand"]),
        "coldChainRisk":   round(cold_chain_risk, 4),
        "counterfeitRisk": round(counterfeit_risk, 4),
        "overallRisk":     round(overall, 4),
    }


# ─────────────────────────────────────────────────────────────────────────────
# LSTM MODEL (TensorFlow)
# ─────────────────────────────────────────────────────────────────────────────

class LSTMRiskPredictor:
    """
    LSTM model that predicts 5 risk metrics for each medicine
    based on 12-week historical sequences.
    """

    def __init__(self):
        self.model   = None
        self.scaler  = MinMaxScaler()
        self.trained = False

    def _build_model(self, input_shape: tuple) -> Sequential:
        model = Sequential([
            LSTM(64, return_sequences=True, input_shape=input_shape),
            Dropout(0.2),
            LSTM(32, return_sequences=False),
            Dropout(0.2),
            Dense(16, activation="relu"),
            Dense(5,  activation="sigmoid")   # 5 risk outputs, all 0-1
        ])
        model.compile(optimizer="adam", loss="mse", metrics=["mae"])
        return model

    def _prepare_sequences(self, df: pd.DataFrame):
        features = ["stock_level", "weekly_demand", "supply_received",
                    "stockout_flag", "price_index", "seasonal_factor"]
        data = df[features].values
        data = self.scaler.fit_transform(data)

        X, y = [], []
        for i in range(SEQUENCE_LENGTH, len(data) - PREDICTION_WEEKS):
            X.append(data[i - SEQUENCE_LENGTH:i])
            # Target: risk scores at prediction point
            raw_row = df.iloc[i + PREDICTION_WEEKS]
            scores  = compute_risk_scores(raw_row, {"baseDemand": df["weekly_demand"].mean(), "coldChain": False})
            y.append([
                scores["stockRisk"],
                scores["demandForecast"] / 100000,  # normalize
                scores["coldChainRisk"],
                scores["counterfeitRisk"],
                scores["overallRisk"]
            ])
        return np.array(X), np.array(y)

    def train(self, medicine: dict):
        print(f"  🧠 Training LSTM for {medicine['name']}...")
        df      = generate_training_data(medicine, weeks=104)
        X, y    = self._prepare_sequences(df)

        if self.model is None:
            self.model = self._build_model((X.shape[1], X.shape[2]))

        early_stop = EarlyStopping(patience=5, restore_best_weights=True)
        history    = self.model.fit(
            X, y,
            epochs          = 30,
            batch_size      = 16,
            validation_split= 0.2,
            callbacks       = [early_stop],
            verbose         = 0
        )
        final_loss = history.history["loss"][-1]
        self.trained = True
        print(f"  ✅ Trained. Final loss: {final_loss:.4f}")
        return final_loss

    def predict(self, medicine: dict) -> dict:
        df = generate_training_data(medicine, weeks=SEQUENCE_LENGTH + 5)

        if self.trained and self.model is not None:
            features = ["stock_level", "weekly_demand", "supply_received",
                        "stockout_flag", "price_index", "seasonal_factor"]
            data = df[features].values
            data = self.scaler.transform(data[-SEQUENCE_LENGTH:].reshape(-1, len(features)))
            X    = data.reshape(1, SEQUENCE_LENGTH, len(features))
            pred = self.model.predict(X, verbose=0)[0]

            return {
                "medicine":        medicine["name"],
                "stockRisk":       round(float(pred[0]), 4),
                "demandForecast":  int(float(pred[1]) * 100000),
                "coldChainRisk":   round(float(pred[2]), 4),
                "counterfeitRisk": round(float(pred[3]), 4),
                "overallRisk":     round(float(pred[4]), 4),
            }
        else:
            # Simulation mode — compute from last data row
            last_row = df.iloc[-1]
            scores   = compute_risk_scores(last_row, medicine)
            scores["medicine"] = medicine["name"]
            return scores


# ─────────────────────────────────────────────────────────────────────────────
# SIMULATION MODE (when TensorFlow not available)
# ─────────────────────────────────────────────────────────────────────────────

class SimulatedPredictor:
    """Runs without TensorFlow — computes risk from synthetic data directly."""

    def predict(self, medicine: dict) -> dict:
        df       = generate_training_data(medicine, weeks=SEQUENCE_LENGTH + 5)
        last_row = df.iloc[-1]
        scores   = compute_risk_scores(last_row, medicine)
        scores["medicine"] = medicine["name"]
        return scores


# ─────────────────────────────────────────────────────────────────────────────
# ORACLE SENDER
# ─────────────────────────────────────────────────────────────────────────────

def send_to_oracle(prediction: dict) -> bool:
    """
    POST prediction to the oracle server (oracle_server.js).
    The oracle server then calls submitPrediction() on the blockchain.
    """
    payload = {
        "medicine":        prediction["medicine"],
        "stockRisk":       int(prediction["stockRisk"] * 1000),       # float → 0-1000
        "demandForecast":  prediction["demandForecast"],
        "coldChainRisk":   int(prediction["coldChainRisk"] * 1000),
        "counterfeitRisk": int(prediction["counterfeitRisk"] * 1000),
        "overallRisk":     int(prediction["overallRisk"] * 1000),
    }

    try:
        resp = requests.post(ORACLE_SERVER_URL, json=payload, timeout=10)
        if resp.status_code == 200:
            print(f"   📡 Sent to blockchain: {prediction['medicine']} "
                  f"risk={payload['overallRisk']}/1000")
            return True
        else:
            print(f"   ❌ Oracle server error {resp.status_code}: {resp.text[:80]}")
            return False
    except requests.exceptions.ConnectionError:
        print(f"   ⚠️  Oracle server not running at {ORACLE_SERVER_URL}")
        print(f"      Start it with: node pbft_coordinator/oracle_server.js")
        print(f"      Prediction data: {json.dumps(payload, indent=6)}")
        return False
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# MAIN LOOP
# ─────────────────────────────────────────────────────────────────────────────

def main():
    print("\n" + "=" * 60)
    print("🧠 SRI LANKA PHARMACHAIN — LSTM RISK PREDICTION MODEL")
    print("=" * 60)
    print(f"Mode      : {'TensorFlow LSTM' if TF_AVAILABLE else 'Simulation'}")
    print(f"Medicines : {len(MEDICINES)}")
    print(f"Oracle    : {ORACLE_SERVER_URL}")
    print("=" * 60)

    # Initialise predictor
    if TF_AVAILABLE:
        predictor = LSTMRiskPredictor()
        print("\n📚 Training LSTM model on all medicines...")
        for med in MEDICINES:
            predictor.train(med)
        print("\n✅ All models trained. Starting prediction loop...\n")
    else:
        predictor = SimulatedPredictor()
        print("\n⚡ Simulation mode active. Starting prediction loop...\n")

    cycle = 0
    while True:
        cycle += 1
        print(f"\n🔄 Prediction Cycle #{cycle}  [{datetime.now().strftime('%H:%M:%S')}]")
        print("-" * 50)

        all_predictions = []
        for med in MEDICINES:
            pred = predictor.predict(med)
            all_predictions.append(pred)

            # Display
            risk_label = "🚨 CRITICAL" if pred["overallRisk"] > 0.8 else \
                         "⚠️  HIGH"    if pred["overallRisk"] > 0.5 else "✅ LOW"
            print(f"  {med['name']:15s}  overall={pred['overallRisk']:.3f}  "
                  f"stock={pred['stockRisk']:.3f}  "
                  f"demand={pred['demandForecast']:6d}  {risk_label}")

            # Send to blockchain oracle
            send_to_oracle(pred)

        # Summary
        high_risk = [p for p in all_predictions if p["overallRisk"] > 0.8]
        if high_risk:
            print(f"\n  🚨 {len(high_risk)} CRITICAL medicines detected!")
            for p in high_risk:
                print(f"     → {p['medicine']} (risk: {p['overallRisk']:.3f})")
        else:
            print(f"\n  ✅ All {len(MEDICINES)} medicines within safe range")

        # Save latest predictions to JSON for frontend dashboard
        output = {
            "timestamp":   datetime.now().isoformat(),
            "cycle":       cycle,
            "predictions": all_predictions
        }
        os.makedirs("ai_model", exist_ok=True)
        with open("ai_model/latest_predictions.json", "w") as f:
            json.dump(output, f, indent=2)
        print(f"\n  💾 Saved to ai_model/latest_predictions.json")

        # Retrain every hour if using real LSTM
        if TF_AVAILABLE and cycle % 12 == 0:
            print("\n  🔁 Retraining LSTM on fresh data...")
            for med in MEDICINES:
                predictor.train(med)

        print(f"\n  ⏳ Next cycle in 5 minutes...")
        time.sleep(300)  # 5-minute intervals


if __name__ == "__main__":
    main()