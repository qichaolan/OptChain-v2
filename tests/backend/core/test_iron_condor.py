"""
Unit tests for Iron Condor module in backend/iron_condor.py

Test Scenarios:
- Data model validation (CreditSpread, IronCondorLeg, IronCondor)
- Max loss and credit calculations
- Breakeven calculations
- Scoring calculations (ROC, POP, width, liquidity, tail risk, total)
- Payoff and ROI calculations
- Iron Condor building and ranking
- Edge cases and error handling

Coverage Target: ≥95% line and branch coverage
"""

import pytest
from dataclasses import FrozenInstanceError
from unittest.mock import patch
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "backend"))

from iron_condor import (
    CreditSpread,
    IronCondorLeg,
    IronCondor,
    clamp,
    compute_max_loss_and_credit,
    compute_breakevens,
    compute_roc_score,
    compute_pop,
    compute_width_score,
    compute_liquidity_score,
    compute_tail_risk,
    compute_total_score,
    payoff_per_contract,
    roi_at_price,
    payoff_roi_curve,
    build_iron_condors,
    rank_iron_condors,
    CONTRACT_MULTIPLIER,
    ROC_TARGET_FOR_FULL_SCORE,
    WIDTH_PCT_MAX_FOR_SCORE,
)


# ============================================================================
# Test Utility Functions
# ============================================================================

class TestClamp:
    """Tests for clamp utility function."""

    def test_clamp_within_range(self):
        """Value within range should remain unchanged."""
        assert clamp(0.5, 0.0, 1.0) == 0.5

    def test_clamp_below_minimum(self):
        """Value below minimum should be clamped to minimum."""
        assert clamp(-0.5, 0.0, 1.0) == 0.0

    def test_clamp_above_maximum(self):
        """Value above maximum should be clamped to maximum."""
        assert clamp(1.5, 0.0, 1.0) == 1.0

    def test_clamp_at_minimum(self):
        """Value at minimum should remain unchanged."""
        assert clamp(0.0, 0.0, 1.0) == 0.0

    def test_clamp_at_maximum(self):
        """Value at maximum should remain unchanged."""
        assert clamp(1.0, 0.0, 1.0) == 1.0


# ============================================================================
# Test CreditSpread Data Model
# ============================================================================

class TestCreditSpread:
    """Tests for CreditSpread dataclass."""

    def test_pcs_creation(self):
        """Should create valid Put Credit Spread."""
        pcs = CreditSpread(
            underlying="SPY",
            expiration="2025-12-19",
            spread_type="PCS",
            short_strike=495.0,
            long_strike=490.0,
            credit=1.50,
            short_delta=0.15,
            bid_ask_spread=0.10,
            volume=1000,
            open_interest=5000,
        )

        assert pcs.underlying == "SPY"
        assert pcs.spread_type == "PCS"
        assert pcs.short_strike > pcs.long_strike

    def test_ccs_creation(self):
        """Should create valid Call Credit Spread."""
        ccs = CreditSpread(
            underlying="SPY",
            expiration="2025-12-19",
            spread_type="CCS",
            short_strike=505.0,
            long_strike=510.0,
            credit=1.30,
            short_delta=0.15,
            bid_ask_spread=0.08,
            volume=800,
            open_interest=4000,
        )

        assert ccs.underlying == "SPY"
        assert ccs.spread_type == "CCS"
        assert ccs.short_strike < ccs.long_strike

    def test_pcs_width_calculation(self):
        """PCS width should be short_strike - long_strike."""
        pcs = CreditSpread(
            underlying="SPY",
            expiration="2025-12-19",
            spread_type="PCS",
            short_strike=495.0,
            long_strike=490.0,
            credit=1.50,
            short_delta=0.15,
            bid_ask_spread=0.10,
            volume=1000,
            open_interest=5000,
        )

        assert pcs.width == 5.0

    def test_ccs_width_calculation(self):
        """CCS width should be long_strike - short_strike."""
        ccs = CreditSpread(
            underlying="SPY",
            expiration="2025-12-19",
            spread_type="CCS",
            short_strike=505.0,
            long_strike=510.0,
            credit=1.30,
            short_delta=0.15,
            bid_ask_spread=0.08,
            volume=800,
            open_interest=4000,
        )

        assert ccs.width == 5.0


# ============================================================================
# Test IronCondorLeg Data Model
# ============================================================================

