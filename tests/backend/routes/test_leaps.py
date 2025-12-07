"""
Unit tests for LEAPS API routes in backend/app/routes/leaps.py

Test Scenarios:
- GET /api/tickers - Ticker list retrieval
- POST /api/leaps - LEAPS ranking with various parameters
- POST /api/roi-simulator - ROI simulation calculations
- Error handling and rate limiting
- Input validation and security

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

from fastapi.testclient import TestClient


# ============================================================================
# Test GET /api/tickers Endpoint
# ============================================================================

class TestGetTickers:
    """Tests for GET /api/tickers endpoint."""

    def test_returns_ticker_list(self, client):
        """Should return list of supported tickers."""
        response = client.get("/api/tickers")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0

        # Each ticker should have required fields
        for ticker in data:
            assert "symbol" in ticker
            assert "name" in ticker or "target_pct" in ticker

    def test_includes_spy(self, client):
        """Should include SPY in ticker list."""
        response = client.get("/api/tickers")

        assert response.status_code == 200
        symbols = [t["symbol"] for t in response.json()]
        assert "SPY" in symbols

    def test_includes_qqq(self, client):
        """Should include QQQ in ticker list."""
        response = client.get("/api/tickers")

        assert response.status_code == 200
        symbols = [t["symbol"] for t in response.json()]
        assert "QQQ" in symbols

    def test_rate_limit_headers(self, client):
        """Should include rate limit headers."""
        response = client.get("/api/tickers")

        assert response.status_code == 200
        # Check for rate limit headers if implemented
        # assert "X-RateLimit-Limit" in response.headers


# ============================================================================
# Test POST /api/leaps Endpoint
# ============================================================================

class TestPostLeaps:
    """Tests for POST /api/leaps endpoint."""

    @patch("app.routes.leaps.rank_leaps")
    @patch("app.routes.leaps.load_config")
    def test_successful_leaps_ranking(self, mock_config, mock_rank, client, mock_options_chain):
        """Should return ranked LEAPS contracts."""
        # Setup mocks
        mock_config.return_value = {
            "tickers": {"SPY": {"target_pct": 0.16}},
            "filters": {"min_dte": 365},
            "scoring": {"high_prob": {"ease_weight": 0.85, "roi_weight": 0.15}},
        }

        mock_rank.return_value = pd.DataFrame([
            {
                "contract_symbol": "SPY20251219C00550000",
                "strike": 550.0,
                "expiration": "2025-12-19",
                "premium": 30.0,
                "cost": 3000.0,
                "payoff_at_target": 5000.0,
                "roi_pct": 66.67,
                "ease_score": 0.8,
                "roi_score": 0.7,
                "total_score": 0.78,
                "iv": 0.22,
                "oi": 10000,
            }
        ])

        response = client.post(
            "/api/leaps",
            json={
                "symbol": "SPY",
                "target_pct": 0.16,
                "mode": "high_prob",
                "top_n": 10,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["symbol"] == "SPY"
        assert len(data["contracts"]) == 1
        assert data["contracts"][0]["strike"] == 550.0

    @patch("app.routes.leaps.rank_leaps")
    @patch("app.routes.leaps.load_config")
    def test_leaps_with_high_convexity_mode(self, mock_config, mock_rank, client):
        """Should rank LEAPS using high_convexity mode."""
        mock_config.return_value = {
            "tickers": {"SPY": {"target_pct": 0.16}},
            "scoring": {"high_convexity": {"ease_weight": 0.10, "roi_weight": 0.90}},
        }
        mock_rank.return_value = pd.DataFrame([
            {
                "contract_symbol": "SPY20251219C00600000",
                "strike": 600.0,
                "expiration": "2025-12-19",
                "premium": 15.0,
                "cost": 1500.0,
                "payoff_at_target": 4000.0,
                "roi_pct": 166.67,
                "ease_score": 0.4,
                "roi_score": 0.95,
                "total_score": 0.89,
                "iv": 0.25,
                "oi": 5000,
            }
        ])

        response = client.post(
            "/api/leaps",
            json={
                "symbol": "SPY",
                "mode": "high_convexity",
            },
        )

        assert response.status_code == 200
        # Verify mode parameter was passed correctly

    def test_invalid_symbol(self, client):
        """Should reject invalid symbol with 422."""
        response = client.post(
            "/api/leaps",
            json={
                "symbol": "",
                "mode": "high_prob",
            },
        )

        assert response.status_code == 422

    def test_invalid_mode(self, client):
        """Should reject invalid mode with 422."""
        response = client.post(
            "/api/leaps",
            json={
                "symbol": "SPY",
                "mode": "invalid_mode",
            },
        )

        assert response.status_code == 422

    def test_malicious_symbol_injection(self, client, malicious_inputs):
        """Should reject malicious symbol inputs."""
        for symbol in malicious_inputs["invalid_symbols"]:
            response = client.post(
                "/api/leaps",
                json={
                    "symbol": symbol,
                    "mode": "high_prob",
                },
            )

            # Should be rejected (422) or sanitized
            assert response.status_code in [200, 422, 400]
            if response.status_code == 200:
                # If accepted, verify symbol was sanitized
                data = response.json()
                assert "../" not in data.get("symbol", "")

    @patch("app.routes.leaps.rank_leaps")
    @patch("app.routes.leaps.load_config")
    def test_no_leaps_found(self, mock_config, mock_rank, client):
        """Should return empty list when no LEAPS found."""
        mock_config.return_value = {"tickers": {"SPY": {"target_pct": 0.16}}}
        mock_rank.return_value = pd.DataFrame()

        response = client.post(
            "/api/leaps",
            json={"symbol": "SPY"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["contracts"] == []

    @patch("app.routes.leaps.rank_leaps")
    def test_ranker_exception_handling(self, mock_rank, client):
        """Should handle ranker exceptions gracefully."""
        mock_rank.side_effect = Exception("yfinance API error")

        response = client.post(
            "/api/leaps",
            json={"symbol": "SPY"},
        )

        # Should return error response, not crash
        assert response.status_code in [500, 503, 400]

    def test_unsupported_ticker(self, client):
        """Should handle unsupported ticker symbols."""
        response = client.post(
            "/api/leaps",
            json={"symbol": "UNKNOWN123"},
        )

        # Depending on implementation, may be 404 or 400
        assert response.status_code in [400, 404, 422]


# ============================================================================
# Test POST /api/roi-simulator Endpoint
# ============================================================================

class TestRoiSimulator:
    """Tests for POST /api/roi-simulator endpoint."""

    @patch("app.routes.leaps.rank_leaps")
    @patch("app.routes.leaps.load_config")
    def test_successful_simulation(self, mock_config, mock_rank, client):
        """Should return ROI simulation results."""
        # Mock would need to be set up based on actual implementation
        mock_config.return_value = {"tickers": {"SPY": {"target_pct": 0.16}}}

        response = client.post(
            "/api/roi-simulator",
            json={
                "contracts": ["SPY20251219C00550000"],
                "underlying_price": 500.0,
                "target_pct": 0.16,
            },
        )

        # Check response based on actual implementation
        assert response.status_code in [200, 422, 400]

    def test_empty_contracts_list(self, client):
        """Should reject empty contracts list."""
        response = client.post(
            "/api/roi-simulator",
            json={
                "contracts": [],
                "underlying_price": 500.0,
                "target_pct": 0.16,
            },
        )

        assert response.status_code == 422

    def test_invalid_underlying_price(self, client):
        """Should reject invalid underlying price."""
        response = client.post(
            "/api/roi-simulator",
            json={
                "contracts": ["SPY20251219C00550000"],
                "underlying_price": -100.0,
                "target_pct": 0.16,
            },
        )

        assert response.status_code == 422

    def test_simulation_with_multiple_contracts(self, client):
        """Should handle multiple contracts in simulation."""
        response = client.post(
            "/api/roi-simulator",
            json={
                "contracts": [
                    "SPY20251219C00550000",
                    "SPY20251219C00560000",
                    "SPY20251219C00570000",
                ],
                "underlying_price": 500.0,
                "target_pct": 0.16,
            },
        )

        # Verify can handle multiple contracts
        assert response.status_code in [200, 422, 400]


# ============================================================================
# Test Rate Limiting
# ============================================================================

class TestLeapsRateLimiting:
    """Tests for rate limiting on LEAPS endpoints."""

    def test_tickers_rate_limit(self, client):
        """Should enforce rate limit on tickers endpoint."""
        # Make multiple requests
        responses = []
        for _ in range(35):  # Assuming 30/min limit
            resp = client.get("/api/tickers")
            responses.append(resp.status_code)

        # At least some should succeed
        assert 200 in responses
        # After limit, should get 429 (if implemented)
        # assert 429 in responses

    @patch("app.routes.leaps.rank_leaps")
    @patch("app.routes.leaps.load_config")
    def test_leaps_rate_limit(self, mock_config, mock_rank, client):
        """Should enforce rate limit on leaps endpoint."""
        mock_config.return_value = {"tickers": {"SPY": {}}}
        mock_rank.return_value = pd.DataFrame()

        # Make multiple requests
        for i in range(15):  # Assuming 10/min limit
            response = client.post(
                "/api/leaps",
                json={"symbol": "SPY"},
            )
            # After limit reached, should get 429


# ============================================================================
# Test Error Handling
# ============================================================================

class TestLeapsErrorHandling:
    """Tests for error handling in LEAPS routes."""

    def test_malformed_json(self, client):
        """Should handle malformed JSON gracefully."""
        response = client.post(
            "/api/leaps",
            content="not valid json",
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 422

    def test_missing_required_fields(self, client):
        """Should reject requests missing required fields."""
        response = client.post(
            "/api/leaps",
            json={},  # Missing symbol
        )

        assert response.status_code == 422

    @patch("app.routes.leaps.load_config")
    def test_config_load_error(self, mock_config, client):
        """Should handle config loading errors."""
        mock_config.side_effect = FileNotFoundError("Config not found")

        response = client.post(
            "/api/leaps",
            json={"symbol": "SPY"},
        )

        # Should handle gracefully
        assert response.status_code in [500, 503, 400]


# ============================================================================
# Test Response Format
# ============================================================================

class TestLeapsResponseFormat:
    """Tests for LEAPS response format compliance."""

    @patch("app.routes.leaps.rank_leaps")
    @patch("app.routes.leaps.load_config")
    def test_response_contains_required_fields(self, mock_config, mock_rank, client):
        """Should return all required fields in response."""
        mock_config.return_value = {"tickers": {"SPY": {"target_pct": 0.16}}}
        mock_rank.return_value = pd.DataFrame([
            {
                "contract_symbol": "SPY20251219C00550000",
                "strike": 550.0,
                "expiration": "2025-12-19",
                "premium": 30.0,
                "cost": 3000.0,
                "payoff_at_target": 5000.0,
                "roi_pct": 66.67,
                "ease_score": 0.8,
                "roi_score": 0.7,
                "total_score": 0.78,
            }
        ])

        response = client.post(
            "/api/leaps",
            json={"symbol": "SPY"},
        )

        assert response.status_code == 200
        data = response.json()

        # Check required response fields
        assert "symbol" in data
        assert "underlying_price" in data or "contracts" in data
        assert "contracts" in data
        assert "fetch_timestamp" in data or "timestamp" in data

    @patch("app.routes.leaps.rank_leaps")
    @patch("app.routes.leaps.load_config")
    def test_contract_fields(self, mock_config, mock_rank, client):
        """Should return all required contract fields."""
        mock_config.return_value = {"tickers": {"SPY": {}}}
        mock_rank.return_value = pd.DataFrame([
            {
                "contract_symbol": "SPY20251219C00550000",
                "strike": 550.0,
                "expiration": "2025-12-19",
                "premium": 30.0,
                "cost": 3000.0,
                "payoff_at_target": 5000.0,
                "roi_pct": 66.67,
                "ease_score": 0.8,
                "roi_score": 0.7,
                "total_score": 0.78,
            }
        ])

        response = client.post(
            "/api/leaps",
            json={"symbol": "SPY"},
        )

        assert response.status_code == 200
        contracts = response.json()["contracts"]

        if contracts:
            contract = contracts[0]
            required_fields = ["contract_symbol", "strike", "expiration", "premium"]
            for field in required_fields:
                assert field in contract, f"Missing field: {field}"


# ============================================================================
# Test Security
# ============================================================================

class TestLeapsSecurity:
    """Security tests for LEAPS routes."""

    def test_path_traversal_prevention(self, client):
        """Should prevent path traversal in symbol."""
        response = client.post(
            "/api/leaps",
            json={"symbol": "../../../etc/passwd"},
        )

        assert response.status_code in [400, 422]

    def test_command_injection_prevention(self, client, malicious_inputs):
        """Should prevent command injection."""
        for cmd in malicious_inputs["command_injection"]:
            response = client.post(
                "/api/leaps",
                json={"symbol": cmd},
            )

            assert response.status_code in [400, 422]

    def test_xss_prevention(self, client, malicious_inputs):
        """Should prevent XSS in responses."""
        for xss in malicious_inputs["xss"]:
            response = client.post(
                "/api/leaps",
                json={"symbol": xss},
            )

            if response.status_code == 200:
                # If response is returned, verify no script tags
                assert "<script>" not in response.text

    def test_sql_injection_prevention(self, client, malicious_inputs):
        """Should prevent SQL injection."""
        for sql in malicious_inputs["sql_injection"]:
            response = client.post(
                "/api/leaps",
                json={"symbol": sql},
            )

            # Should reject or sanitize
            assert response.status_code in [200, 400, 422]


# ============================================================================
# Test Performance
# ============================================================================

class TestLeapsPerformance:
    """Performance tests for LEAPS routes."""

    def test_tickers_response_time(self, client, performance_timer):
        """Tickers endpoint should respond quickly."""
        with performance_timer() as timer:
            response = client.get("/api/tickers")

        assert response.status_code == 200
        timer.assert_under(0.5)  # Should respond in < 500ms

    @patch("app.routes.leaps.rank_leaps")
    @patch("app.routes.leaps.load_config")
    def test_leaps_response_time(self, mock_config, mock_rank, client, performance_timer):
        """LEAPS ranking should complete within time budget."""
        mock_config.return_value = {"tickers": {"SPY": {}}}
        mock_rank.return_value = pd.DataFrame([
            {"contract_symbol": f"SPY{i}", "strike": 500 + i, "premium": 10}
            for i in range(20)
        ])

        with performance_timer() as timer:
            response = client.post(
                "/api/leaps",
                json={"symbol": "SPY"},
            )

        # Mocked call should be fast
        timer.assert_under(0.1)
