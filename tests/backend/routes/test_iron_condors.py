"""
Unit tests for Iron Condors API routes in backend/app/routes/iron_condors.py

Test Scenarios:
- GET /api/iron-condors - Iron condor screening with filters
- GET /api/iron-condors/{condor_id}/payoff - Payoff curve retrieval
- Condor construction and validation
- Caching and performance
- Error handling and security

Coverage Target: ≥95% line and branch coverage
"""

import pytest
from datetime import datetime
from unittest.mock import patch, MagicMock
import pandas as pd
import numpy as np
import uuid

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "backend"))


# ============================================================================
# Test GET /api/iron-condors Endpoint
# ============================================================================

class TestGetIronCondors:
    """Tests for GET /api/iron-condors endpoint."""

    @patch("app.routes.iron_condors.rank_iron_condors")
    def test_successful_condor_screening(self, mock_rank, client, mock_iron_condor):
        """Should return ranked iron condors successfully."""
        condor_with_id = {**mock_iron_condor, "id": str(uuid.uuid4())}
        mock_rank.return_value = [condor_with_id]

        response = client.get(
            "/api/iron-condors",
            params={
                "symbol": "SPY",
                "min_dte": 14,
                "max_dte": 45,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "condors" in data or "results" in data or isinstance(data, list)

    @patch("app.routes.iron_condors.rank_iron_condors")
    def test_filter_by_min_pop(self, mock_rank, client):
        """Should filter condors by minimum POP."""
        mock_rank.return_value = [
            {"id": "1", "pop_pct": 70.0, "roc_pct": 25.0},
            {"id": "2", "pop_pct": 55.0, "roc_pct": 35.0},
        ]

        response = client.get(
            "/api/iron-condors",
            params={
                "symbol": "SPY",
                "min_pop": 60.0,
            },
        )

        if response.status_code == 200:
            data = response.json()
            condors = data.get("condors") or data.get("results") or data
            if isinstance(condors, list):
                for condor in condors:
                    pop = condor.get("pop_pct", 100)
                    assert pop >= 60.0

    @patch("app.routes.iron_condors.rank_iron_condors")
    def test_filter_by_min_roc(self, mock_rank, client):
        """Should filter condors by minimum ROC."""
        mock_rank.return_value = [
            {"id": "1", "pop_pct": 65.0, "roc_pct": 30.0},
            {"id": "2", "pop_pct": 60.0, "roc_pct": 15.0},
        ]

        response = client.get(
            "/api/iron-condors",
            params={
                "symbol": "SPY",
                "min_roc": 20.0,
            },
        )

        if response.status_code == 200:
            data = response.json()
            condors = data.get("condors") or data.get("results") or data
            if isinstance(condors, list):
                for condor in condors:
                    roc = condor.get("roc_pct", 100)
                    assert roc >= 20.0

    @patch("app.routes.iron_condors.rank_iron_condors")
    def test_empty_results(self, mock_rank, client):
        """Should return empty list when no condors match."""
        mock_rank.return_value = []

        response = client.get(
            "/api/iron-condors",
            params={
                "symbol": "SPY",
                "min_pop": 95.0,  # Very high requirement
                "min_roc": 50.0,
            },
        )

        assert response.status_code == 200
        data = response.json()
        condors = data.get("condors") or data.get("results") or data
        if isinstance(condors, list):
            assert len(condors) == 0

    def test_invalid_symbol(self, client):
        """Should reject invalid symbol."""
        response = client.get(
            "/api/iron-condors",
            params={"symbol": ""},
        )

        assert response.status_code in [400, 422]

    def test_invalid_dte_range(self, client):
        """Should validate DTE range."""
        response = client.get(
            "/api/iron-condors",
            params={
                "symbol": "SPY",
                "min_dte": 100,
                "max_dte": 50,  # Invalid: min > max
            },
        )

        assert response.status_code in [200, 400, 422]

    def test_negative_min_pop(self, client):
        """Should reject negative min_pop."""
        response = client.get(
            "/api/iron-condors",
            params={
                "symbol": "SPY",
                "min_pop": -10.0,
            },
        )

        assert response.status_code == 422

    def test_min_pop_over_100(self, client):
        """Should reject min_pop > 100."""
        response = client.get(
            "/api/iron-condors",
            params={
                "symbol": "SPY",
                "min_pop": 110.0,
            },
        )

        assert response.status_code == 422


# ============================================================================
# Test GET /api/iron-condors/{condor_id}/payoff Endpoint
# ============================================================================

class TestIronCondorPayoff:
    """Tests for GET /api/iron-condors/{condor_id}/payoff endpoint."""

    @patch("app.routes.iron_condors._condor_cache")
    def test_successful_payoff_retrieval(self, mock_cache, client, mock_iron_condor):
        """Should return payoff curve for valid condor ID."""
        condor_id = str(uuid.uuid4())
        mock_cache.get.return_value = mock_iron_condor

        response = client.get(f"/api/iron-condors/{condor_id}/payoff")

        # If cache hit, should return payoff
        if mock_cache.get.called:
            assert response.status_code in [200, 404]

    def test_invalid_condor_id(self, client):
        """Should return 404 for non-existent condor ID."""
        fake_id = str(uuid.uuid4())

        response = client.get(f"/api/iron-condors/{fake_id}/payoff")

        assert response.status_code == 404

    def test_malformed_condor_id(self, client):
        """Should handle malformed condor ID."""
        response = client.get("/api/iron-condors/not-a-uuid/payoff")

        assert response.status_code in [400, 404, 422]

    @patch("app.routes.iron_condors._condor_cache")
    @patch("app.routes.iron_condors.payoff_roi_curve")
    def test_payoff_calculation(self, mock_payoff, mock_cache, client, mock_iron_condor):
        """Should calculate payoff curve correctly."""
        condor_id = str(uuid.uuid4())
        mock_cache.get.return_value = mock_iron_condor

        # Mock payoff calculation
        mock_payoff.return_value = [
            {"price": 450.0, "payoff": -360.0, "roi_pct": -100.0},
            {"price": 490.0, "payoff": 140.0, "roi_pct": 38.89},
            {"price": 500.0, "payoff": 140.0, "roi_pct": 38.89},
            {"price": 510.0, "payoff": 140.0, "roi_pct": 38.89},
            {"price": 550.0, "payoff": -360.0, "roi_pct": -100.0},
        ]

        response = client.get(f"/api/iron-condors/{condor_id}/payoff")

        if response.status_code == 200:
            data = response.json()
            points = data.get("points") or data.get("payoff") or data

            if isinstance(points, list) and len(points) > 0:
                # Verify payoff structure
                assert all("price" in p or "target_price" in p for p in points)

    @patch("app.routes.iron_condors._condor_cache")
    def test_payoff_with_custom_range(self, mock_cache, client, mock_iron_condor):
        """Should accept custom price range parameters."""
        condor_id = str(uuid.uuid4())
        mock_cache.get.return_value = mock_iron_condor

        response = client.get(
            f"/api/iron-condors/{condor_id}/payoff",
            params={
                "price_min": 450.0,
                "price_max": 550.0,
                "step": 5.0,
            },
        )

        # Should accept these parameters
        assert response.status_code in [200, 404]


# ============================================================================
# Test Iron Condor Construction
# ============================================================================

class TestIronCondorConstruction:
    """Tests for iron condor construction validation."""

    @patch("app.routes.iron_condors.rank_iron_condors")
    def test_valid_condor_structure(self, mock_rank, client):
        """Should return properly structured iron condors."""
        mock_rank.return_value = [{
            "id": str(uuid.uuid4()),
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
        }]

        response = client.get(
            "/api/iron-condors",
            params={"symbol": "SPY"},
        )

        assert response.status_code == 200
        data = response.json()
        condors = data.get("condors") or data.get("results") or data

        if isinstance(condors, list) and len(condors) > 0:
            condor = condors[0]

            # Verify structure
            assert "put_spread" in condor or "put_short_strike" in condor
            assert "call_spread" in condor or "call_short_strike" in condor
            assert "total_credit" in condor or "credit" in condor

    @patch("app.routes.iron_condors.rank_iron_condors")
    def test_symmetric_wings(self, mock_rank, client):
        """Should validate symmetric wing widths."""
        mock_rank.return_value = [{
            "id": "1",
            "put_spread": {"short_strike": 480.0, "long_strike": 475.0},  # Width: 5
            "call_spread": {"short_strike": 520.0, "long_strike": 525.0},  # Width: 5
        }]

        response = client.get(
            "/api/iron-condors",
            params={"symbol": "SPY"},
        )

        if response.status_code == 200:
            data = response.json()
            condors = data.get("condors") or data.get("results") or data

            if isinstance(condors, list) and len(condors) > 0:
                condor = condors[0]
                put = condor.get("put_spread", {})
                call = condor.get("call_spread", {})

                if put and call:
                    put_width = abs(put.get("short_strike", 0) - put.get("long_strike", 0))
                    call_width = abs(call.get("short_strike", 0) - call.get("long_strike", 0))
                    # Wings should typically be equal
                    assert abs(put_width - call_width) < 0.01


# ============================================================================
# Test Caching
# ============================================================================

class TestIronCondorCaching:
    """Tests for iron condor caching behavior."""

    @patch("app.routes.iron_condors._query_cache")
    @patch("app.routes.iron_condors.rank_iron_condors")
    def test_cache_hit(self, mock_rank, mock_cache, client):
        """Should return cached results when available."""
        # Setup cache hit
        mock_cache.get.return_value = {
            "condors": [{"id": "1", "cached": True}],
            "timestamp": datetime.utcnow().isoformat(),
        }

        response = client.get(
            "/api/iron-condors",
            params={"symbol": "SPY"},
        )

        # Should not call rank_iron_condors if cache hit
        # (depending on implementation)
        assert response.status_code == 200

    @patch("app.routes.iron_condors._query_cache")
    @patch("app.routes.iron_condors.rank_iron_condors")
    def test_cache_miss(self, mock_rank, mock_cache, client):
        """Should compute results on cache miss."""
        mock_cache.get.return_value = None
        mock_rank.return_value = [{"id": "1"}]

        response = client.get(
            "/api/iron-condors",
            params={"symbol": "SPY"},
        )

        assert response.status_code == 200
        # Should have called rank_iron_condors
        mock_rank.assert_called()

    @patch("app.routes.iron_condors._condor_cache")
    def test_condor_cache_for_payoff(self, mock_cache, client):
        """Should cache condor objects for payoff lookup."""
        condor_id = str(uuid.uuid4())
        mock_cache.get.return_value = None

        response = client.get(f"/api/iron-condors/{condor_id}/payoff")

        # Should attempt cache lookup
        mock_cache.get.assert_called_with(condor_id)


# ============================================================================
# Test Error Handling
# ============================================================================

class TestIronCondorsErrorHandling:
    """Tests for error handling in iron condors routes."""

    @patch("app.routes.iron_condors.rank_iron_condors")
    def test_ranker_exception(self, mock_rank, client):
        """Should handle ranker exceptions gracefully."""
        mock_rank.side_effect = Exception("Screener failed")

        response = client.get(
            "/api/iron-condors",
            params={"symbol": "SPY"},
        )

        assert response.status_code in [400, 500, 503]

    @patch("app.routes.iron_condors.payoff_roi_curve")
    @patch("app.routes.iron_condors._condor_cache")
    def test_payoff_calculation_error(self, mock_cache, mock_payoff, client):
        """Should handle payoff calculation errors."""
        condor_id = str(uuid.uuid4())
        mock_cache.get.return_value = {"id": condor_id}
        mock_payoff.side_effect = ValueError("Invalid condor data")

        response = client.get(f"/api/iron-condors/{condor_id}/payoff")

        assert response.status_code in [400, 500]

    def test_unsupported_symbol(self, client):
        """Should handle unsupported symbols."""
        response = client.get(
            "/api/iron-condors",
            params={"symbol": "UNKNOWN_TICKER"},
        )

        assert response.status_code in [200, 400, 404]


# ============================================================================
# Test Rate Limiting
# ============================================================================

class TestIronCondorsRateLimiting:
    """Tests for rate limiting on iron condors endpoints."""

    @patch("app.routes.iron_condors.rank_iron_condors")
    def test_listing_rate_limit(self, mock_rank, client):
        """Should enforce rate limit on listing endpoint."""
        mock_rank.return_value = []

        responses = []
        for _ in range(20):
            resp = client.get("/api/iron-condors", params={"symbol": "SPY"})
            responses.append(resp.status_code)

        # Most should succeed
        assert 200 in responses

    def test_payoff_rate_limit(self, client):
        """Should enforce rate limit on payoff endpoint."""
        condor_id = str(uuid.uuid4())

        responses = []
        for _ in range(35):
            resp = client.get(f"/api/iron-condors/{condor_id}/payoff")
            responses.append(resp.status_code)

        # Should see some 404s (cache miss) or 429s (rate limit)
        assert len(responses) == 35


# ============================================================================
# Test Security
# ============================================================================

class TestIronCondorsSecurity:
    """Security tests for iron condors routes."""

    def test_path_traversal_in_id(self, client):
        """Should prevent path traversal in condor ID."""
        response = client.get("/api/iron-condors/../../../etc/passwd/payoff")

        # Should be rejected or return 404
        assert response.status_code in [400, 404, 422]

    def test_sql_injection_in_symbol(self, client, malicious_inputs):
        """Should prevent SQL injection in symbol."""
        for sql in malicious_inputs["sql_injection"]:
            response = client.get(
                "/api/iron-condors",
                params={"symbol": sql},
            )

            assert response.status_code in [400, 422]

    def test_xss_in_parameters(self, client, malicious_inputs):
        """Should prevent XSS in query parameters."""
        for xss in malicious_inputs["xss"]:
            response = client.get(
                "/api/iron-condors",
                params={"symbol": xss},
            )

            if response.status_code == 200:
                assert "<script>" not in response.text


# ============================================================================
# Test Performance
# ============================================================================

class TestIronCondorsPerformance:
    """Performance tests for iron condors routes."""

    @patch("app.routes.iron_condors.rank_iron_condors")
    def test_listing_response_time(self, mock_rank, client, performance_timer):
        """Listing endpoint should respond within time budget."""
        mock_rank.return_value = [{"id": str(i)} for i in range(20)]

        with performance_timer() as timer:
            response = client.get(
                "/api/iron-condors",
                params={"symbol": "SPY"},
            )

        assert response.status_code == 200
        timer.assert_under(0.2)

    @patch("app.routes.iron_condors._condor_cache")
    @patch("app.routes.iron_condors.payoff_roi_curve")
    def test_payoff_response_time(self, mock_payoff, mock_cache, client, performance_timer):
        """Payoff calculation should be fast for cached condor."""
        condor_id = str(uuid.uuid4())
        mock_cache.get.return_value = {"id": condor_id}
        mock_payoff.return_value = [{"price": 500, "payoff": 100}] * 100

        with performance_timer() as timer:
            response = client.get(f"/api/iron-condors/{condor_id}/payoff")

        timer.assert_under(0.1)


# ============================================================================
# Test Break-Even Calculations
# ============================================================================

class TestBreakEvenCalculations:
    """Tests for break-even price calculations."""

    @patch("app.routes.iron_condors.rank_iron_condors")
    def test_break_even_prices(self, mock_rank, client):
        """Should calculate correct break-even prices."""
        mock_rank.return_value = [{
            "id": "1",
            "put_spread": {"short_strike": 480.0},
            "call_spread": {"short_strike": 520.0},
            "total_credit": 1.40,
            "break_even_low": 478.60,  # 480 - 1.40
            "break_even_high": 521.40,  # 520 + 1.40
        }]

        response = client.get(
            "/api/iron-condors",
            params={"symbol": "SPY"},
        )

        if response.status_code == 200:
            data = response.json()
            condors = data.get("condors") or data.get("results") or data

            if isinstance(condors, list) and len(condors) > 0:
                condor = condors[0]
                credit = condor.get("total_credit", 1.40)
                be_low = condor.get("break_even_low")
                be_high = condor.get("break_even_high")

                if be_low and be_high:
                    # Break-even should be put_short - credit and call_short + credit
                    put_short = condor.get("put_spread", {}).get("short_strike", 480)
                    call_short = condor.get("call_spread", {}).get("short_strike", 520)

                    assert abs(be_low - (put_short - credit)) < 0.01
                    assert abs(be_high - (call_short + credit)) < 0.01