class TestIronCondorLeg:
    """Tests for IronCondorLeg dataclass."""

    def test_put_leg_with_pcs(self):
        """Put leg should accept PCS spread."""
        pcs = CreditSpread(
            underlying="SPY",
            expiration="2025-12-19",
            spread_type="PCS",
            short_strike=495.0,
            long_strike=490.0,
            credit=1.50,
            short_delta=0.15,
            bid_ask_spread=0.10,
            volume=1000,
            open_interest=5000,
        )

        leg = IronCondorLeg(spread=pcs, side="put")

        assert leg.side == "put"
        assert leg.spread == pcs

    def test_call_leg_with_ccs(self):
        """Call leg should accept CCS spread."""
        ccs = CreditSpread(
            underlying="SPY",
            expiration="2025-12-19",
            spread_type="CCS",
            short_strike=505.0,
            long_strike=510.0,
            credit=1.30,
            short_delta=0.15,
            bid_ask_spread=0.08,
            volume=800,
            open_interest=4000,
        )

        leg = IronCondorLeg(spread=ccs, side="call")

        assert leg.side == "call"
        assert leg.spread == ccs

    def test_put_leg_rejects_ccs(self):
        """Put leg should reject CCS spread."""
        ccs = CreditSpread(
            underlying="SPY",
            expiration="2025-12-19",
            spread_type="CCS",
            short_strike=505.0,
            long_strike=510.0,
            credit=1.30,
            short_delta=0.15,
            bid_ask_spread=0.08,
            volume=800,
            open_interest=4000,
        )

        with pytest.raises(ValueError, match="Put leg must use a PCS spread"):
            IronCondorLeg(spread=ccs, side="put")

    def test_call_leg_rejects_pcs(self):
        """Call leg should reject PCS spread."""
        pcs = CreditSpread(
            underlying="SPY",
            expiration="2025-12-19",
            spread_type="PCS",
            short_strike=495.0,
            long_strike=490.0,
            credit=1.50,
            short_delta=0.15,
            bid_ask_spread=0.10,
            volume=1000,
            open_interest=5000,
        )

        with pytest.raises(ValueError, match="Call leg must use a CCS spread"):
            IronCondorLeg(spread=pcs, side="call")


# ============================================================================
# Test IronCondor Data Model
# ============================================================================

class TestIronCondor:
    """Tests for IronCondor dataclass."""

    @pytest.fixture
    def symmetric_condor(self):
        """Create a symmetric Iron Condor for testing."""
        pcs = CreditSpread(
            underlying="TEST",
            expiration="2025-12-19",
            spread_type="PCS",
            short_strike=95.0,
            long_strike=90.0,
            credit=1.0,
            short_delta=0.15,
            bid_ask_spread=0.05,
            volume=500,
            open_interest=1000,
        )

        ccs = CreditSpread(
            underlying="TEST",
            expiration="2025-12-19",
            spread_type="CCS",
            short_strike=105.0,
            long_strike=110.0,
            credit=1.0,
            short_delta=0.15,
            bid_ask_spread=0.05,
            volume=500,
            open_interest=1000,
        )

        put_leg = IronCondorLeg(spread=pcs, side="put")
        call_leg = IronCondorLeg(spread=ccs, side="call")

        return IronCondor(
            put_leg=put_leg,
            call_leg=call_leg,
            underlying_price=100.0,
            days_to_expiration=30,
        )

    def test_condor_creation(self, symmetric_condor):
        """Should create valid Iron Condor."""
        assert symmetric_condor.underlying == "TEST"
        assert symmetric_condor.expiration == "2025-12-19"

    def test_condor_strike_properties(self, symmetric_condor):
        """Should expose strike properties correctly."""
        assert symmetric_condor.short_put_strike == 95.0
        assert symmetric_condor.long_put_strike == 90.0
        assert symmetric_condor.short_call_strike == 105.0
        assert symmetric_condor.long_call_strike == 110.0

    def test_condor_credit_properties(self, symmetric_condor):
        """Should expose credit properties correctly."""
        assert symmetric_condor.credit_pcs == 1.0
        assert symmetric_condor.credit_ccs == 1.0
        assert symmetric_condor.total_credit == 2.0

    def test_condor_width_properties(self, symmetric_condor):
        """Should expose width properties correctly."""
        assert symmetric_condor.put_width == 5.0
        assert symmetric_condor.call_width == 5.0

    def test_rejects_mismatched_underlying(self):
        """Should reject legs with different underlyings."""
        pcs = CreditSpread(
            underlying="SPY",
            expiration="2025-12-19",
            spread_type="PCS",
            short_strike=95.0,
            long_strike=90.0,
            credit=1.0,
            short_delta=0.15,
            bid_ask_spread=0.05,
            volume=500,
            open_interest=1000,
        )

        ccs = CreditSpread(
            underlying="QQQ",  # Different underlying
            expiration="2025-12-19",
            spread_type="CCS",
            short_strike=105.0,
            long_strike=110.0,
            credit=1.0,
            short_delta=0.15,
            bid_ask_spread=0.05,
            volume=500,
            open_interest=1000,
        )

        put_leg = IronCondorLeg(spread=pcs, side="put")
        call_leg = IronCondorLeg(spread=ccs, side="call")

        with pytest.raises(ValueError, match="same underlying"):
            IronCondor(
                put_leg=put_leg,
                call_leg=call_leg,
                underlying_price=100.0,
                days_to_expiration=30,
            )

    def test_rejects_mismatched_expiration(self):
        """Should reject legs with different expirations."""
        pcs = CreditSpread(
            underlying="TEST",
            expiration="2025-12-19",
            spread_type="PCS",
            short_strike=95.0,
            long_strike=90.0,
            credit=1.0,
            short_delta=0.15,
            bid_ask_spread=0.05,
            volume=500,
            open_interest=1000,
        )

        ccs = CreditSpread(
            underlying="TEST",
            expiration="2026-01-16",  # Different expiration
            spread_type="CCS",
            short_strike=105.0,
            long_strike=110.0,
            credit=1.0,
            short_delta=0.15,
            bid_ask_spread=0.05,
            volume=500,
            open_interest=1000,
        )

        put_leg = IronCondorLeg(spread=pcs, side="put")
        call_leg = IronCondorLeg(spread=ccs, side="call")

        with pytest.raises(ValueError, match="same expiration"):
            IronCondor(
                put_leg=put_leg,
                call_leg=call_leg,
                underlying_price=100.0,
                days_to_expiration=30,
            )

    def test_rejects_invalid_condor_shape(self):
        """Should reject if short_put >= short_call."""
        pcs = CreditSpread(
            underlying="TEST",
            expiration="2025-12-19",
            spread_type="PCS",
            short_strike=105.0,  # Higher than short_call
            long_strike=100.0,
            credit=1.0,
            short_delta=0.15,
            bid_ask_spread=0.05,
            volume=500,
            open_interest=1000,
        )

        ccs = CreditSpread(
            underlying="TEST",
            expiration="2025-12-19",
            spread_type="CCS",
            short_strike=100.0,  # Lower than short_put
            long_strike=105.0,
            credit=1.0,
            short_delta=0.15,
            bid_ask_spread=0.05,
            volume=500,
            open_interest=1000,
        )

        put_leg = IronCondorLeg(spread=pcs, side="put")
        call_leg = IronCondorLeg(spread=ccs, side="call")

        with pytest.raises(ValueError, match="Invalid condor shape"):
            IronCondor(
                put_leg=put_leg,
                call_leg=call_leg,
                underlying_price=100.0,
                days_to_expiration=30,
            )


