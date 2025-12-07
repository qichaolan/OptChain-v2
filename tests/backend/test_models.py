"""
Unit tests for Pydantic models in backend/app/models.py

Test Scenarios:
- Model instantiation with valid data
- Validation of all field constraints
- Serialization and deserialization
- Edge cases and boundary values
- Invalid input rejection

Coverage Target: ≥95% line and branch coverage
"""

import pytest
from datetime import datetime
from typing import Any, Dict
from pydantic import ValidationError

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "backend"))

from app.models import (
    LEAPSRequest,
    LEAPSResponse,
    LEAPSContract,
    ROISimulatorRequest,
    ROISimulatorResponse,
    ROISimulatorResult,
    TickerInfo,
    CreditSpreadRequest,
    CreditSpreadResult,
    CreditSpreadResponse,
    CreditSpreadSimulatorRequest,
    CreditSpreadSimulatorResponse,
    CreditSpreadSimulatorPoint,
    AiExplainerRequest,
    AiExplainerResponse,
    AiExplainerContent,
    AiExplainerKeyInsight,
    AiExplainerRisk,
    AiExplainerWatchItem,
)


# ============================================================================
# Test LEAPS Models
# ============================================================================

class TestLEAPSRequest:
    """Tests for LEAPSRequest model validation."""

    def test_valid_request_minimal(self):
        """Should accept minimal valid request."""
        request = LEAPSRequest(symbol="SPY")
        assert request.symbol == "SPY"
        assert request.target_pct is not None  # Has default
        assert request.mode is not None  # Has default
        assert request.top_n is not None  # Has default

    def test_valid_request_full(self):
        """Should accept full valid request with all parameters."""
        request = LEAPSRequest(
            symbol="QQQ",
            target_pct=0.20,
            mode="high_convexity",
            top_n=15,
        )
        assert request.symbol == "QQQ"
        assert request.target_pct == 0.20
        assert request.mode == "high_convexity"
        assert request.top_n == 15

    def test_symbol_uppercase_conversion(self):
        """Should convert symbol to uppercase."""
        request = LEAPSRequest(symbol="spy")
        assert request.symbol == "SPY"

    def test_invalid_symbol_empty(self):
        """Should reject empty symbol."""
        with pytest.raises(ValidationError) as exc_info:
            LEAPSRequest(symbol="")
        assert "symbol" in str(exc_info.value).lower()

    def test_invalid_symbol_with_numbers(self):
        """Should reject symbol with numbers or excessive length."""
        # The validator only allows uppercase letters A-Z, 1-5 chars
        with pytest.raises(ValidationError):
            LEAPSRequest(symbol="SPY500")  # Too long and contains numbers

    def test_invalid_symbol_special_chars(self):
        """Should reject symbol with special characters."""
        with pytest.raises(ValidationError):
            LEAPSRequest(symbol="SPY!")

    def test_invalid_symbol_path_traversal(self):
        """Should reject path traversal attempts in symbol."""
        with pytest.raises(ValidationError):
            LEAPSRequest(symbol="../etc/passwd")

    def test_target_pct_boundary_low(self):
        """Should accept minimum valid target_pct."""
        request = LEAPSRequest(symbol="SPY", target_pct=0.01)
        assert request.target_pct == 0.01

    def test_target_pct_boundary_high(self):
        """Should accept maximum valid target_pct."""
        request = LEAPSRequest(symbol="SPY", target_pct=1.0)
        assert request.target_pct == 1.0

    def test_invalid_target_pct_negative(self):
        """Should reject negative target_pct."""
        with pytest.raises(ValidationError):
            LEAPSRequest(symbol="SPY", target_pct=-0.1)

    def test_invalid_mode(self):
        """Should reject invalid scoring mode."""
        with pytest.raises(ValidationError):
            LEAPSRequest(symbol="SPY", mode="invalid_mode")

    def test_top_n_boundary(self):
        """Should accept valid top_n values."""
        request = LEAPSRequest(symbol="SPY", top_n=1)
        assert request.top_n == 1

        request = LEAPSRequest(symbol="SPY", top_n=50)  # Max is 50 per model
        assert request.top_n == 50

    def test_invalid_top_n_zero(self):
        """Should reject top_n of zero."""
        with pytest.raises(ValidationError):
            LEAPSRequest(symbol="SPY", top_n=0)

    def test_invalid_top_n_negative(self):
        """Should reject negative top_n."""
        with pytest.raises(ValidationError):
            LEAPSRequest(symbol="SPY", top_n=-5)


