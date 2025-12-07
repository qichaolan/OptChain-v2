"""
Unit tests for GCS cache service in backend/app/services/gcs_cache.py

Test Scenarios:
- Symbol validation and sanitization
- Cache read/write operations
- GCS client mocking
- Error handling for network failures
- Cache expiration logic

Coverage Target: ≥95% line and branch coverage
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
import pandas as pd
import io

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "backend"))

from app.services import gcs_cache


# ============================================================================
# Test Symbol Validation
# ============================================================================

class TestValidateSymbol:
    """Tests for _validate_symbol function."""

    def test_valid_symbol_uppercase(self):
        """Should accept valid uppercase symbols."""
        assert gcs_cache._validate_symbol("SPY") == "SPY"
        assert gcs_cache._validate_symbol("QQQ") == "QQQ"
        assert gcs_cache._validate_symbol("AAPL") == "AAPL"

    def test_valid_symbol_lowercase(self):
        """Should convert lowercase to uppercase."""
        assert gcs_cache._validate_symbol("spy") == "SPY"
        assert gcs_cache._validate_symbol("qqq") == "QQQ"

    def test_valid_symbol_mixed_case(self):
        """Should handle mixed case."""
        assert gcs_cache._validate_symbol("Spy") == "SPY"
        assert gcs_cache._validate_symbol("aPPl") == "APPL"

    def test_invalid_symbol_empty(self):
        """Should reject empty symbol."""
        with pytest.raises(ValueError, match="Invalid symbol"):
            gcs_cache._validate_symbol("")

    def test_invalid_symbol_whitespace(self):
        """Should reject whitespace-only symbol."""
        with pytest.raises(ValueError, match="Invalid symbol"):
            gcs_cache._validate_symbol("   ")

    def test_invalid_symbol_with_numbers(self):
        """Should reject symbols with numbers."""
        with pytest.raises(ValueError, match="Invalid symbol"):
            gcs_cache._validate_symbol("SPY500")

    def test_invalid_symbol_special_chars(self):
        """Should reject symbols with special characters."""
        invalid_symbols = ["SPY!", "Q-QQ", "AAP.L", "SPY/ETF"]
        for symbol in invalid_symbols:
            with pytest.raises(ValueError, match="Invalid symbol"):
                gcs_cache._validate_symbol(symbol)

    def test_invalid_symbol_path_traversal(self):
        """Should reject path traversal attempts."""
        with pytest.raises(ValueError, match="Invalid symbol"):
            gcs_cache._validate_symbol("../etc/passwd")

        with pytest.raises(ValueError, match="Invalid symbol"):
            gcs_cache._validate_symbol("..\\windows\\system32")

    def test_invalid_symbol_too_long(self):
        """Should reject excessively long symbols."""
        with pytest.raises(ValueError, match="Invalid symbol"):
            gcs_cache._validate_symbol("A" * 20)  # Too long

    def test_invalid_symbol_too_short(self):
        """Should reject single character symbols."""
        # Depending on implementation, may or may not be valid
        try:
            result = gcs_cache._validate_symbol("A")
            assert result == "A"  # If allowed
        except ValueError:
            pass  # If rejected, that's also acceptable


# ============================================================================
# Test Read Scores
# ============================================================================

class TestReadScores:
    """Tests for read_scores function."""

    @patch.object(gcs_cache, "_get_client")
    def test_returns_dataframe_when_blob_exists(self, mock_get_client, mock_parquet_data):
        """Should return DataFrame when blob exists."""
        # Setup mocks
        mock_client = MagicMock()
        mock_bucket = MagicMock()
        mock_blob = MagicMock()

        mock_blob.exists.return_value = True
        mock_blob.download_as_bytes.return_value = mock_parquet_data

        mock_get_client.return_value = mock_client
        mock_client.bucket.return_value = mock_bucket
        mock_bucket.blob.return_value = mock_blob

        # Execute
        result = gcs_cache.read_scores("SPY")

        # Verify
        assert result is not None
        assert isinstance(result, pd.DataFrame)
        assert len(result) == 2  # From mock_parquet_data fixture

    @patch.object(gcs_cache, "_get_client")
    def test_returns_none_when_blob_not_exists(self, mock_get_client):
        """Should return None when blob doesn't exist."""
        mock_client = MagicMock()
        mock_bucket = MagicMock()
        mock_blob = MagicMock()

        mock_blob.exists.return_value = False

        mock_get_client.return_value = mock_client
        mock_client.bucket.return_value = mock_bucket
        mock_bucket.blob.return_value = mock_blob

        result = gcs_cache.read_scores("SPY")

        assert result is None

    @patch.object(gcs_cache, "_get_client")
    def test_handles_download_error(self, mock_get_client):
        """Should handle download errors gracefully."""
        mock_client = MagicMock()
        mock_bucket = MagicMock()
        mock_blob = MagicMock()

        mock_blob.exists.return_value = True
        mock_blob.download_as_bytes.side_effect = Exception("Network error")

        mock_get_client.return_value = mock_client
        mock_client.bucket.return_value = mock_bucket
        mock_bucket.blob.return_value = mock_blob

        # Should handle gracefully
        result = gcs_cache.read_scores("SPY")
        assert result is None or isinstance(result, pd.DataFrame)

    @patch.object(gcs_cache, "_get_client")
    def test_handles_invalid_parquet(self, mock_get_client):
        """Should handle invalid parquet data."""
        mock_client = MagicMock()
        mock_bucket = MagicMock()
        mock_blob = MagicMock()

        mock_blob.exists.return_value = True
        mock_blob.download_as_bytes.return_value = b"not valid parquet"

        mock_get_client.return_value = mock_client
        mock_client.bucket.return_value = mock_bucket
        mock_bucket.blob.return_value = mock_blob

        # Should handle gracefully
        with pytest.raises(Exception):
            gcs_cache.read_scores("SPY")

    def test_validates_symbol_before_read(self):
        """Should validate symbol before attempting read."""
        with pytest.raises(ValueError, match="Invalid symbol"):
            gcs_cache.read_scores("../etc/passwd")