# ============================================================================
# Test Max Loss and Credit Calculations
# ============================================================================

class TestMaxLossAndCredit:
    """Tests for max loss and credit calculations."""

    def test_symmetric_condor_max_loss(self):
        """Max loss for symmetric condor should be width - total_credit."""
        pcs = CreditSpread(
            underlying="TEST",
            expiration="2025-12-19",
            spread_type="PCS",
            short_strike=95.0,
            long_strike=90.0,
            credit=1.0,  # Width = 5
            short_delta=0.15,
            bid_ask_spread=0.05,
            volume=500,
            open_interest=1000,
        )

        ccs = CreditSpread(
            underlying="TEST",
            expiration="2025-12-19",
            spread_type="CCS",
            short_strike=105.0,
            long_strike=110.0,
            credit=1.0,  # Width = 5
            short_delta=0.15,
            bid_ask_spread=0.05,
            volume=500,
            open_interest=1000,
        )

        put_leg = IronCondorLeg(spread=pcs, side="put")
        call_leg = IronCondorLeg(spread=ccs, side="call")

        condor = IronCondor(
            put_leg=put_leg,
            call_leg=call_leg,
            underlying_price=100.0,
            days_to_expiration=30,
        )

        # total_credit = 1.0 + 1.0 = 2.0
        # max_loss_per_share = max(5, 5) - 2.0 = 3.0
        assert condor.total_credit == 2.0
        assert condor.max_loss_per_share == 3.0
        assert condor.max_profit_dollars == 200.0  # 2.0 * 100
        assert condor.max_loss_dollars == 300.0  # 3.0 * 100

    def test_asymmetric_condor_max_loss(self):
        """Max loss for asymmetric condor should use wider wing."""
        pcs = CreditSpread(
            underlying="TEST",
            expiration="2025-12-19",
            spread_type="PCS",
            short_strike=95.0,
            long_strike=85.0,  # Width = 10
            credit=1.5,
            short_delta=0.15,
            bid_ask_spread=0.05,
            volume=500,
            open_interest=1000,
        )

        ccs = CreditSpread(
            underlying="TEST",
            expiration="2025-12-19",
            spread_type="CCS",
            short_strike=105.0,
            long_strike=110.0,  # Width = 5
            credit=1.0,
            short_delta=0.15,
            bid_ask_spread=0.05,
            volume=500,
            open_interest=1000,
        )

        put_leg = IronCondorLeg(spread=pcs, side="put")
        call_leg = IronCondorLeg(spread=ccs, side="call")

        condor = IronCondor(
            put_leg=put_leg,
            call_leg=call_leg,
            underlying_price=100.0,
            days_to_expiration=30,
        )

        # total_credit = 1.5 + 1.0 = 2.5
        # max_loss_per_share = max(10, 5) - 2.5 = 7.5
        assert condor.total_credit == 2.5
        assert condor.max_loss_per_share == 7.5


# ============================================================================
# Test Breakeven Calculations
# ============================================================================

