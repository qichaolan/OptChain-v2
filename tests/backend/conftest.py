"""
Pytest configuration and shared fixtures for OptChain-v2 backend tests.

This module provides:
- Path configuration for imports
- Shared fixtures for mocking external APIs
- Test data generators
- FastAPI test client
"""

import io
import json
import sys
import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, Generator
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pytest

# Add backend directory to sys.path for proper imports
backend_dir = Path(__file__).parent.parent.parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))


# ============================================================================
# FastAPI Test Client Fixtures
# ============================================================================

@pytest.fixture
def client():
    """Create FastAPI test client."""
    from fastapi.testclient import TestClient
    from app.main import app
    return TestClient(app)


@pytest.fixture
def async_client():
    """Create async FastAPI test client for async endpoints."""
    from httpx import AsyncClient, ASGITransport
    from app.main import app

    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


# ============================================================================
# Mock Data Fixtures - Stock/Options Data
# ============================================================================

@pytest.fixture
def mock_stock_data() -> pd.DataFrame:
    """Create mock stock data with enough rows for indicators (300 days)."""
    n_days = 300
    dates = pd.date_range("2023-01-01", periods=n_days, freq="B")
    np.random.seed(42)

    close = 100 + np.cumsum(np.random.randn(n_days) * 0.5)
    high = close + np.abs(np.random.randn(n_days)) * 2
    low = close - np.abs(np.random.randn(n_days)) * 2
    open_price = close + np.random.randn(n_days) * 0.5
    volume = np.random.randint(1000000, 5000000, n_days)

    return pd.DataFrame({
        "Date": dates,
        "Open": open_price,
        "High": high,
        "Low": low,
        "Close": close,
        "Volume": volume,
    })


@pytest.fixture
def mock_options_chain() -> Dict[str, pd.DataFrame]:
    """Create mock options chain data for testing."""
    np.random.seed(42)

    # Generate expiration dates
    today = datetime.now()
    expirations = [
        (today + timedelta(days=d)).strftime("%Y-%m-%d")
        for d in [30, 60, 90, 180, 365, 730]
    ]

    calls_data = []
    puts_data = []

    underlying_price = 500.0

    for exp in expirations:
        for i, strike in enumerate(range(400, 650, 10)):
            moneyness = (strike - underlying_price) / underlying_price

            # Call option data
            call_premium = max(0.1, (underlying_price - strike) + 20 + np.random.rand() * 10)
            call_iv = 0.20 + abs(moneyness) * 0.3 + np.random.rand() * 0.05
            call_delta = max(0.01, min(0.99, 0.5 - moneyness))

            calls_data.append({
                "contractSymbol": f"SPY{exp.replace('-', '')}C{strike:05d}000",
                "strike": float(strike),
                "expiration": exp,
                "lastPrice": call_premium,
                "bid": call_premium * 0.98,
                "ask": call_premium * 1.02,
                "volume": np.random.randint(100, 10000),
                "openInterest": np.random.randint(1000, 50000),
                "impliedVolatility": call_iv,
                "delta": call_delta,
                "gamma": 0.01 + np.random.rand() * 0.02,
                "theta": -0.1 - np.random.rand() * 0.1,
                "vega": 0.2 + np.random.rand() * 0.1,
            })

            # Put option data
            put_premium = max(0.1, (strike - underlying_price) + 20 + np.random.rand() * 10)
            put_iv = 0.22 + abs(moneyness) * 0.35 + np.random.rand() * 0.05
            put_delta = -max(0.01, min(0.99, 0.5 + moneyness))

            puts_data.append({
                "contractSymbol": f"SPY{exp.replace('-', '')}P{strike:05d}000",
                "strike": float(strike),
                "expiration": exp,
                "lastPrice": put_premium,
                "bid": put_premium * 0.98,
                "ask": put_premium * 1.02,
                "volume": np.random.randint(100, 10000),
                "openInterest": np.random.randint(1000, 50000),
                "impliedVolatility": put_iv,
                "delta": put_delta,
                "gamma": 0.01 + np.random.rand() * 0.02,
                "theta": -0.1 - np.random.rand() * 0.1,
                "vega": 0.2 + np.random.rand() * 0.1,
            })

    return {
        "calls": pd.DataFrame(calls_data),
        "puts": pd.DataFrame(puts_data),
        "underlying_price": underlying_price,
        "expirations": expirations,
    }