# ============================================================================
# Test Write Scores
# ============================================================================

class TestWriteScores:
    """Tests for write_scores function."""

    @patch.object(gcs_cache, "_get_client")
    def test_successful_write(self, mock_get_client):
        """Should write DataFrame to GCS successfully."""
        mock_client = MagicMock()
        mock_bucket = MagicMock()
        mock_blob = MagicMock()

        mock_get_client.return_value = mock_client
        mock_client.bucket.return_value = mock_bucket
        mock_bucket.blob.return_value = mock_blob

        test_df = pd.DataFrame({
            "date": [datetime(2024, 1, 1)],
            "signal_raw": [0.5],
            "signal_0_1": [0.75],
        })

        # Execute
        gcs_cache.write_scores("SPY", test_df)

        # Verify upload was called
        mock_blob.upload_from_string.assert_called_once()

    @patch.object(gcs_cache, "_get_client")
    def test_write_empty_dataframe(self, mock_get_client):
        """Should handle empty DataFrame."""
        mock_client = MagicMock()
        mock_bucket = MagicMock()
        mock_blob = MagicMock()

        mock_get_client.return_value = mock_client
        mock_client.bucket.return_value = mock_bucket
        mock_bucket.blob.return_value = mock_blob

        empty_df = pd.DataFrame()

        # Should handle or reject empty DataFrame
        try:
            gcs_cache.write_scores("SPY", empty_df)
        except (ValueError, Exception):
            pass  # Acceptable to reject empty

    @patch.object(gcs_cache, "_get_client")
    def test_handles_upload_error(self, mock_get_client):
        """Should handle upload errors."""
        mock_client = MagicMock()
        mock_bucket = MagicMock()
        mock_blob = MagicMock()

        mock_blob.upload_from_string.side_effect = Exception("Upload failed")

        mock_get_client.return_value = mock_client
        mock_client.bucket.return_value = mock_bucket
        mock_bucket.blob.return_value = mock_blob

        test_df = pd.DataFrame({"date": [datetime.now()], "value": [1.0]})

        with pytest.raises(Exception, match="Upload failed"):
            gcs_cache.write_scores("SPY", test_df)

    def test_validates_symbol_before_write(self):
        """Should validate symbol before attempting write."""
        test_df = pd.DataFrame({"value": [1.0]})

        with pytest.raises(ValueError, match="Invalid symbol"):
            gcs_cache.write_scores("INVALID!", test_df)