class TestBreakevenCalculations:
    """Tests for breakeven price calculations."""

    def test_breakeven_prices(self):
        """Should calculate correct breakeven prices."""
        pcs = CreditSpread(
            underlying="TEST",
            expiration="2025-12-19",
            spread_type="PCS",
            short_strike=95.0,
            long_strike=90.0,
            credit=1.0,
            short_delta=0.15,
            bid_ask_spread=0.05,
            volume=500,
            open_interest=1000,
        )

        ccs = CreditSpread(
            underlying="TEST",
            expiration="2025-12-19",
            spread_type="CCS",
            short_strike=105.0,
            long_strike=110.0,
            credit=1.0,
            short_delta=0.15,
            bid_ask_spread=0.05,
            volume=500,
            open_interest=1000,
        )

        put_leg = IronCondorLeg(spread=pcs, side="put")
        call_leg = IronCondorLeg(spread=ccs, side="call")

        condor = IronCondor(
            put_leg=put_leg,
            call_leg=call_leg,
            underlying_price=100.0,
            days_to_expiration=30,
        )

        # breakeven_low = short_put - total_credit = 95 - 2 = 93
        # breakeven_high = short_call + total_credit = 105 + 2 = 107
        assert condor.breakeven_low == 93.0
        assert condor.breakeven_high == 107.0

    def test_breakeven_distance_percentages(self):
        """Should calculate correct breakeven distance percentages."""
        pcs = CreditSpread(
            underlying="TEST",
            expiration="2025-12-19",
            spread_type="PCS",
            short_strike=95.0,
            long_strike=90.0,
            credit=1.0,
            short_delta=0.15,
            bid_ask_spread=0.05,
            volume=500,
            open_interest=1000,
        )

        ccs = CreditSpread(
            underlying="TEST",
            expiration="2025-12-19",
            spread_type="CCS",
            short_strike=105.0,
            long_strike=110.0,
            credit=1.0,
            short_delta=0.15,
            bid_ask_spread=0.05,
            volume=500,
            open_interest=1000,
        )

        put_leg = IronCondorLeg(spread=pcs, side="put")
        call_leg = IronCondorLeg(spread=ccs, side="call")

        condor = IronCondor(
            put_leg=put_leg,
            call_leg=call_leg,
            underlying_price=100.0,
            days_to_expiration=30,
        )

        # distance_to_BE_low = (100 - 93) / 100 = 0.07
        # distance_to_BE_high = (107 - 100) / 100 = 0.07
        assert abs(condor.distance_to_BE_low_pct - 0.07) < 0.001
        assert abs(condor.distance_to_BE_high_pct - 0.07) < 0.001


# ============================================================================
# Test Scoring Calculations
# ============================================================================

class TestScoringCalculations:
    """Tests for scoring calculations."""

    @pytest.fixture
    def test_condor(self):
        """Create a test condor for scoring tests."""
        pcs = CreditSpread(
            underlying="TEST",
            expiration="2025-12-19",
            spread_type="PCS",
            short_strike=95.0,
            long_strike=90.0,
            credit=1.0,
            short_delta=0.15,
            bid_ask_spread=0.05,
            volume=500,
            open_interest=1000,
        )

        ccs = CreditSpread(
            underlying="TEST",
            expiration="2025-12-19",
            spread_type="CCS",
            short_strike=105.0,
            long_strike=110.0,
            credit=1.0,
            short_delta=0.15,
            bid_ask_spread=0.05,
            volume=500,
            open_interest=1000,
        )

        put_leg = IronCondorLeg(spread=pcs, side="put")
        call_leg = IronCondorLeg(spread=ccs, side="call")

        return IronCondor(
            put_leg=put_leg,
            call_leg=call_leg,
            underlying_price=100.0,
            days_to_expiration=30,
        )

    def test_roc_score_range(self, test_condor):
        """ROC score should be between 0 and 1."""
        assert 0 <= test_condor.roc_score <= 1

    def test_roc_raw_calculation(self, test_condor):
        """ROC raw should be total_credit / max_loss_per_share."""
        expected_roc = test_condor.total_credit / test_condor.max_loss_per_share
        assert abs(test_condor.roc_raw - expected_roc) < 0.001

    def test_pop_range(self, test_condor):
        """POP should be between 0 and 1."""
        assert 0 <= test_condor.pop <= 1

    def test_pop_calculation(self, test_condor):
        """POP should be 1 - (delta_put + delta_call)."""
        expected_pop = 1 - (0.15 + 0.15)
        assert abs(test_condor.pop - expected_pop) < 0.001

    def test_width_score_range(self, test_condor):
        """Width score should be between 0 and 1."""
        assert 0 <= test_condor.width_score <= 1

    def test_liquidity_score_range(self, test_condor):
        """Liquidity score should be between 0 and 1."""
        assert 0 <= test_condor.liquidity_score <= 1

    def test_tail_risk_range(self, test_condor):
        """Tail risk should be between 0 and 1."""
        assert 0 <= test_condor.tail_risk <= 1

    def test_total_score_range(self, test_condor):
        """Total score should be between 0 and 1."""
        assert 0 <= test_condor.total_score <= 1


# ============================================================================
# Test Payoff Calculations
# ============================================================================