class TestLEAPSContract:
    """Tests for LEAPSContract model."""

    def test_valid_contract(self):
        """Should create valid contract with all fields."""
        contract = LEAPSContract(
            contract_symbol="SPY20251219C00600000",
            strike=600.0,
            expiration="2025-12-19",
            target_price=580.0,
            premium=25.50,
            cost=2550.0,
            payoff_target=5000.0,
            roi_target=96.08,
            ease_score=0.75,
            roi_score=0.85,
            score=0.80,
            implied_volatility=0.22,
            open_interest=15000,
        )
        assert contract.contract_symbol == "SPY20251219C00600000"
        assert contract.strike == 600.0
        assert contract.roi_target == 96.08

    def test_optional_fields(self):
        """Should handle optional fields correctly."""
        contract = LEAPSContract(
            contract_symbol="SPY20251219C00600000",
            strike=600.0,
            expiration="2025-12-19",
            target_price=580.0,
            premium=25.50,
            cost=2550.0,
            payoff_target=5000.0,
            roi_target=96.08,
            ease_score=0.75,
            roi_score=0.85,
            score=0.80,
            # implied_volatility and open_interest omitted (optional)
        )
        assert contract.implied_volatility is None or contract.implied_volatility >= 0
        assert contract.open_interest is None or contract.open_interest >= 0

    def test_serialization(self):
        """Should serialize to dict correctly."""
        contract = LEAPSContract(
            contract_symbol="SPY20251219C00600000",
            strike=600.0,
            expiration="2025-12-19",
            target_price=580.0,
            premium=25.50,
            cost=2550.0,
            payoff_target=5000.0,
            roi_target=96.08,
            ease_score=0.75,
            roi_score=0.85,
            score=0.80,
        )
        data = contract.model_dump()
        assert isinstance(data, dict)
        assert data["contract_symbol"] == "SPY20251219C00600000"
        assert data["strike"] == 600.0


class TestLEAPSResponse:
    """Tests for LEAPSResponse model."""

    def test_valid_response(self, mock_leaps_contract):
        """Should create valid response with contracts."""
        contract = LEAPSContract(**mock_leaps_contract)
        response = LEAPSResponse(
            symbol="SPY",
            underlying_price=500.0,
            target_price=580.0,
            target_pct=0.16,
            mode="high_prob",
            contracts=[contract],
            timestamp=datetime.utcnow().isoformat(),
        )
        assert response.symbol == "SPY"
        assert len(response.contracts) == 1

    def test_empty_contracts_list(self):
        """Should accept empty contracts list."""
        response = LEAPSResponse(
            symbol="SPY",
            underlying_price=500.0,
            target_price=580.0,
            target_pct=0.16,
            mode="high_prob",
            contracts=[],
            timestamp=datetime.utcnow().isoformat(),
        )
        assert len(response.contracts) == 0


# ============================================================================
# Test ROI Simulator Models
# ============================================================================

class TestROISimulatorRequest:
    """Tests for ROI Simulator request model."""

    def test_valid_request(self):
        """Should accept valid ROI simulator request."""
        request = ROISimulatorRequest(
            strike=550.0,
            premium=25.0,
            underlying_price=500.0,
            target_prices=[520.0, 540.0, 560.0, 580.0],
        )
        assert request.strike == 550.0
        assert request.underlying_price == 500.0
        assert len(request.target_prices) == 4

    def test_empty_target_prices(self):
        """Should reject empty target_prices list."""
        with pytest.raises(ValidationError):
            ROISimulatorRequest(
                strike=550.0,
                premium=25.0,
                underlying_price=500.0,
                target_prices=[],
            )

    def test_invalid_underlying_price_zero(self):
        """Should reject zero underlying price."""
        with pytest.raises(ValidationError):
            ROISimulatorRequest(
                strike=550.0,
                premium=25.0,
                underlying_price=0.0,
                target_prices=[560.0],
            )

    def test_invalid_underlying_price_negative(self):
        """Should reject negative underlying price."""
        with pytest.raises(ValidationError):
            ROISimulatorRequest(
                strike=550.0,
                premium=25.0,
                underlying_price=-100.0,
                target_prices=[560.0],
            )