@pytest.fixture
def mock_leaps_contract() -> Dict[str, Any]:
    """Create a single mock LEAPS contract for testing."""
    return {
        "contract_symbol": "SPY20251219C00600000",
        "strike": 600.0,
        "expiration": "2025-12-19",
        "target_price": 580.0,
        "premium": 25.50,
        "cost": 2550.0,
        "payoff_target": 5000.0,
        "roi_target": 96.08,
        "ease_score": 0.75,
        "roi_score": 0.85,
        "score": 0.80,
        "implied_volatility": 0.22,
        "open_interest": 15000,
    }


@pytest.fixture
def mock_credit_spread() -> Dict[str, Any]:
    """Create a mock credit spread for testing."""
    return {
        "symbol": "SPY",
        "spread_type": "PCS",  # Put Credit Spread
        "expiration": "2024-02-16",
        "dte": 30,
        "short_strike": 480.0,
        "long_strike": 475.0,
        "width": 5.0,
        "credit": 1.25,
        "max_loss": 3.75,
        "roc": 0.3333,
        "short_delta": 0.15,
        "delta_estimated": False,
        "prob_profit": 0.725,
        "iv": 0.18,
        "ivp": 0.45,
        "underlying_price": 500.0,
        "break_even": 478.75,
        "break_even_distance_pct": 0.0425,
        "liquidity_score": 0.9,
        "slippage_score": 0.85,
        "total_score": 0.80,
    }


@pytest.fixture
def mock_iron_condor() -> Dict[str, Any]:
    """Create a mock iron condor for testing."""
    return {
        "id": "ic_001",
        "symbol": "SPY",
        "expiration": "2024-02-16",
        "put_spread": {
            "short_strike": 480.0,
            "long_strike": 475.0,
            "credit": 0.75,
        },
        "call_spread": {
            "short_strike": 520.0,
            "long_strike": 525.0,
            "credit": 0.65,
        },
        "total_credit": 1.40,
        "max_loss": 3.60,
        "pop_pct": 68.0,
        "roc_pct": 38.89,
        "break_even_low": 478.60,
        "break_even_high": 521.40,
    }


# ============================================================================
# Mock External API Fixtures
# ============================================================================

@pytest.fixture
def mock_yfinance():
    """Mock yfinance Ticker and download functions."""
    with patch("yfinance.Ticker") as mock_ticker, \
         patch("yfinance.download") as mock_download:

        mock_ticker_instance = MagicMock()
        mock_ticker_instance.info = {
            "regularMarketPrice": 500.0,
            "shortName": "SPDR S&P 500 ETF Trust",
            "symbol": "SPY",
        }
        mock_ticker.return_value = mock_ticker_instance

        yield {
            "Ticker": mock_ticker,
            "download": mock_download,
            "ticker_instance": mock_ticker_instance,
        }


@pytest.fixture
def mock_gcs_client():
    """Mock Google Cloud Storage client."""
    with patch("google.cloud.storage.Client") as mock_client:
        mock_bucket = MagicMock()
        mock_blob = MagicMock()

        mock_client.return_value.bucket.return_value = mock_bucket
        mock_bucket.blob.return_value = mock_blob

        yield {
            "client": mock_client,
            "bucket": mock_bucket,
            "blob": mock_blob,
        }


@pytest.fixture
def mock_gemini():
    """Mock Google Generative AI (Gemini) client."""
    with patch("google.generativeai.GenerativeModel") as mock_model:
        mock_instance = MagicMock()
        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "summary": "Test AI summary",
            "key_insights": [
                {"title": "Insight 1", "description": "Test description", "sentiment": "positive"}
            ],
            "risks": [
                {"risk": "Test risk", "severity": "medium"}
            ],
            "watch_items": [
                {"item": "Test item", "trigger": "Test trigger"}
            ],
            "disclaimer": "For educational purposes only.",
        })

        mock_instance.generate_content.return_value = mock_response
        mock_model.return_value = mock_instance

        yield {
            "model": mock_model,
            "instance": mock_instance,
            "response": mock_response,
        }


# ============================================================================
# Temporary File/Directory Fixtures
# ============================================================================

@pytest.fixture
def temp_dir() -> Generator[Path, None, None]:
    """Create a temporary directory for test files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def temp_config_file(temp_dir) -> Path:
    """Create a temporary YAML config file."""
    config_content = """
scoring:
  high_prob:
    ease_weight: 0.85
    roi_weight: 0.15
  high_convexity:
    ease_weight: 0.10
    roi_weight: 0.90

filters:
  min_dte: 365
  longest_only: true
  max_target_distance_pct: 0.5

tickers:
  SPY:
    target_pct: 0.16
  QQQ:
    target_pct: 0.20

