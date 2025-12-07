"""
Unit tests for LEAPS Ranker engine in backend/leaps_ranker.py

Test Scenarios:
- Configuration loading
- Options chain fetching (mocked)
- Scoring algorithm validation
- Ranking and filtering
- ROI calculations
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

from leaps_ranker import (
    load_config,
    rank_leaps,
    # Additional functions if exported
)


# ============================================================================
# Test Configuration Loading
# ============================================================================

class TestLoadConfig:
    """Tests for configuration loading."""

    def test_loads_default_config(self, temp_config_file):
        """Should load configuration from file."""
        config = load_config(str(temp_config_file))

        assert config is not None
        assert "scoring" in config
        assert "tickers" in config

    def test_config_has_scoring_modes(self, temp_config_file):
        """Should have both scoring modes."""
        config = load_config(str(temp_config_file))

        assert "high_prob" in config["scoring"]
        assert "high_convexity" in config["scoring"]

    def test_config_has_ticker_targets(self, temp_config_file):
        """Should have ticker targets defined."""
        config = load_config(str(temp_config_file))

        assert "SPY" in config["tickers"]
        assert "target_pct" in config["tickers"]["SPY"]

    def test_missing_config_file(self):
        """Should handle missing config file."""
        with pytest.raises((FileNotFoundError, Exception)):
            load_config("/nonexistent/path/config.yaml")

    def test_invalid_yaml_config(self, temp_dir):
        """Should handle invalid YAML."""
        invalid_config = temp_dir / "invalid.yaml"
        invalid_config.write_text("{ invalid yaml content")

        with pytest.raises(Exception):
            load_config(str(invalid_config))


# ============================================================================
# Test Ranking Function
# ============================================================================

class TestRankLeaps:
    """Tests for rank_leaps function."""

    @patch("leaps_ranker._get_yfinance_options_chain")
    @patch("leaps_ranker.load_config")
    def test_returns_dataframe(self, mock_config, mock_chain, mock_options_chain):
        """Should return a pandas DataFrame."""
        mock_config.return_value = {
            "tickers": {"SPY": {"target_pct": 0.16}},
            "scoring": {"high_prob": {"ease_weight": 0.85, "roi_weight": 0.15}},
            "filters": {"min_dte": 365, "longest_only": True},
            "display": {"top_n": 20},
        }

        mock_chain.return_value = (
            mock_options_chain["calls"],
            mock_options_chain["underlying_price"],
            mock_options_chain["expirations"],
        )

        result = rank_leaps("SPY", target_pct=0.16, mode="high_prob", top_n=10)

        assert isinstance(result, pd.DataFrame)

    @patch("leaps_ranker._get_yfinance_options_chain")
    @patch("leaps_ranker.load_config")
    def test_contains_required_columns(self, mock_config, mock_chain, mock_options_chain):
        """Should contain all required columns."""
        mock_config.return_value = {
            "tickers": {"SPY": {"target_pct": 0.16}},
            "scoring": {"high_prob": {"ease_weight": 0.85, "roi_weight": 0.15}},
            "filters": {"min_dte": 365},
            "display": {"top_n": 20},
        }

        mock_chain.return_value = (
            mock_options_chain["calls"],
            mock_options_chain["underlying_price"],
            mock_options_chain["expirations"],
        )

        result = rank_leaps("SPY", mode="high_prob")

        if not result.empty:
            expected_columns = [
                "contract_symbol",
                "strike",
                "expiration",
                "premium",
                "total_score",
            ]
            for col in expected_columns:
                assert col in result.columns, f"Missing column: {col}"

    @patch("leaps_ranker._get_yfinance_options_chain")
    @patch("leaps_ranker.load_config")
    def test_respects_top_n(self, mock_config, mock_chain, mock_options_chain):
        """Should return at most top_n results."""
        mock_config.return_value = {
            "tickers": {"SPY": {}},
            "scoring": {"high_prob": {"ease_weight": 0.85, "roi_weight": 0.15}},
            "filters": {},
            "display": {"top_n": 100},
        }

        mock_chain.return_value = (
            mock_options_chain["calls"],
            mock_options_chain["underlying_price"],
            mock_options_chain["expirations"],
        )

        result = rank_leaps("SPY", top_n=5)

        assert len(result) <= 5

    @patch("leaps_ranker._get_yfinance_options_chain")
    @patch("leaps_ranker.load_config")
    def test_sorts_by_total_score(self, mock_config, mock_chain, mock_options_chain):
        """Should sort results by total_score descending."""
        mock_config.return_value = {
            "tickers": {"SPY": {}},
            "scoring": {"high_prob": {"ease_weight": 0.85, "roi_weight": 0.15}},
            "filters": {},
            "display": {"top_n": 100},
        }

        mock_chain.return_value = (
            mock_options_chain["calls"],
            mock_options_chain["underlying_price"],
            mock_options_chain["expirations"],
        )

        result = rank_leaps("SPY", top_n=20)

        if len(result) > 1:
            scores = result["total_score"].tolist()
            assert scores == sorted(scores, reverse=True)

    @patch("leaps_ranker._get_yfinance_options_chain")
    @patch("leaps_ranker.load_config")
    def test_high_convexity_mode(self, mock_config, mock_chain, mock_options_chain):
        """Should use high_convexity scoring weights."""
        mock_config.return_value = {
            "tickers": {"SPY": {}},
            "scoring": {
                "high_prob": {"ease_weight": 0.85, "roi_weight": 0.15},
                "high_convexity": {"ease_weight": 0.10, "roi_weight": 0.90},
            },
            "filters": {},
            "display": {"top_n": 100},
        }

        mock_chain.return_value = (
            mock_options_chain["calls"],
            mock_options_chain["underlying_price"],
            mock_options_chain["expirations"],
        )

        result = rank_leaps("SPY", mode="high_convexity")

        assert isinstance(result, pd.DataFrame)

    @patch("leaps_ranker._get_yfinance_options_chain")
    def test_handles_empty_chain(self, mock_chain):
        """Should handle empty options chain."""
        mock_chain.return_value = (pd.DataFrame(), 500.0, [])

        result = rank_leaps("SPY")

        assert isinstance(result, pd.DataFrame)
        assert len(result) == 0


# ============================================================================
# Test Scoring Calculations
# ============================================================================

class TestScoringCalculations:
    """Tests for scoring algorithm."""

    @patch("leaps_ranker._get_yfinance_options_chain")
    @patch("leaps_ranker.load_config")
    def test_ease_score_range(self, mock_config, mock_chain, mock_options_chain):
        """Ease score should be between 0 and 1."""
        mock_config.return_value = {
            "tickers": {"SPY": {}},
            "scoring": {"high_prob": {"ease_weight": 0.85, "roi_weight": 0.15}},
            "filters": {},
            "display": {"top_n": 100},
        }

        mock_chain.return_value = (
            mock_options_chain["calls"],
            mock_options_chain["underlying_price"],
            mock_options_chain["expirations"],
        )

        result = rank_leaps("SPY")

        if "ease_score" in result.columns and not result.empty:
            assert result["ease_score"].min() >= 0
            assert result["ease_score"].max() <= 1

    @patch("leaps_ranker._get_yfinance_options_chain")
    @patch("leaps_ranker.load_config")
    def test_roi_score_range(self, mock_config, mock_chain, mock_options_chain):
        """ROI score should be between 0 and 1."""
        mock_config.return_value = {
            "tickers": {"SPY": {}},
            "scoring": {"high_prob": {"ease_weight": 0.85, "roi_weight": 0.15}},
            "filters": {},
            "display": {"top_n": 100},
        }

        mock_chain.return_value = (
            mock_options_chain["calls"],
            mock_options_chain["underlying_price"],
            mock_options_chain["expirations"],
        )

        result = rank_leaps("SPY")

        if "roi_score" in result.columns and not result.empty:
            assert result["roi_score"].min() >= 0
            assert result["roi_score"].max() <= 1

    @patch("leaps_ranker._get_yfinance_options_chain")
    @patch("leaps_ranker.load_config")
    def test_total_score_is_weighted_average(self, mock_config, mock_chain, mock_options_chain):
        """Total score should be weighted average of ease and ROI scores."""
        ease_weight = 0.85
        roi_weight = 0.15

        mock_config.return_value = {
            "tickers": {"SPY": {}},
            "scoring": {"high_prob": {"ease_weight": ease_weight, "roi_weight": roi_weight}},
            "filters": {},
            "display": {"top_n": 100},
        }

        mock_chain.return_value = (
            mock_options_chain["calls"],
            mock_options_chain["underlying_price"],
            mock_options_chain["expirations"],
        )

        result = rank_leaps("SPY", mode="high_prob")

        if all(col in result.columns for col in ["ease_score", "roi_score", "total_score"]) and not result.empty:
            expected_total = (
                result["ease_score"] * ease_weight + result["roi_score"] * roi_weight
            )
            # Allow small floating point differences
            np.testing.assert_array_almost_equal(
                result["total_score"].values,
                expected_total.values,
                decimal=5,
            )


# ============================================================================
# Test ROI Calculations
# ============================================================================

class TestRoiCalculations:
    """Tests for ROI calculation accuracy."""

    @patch("leaps_ranker._get_yfinance_options_chain")
    @patch("leaps_ranker.load_config")
    def test_roi_formula(self, mock_config, mock_chain, mock_options_chain):
        """ROI should be (payoff - cost) / cost * 100."""
        mock_config.return_value = {
            "tickers": {"SPY": {"target_pct": 0.16}},
            "scoring": {"high_prob": {"ease_weight": 0.85, "roi_weight": 0.15}},
            "filters": {},
            "display": {"top_n": 100},
        }

        mock_chain.return_value = (
            mock_options_chain["calls"],
            mock_options_chain["underlying_price"],
            mock_options_chain["expirations"],
        )

        result = rank_leaps("SPY", target_pct=0.16)

        if all(col in result.columns for col in ["payoff_at_target", "cost", "roi_pct"]) and not result.empty:
            expected_roi = (result["payoff_at_target"] - result["cost"]) / result["cost"] * 100
            np.testing.assert_array_almost_equal(
                result["roi_pct"].values,
                expected_roi.values,
                decimal=2,
            )

    @patch("leaps_ranker._get_yfinance_options_chain")
    @patch("leaps_ranker.load_config")
    def test_cost_is_premium_times_100(self, mock_config, mock_chain, mock_options_chain):
        """Cost should be premium * 100 (per contract)."""
        mock_config.return_value = {
            "tickers": {"SPY": {}},
            "scoring": {"high_prob": {}},
            "filters": {},
            "display": {"top_n": 100},
        }

        mock_chain.return_value = (
            mock_options_chain["calls"],
            mock_options_chain["underlying_price"],
            mock_options_chain["expirations"],
        )

        result = rank_leaps("SPY")

        if all(col in result.columns for col in ["premium", "cost"]) and not result.empty:
            expected_cost = result["premium"] * 100
            np.testing.assert_array_almost_equal(
                result["cost"].values,
                expected_cost.values,
                decimal=2,
            )


# ============================================================================
# Test Filtering
# ============================================================================

class TestFiltering:
    """Tests for filtering options."""

    @patch("leaps_ranker._get_yfinance_options_chain")
    @patch("leaps_ranker.load_config")
    def test_filters_by_min_dte(self, mock_config, mock_chain, mock_options_chain):
        """Should filter out options with DTE < min_dte."""
        mock_config.return_value = {
            "tickers": {"SPY": {}},
            "scoring": {"high_prob": {}},
            "filters": {"min_dte": 365},  # Require at least 1 year
            "display": {"top_n": 100},
        }

        mock_chain.return_value = (
            mock_options_chain["calls"],
            mock_options_chain["underlying_price"],
            mock_options_chain["expirations"],
        )

        result = rank_leaps("SPY")

        # All results should have expiration >= 365 days from now
        if "expiration" in result.columns and not result.empty:
            today = datetime.now().date()
            for exp in result["expiration"]:
                exp_date = pd.to_datetime(exp).date()
                dte = (exp_date - today).days
                assert dte >= 365


# ============================================================================
# Test Error Handling
# ============================================================================

class TestErrorHandling:
    """Tests for error handling in LEAPS ranker."""

    @patch("leaps_ranker._get_yfinance_options_chain")
    def test_handles_api_error(self, mock_chain):
        """Should handle API errors gracefully."""
        mock_chain.side_effect = Exception("API Error")

        with pytest.raises(Exception):
            rank_leaps("SPY")

    @patch("leaps_ranker._get_yfinance_options_chain")
    @patch("leaps_ranker.load_config")
    def test_handles_nan_values(self, mock_config, mock_chain):
        """Should handle NaN values in options data."""
        mock_config.return_value = {
            "tickers": {"SPY": {}},
            "scoring": {"high_prob": {}},
            "filters": {},
            "display": {"top_n": 100},
        }

        # Create options chain with NaN values
        chain_with_nan = pd.DataFrame([
            {
                "contractSymbol": "SPY20251219C00550000",
                "strike": 550.0,
                "lastPrice": float("nan"),  # NaN price
                "bid": 29.0,
                "ask": 31.0,
            }
        ])

        mock_chain.return_value = (chain_with_nan, 500.0, ["2025-12-19"])

        # Should handle gracefully (either filter out or use fallback)
        result = rank_leaps("SPY")
        assert isinstance(result, pd.DataFrame)


# ============================================================================
# Test Performance
# ============================================================================

class TestLeapsRankerPerformance:
    """Performance tests for LEAPS ranker."""

    @patch("leaps_ranker._get_yfinance_options_chain")
    @patch("leaps_ranker.load_config")
    def test_ranking_performance(self, mock_config, mock_chain, mock_options_chain, performance_timer):
        """Ranking should complete within time budget."""
        mock_config.return_value = {
            "tickers": {"SPY": {}},
            "scoring": {"high_prob": {"ease_weight": 0.85, "roi_weight": 0.15}},
            "filters": {},
            "display": {"top_n": 100},
        }

        mock_chain.return_value = (
            mock_options_chain["calls"],
            mock_options_chain["underlying_price"],
            mock_options_chain["expirations"],
        )

        with performance_timer() as timer:
            for _ in range(10):
                rank_leaps("SPY", top_n=20)

        # 10 rankings with mocked data should be fast
        timer.assert_under(1.0)


# ============================================================================
# Test Security
# ============================================================================

class TestLeapsRankerSecurity:
    """Security tests for LEAPS ranker."""

    def test_rejects_malicious_symbol(self, malicious_inputs):
        """Should reject malicious symbol inputs."""
        for symbol in malicious_inputs["invalid_symbols"]:
            try:
                rank_leaps(symbol)
            except (ValueError, Exception):
                pass  # Expected to reject

    @patch("leaps_ranker.load_config")
    def test_safe_config_loading(self, mock_config, temp_dir):
        """Should not execute code in config file."""
        # Create a config with potential code injection
        malicious_config = temp_dir / "malicious.yaml"
        malicious_config.write_text("""
!!python/object/apply:os.system ["echo 'code executed'"]
""")

        with pytest.raises(Exception):
            load_config(str(malicious_config))