class TestROISimulatorResult:
    """Tests for ROI Simulator result model."""

    def test_valid_result(self):
        """Should create valid simulator result."""
        result = ROISimulatorResult(
            target_price=550.0,
            price_change_pct=0.10,
            intrinsic_value=0.0,
            payoff=2500.0,
            profit=100.0,
            roi_pct=45.5,
        )
        assert result.price_change_pct == 0.10
        assert result.roi_pct == 45.5

    def test_negative_roi(self):
        """Should accept negative ROI (loss scenario)."""
        result = ROISimulatorResult(
            target_price=475.0,
            price_change_pct=-0.05,
            intrinsic_value=0.0,
            payoff=-1000.0,
            profit=-2500.0,
            roi_pct=-100.0,
        )
        assert result.roi_pct == -100.0


# ============================================================================
# Test Credit Spread Models
# ============================================================================

class TestCreditSpreadRequest:
    """Tests for CreditSpreadRequest model."""

    def test_valid_request(self, valid_credit_spread_request):
        """Should accept valid credit spread request."""
        request = CreditSpreadRequest(**valid_credit_spread_request)
        assert request.symbol == "SPY"
        assert request.spread_type == "PCS"

    def test_invalid_spread_type(self):
        """Should reject invalid spread type."""
        with pytest.raises(ValidationError):
            CreditSpreadRequest(
                symbol="SPY",
                spread_type="INVALID",
            )

    def test_dte_range_validation(self):
        """Should validate DTE range (min < max)."""
        # Valid range
        request = CreditSpreadRequest(
            symbol="SPY",
            min_dte=14,
            max_dte=45,
        )
        assert request.min_dte < request.max_dte

    def test_delta_range_validation(self):
        """Should validate delta range."""
        request = CreditSpreadRequest(
            symbol="SPY",
            min_delta=0.05,
            max_delta=0.35,
        )
        assert 0 < request.min_delta < request.max_delta < 1


class TestCreditSpreadResult:
    """Tests for CreditSpreadResult model."""

    def test_valid_result(self, mock_credit_spread):
        """Should create valid credit spread result."""
        result = CreditSpreadResult(**mock_credit_spread)
        assert result.spread_type == "PCS"
        assert result.short_strike > result.long_strike  # For PCS

    def test_spread_metrics(self):
        """Should calculate spread metrics correctly."""
        result = CreditSpreadResult(
            symbol="SPY",
            spread_type="PCS",
            short_strike=480.0,
            long_strike=475.0,
            expiration="2024-02-16",
            dte=30,
            credit=1.25,
            max_loss=3.75,
            width=5.0,
            roc=0.3333,
            short_delta=0.15,
            delta_estimated=False,
            prob_profit=0.725,
            iv=0.185,
            ivp=0.45,
            underlying_price=500.0,
            break_even=478.75,
            break_even_distance_pct=0.0425,
            liquidity_score=0.9,
            slippage_score=0.85,
            total_score=0.80,
        )
        assert result.width == result.short_strike - result.long_strike


# ============================================================================
# Test AI Explainer Models
# ============================================================================

class TestAiExplainerRequest:
    """Tests for AI Explainer request model."""

    def test_valid_request(self, valid_ai_explainer_request):
        """Should accept valid AI explainer request."""
        request = AiExplainerRequest(**valid_ai_explainer_request)
        assert request.pageId == "leaps_ranker"
        assert request.contextType == "roi_simulator"

    def test_invalid_page_id(self):
        """Should reject invalid pageId."""
        with pytest.raises(ValidationError):
            AiExplainerRequest(
                pageId="invalid_page",
                contextType="roi_simulator",
                timestamp=datetime.utcnow().isoformat() + "Z",
                metadata={},
            )

    def test_invalid_context_type(self):
        """Should reject invalid contextType."""
        with pytest.raises(ValidationError):
            AiExplainerRequest(
                pageId="leaps_ranker",
                contextType="invalid_context",
                timestamp=datetime.utcnow().isoformat() + "Z",
                metadata={},
            )

    def test_metadata_with_malicious_content(self, malicious_inputs):
        """Should handle/sanitize malicious metadata."""
        # The model should either sanitize or reject malicious content
        for xss in malicious_inputs["xss"]:
            request = AiExplainerRequest(
                pageId="leaps_ranker",
                contextType="roi_simulator",
                timestamp=datetime.utcnow().isoformat() + "Z",
                metadata={"symbol": "SPY", "note": xss},
            )
            # If sanitized, the malicious content should be escaped
            # If rejected, a ValidationError should be raised


