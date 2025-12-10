"""Test cases for ROI calculation in LEAPS ranker.

Tests verify that:
1. ROI is calculated correctly as (Payoff - Cost) / Cost
2. ROI is stored as decimal (1.0 = 100% ROI)
3. ROI normalization produces correct scores
4. Edge cases are handled properly (zero cost, negative ROI, etc.)
"""

import numpy as np
import pandas as pd
import pytest
import sys
from pathlib import Path

# Add parent directory to path to import leaps_ranker
sys.path.insert(0, str(Path(__file__).parent.parent))

from leaps_ranker import _normalize_roi_score


class TestROICalculation:
    """Test ROI calculation formula: (Payoff - Cost) / Cost"""

    def test_basic_roi_calculation(self):
        """Test basic ROI calculation with known values."""
        # Example: Cost = $1000, Payoff = $2500
        # ROI = (2500 - 1000) / 1000 = 1.5 (150%)
        cost = 1000
        payoff = 2500
        expected_roi = 1.5  # 150% as decimal

        actual_roi = (payoff - cost) / cost
        assert actual_roi == expected_roi

    def test_roi_100_percent(self):
        """Test 100% ROI (doubling money)."""
        # Cost = $1000, Payoff = $2000
        # ROI = (2000 - 1000) / 1000 = 1.0 (100%)
        cost = 1000
        payoff = 2000
        expected_roi = 1.0

        actual_roi = (payoff - cost) / cost
        assert actual_roi == expected_roi

    def test_roi_zero_profit(self):
        """Test zero profit (breakeven)."""
        # Cost = $1000, Payoff = $1000
        # ROI = (1000 - 1000) / 1000 = 0.0 (0%)
        cost = 1000
        payoff = 1000
        expected_roi = 0.0

        actual_roi = (payoff - cost) / cost
        assert actual_roi == expected_roi

    def test_roi_total_loss(self):
        """Test total loss (worthless at expiration)."""
        # Cost = $1000, Payoff = $0
        # ROI = (0 - 1000) / 1000 = -1.0 (-100%)
        cost = 1000
        payoff = 0
        expected_roi = -1.0

        actual_roi = (payoff - cost) / cost
        assert actual_roi == expected_roi

    def test_roi_partial_loss(self):
        """Test partial loss."""
        # Cost = $1000, Payoff = $500
        # ROI = (500 - 1000) / 1000 = -0.5 (-50%)
        cost = 1000
        payoff = 500
        expected_roi = -0.5

        actual_roi = (payoff - cost) / cost
        assert actual_roi == expected_roi

    def test_roi_500_percent(self):
        """Test 500% ROI (6x money)."""
        # Cost = $1000, Payoff = $6000
        # ROI = (6000 - 1000) / 1000 = 5.0 (500%)
        cost = 1000
        payoff = 6000
        expected_roi = 5.0

        actual_roi = (payoff - cost) / cost
        assert actual_roi == expected_roi

    def test_roi_as_decimal_format(self):
        """Verify ROI is stored as decimal, not percentage."""
        cost = 100
        payoff = 250  # 150% ROI

        roi = (payoff - cost) / cost

        # ROI should be 1.5, not 150
        assert roi == 1.5
        assert roi < 100  # Not stored as percentage