class TestPayoffCalculations:
    """Tests for payoff calculations."""

    @pytest.fixture
    def symmetric_condor(self):
        """Create a symmetric condor for payoff tests."""
        pcs = CreditSpread(
            underlying="TEST",
            expiration="2025-12-19",
            spread_type="PCS",
            short_strike=95.0,
            long_strike=90.0,
            credit=1.0,
            short_delta=0.15,
            bid_ask_spread=0.05,
            volume=500,
            open_interest=1000,
        )

        ccs = CreditSpread(
            underlying="TEST",
            expiration="2025-12-19",
            spread_type="CCS",
            short_strike=105.0,
            long_strike=110.0,
            credit=1.0,
            short_delta=0.15,
            bid_ask_spread=0.05,
            volume=500,
            open_interest=1000,
        )

        put_leg = IronCondorLeg(spread=pcs, side="put")
        call_leg = IronCondorLeg(spread=ccs, side="call")

        return IronCondor(
            put_leg=put_leg,
            call_leg=call_leg,
            underlying_price=100.0,
            days_to_expiration=30,
        )

    def test_max_profit_in_zone(self, symmetric_condor):
        """Payoff at center should equal max profit."""
        payoff = payoff_per_contract(symmetric_condor, s_t=100.0)

        assert abs(payoff - symmetric_condor.max_profit_dollars) < 0.01

    def test_max_loss_downside(self, symmetric_condor):
        """Payoff at deep ITM downside should equal -max_loss."""
        payoff = payoff_per_contract(symmetric_condor, s_t=50.0)

        assert abs(payoff - (-symmetric_condor.max_loss_dollars)) < 0.01

    def test_max_loss_upside(self, symmetric_condor):
        """Payoff at deep ITM upside should equal -max_loss."""
        payoff = payoff_per_contract(symmetric_condor, s_t=200.0)

        assert abs(payoff - (-symmetric_condor.max_loss_dollars)) < 0.01

    def test_breakeven_low_payoff(self, symmetric_condor):
        """Payoff at lower breakeven should be zero."""
        payoff = payoff_per_contract(symmetric_condor, s_t=symmetric_condor.breakeven_low)

        assert abs(payoff) < 0.01

    def test_breakeven_high_payoff(self, symmetric_condor):
        """Payoff at upper breakeven should be zero."""
        payoff = payoff_per_contract(symmetric_condor, s_t=symmetric_condor.breakeven_high)

        assert abs(payoff) < 0.01

    def test_partial_loss_put_side(self, symmetric_condor):
        """Payoff between short_put and breakeven_low should be partial profit/loss."""
        s_t = 94.0  # Between short_put (95) and breakeven_low (93)
        payoff = payoff_per_contract(symmetric_condor, s_t=s_t)

        # Should be positive but less than max profit
        assert 0 < payoff < symmetric_condor.max_profit_dollars

    def test_partial_loss_call_side(self, symmetric_condor):
        """Payoff between short_call and breakeven_high should be partial profit/loss."""
        s_t = 106.0  # Between short_call (105) and breakeven_high (107)
        payoff = payoff_per_contract(symmetric_condor, s_t=s_t)

        # Should be positive but less than max profit
        assert 0 < payoff < symmetric_condor.max_profit_dollars


# ============================================================================
# Test ROI Calculations
# ============================================================================

class TestRoiCalculations:
    """Tests for ROI calculations."""

    @pytest.fixture
    def test_condor(self):
        """Create test condor for ROI tests."""
        pcs = CreditSpread(
            underlying="TEST",
            expiration="2025-12-19",
            spread_type="PCS",
            short_strike=95.0,
            long_strike=90.0,
            credit=1.0,
            short_delta=0.15,
            bid_ask_spread=0.05,
            volume=500,
            open_interest=1000,
        )

        ccs = CreditSpread(
            underlying="TEST",
            expiration="2025-12-19",
            spread_type="CCS",
            short_strike=105.0,
            long_strike=110.0,
            credit=1.0,
            short_delta=0.15,
            bid_ask_spread=0.05,
            volume=500,
            open_interest=1000,
        )

        put_leg = IronCondorLeg(spread=pcs, side="put")
        call_leg = IronCondorLeg(spread=ccs, side="call")

        return IronCondor(
            put_leg=put_leg,
            call_leg=call_leg,
            underlying_price=100.0,
            days_to_expiration=30,
        )

    def test_roi_at_max_profit(self, test_condor):
        """ROI at max profit zone should be positive."""
        roi = roi_at_price(test_condor, s_t=100.0)

        # ROI = max_profit / max_loss = 200 / 300 = 0.6667
        expected = test_condor.max_profit_dollars / test_condor.max_loss_dollars
        assert abs(roi - expected) < 0.01

    def test_roi_at_max_loss(self, test_condor):
        """ROI at max loss should be -1."""
        roi = roi_at_price(test_condor, s_t=50.0)

        assert abs(roi - (-1.0)) < 0.01

    def test_roi_at_breakeven(self, test_condor):
        """ROI at breakeven should be zero."""
        roi = roi_at_price(test_condor, s_t=test_condor.breakeven_low)

        assert abs(roi) < 0.01

    def test_roi_handles_zero_max_loss(self):
        """ROI should return 0 for zero max loss."""
        pcs = CreditSpread(
            underlying="TEST",
            expiration="2025-12-19",
            spread_type="PCS",
            short_strike=95.0,
            long_strike=90.0,
            credit=5.0,  # Credit equals width
            short_delta=0.15,
            bid_ask_spread=0.05,
            volume=500,
            open_interest=1000,
        )

        ccs = CreditSpread(
            underlying="TEST",
            expiration="2025-12-19",
            spread_type="CCS",
            short_strike=105.0,
            long_strike=110.0,
            credit=0.0,  # No credit on this leg
            short_delta=0.15,
            bid_ask_spread=0.05,
            volume=500,
            open_interest=1000,
        )

        put_leg = IronCondorLeg(spread=pcs, side="put")
        call_leg = IronCondorLeg(spread=ccs, side="call")

        condor = IronCondor(
            put_leg=put_leg,
            call_leg=call_leg,
            underlying_price=100.0,
            days_to_expiration=30,
        )

        # If max_loss_dollars is 0, roi should be 0
        roi = roi_at_price(condor, s_t=100.0)
        # Since total_credit = 5.0, max_loss_per_share = max(5, 5) - 5 = 0
        assert condor.max_loss_per_share == 0.0
        assert roi == 0.0