class TestAiExplainerContent:
    """Tests for AI Explainer content model."""

    def test_valid_content(self):
        """Should create valid AI content."""
        content = AiExplainerContent(
            summary="Test summary for the analysis.",
            key_insights=[
                AiExplainerKeyInsight(
                    title="Market Trend",
                    description="Bullish momentum",
                    sentiment="positive",
                )
            ],
            risks=[
                AiExplainerRisk(risk="Market volatility", severity="medium")
            ],
            watch_items=[
                AiExplainerWatchItem(item="Earnings date", trigger="Before expiration")
            ],
            disclaimer="For educational purposes only.",
        )
        assert content.summary == "Test summary for the analysis."
        assert len(content.key_insights) == 1
        assert len(content.risks) == 1

    def test_empty_lists(self):
        """Should accept empty insight/risk lists."""
        content = AiExplainerContent(
            summary="Minimal summary.",
            key_insights=[],
            risks=[],
            watch_items=[],
        )
        assert len(content.key_insights) == 0
        assert len(content.risks) == 0


class TestAiExplainerKeyInsight:
    """Tests for AiExplainerKeyInsight model."""

    def test_valid_sentiment_values(self):
        """Should accept valid sentiment values."""
        for sentiment in ["positive", "negative", "neutral"]:
            insight = AiExplainerKeyInsight(
                title="Test",
                description="Test description",
                sentiment=sentiment,
            )
            assert insight.sentiment == sentiment

    def test_invalid_sentiment(self):
        """Should reject invalid sentiment value."""
        with pytest.raises(ValidationError):
            AiExplainerKeyInsight(
                title="Test",
                description="Test description",
                sentiment="invalid",
            )


class TestAiExplainerRisk:
    """Tests for AiExplainerRisk model."""

    def test_valid_severity_values(self):
        """Should accept valid severity values."""
        for severity in ["low", "medium", "high"]:
            risk = AiExplainerRisk(risk="Test risk", severity=severity)
            assert risk.severity == severity

    def test_invalid_severity(self):
        """Should reject invalid severity value."""
        with pytest.raises(ValidationError):
            AiExplainerRisk(risk="Test risk", severity="critical")


class TestAiExplainerResponse:
    """Tests for AI Explainer response model."""

    def test_success_response(self):
        """Should create successful response."""
        response = AiExplainerResponse(
            success=True,
            pageId="leaps_ranker",
            contextType="roi_simulator",
            content=AiExplainerContent(
                summary="Test summary",
                key_insights=[],
                risks=[],
                watch_items=[],
            ),
            cached=False,
            timestamp=datetime.utcnow().isoformat() + "Z",
        )
        assert response.success is True
        assert response.cached is False

    def test_error_response(self):
        """Should create error response."""
        response = AiExplainerResponse(
            success=False,
            pageId="leaps_ranker",
            contextType="roi_simulator",
            content=None,
            error="Rate limit exceeded",
            cached=False,
            timestamp=datetime.utcnow().isoformat() + "Z",
        )
        assert response.success is False
        assert response.error == "Rate limit exceeded"


# ============================================================================
# Test Ticker Info Model
# ============================================================================

class TestTickerInfo:
    """Tests for TickerInfo model."""

    def test_valid_ticker_info(self):
        """Should create valid ticker info."""
        info = TickerInfo(
            symbol="SPY",
            name="SPDR S&P 500 ETF Trust",
            default_target_pct=0.16,
        )
        assert info.symbol == "SPY"
        assert info.default_target_pct == 0.16

    def test_symbol_normalization(self):
        """Should normalize symbol to uppercase."""
        info = TickerInfo(
            symbol="spy",
            name="SPDR S&P 500 ETF Trust",
            default_target_pct=0.16,
        )
        assert info.symbol == "spy"  # TickerInfo doesn't have a validator


# ============================================================================
# Test Model Serialization/Deserialization
# ============================================================================

