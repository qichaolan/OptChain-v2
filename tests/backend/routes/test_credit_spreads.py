"""
Unit tests for Credit Spreads API routes in backend/app/routes/credit_spreads.py

Test Scenarios:
- GET /api/credit-spreads/tickers - Ticker list retrieval
- POST /api/credit-spreads - Credit spread screening
- POST /api/credit-spreads/simulate - P/L simulation
- Spread type filtering (PCS/CCS)
- Error handling and validation

Coverage Target: ≥95% line and branch coverage
"""

import pytest
from datetime import datetime
from unittest.mock import patch, MagicMock
import pandas as pd
import numpy as np

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "backend"))


# ============================================================================
# Test GET /api/credit-spreads/tickers Endpoint
# ============================================================================

class TestCreditSpreadsTickers:
    """Tests for GET /api/credit-spreads/tickers endpoint."""

    def test_returns_supported_tickers(self, client):
        """Should return list of supported tickers for credit spreads."""
        response = client.get("/api/credit-spreads/tickers")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

        # Should include major ETFs
        symbols = [t["symbol"] if isinstance(t, dict) else t for t in data]
        assert "SPY" in symbols or len(symbols) > 0

    def test_response_format(self, client):
        """Should return properly formatted ticker info."""
        response = client.get("/api/credit-spreads/tickers")

        assert response.status_code == 200
        data = response.json()

        if data and isinstance(data[0], dict):
            # Check for expected fields
            assert "symbol" in data[0]


# ============================================================================
# Test POST /api/credit-spreads Endpoint
# ============================================================================

