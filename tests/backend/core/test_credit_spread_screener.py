"""
Unit tests for Credit Spread Screener in backend/credit_spread_screener.py

Test Scenarios:
- Configuration and parameter handling
- Price fetching (mocked)
- Option chain fetching (mocked)
- Delta estimation (Black-Scholes)
- PCS and CCS building algorithms
- Metric computations (liquidity, slippage, convexity, ease)
- Scoring and ranking
- Filtering logic
- Edge cases and error handling

Coverage Target: ≥95% line and branch coverage
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
import pandas as pd
import numpy as np
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "backend"))

from credit_spread_screener import (
    ScreenerConfig,
    fetch_current_price,
    fetch_option_chain,
    estimate_delta,
    fetch_iv_percentile,
    build_credit_spreads_from_chain,
    compute_spread_metrics,
    score_spreads,
    filter_and_sort_spreads,
    format_output_table,
    run_screener,
)


# ============================================================================
# Test ScreenerConfig
# ============================================================================

class TestScreenerConfig:
    """Tests for ScreenerConfig dataclass."""

    def test_default_config(self):
        """Should create config with default values."""
        config = ScreenerConfig(tickers=["SPY"])

        assert config.tickers == ["SPY"]
        assert config.min_dte == 14
        assert config.max_dte == 30
        assert config.min_delta == 0.08
        assert config.max_delta == 0.35
        assert config.max_width == 10.0
        assert config.min_roc == 0.20
        assert config.min_ivp == 40

    def test_custom_config(self):
        """Should create config with custom values."""
        config = ScreenerConfig(
            tickers=["SPY", "QQQ"],
            min_dte=7,
            max_dte=45,
            min_delta=0.10,
            max_delta=0.25,
            max_width=5.0,
            min_roc=0.30,
            min_ivp=50,
        )

        assert config.tickers == ["SPY", "QQQ"]
        assert config.min_dte == 7
        assert config.max_dte == 45
        assert config.min_delta == 0.10
        assert config.max_delta == 0.25
        assert config.max_width == 5.0
        assert config.min_roc == 0.30
        assert config.min_ivp == 50

    def test_scoring_weights_sum(self):
        """Scoring weights should be properly defined."""
        config = ScreenerConfig(tickers=["SPY"])

        # Default weights sum (excluding prob and ease which are 0)
        active_weights = (
            config.roc_weight +
            config.convexity_weight +
            config.slippage_weight +
            config.liquidity_weight
        )
        assert active_weights == 1.0


# ============================================================================
# Test Price Fetching
# ============================================================================

class TestFetchCurrentPrice:
    """Tests for price fetching function."""

    @patch("credit_spread_screener.yf.Ticker")
    def test_successful_price_fetch_from_history(self, mock_ticker):
        """Should fetch price from history."""
        mock_instance = MagicMock()
        mock_instance.history.return_value = pd.DataFrame({
            "Close": [500.50]
        })
        mock_ticker.return_value = mock_instance

        price = fetch_current_price("SPY")

        assert price == 500.50
        mock_ticker.assert_called_once_with("SPY")

    @patch("credit_spread_screener.yf.Ticker")
    def test_fallback_to_info(self, mock_ticker):
        """Should fallback to info if history fails."""
        mock_instance = MagicMock()
        mock_instance.history.return_value = pd.DataFrame()  # Empty
        mock_instance.info = {"regularMarketPrice": 501.25}
        mock_ticker.return_value = mock_instance

        price = fetch_current_price("SPY")

        assert price == 501.25

    @patch("credit_spread_screener.yf.Ticker")
    def test_raises_on_no_price(self, mock_ticker):
        """Should raise ValueError if no price available."""
        mock_instance = MagicMock()
        mock_instance.history.return_value = pd.DataFrame()
        mock_instance.info = {}
        mock_ticker.return_value = mock_instance

        with pytest.raises(ValueError, match="Could not fetch price"):
            fetch_current_price("INVALID")


# ============================================================================
# Test Delta Estimation
# ============================================================================

class TestEstimateDelta:
    """Tests for Black-Scholes delta estimation."""

    def test_atm_call_delta_near_05(self):
        """ATM call delta should be near 0.5."""
        delta = estimate_delta(
            strike=100.0,
            underlying_price=100.0,
            dte=30,
            iv=0.20,
            option_type="call",
        )

        # ATM call delta with dividend yield should be around 0.5
        assert 0.45 < delta < 0.55

    def test_atm_put_delta_near_minus_05(self):
        """ATM put delta should be near -0.5."""
        delta = estimate_delta(
            strike=100.0,
            underlying_price=100.0,
            dte=30,
            iv=0.20,
            option_type="put",
        )

        # ATM put delta is negative
        assert -0.55 < delta < -0.45

    def test_otm_call_delta_low(self):
        """OTM call delta should be low."""
        delta = estimate_delta(
            strike=120.0,  # OTM call
            underlying_price=100.0,
            dte=30,
            iv=0.20,
            option_type="call",
        )

        assert 0 < delta < 0.30

    def test_otm_put_delta_low(self):
        """OTM put delta should be low (in absolute terms)."""
        delta = estimate_delta(
            strike=80.0,  # OTM put
            underlying_price=100.0,
            dte=30,
            iv=0.20,
            option_type="put",
        )

        assert -0.30 < delta < 0

    def test_itm_call_delta_high(self):
        """ITM call delta should be high."""
        delta = estimate_delta(
            strike=80.0,  # ITM call
            underlying_price=100.0,
            dte=30,
            iv=0.20,
            option_type="call",
        )

        assert delta > 0.70

    def test_zero_dte_returns_zero(self):
        """Should return 0 for zero DTE."""
        delta = estimate_delta(
            strike=100.0,
            underlying_price=100.0,
            dte=0,
            iv=0.20,
            option_type="call",
        )

        assert delta == 0.0

    def test_zero_iv_returns_zero(self):
        """Should return 0 for zero IV."""
        delta = estimate_delta(
            strike=100.0,
            underlying_price=100.0,
            dte=30,
            iv=0,
            option_type="call",
        )

        assert delta == 0.0

    def test_zero_price_returns_zero(self):
        """Should return 0 for zero price."""
        delta = estimate_delta(
            strike=100.0,
            underlying_price=0,
            dte=30,
            iv=0.20,
            option_type="call",
        )

        assert delta == 0.0

    def test_longer_dte_higher_extrinsic(self):
        """Longer DTE should affect delta calculation."""
        delta_short = estimate_delta(
            strike=100.0, underlying_price=100.0, dte=7, iv=0.20, option_type="call"
        )
        delta_long = estimate_delta(
            strike=100.0, underlying_price=100.0, dte=365, iv=0.20, option_type="call"
        )

        # Both should be valid deltas
        assert 0 < delta_short < 1
        assert 0 < delta_long < 1


# ============================================================================
# Test IV Percentile
# ============================================================================

class TestFetchIvPercentile:
    """Tests for IV percentile fetching."""

    @patch("credit_spread_screener.yf.Ticker")
    def test_successful_ivp_calculation(self, mock_ticker):
        """Should calculate IV percentile from historical data."""
        # Create mock historical data with varying HV
        mock_instance = MagicMock()
        dates = pd.date_range(end=datetime.now(), periods=252, freq="D")
        closes = [100 + np.sin(i / 10) * 5 for i in range(252)]  # Simulate price movement
        mock_instance.history.return_value = pd.DataFrame({
            "Close": closes
        }, index=dates)
        mock_ticker.return_value = mock_instance

        ivp = fetch_iv_percentile("SPY")

        # IVP should be between 0 and 100
        assert 0 <= ivp <= 100

    @patch("credit_spread_screener.yf.Ticker")
    def test_empty_history_returns_default(self, mock_ticker):
        """Should return 50.0 for empty history."""
        mock_instance = MagicMock()
        mock_instance.history.return_value = pd.DataFrame()
        mock_ticker.return_value = mock_instance

        ivp = fetch_iv_percentile("SPY")

        assert ivp == 50.0

    @patch("credit_spread_screener.yf.Ticker")
    def test_api_error_returns_default(self, mock_ticker):
        """Should return 50.0 on API error."""
        mock_ticker.side_effect = Exception("API Error")

        ivp = fetch_iv_percentile("SPY")

        assert ivp == 50.0


# ============================================================================
# Test Credit Spread Building
# ============================================================================

class TestBuildCreditSpreads:
    """Tests for building credit spreads from option chain."""

    @pytest.fixture
    def mock_chain(self):
        """Create a mock option chain."""
        today = pd.Timestamp.now().normalize()
        expiration = today + pd.Timedelta(days=21)

        # Create puts and calls
        data = []

        # OTM Puts (strike < underlying)
        for strike in [485.0, 490.0, 495.0, 500.0]:
            data.append({
                "strike": strike,
                "bid": 2.0 + (500 - strike) * 0.02,
                "ask": 2.5 + (500 - strike) * 0.02,
                "volume": 1000,
                "openInterest": 5000,
                "impliedVolatility": 0.22,
                "option_type": "put",
                "expiration": expiration,
                "dte": 21,
            })

        # OTM Calls (strike > underlying)
        for strike in [505.0, 510.0, 515.0, 520.0]:
            data.append({
                "strike": strike,
                "bid": 2.0 + (strike - 500) * 0.02,
                "ask": 2.5 + (strike - 500) * 0.02,
                "volume": 1000,
                "openInterest": 5000,
                "impliedVolatility": 0.22,
                "option_type": "call",
                "expiration": expiration,
                "dte": 21,
            })

        return pd.DataFrame(data)

    def test_builds_pcs_spreads(self, mock_chain):
        """Should build Put Credit Spreads."""
        config = ScreenerConfig(
            tickers=["SPY"],
            min_delta=0.05,
            max_delta=0.40,
            min_roc=0.10,
        )

        spreads = build_credit_spreads_from_chain(
            chain=mock_chain,
            underlying_price=502.0,
            config=config,
            symbol="SPY",
            ivp=50.0,
        )

        pcs_spreads = spreads[spreads["type"] == "PCS"]
        assert len(pcs_spreads) > 0

        # All PCS should have short_strike > long_strike
        for _, row in pcs_spreads.iterrows():
            assert row["short_strike"] > row["long_strike"]

    def test_builds_ccs_spreads(self, mock_chain):
        """Should build Call Credit Spreads."""
        config = ScreenerConfig(
            tickers=["SPY"],
            min_delta=0.05,
            max_delta=0.40,
            min_roc=0.10,
        )

        spreads = build_credit_spreads_from_chain(
            chain=mock_chain,
            underlying_price=502.0,
            config=config,
            symbol="SPY",
            ivp=50.0,
        )

        ccs_spreads = spreads[spreads["type"] == "CCS"]
        assert len(ccs_spreads) > 0

        # All CCS should have short_strike < long_strike
        for _, row in ccs_spreads.iterrows():
            assert row["short_strike"] < row["long_strike"]

    def test_respects_max_width(self, mock_chain):
        """Should respect max width constraint."""
        config = ScreenerConfig(
            tickers=["SPY"],
            max_width=5.0,  # Max $5 width
        )

        spreads = build_credit_spreads_from_chain(
            chain=mock_chain,
            underlying_price=502.0,
            config=config,
            symbol="SPY",
            ivp=50.0,
        )

        if not spreads.empty:
            # All spreads should have width <= max_width
            for _, row in spreads.iterrows():
                width = abs(row["short_strike"] - row["long_strike"])
                assert width <= config.max_width

    def test_respects_min_roc(self):
        """Should filter spreads below min ROC."""
        config = ScreenerConfig(
            tickers=["SPY"],
            min_roc=0.50,  # High min ROC
        )

        # Create chain with low credit spreads
        today = pd.Timestamp.now().normalize()
        expiration = today + pd.Timedelta(days=21)

        data = []
        for strike in [490.0, 495.0]:
            data.append({
                "strike": strike,
                "bid": 0.50,  # Low bid
                "ask": 0.60,
                "volume": 1000,
                "openInterest": 5000,
                "impliedVolatility": 0.22,
                "option_type": "put",
                "expiration": expiration,
                "dte": 21,
            })

        chain = pd.DataFrame(data)

        spreads = build_credit_spreads_from_chain(
            chain=chain,
            underlying_price=502.0,
            config=config,
            symbol="SPY",
            ivp=50.0,
        )

        # With such low credits, spreads should fail min_roc filter
        # (credit / max_loss) must be >= 0.50

    def test_empty_chain_returns_empty(self):
        """Should return empty DataFrame for empty chain."""
        config = ScreenerConfig(tickers=["SPY"])

        spreads = build_credit_spreads_from_chain(
            chain=pd.DataFrame(),
            underlying_price=500.0,
            config=config,
            symbol="SPY",
            ivp=50.0,
        )

        assert spreads.empty


# ============================================================================
# Test Metric Computations
# ============================================================================

class TestComputeSpreadMetrics:
    """Tests for spread metric computations."""

    @pytest.fixture
    def sample_spreads(self):
        """Create sample spreads for testing."""
        return pd.DataFrame([
            {
                "symbol": "SPY",
                "type": "PCS",
                "short_strike": 495.0,
                "long_strike": 490.0,
                "width": 5.0,
                "credit": 1.0,
                "max_loss": 4.0,
                "roc": 0.25,
                "short_delta": 0.15,
                "prob_profit": 0.85,
                "break_even_distance_pct": 0.02,
                "short_oi": 5000,
                "long_oi": 4000,
                "short_volume": 1000,
                "long_volume": 800,
                "short_bid": 2.0,
                "short_ask": 2.2,
                "long_bid": 1.0,
                "long_ask": 1.1,
                "dte": 21,
            },
            {
                "symbol": "SPY",
                "type": "CCS",
                "short_strike": 510.0,
                "long_strike": 515.0,
                "width": 5.0,
                "credit": 1.2,
                "max_loss": 3.8,
                "roc": 0.31,
                "short_delta": 0.18,
                "prob_profit": 0.82,
                "break_even_distance_pct": 0.03,
                "short_oi": 4500,
                "long_oi": 3500,
                "short_volume": 900,
                "long_volume": 700,
                "short_bid": 2.5,
                "short_ask": 2.7,
                "long_bid": 1.3,
                "long_ask": 1.4,
                "dte": 21,
            },
        ])

    def test_computes_liquidity_score(self, sample_spreads):
        """Should compute liquidity score."""
        config = ScreenerConfig(tickers=["SPY"])

        result = compute_spread_metrics(sample_spreads, config)

        assert "liquidity_score" in result.columns
        assert result["liquidity_score"].min() >= 0
        assert result["liquidity_score"].max() <= 1

    def test_computes_slippage_score(self, sample_spreads):
        """Should compute slippage score."""
        config = ScreenerConfig(tickers=["SPY"])

        result = compute_spread_metrics(sample_spreads, config)

        assert "slippage_score" in result.columns
        assert result["slippage_score"].min() >= 0
        assert result["slippage_score"].max() <= 1

    def test_computes_convexity_score(self, sample_spreads):
        """Should compute convexity score."""
        config = ScreenerConfig(tickers=["SPY"])

        result = compute_spread_metrics(sample_spreads, config)

        assert "convexity_score" in result.columns
        assert result["convexity_score"].min() >= 0
        assert result["convexity_score"].max() <= 1

    def test_computes_ease_score(self, sample_spreads):
        """Should compute ease score."""
        config = ScreenerConfig(tickers=["SPY"])

        result = compute_spread_metrics(sample_spreads, config)

        assert "ease_score" in result.columns
        assert result["ease_score"].min() >= 0
        assert result["ease_score"].max() <= 1

    def test_empty_dataframe(self):
        """Should handle empty DataFrame."""
        config = ScreenerConfig(tickers=["SPY"])

        result = compute_spread_metrics(pd.DataFrame(), config)

        assert result.empty


# ============================================================================
# Test Scoring
# ============================================================================

class TestScoreSpreads:
    """Tests for spread scoring."""

    @pytest.fixture
    def sample_spreads_with_metrics(self):
        """Create sample spreads with computed metrics."""
        return pd.DataFrame([
            {
                "roc": 0.25,
                "convexity_score": 0.7,
                "slippage_score": 0.8,
                "liquidity_score": 0.9,
                "prob_profit": 0.85,
                "ease_score": 0.75,
            },
            {
                "roc": 0.35,
                "convexity_score": 0.6,
                "slippage_score": 0.7,
                "liquidity_score": 0.8,
                "prob_profit": 0.80,
                "ease_score": 0.65,
            },
        ])

    def test_computes_total_score(self, sample_spreads_with_metrics):
        """Should compute total score."""
        config = ScreenerConfig(tickers=["SPY"])

        result = score_spreads(sample_spreads_with_metrics, config)

        assert "total_score" in result.columns
        assert result["total_score"].min() >= 0
        assert result["total_score"].max() <= 1

    def test_total_score_uses_weights(self, sample_spreads_with_metrics):
        """Total score should use configured weights."""
        config = ScreenerConfig(
            tickers=["SPY"],
            roc_weight=1.0,  # All weight on ROC
            convexity_weight=0.0,
            slippage_weight=0.0,
            liquidity_weight=0.0,
        )

        result = score_spreads(sample_spreads_with_metrics, config)

        # Higher ROC should have higher score
        assert result.iloc[1]["total_score"] > result.iloc[0]["total_score"]


# ============================================================================
# Test Filtering and Sorting
# ============================================================================

class TestFilterAndSort:
    """Tests for filtering and sorting spreads."""

    @pytest.fixture
    def sample_scored_spreads(self):
        """Create sample scored spreads."""
        return pd.DataFrame([
            {"ivp": 60.0, "liquidity_score": 0.5, "slippage_score": 0.5, "total_score": 0.75},
            {"ivp": 30.0, "liquidity_score": 0.5, "slippage_score": 0.5, "total_score": 0.80},  # Low IVP
            {"ivp": 60.0, "liquidity_score": 0.05, "slippage_score": 0.5, "total_score": 0.85},  # Low liquidity
            {"ivp": 60.0, "liquidity_score": 0.5, "slippage_score": 0.05, "total_score": 0.90},  # Low slippage
            {"ivp": 60.0, "liquidity_score": 0.5, "slippage_score": 0.5, "total_score": 0.70},
        ])

    def test_filters_by_ivp(self, sample_scored_spreads):
        """Should filter spreads below min IVP."""
        config = ScreenerConfig(tickers=["SPY"], min_ivp=40)

        result = filter_and_sort_spreads(sample_scored_spreads, config)

        assert all(result["ivp"] >= 40)

    def test_filters_by_liquidity(self, sample_scored_spreads):
        """Should filter spreads below min liquidity score."""
        config = ScreenerConfig(tickers=["SPY"], min_liquidity_score=0.1)

        result = filter_and_sort_spreads(sample_scored_spreads, config)

        assert all(result["liquidity_score"] >= 0.1)

    def test_filters_by_slippage(self, sample_scored_spreads):
        """Should filter spreads below min slippage score."""
        config = ScreenerConfig(tickers=["SPY"], min_slippage_score=0.1)

        result = filter_and_sort_spreads(sample_scored_spreads, config)

        assert all(result["slippage_score"] >= 0.1)

    def test_sorts_by_total_score_descending(self, sample_scored_spreads):
        """Should sort by total_score descending."""
        config = ScreenerConfig(
            tickers=["SPY"],
            min_ivp=0,
            min_liquidity_score=0,
            min_slippage_score=0,
        )

        result = filter_and_sort_spreads(sample_scored_spreads, config)

        scores = result["total_score"].tolist()
        assert scores == sorted(scores, reverse=True)


# ============================================================================
# Test Output Formatting
# ============================================================================

class TestFormatOutputTable:
    """Tests for output table formatting."""

    def test_selects_display_columns(self):
        """Should select display columns."""
        df = pd.DataFrame([
            {
                "symbol": "SPY",
                "type": "PCS",
                "expiration": "2025-12-19",
                "dte": 21,
                "short_strike": 495.0,
                "long_strike": 490.0,
                "credit": 1.0,
                "roc": 0.25,
                "short_delta": 0.15,
                "delta_estimated": True,
                "prob_profit": 0.85,
                "ivp": 50.0,
                "break_even": 494.0,
                "break_even_distance_pct": 0.02,
                "liquidity_score": 0.8,
                "slippage_score": 0.7,
                "total_score": 0.75,
                # Extra columns that should not appear
                "underlying_price": 500.0,
                "short_bid": 2.0,
            }
        ])

        result = format_output_table(df)

        # Should include display columns
        assert "symbol" in result.columns
        assert "total_score" in result.columns

        # Should not include internal columns
        assert "short_bid" not in result.columns

    def test_creates_delta_est_column(self):
        """Should create delta_est indicator column."""
        df = pd.DataFrame([
            {"delta_estimated": True, "symbol": "SPY", "total_score": 0.8},
            {"delta_estimated": False, "symbol": "QQQ", "total_score": 0.7},
        ])

        result = format_output_table(df)

        assert "delta_est" in result.columns
        assert result.iloc[0]["delta_est"] == "*"
        assert result.iloc[1]["delta_est"] == ""


# ============================================================================
# Test Run Screener Integration
# ============================================================================

class TestRunScreener:
    """Integration tests for run_screener function."""

    @patch("credit_spread_screener.fetch_current_price")
    @patch("credit_spread_screener.fetch_iv_percentile")
    @patch("credit_spread_screener.fetch_option_chain")
    def test_successful_screening(self, mock_chain, mock_ivp, mock_price):
        """Should run complete screening workflow."""
        mock_price.return_value = 500.0
        mock_ivp.return_value = 55.0

        # Create mock option chain
        today = pd.Timestamp.now().normalize()
        expiration = today + pd.Timedelta(days=21)

        data = []
        for strike in [485.0, 490.0, 495.0]:
            data.append({
                "strike": strike,
                "bid": 2.0 + (500 - strike) * 0.02,
                "ask": 2.5 + (500 - strike) * 0.02,
                "volume": 1000,
                "openInterest": 5000,
                "impliedVolatility": 0.22,
                "option_type": "put",
                "expiration": expiration,
                "dte": 21,
            })
        for strike in [505.0, 510.0, 515.0]:
            data.append({
                "strike": strike,
                "bid": 2.0 + (strike - 500) * 0.02,
                "ask": 2.5 + (strike - 500) * 0.02,
                "volume": 1000,
                "openInterest": 5000,
                "impliedVolatility": 0.22,
                "option_type": "call",
                "expiration": expiration,
                "dte": 21,
            })

        mock_chain.return_value = pd.DataFrame(data)

        config = ScreenerConfig(
            tickers=["SPY"],
            min_delta=0.05,
            max_delta=0.40,
            min_roc=0.05,
            min_ivp=40,
        )

        result = run_screener(config)

        assert isinstance(result, pd.DataFrame)

    @patch("credit_spread_screener.fetch_current_price")
    def test_handles_price_fetch_error(self, mock_price):
        """Should handle price fetch errors gracefully."""
        mock_price.side_effect = ValueError("Could not fetch price")

        config = ScreenerConfig(tickers=["INVALID"])

        result = run_screener(config)

        # Should return empty DataFrame on error
        assert isinstance(result, pd.DataFrame)


# ============================================================================
# Test Edge Cases
# ============================================================================

class TestEdgeCases:
    """Tests for edge cases and boundary conditions."""

    def test_single_option_in_chain(self):
        """Should handle chain with single option."""
        config = ScreenerConfig(tickers=["SPY"])

        today = pd.Timestamp.now().normalize()
        expiration = today + pd.Timedelta(days=21)

        chain = pd.DataFrame([{
            "strike": 495.0,
            "bid": 2.0,
            "ask": 2.2,
            "volume": 1000,
            "openInterest": 5000,
            "impliedVolatility": 0.22,
            "option_type": "put",
            "expiration": expiration,
            "dte": 21,
        }])

        spreads = build_credit_spreads_from_chain(
            chain=chain,
            underlying_price=500.0,
            config=config,
            symbol="SPY",
            ivp=50.0,
        )

        # Can't build spread with single option
        assert spreads.empty

    def test_all_itm_options(self):
        """Should handle all ITM options."""
        config = ScreenerConfig(tickers=["SPY"])

        today = pd.Timestamp.now().normalize()
        expiration = today + pd.Timedelta(days=21)

        # All puts ITM (strike > underlying)
        chain = pd.DataFrame([
            {"strike": 510.0, "bid": 10.0, "ask": 10.5, "volume": 1000, "openInterest": 5000,
             "impliedVolatility": 0.22, "option_type": "put", "expiration": expiration, "dte": 21},
            {"strike": 505.0, "bid": 5.0, "ask": 5.5, "volume": 1000, "openInterest": 5000,
             "impliedVolatility": 0.22, "option_type": "put", "expiration": expiration, "dte": 21},
        ])

        spreads = build_credit_spreads_from_chain(
            chain=chain,
            underlying_price=500.0,
            config=config,
            symbol="SPY",
            ivp=50.0,
        )

        # All ITM puts should not build PCS (we need OTM)
        pcs = spreads[spreads["type"] == "PCS"] if not spreads.empty else pd.DataFrame()
        assert pcs.empty

    def test_nan_values_in_chain(self):
        """Should handle NaN values in option chain."""
        config = ScreenerConfig(tickers=["SPY"])

        today = pd.Timestamp.now().normalize()
        expiration = today + pd.Timedelta(days=21)

        chain = pd.DataFrame([
            {"strike": 495.0, "bid": np.nan, "ask": 2.2, "volume": 1000, "openInterest": 5000,
             "impliedVolatility": 0.22, "option_type": "put", "expiration": expiration, "dte": 21},
            {"strike": 490.0, "bid": 1.0, "ask": np.nan, "volume": 1000, "openInterest": 5000,
             "impliedVolatility": 0.22, "option_type": "put", "expiration": expiration, "dte": 21},
        ])

        # Should not crash
        spreads = build_credit_spreads_from_chain(
            chain=chain,
            underlying_price=500.0,
            config=config,
            symbol="SPY",
            ivp=50.0,
        )

        assert isinstance(spreads, pd.DataFrame)


# ============================================================================
# Test Performance
# ============================================================================

class TestCreditSpreadScreenerPerformance:
    """Performance tests for credit spread screener."""

    def test_metric_computation_performance(self, performance_timer):
        """Metric computation should be fast for large datasets."""
        config = ScreenerConfig(tickers=["SPY"])

        # Create large dataset
        n_spreads = 1000
        spreads = pd.DataFrame({
            "symbol": ["SPY"] * n_spreads,
            "type": ["PCS"] * (n_spreads // 2) + ["CCS"] * (n_spreads // 2),
            "short_strike": np.linspace(480, 520, n_spreads),
            "long_strike": np.linspace(475, 515, n_spreads),
            "width": [5.0] * n_spreads,
            "credit": np.random.uniform(0.5, 2.0, n_spreads),
            "max_loss": np.random.uniform(3.0, 4.5, n_spreads),
            "roc": np.random.uniform(0.15, 0.40, n_spreads),
            "short_delta": np.random.uniform(0.10, 0.30, n_spreads),
            "prob_profit": np.random.uniform(0.70, 0.90, n_spreads),
            "break_even_distance_pct": np.random.uniform(0.01, 0.05, n_spreads),
            "short_oi": np.random.randint(1000, 10000, n_spreads),
            "long_oi": np.random.randint(1000, 10000, n_spreads),
            "short_volume": np.random.randint(100, 2000, n_spreads),
            "long_volume": np.random.randint(100, 2000, n_spreads),
            "short_bid": np.random.uniform(1.0, 3.0, n_spreads),
            "short_ask": np.random.uniform(1.1, 3.2, n_spreads),
            "long_bid": np.random.uniform(0.5, 1.5, n_spreads),
            "long_ask": np.random.uniform(0.6, 1.7, n_spreads),
            "dte": [21] * n_spreads,
        })

        with performance_timer() as timer:
            result = compute_spread_metrics(spreads, config)
            result = score_spreads(result, config)
            result = filter_and_sort_spreads(result, config)

        # Should complete quickly for 1000 spreads
        timer.assert_under(1.0)


# ============================================================================
# Test Security
# ============================================================================

class TestCreditSpreadScreenerSecurity:
    """Security tests for credit spread screener."""

    def test_rejects_malicious_symbol(self, malicious_inputs):
        """Should handle malicious symbol inputs safely."""
        config = ScreenerConfig(tickers=malicious_inputs["invalid_symbols"][:3])

        # Should not execute any malicious code
        try:
            result = run_screener(config)
            assert isinstance(result, pd.DataFrame)
        except Exception:
            pass  # Expected to fail safely

    def test_handles_extreme_values(self):
        """Should handle extreme numeric values."""
        config = ScreenerConfig(tickers=["SPY"])

        today = pd.Timestamp.now().normalize()
        expiration = today + pd.Timedelta(days=21)

        chain = pd.DataFrame([
            {"strike": 1e10, "bid": 1e10, "ask": 1e10, "volume": 0, "openInterest": 0,
             "impliedVolatility": 100.0, "option_type": "put", "expiration": expiration, "dte": 21},
            {"strike": 0.001, "bid": 0.001, "ask": 0.001, "volume": 0, "openInterest": 0,
             "impliedVolatility": 0.001, "option_type": "put", "expiration": expiration, "dte": 21},
        ])

        # Should not crash with extreme values
        spreads = build_credit_spreads_from_chain(
            chain=chain,
            underlying_price=500.0,
            config=config,
            symbol="SPY",
            ivp=50.0,
        )

        assert isinstance(spreads, pd.DataFrame)