# ============================================================================
# Test Payoff/ROI Curve
# ============================================================================

class TestPayoffRoiCurve:
    """Tests for payoff/ROI curve generation."""

    @pytest.fixture
    def test_condor(self):
        """Create test condor."""
        pcs = CreditSpread(
            underlying="TEST",
            expiration="2025-12-19",
            spread_type="PCS",
            short_strike=95.0,
            long_strike=90.0,
            credit=1.0,
            short_delta=0.15,
            bid_ask_spread=0.05,
            volume=500,
            open_interest=1000,
        )

        ccs = CreditSpread(
            underlying="TEST",
            expiration="2025-12-19",
            spread_type="CCS",
            short_strike=105.0,
            long_strike=110.0,
            credit=1.0,
            short_delta=0.15,
            bid_ask_spread=0.05,
            volume=500,
            open_interest=1000,
        )

        put_leg = IronCondorLeg(spread=pcs, side="put")
        call_leg = IronCondorLeg(spread=ccs, side="call")

        return IronCondor(
            put_leg=put_leg,
            call_leg=call_leg,
            underlying_price=100.0,
            days_to_expiration=30,
        )

    def test_curve_returns_list(self, test_condor):
        """Should return a list of dictionaries."""
        curve = payoff_roi_curve(test_condor)

        assert isinstance(curve, list)
        assert len(curve) > 0
        assert all(isinstance(point, dict) for point in curve)

    def test_curve_contains_required_keys(self, test_condor):
        """Each point should contain required keys."""
        curve = payoff_roi_curve(test_condor)

        required_keys = ["move_pct", "price", "payoff", "roi"]
        for point in curve:
            for key in required_keys:
                assert key in point

    def test_curve_respects_bounds(self, test_condor):
        """Curve should respect move_low and move_high bounds."""
        curve = payoff_roi_curve(
            test_condor,
            move_low_pct=-0.10,
            move_high_pct=0.10,
            step_pct=0.02,
        )

        moves = [p["move_pct"] for p in curve]
        assert min(moves) >= -0.10
        assert max(moves) <= 0.11  # Allow for floating point

    def test_curve_center_is_max_profit(self, test_condor):
        """Center point (0% move) should have max profit payoff."""
        curve = payoff_roi_curve(test_condor, move_low_pct=-0.05, move_high_pct=0.05)

        center_point = [p for p in curve if abs(p["move_pct"]) < 0.005][0]
        assert abs(center_point["payoff"] - test_condor.max_profit_dollars) < 1.0


# ============================================================================
# Test Iron Condor Building
# ============================================================================

class TestBuildIronCondors:
    """Tests for building Iron Condors from spreads."""

    @pytest.fixture
    def put_spreads(self):
        """Create test PCS spreads."""
        return [
            CreditSpread(
                underlying="QQQ",
                expiration="2025-12-19",
                spread_type="PCS",
                short_strike=490.0,
                long_strike=485.0,
                credit=0.85,
                short_delta=0.12,
                bid_ask_spread=0.08,
                volume=1200,
                open_interest=5500,
            ),
            CreditSpread(
                underlying="QQQ",
                expiration="2025-12-19",
                spread_type="PCS",
                short_strike=495.0,
                long_strike=490.0,
                credit=1.10,
                short_delta=0.15,
                bid_ask_spread=0.10,
                volume=1500,
                open_interest=6200,
            ),
        ]

    @pytest.fixture
    def call_spreads(self):
        """Create test CCS spreads."""
        return [
            CreditSpread(
                underlying="QQQ",
                expiration="2025-12-19",
                spread_type="CCS",
                short_strike=540.0,
                long_strike=545.0,
                credit=0.90,
                short_delta=0.12,
                bid_ask_spread=0.08,
                volume=1100,
                open_interest=5000,
            ),
            CreditSpread(
                underlying="QQQ",
                expiration="2025-12-19",
                spread_type="CCS",
                short_strike=535.0,
                long_strike=540.0,
                credit=1.15,
                short_delta=0.15,
                bid_ask_spread=0.10,
                volume=1300,
                open_interest=5500,
            ),
        ]

    def test_builds_all_combinations(self, put_spreads, call_spreads):
        """Should build all valid PCS x CCS combinations."""
        condors = build_iron_condors(
            put_spreads=put_spreads,
            call_spreads=call_spreads,
            underlying_price=520.0,
            days_to_expiration=45,
        )

        # 2 PCS x 2 CCS = 4 combinations (all valid since puts < calls)
        assert len(condors) == 4

    def test_rejects_invalid_shape(self, call_spreads):
        """Should reject invalid condor shapes."""
        # Create PCS with strikes above the CCS
        invalid_pcs = [
            CreditSpread(
                underlying="QQQ",
                expiration="2025-12-19",
                spread_type="PCS",
                short_strike=550.0,  # Higher than CCS short strikes
                long_strike=545.0,
                credit=1.0,
                short_delta=0.15,
                bid_ask_spread=0.10,
                volume=1000,
                open_interest=5000,
            ),
        ]

        condors = build_iron_condors(
            put_spreads=invalid_pcs,
            call_spreads=call_spreads,
            underlying_price=520.0,
            days_to_expiration=45,
        )

        # No valid condors since PCS strikes > CCS strikes
        assert len(condors) == 0

    def test_filters_different_underlying(self, put_spreads):
        """Should filter spreads with different underlying."""
        different_underlying_ccs = [
            CreditSpread(
                underlying="SPY",  # Different from QQQ
                expiration="2025-12-19",
                spread_type="CCS",
                short_strike=540.0,
                long_strike=545.0,
                credit=0.90,
                short_delta=0.12,
                bid_ask_spread=0.08,
                volume=1100,
                open_interest=5000,
            ),
        ]

        condors = build_iron_condors(
            put_spreads=put_spreads,
            call_spreads=different_underlying_ccs,
            underlying_price=520.0,
            days_to_expiration=45,
        )

        assert len(condors) == 0

    def test_filters_different_expiration(self, put_spreads):
        """Should filter spreads with different expiration."""
        different_exp_ccs = [
            CreditSpread(
                underlying="QQQ",
                expiration="2026-01-16",  # Different expiration
                spread_type="CCS",
                short_strike=540.0,
                long_strike=545.0,
                credit=0.90,
                short_delta=0.12,
                bid_ask_spread=0.08,
                volume=1100,
                open_interest=5000,
            ),
        ]

        condors = build_iron_condors(
            put_spreads=put_spreads,
            call_spreads=different_exp_ccs,
            underlying_price=520.0,
            days_to_expiration=45,
        )

        assert len(condors) == 0