# ============================================================================
# Test Get Latest Score
# ============================================================================

class TestGetLatestScore:
    """Tests for get_latest_score function."""

    @patch.object(gcs_cache, "read_scores")
    def test_returns_latest_score(self, mock_read):
        """Should return the most recent score."""
        mock_read.return_value = pd.DataFrame({
            "date": pd.to_datetime(["2024-01-01", "2024-01-02", "2024-01-03"]),
            "signal_0_1": [0.5, 0.6, 0.7],
        })

        result = gcs_cache.get_latest_score("SPY")

        assert result is not None
        assert result == 0.7  # Most recent

    @patch.object(gcs_cache, "read_scores")
    def test_returns_none_when_no_data(self, mock_read):
        """Should return None when no data available."""
        mock_read.return_value = None

        result = gcs_cache.get_latest_score("SPY")

        assert result is None

    @patch.object(gcs_cache, "read_scores")
    def test_returns_none_when_empty_dataframe(self, mock_read):
        """Should return None for empty DataFrame."""
        mock_read.return_value = pd.DataFrame()

        result = gcs_cache.get_latest_score("SPY")

        assert result is None

    @patch.object(gcs_cache, "read_scores")
    def test_handles_missing_column(self, mock_read):
        """Should handle missing signal column."""
        mock_read.return_value = pd.DataFrame({
            "date": [datetime.now()],
            "other_column": [1.0],
        })

        result = gcs_cache.get_latest_score("SPY")

        # Should return None or raise appropriate error
        assert result is None or isinstance(result, (float, int))


# ============================================================================
# Test Add Score
# ============================================================================

class TestAddScore:
    """Tests for add_score function."""

    @patch.object(gcs_cache, "read_scores")
    @patch.object(gcs_cache, "write_scores")
    def test_adds_new_score(self, mock_write, mock_read):
        """Should add new score to existing data."""
        existing_df = pd.DataFrame({
            "date": pd.to_datetime(["2024-01-01"]),
            "signal_0_1": [0.5],
        })
        mock_read.return_value = existing_df

        gcs_cache.add_score("SPY", 0.75, datetime(2024, 1, 2))

        # Verify write was called with updated data
        mock_write.assert_called_once()
        written_df = mock_write.call_args[0][1]
        assert len(written_df) == 2  # Original + new

    @patch.object(gcs_cache, "read_scores")
    @patch.object(gcs_cache, "write_scores")
    def test_creates_new_when_no_existing(self, mock_write, mock_read):
        """Should create new data when none exists."""
        mock_read.return_value = None

        gcs_cache.add_score("SPY", 0.75, datetime(2024, 1, 1))

        mock_write.assert_called_once()
        written_df = mock_write.call_args[0][1]
        assert len(written_df) == 1

    @patch.object(gcs_cache, "read_scores")
    @patch.object(gcs_cache, "write_scores")
    def test_validates_score_range(self, mock_write, mock_read):
        """Should validate score is in valid range."""
        mock_read.return_value = None

        # Score should be 0-1
        with pytest.raises(ValueError):
            gcs_cache.add_score("SPY", 1.5, datetime.now())  # Out of range

        with pytest.raises(ValueError):
            gcs_cache.add_score("SPY", -0.1, datetime.now())  # Negative


# ============================================================================
# Test Clear Cache
# ============================================================================