display:
  top_n: 20
  decimals: 2
"""
    config_path = temp_dir / "leaps_ranker.yaml"
    config_path.write_text(config_content)
    return config_path


@pytest.fixture
def mock_parquet_data() -> bytes:
    """Create mock parquet data for GCS cache tests."""
    test_df = pd.DataFrame({
        "date": [datetime(2024, 1, 1), datetime(2024, 1, 2)],
        "signal_raw": [0.5, 0.6],
        "signal_0_1": [0.75, 0.8],
    })
    buffer = io.BytesIO()
    test_df.to_parquet(buffer, index=False)
    buffer.seek(0)
    return buffer.getvalue()


# ============================================================================
# API Request/Response Fixtures
# ============================================================================

@pytest.fixture
def valid_leaps_request() -> Dict[str, Any]:
    """Create a valid LEAPS API request payload."""
    return {
        "symbol": "SPY",
        "target_pct": 0.16,
        "mode": "high_prob",
        "top_n": 10,
    }


@pytest.fixture
def valid_credit_spread_request() -> Dict[str, Any]:
    """Create a valid credit spread API request payload."""
    return {
        "symbol": "SPY",
        "spread_type": "PCS",
        "min_dte": 14,
        "max_dte": 45,
        "min_delta": 0.10,
        "max_delta": 0.30,
        "max_width": 10,
        "min_roc": 0.15,  # Decimal, not percentage (model expects 0.05-1.0)
    }


@pytest.fixture
def valid_iron_condor_request() -> Dict[str, Any]:
    """Create a valid iron condor API request payload."""
    return {
        "symbol": "SPY",
        "min_dte": 14,
        "max_dte": 45,
        "min_pop": 50.0,
        "min_roc": 15.0,
    }


@pytest.fixture
def valid_ai_explainer_request() -> Dict[str, Any]:
    """Create a valid AI explainer API request payload."""
    return {
        "pageId": "leaps_ranker",
        "contextType": "roi_simulator",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "metadata": {
            "symbol": "SPY",
            "underlying_price": 500.0,
            "contracts": [
                {
                    "contract_symbol": "SPY20251219C00550000",
                    "strike": 550.0,
                    "premium": 30.0,
                    "expiration": "2025-12-19",
                }
            ],
        },
    }


# ============================================================================
# Performance Testing Fixtures
# ============================================================================

@pytest.fixture
def performance_timer():
    """Context manager for timing test execution."""
    import time

    class Timer:
        def __init__(self):
            self.start_time = None
            self.end_time = None
            self.elapsed = None

        def __enter__(self):
            self.start_time = time.perf_counter()
            return self

        def __exit__(self, *args):
            self.end_time = time.perf_counter()
            self.elapsed = self.end_time - self.start_time

        def assert_under(self, max_seconds: float):
            assert self.elapsed < max_seconds, \
                f"Execution took {self.elapsed:.3f}s, expected < {max_seconds}s"

    return Timer


# ============================================================================
# Security Testing Fixtures
# ============================================================================

@pytest.fixture
def malicious_inputs() -> Dict[str, list]:
    """Provide malicious input patterns for security testing."""
    return {
        "sql_injection": [
            "'; DROP TABLE users; --",
            "1 OR 1=1",
            "UNION SELECT * FROM passwords",
        ],
        "xss": [
            "<script>alert('xss')</script>",
            "javascript:alert('xss')",
            "<img src=x onerror=alert('xss')>",
        ],
        "path_traversal": [
            "../../../etc/passwd",
            "..\\..\\..\\windows\\system32\\config\\sam",
            "/etc/passwd",
        ],
        "command_injection": [
            "; rm -rf /",
            "| cat /etc/passwd",
            "`whoami`",
            "$(cat /etc/passwd)",
        ],
        "invalid_symbols": [
            "SPY; DROP TABLE",
            "SPY<script>",
            "SPY/../../../",
            "SPY|ls",
        ],
    }


# ============================================================================
# Cleanup Fixtures
# ============================================================================

@pytest.fixture(autouse=True)
def reset_caches():
    """Reset all caches before each test."""
    # Import and clear caches if they exist
    try:
        from app.services import ai_explainer_service
        if hasattr(ai_explainer_service, "_response_cache"):
            ai_explainer_service._response_cache.clear()
        if hasattr(ai_explainer_service, "_rate_limit_tracker"):
            ai_explainer_service._rate_limit_tracker.clear()
    except ImportError:
        pass

    yield

    # Cleanup after test if needed