# ============================================================================
# Test Iron Condor Ranking
# ============================================================================

class TestRankIronCondors:
    """Tests for ranking Iron Condors."""

    @pytest.fixture
    def put_spreads(self):
        """Create test PCS spreads."""
        return [
            CreditSpread(
                underlying="QQQ",
                expiration="2025-12-19",
                spread_type="PCS",
                short_strike=490.0,
                long_strike=485.0,
                credit=0.85,
                short_delta=0.10,
                bid_ask_spread=0.05,
                volume=2000,
                open_interest=10000,
            ),
            CreditSpread(
                underlying="QQQ",
                expiration="2025-12-19",
                spread_type="PCS",
                short_strike=495.0,
                long_strike=490.0,
                credit=1.20,
                short_delta=0.15,
                bid_ask_spread=0.08,
                volume=1500,
                open_interest=8000,
            ),
            CreditSpread(
                underlying="QQQ",
                expiration="2025-12-19",
                spread_type="PCS",
                short_strike=500.0,
                long_strike=495.0,
                credit=1.50,
                short_delta=0.20,
                bid_ask_spread=0.10,
                volume=1200,
                open_interest=6000,
            ),
        ]

    @pytest.fixture
    def call_spreads(self):
        """Create test CCS spreads."""
        return [
            CreditSpread(
                underlying="QQQ",
                expiration="2025-12-19",
                spread_type="CCS",
                short_strike=540.0,
                long_strike=545.0,
                credit=0.90,
                short_delta=0.10,
                bid_ask_spread=0.05,
                volume=1800,
                open_interest=9000,
            ),
            CreditSpread(
                underlying="QQQ",
                expiration="2025-12-19",
                spread_type="CCS",
                short_strike=535.0,
                long_strike=540.0,
                credit=1.25,
                short_delta=0.15,
                bid_ask_spread=0.08,
                volume=1400,
                open_interest=7000,
            ),
            CreditSpread(
                underlying="QQQ",
                expiration="2025-12-19",
                spread_type="CCS",
                short_strike=530.0,
                long_strike=535.0,
                credit=1.60,
                short_delta=0.20,
                bid_ask_spread=0.10,
                volume=1100,
                open_interest=5500,
            ),
        ]

    def test_ranks_by_total_score(self, put_spreads, call_spreads):
        """Should rank condors by total_score descending."""
        condors = rank_iron_condors(
            put_spreads=put_spreads,
            call_spreads=call_spreads,
            underlying_price=520.0,
            days_to_expiration=45,
            top_n=20,
        )

        scores = [c.total_score for c in condors]
        assert scores == sorted(scores, reverse=True)

    def test_respects_top_n(self, put_spreads, call_spreads):
        """Should return at most top_n results."""
        condors = rank_iron_condors(
            put_spreads=put_spreads,
            call_spreads=call_spreads,
            underlying_price=520.0,
            days_to_expiration=45,
            top_n=3,
        )

        assert len(condors) <= 3

    def test_empty_inputs(self):
        """Should handle empty inputs gracefully."""
        condors = rank_iron_condors(
            put_spreads=[],
            call_spreads=[],
            underlying_price=520.0,
            days_to_expiration=45,
        )

        assert condors == []