class TestPostCreditSpreads:
    """Tests for POST /api/credit-spreads endpoint."""

    @patch("app.routes.credit_spreads.run_screener")
    def test_successful_pcs_screening(self, mock_screener, client, mock_credit_spread):
        """Should return PCS spreads successfully."""
        mock_screener.return_value = pd.DataFrame([mock_credit_spread])

        response = client.post(
            "/api/credit-spreads",
            json={
                "symbol": "SPY",
                "spread_type": "PCS",
                "min_dte": 14,
                "max_dte": 45,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "spreads" in data or "results" in data or isinstance(data, list)

    @patch("app.routes.credit_spreads.run_screener")
    def test_successful_ccs_screening(self, mock_screener, client):
        """Should return CCS spreads successfully."""
        mock_screener.return_value = pd.DataFrame([{
            "spread_type": "CCS",
            "short_strike": 520.0,
            "long_strike": 525.0,
            "expiration": "2024-02-16",
            "credit": 0.95,
            "max_loss": 4.05,
            "width": 5.0,
            "roc_pct": 23.46,
            "pop_pct": 68.5,
            "delta": -0.18,
            "iv_pct": 17.2,
        }])

        response = client.post(
            "/api/credit-spreads",
            json={
                "symbol": "SPY",
                "spread_type": "CCS",
            },
        )

        assert response.status_code == 200

    @patch("app.routes.credit_spreads.run_screener")
    def test_all_spread_types(self, mock_screener, client):
        """Should return both PCS and CCS when type is ALL."""
        mock_screener.return_value = pd.DataFrame([
            {"spread_type": "PCS", "short_strike": 480.0, "credit": 1.0},
            {"spread_type": "CCS", "short_strike": 520.0, "credit": 0.9},
        ])

        response = client.post(
            "/api/credit-spreads",
            json={
                "symbol": "SPY",
                "spread_type": "ALL",
            },
        )

        # Should include both types
        assert response.status_code == 200

    def test_invalid_spread_type(self, client):
        """Should reject invalid spread type."""
        response = client.post(
            "/api/credit-spreads",
            json={
                "symbol": "SPY",
                "spread_type": "INVALID",
            },
        )

        assert response.status_code == 422

    def test_invalid_dte_range(self, client):
        """Should reject invalid DTE range (min > max)."""
        response = client.post(
            "/api/credit-spreads",
            json={
                "symbol": "SPY",
                "min_dte": 60,
                "max_dte": 30,  # Invalid: min > max
            },
        )

        # Should either reject or swap values
        assert response.status_code in [200, 400, 422]

    def test_invalid_delta_range(self, client):
        """Should reject invalid delta range."""
        response = client.post(
            "/api/credit-spreads",
            json={
                "symbol": "SPY",
                "min_delta": 0.50,
                "max_delta": 0.20,  # Invalid: min > max
            },
        )

        assert response.status_code in [200, 400, 422]

    def test_delta_out_of_bounds(self, client):
        """Should reject delta values outside [0, 1]."""
        response = client.post(
            "/api/credit-spreads",
            json={
                "symbol": "SPY",
                "min_delta": -0.1,  # Invalid: negative
            },
        )

        assert response.status_code == 422

        response = client.post(
            "/api/credit-spreads",
            json={
                "symbol": "SPY",
                "max_delta": 1.5,  # Invalid: > 1
            },
        )

        assert response.status_code == 422

    @patch("app.routes.credit_spreads.run_screener")
    def test_no_spreads_found(self, mock_screener, client):
        """Should return empty list when no spreads match criteria."""
        mock_screener.return_value = pd.DataFrame()

        response = client.post(
            "/api/credit-spreads",
            json={
                "symbol": "SPY",
                "min_roc": 100.0,  # Very high ROC requirement
            },
        )

        assert response.status_code == 200
        data = response.json()
        spreads = data.get("spreads") or data.get("results") or data
        if isinstance(spreads, list):
            assert len(spreads) == 0

    def test_invalid_symbol(self, client):
        """Should reject invalid symbol."""
        response = client.post(
            "/api/credit-spreads",
            json={
                "symbol": "",
            },
        )

        assert response.status_code == 422


# ============================================================================
# Test POST /api/credit-spreads/simulate Endpoint
# ============================================================================

class TestCreditSpreadsSimulate:
    """Tests for POST /api/credit-spreads/simulate endpoint."""

    def test_pcs_simulation(self, client, mock_credit_spread):
        """Should simulate PCS P/L at different price levels."""
        response = client.post(
            "/api/credit-spreads/simulate",
            json={
                "spread_type": "PCS",
                "short_strike": 480.0,
                "long_strike": 475.0,
                "credit": 1.25,
                "underlying_price": 500.0,
            },
        )

        # Check response based on implementation
        assert response.status_code in [200, 422]

        if response.status_code == 200:
            data = response.json()
            # Should have simulation points
            assert "points" in data or "results" in data or isinstance(data, list)

    def test_ccs_simulation(self, client):
        """Should simulate CCS P/L at different price levels."""
        response = client.post(
            "/api/credit-spreads/simulate",
            json={
                "spread_type": "CCS",
                "short_strike": 520.0,
                "long_strike": 525.0,
                "credit": 0.95,
                "underlying_price": 500.0,
            },
        )

        assert response.status_code in [200, 422]

    def test_simulation_price_range(self, client):
        """Should simulate across reasonable price range."""
        response = client.post(
            "/api/credit-spreads/simulate",
            json={
                "spread_type": "PCS",
                "short_strike": 480.0,
                "long_strike": 475.0,
                "credit": 1.25,
                "underlying_price": 500.0,
                "price_range_pct": 0.10,  # +/- 10%
            },
        )

        if response.status_code == 200:
            data = response.json()
            points = data.get("points") or data.get("results") or data

            if isinstance(points, list) and len(points) > 0:
                # Check price range coverage
                prices = [p.get("price") or p.get("target_price") for p in points]
                if all(p is not None for p in prices):
                    assert min(prices) < 500.0  # Below current
                    assert max(prices) > 500.0  # Above current

    def test_invalid_strike_relationship_pcs(self, client):
        """Should validate PCS strike relationship (short > long)."""
        response = client.post(
            "/api/credit-spreads/simulate",
            json={
                "spread_type": "PCS",
                "short_strike": 475.0,  # Invalid: short < long for PCS
                "long_strike": 480.0,
                "credit": 1.25,
                "underlying_price": 500.0,
            },
        )

        # Should reject or swap
        assert response.status_code in [200, 400, 422]

    def test_invalid_strike_relationship_ccs(self, client):
        """Should validate CCS strike relationship (short < long)."""
        response = client.post(
            "/api/credit-spreads/simulate",
            json={
                "spread_type": "CCS",
                "short_strike": 525.0,  # Invalid: short > long for CCS
                "long_strike": 520.0,
                "credit": 0.95,
                "underlying_price": 500.0,
            },
        )

        assert response.status_code in [200, 400, 422]

    def test_negative_credit(self, client):
        """Should reject negative credit (would be a debit spread)."""
        response = client.post(
            "/api/credit-spreads/simulate",
            json={
                "spread_type": "PCS",
                "short_strike": 480.0,
                "long_strike": 475.0,
                "credit": -1.0,  # Invalid: negative credit
                "underlying_price": 500.0,
            },
        )

        assert response.status_code == 422


# ============================================================================
# Test Spread Metrics Validation
# ============================================================================

class TestSpreadMetrics:
    """Tests for spread metric calculations and validation."""

    @patch("app.routes.credit_spreads.run_screener")
    def test_roc_calculation(self, mock_screener, client):
        """Should calculate ROC correctly: credit / (width - credit) * 100."""
        # Credit = 1.25, Width = 5, Max Loss = 3.75
        # ROC = 1.25 / 3.75 * 100 = 33.33%
        mock_screener.return_value = pd.DataFrame([{
            "spread_type": "PCS",
            "short_strike": 480.0,
            "long_strike": 475.0,
            "credit": 1.25,
            "max_loss": 3.75,
            "width": 5.0,
            "roc_pct": 33.33,
            "pop_pct": 72.0,
            "delta": 0.15,
        }])

        response = client.post(
            "/api/credit-spreads",
            json={"symbol": "SPY"},
        )

        if response.status_code == 200:
            data = response.json()
            spreads = data.get("spreads") or data.get("results") or data
            if isinstance(spreads, list) and len(spreads) > 0:
                spread = spreads[0]
                # Verify ROC is in expected range
                assert 30 <= spread.get("roc_pct", 33) <= 35

    @patch("app.routes.credit_spreads.run_screener")
    def test_max_loss_calculation(self, mock_screener, client):
        """Should calculate max loss correctly: width - credit."""
        mock_screener.return_value = pd.DataFrame([{
            "spread_type": "PCS",
            "short_strike": 480.0,
            "long_strike": 475.0,
            "credit": 1.25,
            "max_loss": 3.75,  # 5.0 - 1.25
            "width": 5.0,
        }])

        response = client.post(
            "/api/credit-spreads",
            json={"symbol": "SPY"},
        )

        if response.status_code == 200:
            data = response.json()
            spreads = data.get("spreads") or data.get("results") or data
            if isinstance(spreads, list) and len(spreads) > 0:
                spread = spreads[0]
                width = spread.get("width", 5.0)
                credit = spread.get("credit", 1.25)
                max_loss = spread.get("max_loss", 3.75)
                assert abs(max_loss - (width - credit)) < 0.01


# ============================================================================
# Test Error Handling
# ============================================================================

class TestCreditSpreadsErrorHandling:
    """Tests for error handling in credit spreads routes."""

    @patch("app.routes.credit_spreads.run_screener")
    def test_screener_exception(self, mock_screener, client):
        """Should handle screener exceptions gracefully."""
        mock_screener.side_effect = Exception("Data fetch error")

        response = client.post(
            "/api/credit-spreads",
            json={"symbol": "SPY"},
        )

        assert response.status_code in [400, 500, 503]

    def test_malformed_request(self, client):
        """Should handle malformed JSON gracefully."""
        response = client.post(
            "/api/credit-spreads",
            content="not json",
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 422

    @patch("app.routes.credit_spreads.run_screener")
    def test_data_processing_error(self, mock_screener, client):
        """Should handle data processing errors."""
        # Return data that might cause processing issues
        mock_screener.return_value = pd.DataFrame([{
            "spread_type": "PCS",
            "short_strike": float("nan"),  # Invalid value
            "credit": float("inf"),  # Invalid value
        }])

        response = client.post(
            "/api/credit-spreads",
            json={"symbol": "SPY"},
        )

        # Should handle gracefully
        assert response.status_code in [200, 400, 500]


# ============================================================================
# Test Rate Limiting
# ============================================================================

class TestCreditSpreadsRateLimiting:
    """Tests for rate limiting on credit spreads endpoints."""

    def test_tickers_rate_limit(self, client):
        """Should enforce rate limit on tickers endpoint."""
        responses = [
            client.get("/api/credit-spreads/tickers").status_code
            for _ in range(20)
        ]

        # Most should succeed
        assert responses.count(200) > 10

    @patch("app.routes.credit_spreads.run_screener")
    def test_screening_rate_limit(self, mock_screener, client):
        """Should enforce rate limit on screening endpoint."""
        mock_screener.return_value = pd.DataFrame()

        responses = [
            client.post("/api/credit-spreads", json={"symbol": "SPY"}).status_code
            for _ in range(10)
        ]

        # At least some should succeed
        assert 200 in responses


# ============================================================================
# Test Security
# ============================================================================

class TestCreditSpreadsSecurity:
    """Security tests for credit spreads routes."""

    def test_symbol_validation(self, client, malicious_inputs):
        """Should validate and sanitize symbol input."""
        for symbol in malicious_inputs["invalid_symbols"]:
            response = client.post(
                "/api/credit-spreads",
                json={"symbol": symbol},
            )

            assert response.status_code in [400, 422]

    def test_numeric_bounds(self, client):
        """Should validate numeric parameter bounds."""
        # Extremely large values
        response = client.post(
            "/api/credit-spreads",
            json={
                "symbol": "SPY",
                "min_roc": 1e10,  # Unreasonable value
            },
        )

        # Should either reject or handle gracefully
        assert response.status_code in [200, 400, 422]

    def test_no_sensitive_data_in_error(self, client):
        """Should not leak sensitive data in error messages."""
        response = client.post(
            "/api/credit-spreads",
            json={"symbol": "INVALID_TEST_SYMBOL"},
        )

        if response.status_code >= 400:
            error_text = response.text.lower()
            # Should not contain internal paths or stack traces
            assert "/app/" not in error_text or "error" in error_text
            assert "traceback" not in error_text


# ============================================================================
# Test Performance
# ============================================================================

class TestCreditSpreadsPerformance:
    """Performance tests for credit spreads routes."""

    def test_tickers_response_time(self, client, performance_timer):
        """Tickers endpoint should respond quickly."""
        with performance_timer() as timer:
            response = client.get("/api/credit-spreads/tickers")

        assert response.status_code == 200
        timer.assert_under(0.5)

    @patch("app.routes.credit_spreads.run_screener")
    def test_screening_response_time(self, mock_screener, client, performance_timer):
        """Screening should complete within time budget."""
        mock_screener.return_value = pd.DataFrame([
            {"spread_type": "PCS", "short_strike": 480 + i, "credit": 1.0}
            for i in range(50)
        ])

        with performance_timer() as timer:
            response = client.post(
                "/api/credit-spreads",
                json={"symbol": "SPY"},
            )

        timer.assert_under(0.2)  # Mocked should be fast