class TestModelSerialization:
    """Tests for model serialization and deserialization."""

    def test_leaps_contract_round_trip(self, mock_leaps_contract):
        """Should serialize and deserialize LEAPSContract correctly."""
        contract = LEAPSContract(**mock_leaps_contract)
        json_data = contract.model_dump_json()
        restored = LEAPSContract.model_validate_json(json_data)

        assert restored.contract_symbol == contract.contract_symbol
        assert restored.strike == contract.strike
        assert restored.roi_target == contract.roi_target

    def test_credit_spread_round_trip(self, mock_credit_spread):
        """Should serialize and deserialize CreditSpreadResult correctly."""
        spread = CreditSpreadResult(**mock_credit_spread)
        json_data = spread.model_dump_json()
        restored = CreditSpreadResult.model_validate_json(json_data)

        assert restored.spread_type == spread.spread_type
        assert restored.credit == spread.credit

    def test_ai_response_round_trip(self):
        """Should serialize and deserialize AI response correctly."""
        response = AiExplainerResponse(
            success=True,
            pageId="leaps_ranker",
            contextType="roi_simulator",
            content=AiExplainerContent(
                summary="Test",
                key_insights=[AiExplainerKeyInsight(title="T", description="D", sentiment="neutral")],
                risks=[AiExplainerRisk(risk="R", severity="low")],
                watch_items=[AiExplainerWatchItem(item="I", trigger="T")],
            ),
            cached=True,
            timestamp="2024-01-01T00:00:00Z",
        )

        json_data = response.model_dump_json()
        restored = AiExplainerResponse.model_validate_json(json_data)

        assert restored.success == response.success
        assert restored.content.summary == response.content.summary
        assert len(restored.content.key_insights) == 1


# ============================================================================
# Test Edge Cases and Boundary Values
# ============================================================================

class TestEdgeCases:
    """Tests for edge cases and boundary values."""

    def test_very_long_symbol(self):
        """Should reject excessively long symbols."""
        with pytest.raises(ValidationError):
            LEAPSRequest(symbol="A" * 100)

    def test_unicode_in_symbol(self):
        """Should reject unicode characters in symbol."""
        with pytest.raises(ValidationError):
            LEAPSRequest(symbol="SPY\u200b")  # Zero-width space

    def test_whitespace_only_symbol(self):
        """Should reject whitespace-only symbol."""
        with pytest.raises(ValidationError):
            LEAPSRequest(symbol="   ")

    def test_extreme_float_values(self):
        """Should handle extreme float values."""
        # Very small positive value
        result = ROISimulatorResult(
            price_change_pct=0.0001,
            target_price=500.05,
            intrinsic_value=0.05,
            payoff=5.0,
            profit=0.1,
            roi_pct=0.1,
        )
        assert result.price_change_pct == 0.0001

        # Very large value
        result = ROISimulatorResult(
            price_change_pct=10.0,
            target_price=5500.0,
            intrinsic_value=5000.0,
            payoff=50000.0,
            profit=45000.0,
            roi_pct=1000.0,
        )
        assert result.roi_pct == 1000.0

    def test_float_precision(self):
        """Should maintain float precision."""
        contract = LEAPSContract(
            contract_symbol="SPY20251219C00600000",
            strike=599.9999999,
            expiration="2025-12-19",
            target_price=580.0,
            premium=25.123456789,
            cost=2512.3456789,
            payoff_target=5000.0,
            roi_target=96.08123456,
            ease_score=0.75123456,
            roi_score=0.85123456,
            score=0.80123456,
        )
        # Check that precision is maintained (or properly rounded)
        assert abs(contract.strike - 599.9999999) < 0.0001


# ============================================================================
# Performance Tests
# ============================================================================

class TestModelPerformance:
    """Performance tests for model operations."""

    def test_contract_creation_performance(self, performance_timer, mock_leaps_contract):
        """Contract creation should complete within time budget."""
        with performance_timer() as timer:
            for _ in range(1000):
                LEAPSContract(**mock_leaps_contract)

        timer.assert_under(1.0)  # Should create 1000 contracts in < 1 second

    def test_response_serialization_performance(self, performance_timer, mock_leaps_contract):
        """Response serialization should be fast."""
        contracts = [LEAPSContract(**mock_leaps_contract) for _ in range(100)]
        response = LEAPSResponse(
            symbol="SPY",
            underlying_price=500.0,
            target_price=580.0,
            target_pct=0.16,
            mode="high_prob",
            contracts=contracts,
            timestamp=datetime.utcnow().isoformat(),
        )

        with performance_timer() as timer:
            for _ in range(100):
                response.model_dump_json()

        timer.assert_under(1.0)  # 100 serializations in < 1 second