# ============================================================================
# Test Edge Cases
# ============================================================================

class TestIronCondorEdgeCases:
    """Tests for edge cases in Iron Condor calculations."""

    def test_zero_underlying_price(self):
        """Should handle zero underlying price."""
        pcs = CreditSpread(
            underlying="TEST",
            expiration="2025-12-19",
            spread_type="PCS",
            short_strike=95.0,
            long_strike=90.0,
            credit=1.0,
            short_delta=0.15,
            bid_ask_spread=0.05,
            volume=500,
            open_interest=1000,
        )

        ccs = CreditSpread(
            underlying="TEST",
            expiration="2025-12-19",
            spread_type="CCS",
            short_strike=105.0,
            long_strike=110.0,
            credit=1.0,
            short_delta=0.15,
            bid_ask_spread=0.05,
            volume=500,
            open_interest=1000,
        )

        put_leg = IronCondorLeg(spread=pcs, side="put")
        call_leg = IronCondorLeg(spread=ccs, side="call")

        condor = IronCondor(
            put_leg=put_leg,
            call_leg=call_leg,
            underlying_price=0.0,  # Edge case
            days_to_expiration=30,
        )

        # Should handle gracefully
        assert condor.distance_to_BE_low_pct == 0.0
        assert condor.distance_to_BE_high_pct == 0.0

    def test_extreme_delta_values(self):
        """Should handle extreme delta values."""
        pcs = CreditSpread(
            underlying="TEST",
            expiration="2025-12-19",
            spread_type="PCS",
            short_strike=95.0,
            long_strike=90.0,
            credit=1.0,
            short_delta=0.99,  # Extreme delta
            bid_ask_spread=0.05,
            volume=500,
            open_interest=1000,
        )

        ccs = CreditSpread(
            underlying="TEST",
            expiration="2025-12-19",
            spread_type="CCS",
            short_strike=105.0,
            long_strike=110.0,
            credit=1.0,
            short_delta=0.01,  # Extreme delta
            bid_ask_spread=0.05,
            volume=500,
            open_interest=1000,
        )

        put_leg = IronCondorLeg(spread=pcs, side="put")
        call_leg = IronCondorLeg(spread=ccs, side="call")

        condor = IronCondor(
            put_leg=put_leg,
            call_leg=call_leg,
            underlying_price=100.0,
            days_to_expiration=30,
        )

        # All scores should still be clamped
        assert 0 <= condor.pop <= 1
        assert 0 <= condor.tail_risk <= 1
        assert 0 <= condor.total_score <= 1


# ============================================================================
# Test Performance
# ============================================================================

class TestIronCondorPerformance:
    """Performance tests for Iron Condor operations."""

    def test_building_many_condors(self, performance_timer):
        """Building many condors should be fast."""
        # Create many spreads
        put_spreads = []
        call_spreads = []

        for i in range(20):
            put_spreads.append(CreditSpread(
                underlying="QQQ",
                expiration="2025-12-19",
                spread_type="PCS",
                short_strike=490.0 - i,
                long_strike=485.0 - i,
                credit=0.85 + i * 0.05,
                short_delta=0.10 + i * 0.005,
                bid_ask_spread=0.05,
                volume=1000,
                open_interest=5000,
            ))

            call_spreads.append(CreditSpread(
                underlying="QQQ",
                expiration="2025-12-19",
                spread_type="CCS",
                short_strike=540.0 + i,
                long_strike=545.0 + i,
                credit=0.90 + i * 0.05,
                short_delta=0.10 + i * 0.005,
                bid_ask_spread=0.05,
                volume=1000,
                open_interest=5000,
            ))

        with performance_timer() as timer:
            condors = rank_iron_condors(
                put_spreads=put_spreads,
                call_spreads=call_spreads,
                underlying_price=520.0,
                days_to_expiration=45,
                top_n=50,
            )

        # 20 x 20 = 400 potential condors should be fast
        timer.assert_under(1.0)
        assert len(condors) <= 50

    def test_payoff_curve_generation(self, performance_timer):
        """Payoff curve generation should be fast."""
        pcs = CreditSpread(
            underlying="TEST",
            expiration="2025-12-19",
            spread_type="PCS",
            short_strike=95.0,
            long_strike=90.0,
            credit=1.0,
            short_delta=0.15,
            bid_ask_spread=0.05,
            volume=500,
            open_interest=1000,
        )

        ccs = CreditSpread(
            underlying="TEST",
            expiration="2025-12-19",
            spread_type="CCS",
            short_strike=105.0,
            long_strike=110.0,
            credit=1.0,
            short_delta=0.15,
            bid_ask_spread=0.05,
            volume=500,
            open_interest=1000,
        )

        put_leg = IronCondorLeg(spread=pcs, side="put")
        call_leg = IronCondorLeg(spread=ccs, side="call")

        condor = IronCondor(
            put_leg=put_leg,
            call_leg=call_leg,
            underlying_price=100.0,
            days_to_expiration=30,
        )

        with performance_timer() as timer:
            # Generate many curves
            for _ in range(100):
                curve = payoff_roi_curve(
                    condor,
                    move_low_pct=-0.20,
                    move_high_pct=0.20,
                    step_pct=0.005,
                )

        timer.assert_under(1.0)