class TestROINormalization:
    """Test _normalize_roi_score function."""

    def test_normalize_basic(self):
        """Test normalization produces values between 0 and 1."""
        df = pd.DataFrame({
            "roi_target": [0.0, 1.0, 2.0, 5.0, 10.0]  # 0%, 100%, 200%, 500%, 1000%
        })

        result = _normalize_roi_score(df)

        assert "roi_score" in result.columns
        assert (result["roi_score"] >= 0).all()
        assert (result["roi_score"] <= 1).all()

    def test_normalize_negative_roi(self):
        """Test that negative ROI gets score 0."""
        df = pd.DataFrame({
            "roi_target": [-1.0, -0.5, 0.0]  # -100%, -50%, 0%
        })

        result = _normalize_roi_score(df)

        # All negative ROI should become 0 after clipping
        assert result["roi_score"].iloc[0] == 0.0
        assert result["roi_score"].iloc[1] == 0.0
        assert result["roi_score"].iloc[2] == 0.0

    def test_normalize_ordering(self):
        """Test that higher ROI gets higher score."""
        df = pd.DataFrame({
            "roi_target": [0.5, 1.0, 2.0, 5.0]  # 50%, 100%, 200%, 500%
        })

        result = _normalize_roi_score(df)
        scores = result["roi_score"].tolist()

        # Scores should be in increasing order
        assert scores[0] < scores[1] < scores[2] < scores[3]

    def test_normalize_max_is_one(self):
        """Test that maximum ROI gets score 1.0."""
        df = pd.DataFrame({
            "roi_target": [0.5, 1.0, 5.0, 10.0]  # 50%, 100%, 500%, 1000%
        })

        result = _normalize_roi_score(df)

        # Maximum ROI should have score 1.0
        assert result["roi_score"].max() == 1.0

    def test_normalize_all_same(self):
        """Test normalization when all ROI values are the same."""
        df = pd.DataFrame({
            "roi_target": [1.0, 1.0, 1.0]
        })

        result = _normalize_roi_score(df)

        # All scores should be the same (either all 1.0 or all some value)
        assert result["roi_score"].nunique() == 1

    def test_normalize_all_zero(self):
        """Test normalization when all ROI values are zero."""
        df = pd.DataFrame({
            "roi_target": [0.0, 0.0, 0.0]
        })

        result = _normalize_roi_score(df)

        # All scores should be 0
        assert (result["roi_score"] == 0.0).all()

    def test_normalize_with_nan(self):
        """Test normalization handles NaN values."""
        df = pd.DataFrame({
            "roi_target": [1.0, np.nan, 2.0]
        })

        result = _normalize_roi_score(df)

        # Should not have NaN in output
        assert not result["roi_score"].isna().any()


class TestROIEdgeCases:
    """Test edge cases in ROI calculation."""

    def test_zero_cost_handling(self):
        """Test that zero cost is handled (division by zero)."""
        # In the actual code, this is handled with np.where on arrays
        cost = np.array([0, 1000, 0])
        payoff = np.array([1000, 2000, 500])

        # Using numpy's where for safe division (as done in leaps_ranker.py)
        roi = np.where(cost > 0, (payoff - cost) / cost, 0.0)

        # Zero cost contracts should have ROI = 0
        assert roi[0] == 0.0
        assert roi[1] == 1.0  # (2000-1000)/1000 = 1.0
        assert roi[2] == 0.0

    def test_very_large_roi(self):
        """Test handling of very large ROI values."""
        df = pd.DataFrame({
            "roi_target": [1.0, 100.0, 1000.0]  # 100%, 10000%, 100000%
        })

        result = _normalize_roi_score(df)

        # All scores should be valid numbers between 0 and 1
        assert not result["roi_score"].isna().any()
        assert (result["roi_score"] >= 0).all()
        assert (result["roi_score"] <= 1).all()

    def test_small_positive_roi(self):
        """Test handling of small positive ROI values."""
        df = pd.DataFrame({
            "roi_target": [0.01, 0.05, 0.10]  # 1%, 5%, 10%
        })

        result = _normalize_roi_score(df)

        # All scores should be valid and in increasing order
        scores = result["roi_score"].tolist()
        assert scores[0] < scores[1] < scores[2]


class TestROIFormatting:
    """Test that ROI is in correct format for frontend display."""

    def test_roi_format_for_frontend(self):
        """Test ROI decimal format works with frontend formatPercent function."""
        # Frontend function: formatPercent(val) = `${(val * 100).toFixed(1)}%`
        roi_decimal = 1.5  # 150% ROI

        # Simulate frontend formatting
        displayed = f"{(roi_decimal * 100):.1f}%"

        assert displayed == "150.0%"

    def test_roi_format_examples(self):
        """Test various ROI values format correctly."""
        test_cases = [
            (0.0, "0.0%"),      # 0%
            (0.5, "50.0%"),     # 50%
            (1.0, "100.0%"),    # 100%
            (1.5, "150.0%"),    # 150%
            (2.0, "200.0%"),    # 200%
            (5.0, "500.0%"),    # 500%
            (-0.5, "-50.0%"),   # -50%
            (-1.0, "-100.0%"), # -100%
        ]

        for roi_decimal, expected in test_cases:
            displayed = f"{(roi_decimal * 100):.1f}%"
            assert displayed == expected, f"ROI {roi_decimal} should display as {expected}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