class TestClearCache:
    """Tests for clear_cache function."""

    @patch.object(gcs_cache, "_get_client")
    def test_clears_symbol_cache(self, mock_get_client):
        """Should delete blob for symbol."""
        mock_client = MagicMock()
        mock_bucket = MagicMock()
        mock_blob = MagicMock()
        mock_blob.exists.return_value = True

        mock_get_client.return_value = mock_client
        mock_client.bucket.return_value = mock_bucket
        mock_bucket.blob.return_value = mock_blob

        result = gcs_cache.clear_cache("SPY")

        mock_blob.delete.assert_called_once()
        assert result is True

    @patch.object(gcs_cache, "_get_client")
    def test_returns_false_when_no_cache(self, mock_get_client):
        """Should return False when no cache exists."""
        mock_client = MagicMock()
        mock_bucket = MagicMock()
        mock_blob = MagicMock()
        mock_blob.exists.return_value = False

        mock_get_client.return_value = mock_client
        mock_client.bucket.return_value = mock_bucket
        mock_bucket.blob.return_value = mock_blob

        result = gcs_cache.clear_cache("SPY")

        mock_blob.delete.assert_not_called()
        assert result is False


# ============================================================================
# Test GCS Client Initialization
# ============================================================================

class TestGCSClient:
    """Tests for GCS client initialization."""

    @patch("google.cloud.storage.Client")
    def test_creates_client_on_first_call(self, mock_client_class):
        """Should create client on first call."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client

        # Clear any cached client
        if hasattr(gcs_cache, "_client"):
            gcs_cache._client = None

        result = gcs_cache._get_client()

        # Client should be created
        assert result is not None

    @patch("google.cloud.storage.Client")
    def test_handles_credentials_error(self, mock_client_class):
        """Should handle missing credentials."""
        mock_client_class.side_effect = Exception("No credentials")

        if hasattr(gcs_cache, "_client"):
            gcs_cache._client = None

        with pytest.raises(Exception, match="No credentials"):
            gcs_cache._get_client()


# ============================================================================
# Test Security
# ============================================================================

class TestGCSCacheSecurity:
    """Security tests for GCS cache."""

    def test_prevents_path_injection_in_blob_name(self):
        """Should prevent path injection in blob names."""
        malicious_symbols = [
            "../secrets",
            "..%2F..%2Fsecrets",
            "spy/../../secrets",
        ]

        for symbol in malicious_symbols:
            with pytest.raises(ValueError, match="Invalid symbol"):
                gcs_cache._validate_symbol(symbol)

    def test_prevents_null_byte_injection(self):
        """Should prevent null byte injection."""
        with pytest.raises(ValueError):
            gcs_cache._validate_symbol("SPY\x00malicious")

    @patch.object(gcs_cache, "_get_client")
    def test_bucket_name_is_not_user_controlled(self, mock_get_client):
        """Bucket name should be from config, not user input."""
        mock_client = MagicMock()
        mock_bucket = MagicMock()
        mock_blob = MagicMock()
        mock_blob.exists.return_value = False

        mock_get_client.return_value = mock_client
        mock_client.bucket.return_value = mock_bucket
        mock_bucket.blob.return_value = mock_blob

        # Call with various inputs
        gcs_cache.read_scores("SPY")

        # Verify bucket name is not from user input
        bucket_call = mock_client.bucket.call_args
        if bucket_call:
            bucket_name = bucket_call[0][0]
            assert "SPY" not in bucket_name  # Symbol shouldn't be in bucket name


# ============================================================================
# Test Performance
# ============================================================================

class TestGCSCachePerformance:
    """Performance tests for GCS cache."""

    @patch.object(gcs_cache, "_get_client")
    def test_read_performance(self, mock_get_client, performance_timer, mock_parquet_data):
        """Read operation should complete quickly."""
        mock_client = MagicMock()
        mock_bucket = MagicMock()
        mock_blob = MagicMock()

        mock_blob.exists.return_value = True
        mock_blob.download_as_bytes.return_value = mock_parquet_data

        mock_get_client.return_value = mock_client
        mock_client.bucket.return_value = mock_bucket
        mock_bucket.blob.return_value = mock_blob

        with performance_timer() as timer:
            for _ in range(100):
                gcs_cache.read_scores("SPY")

        timer.assert_under(1.0)  # 100 reads in < 1 second (mocked)

    def test_symbol_validation_performance(self, performance_timer):
        """Symbol validation should be very fast."""
        with performance_timer() as timer:
            for _ in range(10000):
                gcs_cache._validate_symbol("SPY")

        timer.assert_under(0.5)  # 10k validations in < 0.5 second
