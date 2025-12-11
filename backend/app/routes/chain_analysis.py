"""Options Chain Analysis API routes."""

import logging
import re
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel, Field, field_validator
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chain", tags=["chain"])

# Strict symbol pattern: only uppercase letters, 1-5 chars
SYMBOL_PATTERN = re.compile(r"^[A-Z]{1,5}$")

# Date format pattern
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")

# Maximum years for expiration dates
MAX_EXPIRY_YEARS = 5


def validate_ticker_symbol(v: str) -> str:
    """
    Validate and sanitize ticker symbol.
    Ensures the symbol is alphanumeric uppercase only (1-5 characters).
    """
    if not isinstance(v, str):
        raise ValueError("Symbol must be a string")
    v = v.strip().upper()
    if len(v) == 0 or len(v) > 5:
        raise ValueError("Symbol must be 1-5 characters")
    if not SYMBOL_PATTERN.match(v):
        raise ValueError("Symbol must contain only uppercase letters (A-Z)")
    return v


def validate_expiration_date(date_str: str) -> str:
    """
    Validate expiration date format and range.
    Returns the date string if valid, raises ValueError otherwise.
    """
    if not DATE_PATTERN.match(date_str):
        raise ValueError("Date must be in YYYY-MM-DD format")

    try:
        exp_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise ValueError("Invalid date format")

    today = datetime.now().date()
    max_date = today + timedelta(days=MAX_EXPIRY_YEARS * 365)

    if exp_date < today:
        raise ValueError("Expiration date must be today or in the future")
    if exp_date > max_date:
        raise ValueError(f"Expiration date must be within {MAX_EXPIRY_YEARS} years")

    return date_str


# =============================================================================
# Pydantic Models
# =============================================================================

class ExpirationDateResponse(BaseModel):
    """Response for available expiration dates."""
    symbol: str
    underlying_price: float
    expirations: List[str]
    timestamp: str


class OptionContract(BaseModel):
    """Single option contract data."""
    contract_symbol: str = Field(..., description="Option symbol (e.g., SPY280121C00555000)")
    option_type: str = Field(..., description="'call' or 'put'")
    strike: float = Field(..., description="Strike price")
    expiration: str = Field(..., description="Expiration date (YYYY-MM-DD)")
    last_price: float = Field(default=0.0, description="Last traded price")
    bid: float = Field(default=0.0, description="Bid price")
    ask: float = Field(default=0.0, description="Ask price")
    volume: int = Field(default=0, description="Trading volume")
    open_interest: int = Field(default=0, description="Open interest")
    implied_volatility: Optional[float] = Field(default=None, description="Implied volatility")
    delta: Optional[float] = Field(default=None, description="Delta")
    gamma: Optional[float] = Field(default=None, description="Gamma")
    theta: Optional[float] = Field(default=None, description="Theta")
    vega: Optional[float] = Field(default=None, description="Vega")
    rho: Optional[float] = Field(default=None, description="Rho")


class OptionsChainResponse(BaseModel):
    """Response for options chain data."""
    symbol: str
    underlying_price: float
    expiration: str
    dte: int
    calls: List[OptionContract]
    puts: List[OptionContract]
    total_calls: int
    total_puts: int
    timestamp: str


class ChainRequest(BaseModel):
    """Request model for fetching options chain."""
    symbol: str = Field(..., description="Ticker symbol (e.g., SPY, AAPL)")
    expiration: str = Field(..., description="Expiration date (YYYY-MM-DD)")

    @field_validator("symbol")
    @classmethod
    def validate_symbol(cls, v: str) -> str:
        return validate_ticker_symbol(v)

    @field_validator("expiration")
    @classmethod
    def validate_exp(cls, v: str) -> str:
        return validate_expiration_date(v)


# =============================================================================
# Data Fetching Functions - CBOE (Primary)
# =============================================================================

CBOE_API_URL = "https://cdn.cboe.com/api/global/delayed_quotes/options"
CBOE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
}


def _parse_cboe_option_symbol(option_symbol: str) -> dict:
    """
    Parse CBOE option symbol to extract components.
    Format: SPY251210C00500000
    - Symbol: SPY
    - Date: 251210 (YYMMDD)
    - Type: C (call) or P (put)
    - Strike: 00500000 (price * 1000)
    """
    import re
    match = re.match(r'^([A-Z]+)(\d{6})([CP])(\d{8})$', option_symbol)
    if not match:
        return {}

    symbol, date_str, opt_type, strike_str = match.groups()

    # Parse date (YYMMDD -> YYYY-MM-DD)
    year = 2000 + int(date_str[:2])
    month = int(date_str[2:4])
    day = int(date_str[4:6])
    expiration = f"{year}-{month:02d}-{day:02d}"

    # Parse strike (divide by 1000)
    strike = int(strike_str) / 1000.0

    return {
        "symbol": symbol,
        "expiration": expiration,
        "option_type": "call" if opt_type == "C" else "put",
        "strike": strike,
    }


def _fetch_cboe_data(symbol: str) -> dict:
    """
    Fetch all options data from CBOE for a symbol.
    Returns raw CBOE API response.
    """
    import requests

    url = f"{CBOE_API_URL}/{symbol}.json"

    try:
        response = requests.get(url, headers=CBOE_HEADERS, timeout=15)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        logger.error(f"CBOE API error for {symbol}: {e}")
        raise ValueError(f"Failed to fetch data from CBOE for {symbol}")


def _fetch_expirations_cboe(symbol: str) -> tuple[float, List[str]]:
    """
    Fetch available expiration dates from CBOE.
    Returns (underlying_price, list_of_expiration_dates).
    """
    try:
        data = _fetch_cboe_data(symbol)

        # Get underlying price
        underlying_price = float(data['data'].get('current_price', 0))
        if underlying_price <= 0:
            raise ValueError(f"No price data available for {symbol}")

        # Extract unique expiration dates from all options
        expirations = set()
        for opt in data['data'].get('options', []):
            parsed = _parse_cboe_option_symbol(opt.get('option', ''))
            if parsed.get('expiration'):
                expirations.add(parsed['expiration'])

        if not expirations:
            raise ValueError(f"No options available for {symbol}")

        return underlying_price, sorted(list(expirations))

    except Exception as e:
        logger.error(f"CBOE expirations error for {symbol}: {e}")
        raise


def _fetch_options_chain_cboe(symbol: str, expiration: str) -> tuple[float, List[dict], List[dict]]:
    """
    Fetch options chain data from CBOE for a specific expiration.
    Returns (underlying_price, calls_list, puts_list).
    """
    try:
        data = _fetch_cboe_data(symbol)

        # Get underlying price
        underlying_price = float(data['data'].get('current_price', 0))
        if underlying_price <= 0:
            raise ValueError(f"No price data available for {symbol}")

        calls = []
        puts = []

        for opt in data['data'].get('options', []):
            parsed = _parse_cboe_option_symbol(opt.get('option', ''))

            # Skip if not matching expiration
            if parsed.get('expiration') != expiration:
                continue

            option_data = {
                "contract_symbol": opt.get('option', ''),
                "option_type": parsed.get('option_type', 'call'),
                "strike": parsed.get('strike', 0),
                "expiration": expiration,
                "last_price": float(opt.get('last_trade_price', 0) or 0),
                "bid": float(opt.get('bid', 0) or 0),
                "ask": float(opt.get('ask', 0) or 0),
                "volume": int(opt.get('volume', 0) or 0),
                "open_interest": int(opt.get('open_interest', 0) or 0),
                "implied_volatility": float(opt.get('iv', 0) or 0),
                # CBOE provides Greeks directly!
                "delta": float(opt.get('delta', 0) or 0) if opt.get('delta') is not None else None,
                "gamma": float(opt.get('gamma', 0) or 0) if opt.get('gamma') is not None else None,
                "theta": float(opt.get('theta', 0) or 0) if opt.get('theta') is not None else None,
                "vega": float(opt.get('vega', 0) or 0) if opt.get('vega') is not None else None,
                "rho": float(opt.get('rho', 0) or 0) if opt.get('rho') is not None else None,
            }

            if parsed.get('option_type') == 'call':
                calls.append(option_data)
            else:
                puts.append(option_data)

        if not calls and not puts:
            raise ValueError(f"No options found for {symbol} {expiration}")

        return underlying_price, calls, puts

    except Exception as e:
        logger.error(f"CBOE chain error for {symbol} {expiration}: {e}")
        raise


# =============================================================================
# Data Fetching Functions - yfinance (Fallback)
# =============================================================================

def _fetch_expirations_yfinance(symbol: str) -> tuple[float, List[str]]:
    """
    Fetch available expiration dates from yfinance.
    Returns (underlying_price, list_of_expiration_dates).
    """
    import yfinance as yf

    try:
        ticker = yf.Ticker(symbol)

        # Get underlying price
        history = ticker.history(period="1d")
        if history.empty:
            raise ValueError(f"No price data available for {symbol}")
        underlying_price = float(history['Close'].iloc[-1])

        # Get expiration dates
        expirations = ticker.options
        if not expirations:
            raise ValueError(f"No options available for {symbol}")

        # Convert to list of strings (YYYY-MM-DD format)
        exp_list = list(expirations)

        return underlying_price, exp_list

    except Exception as e:
        logger.error(f"yfinance error for {symbol}: {e}")
        raise


def _filter_valid_expirations(expirations: List[str]) -> List[str]:
    """
    Filter expiration dates to only include valid ones:
    - Today or future dates
    - Within MAX_EXPIRY_YEARS years
    - Sorted ascending
    """
    today = datetime.now().date()
    max_date = today + timedelta(days=MAX_EXPIRY_YEARS * 365)

    valid_exps = []
    for exp_str in expirations:
        try:
            exp_date = datetime.strptime(exp_str, "%Y-%m-%d").date()
            if today <= exp_date <= max_date:
                valid_exps.append(exp_str)
        except ValueError:
            # Skip invalid date formats
            continue

    # Sort ascending
    valid_exps.sort()
    return valid_exps


def _fetch_options_chain_yfinance(symbol: str, expiration: str) -> tuple[float, List[dict], List[dict]]:
    """
    Fetch options chain data from yfinance for a specific expiration.
    Returns (underlying_price, calls_list, puts_list).
    """
    import yfinance as yf
    import numpy as np

    try:
        ticker = yf.Ticker(symbol)

        # Get underlying price
        history = ticker.history(period="1d")
        if history.empty:
            raise ValueError(f"No price data available for {symbol}")
        underlying_price = float(history['Close'].iloc[-1])

        # Get options chain for the expiration
        chain = ticker.option_chain(expiration)

        calls_df = chain.calls
        puts_df = chain.puts

        def process_options(df, option_type: str) -> List[dict]:
            """Process options dataframe to list of dicts."""
            options = []
            for _, row in df.iterrows():
                # Safely get values with defaults
                def safe_float(val, default=0.0):
                    if val is None or (isinstance(val, float) and np.isnan(val)):
                        return default
                    try:
                        return float(val)
                    except (TypeError, ValueError):
                        return default

                def safe_int(val, default=0):
                    if val is None or (isinstance(val, float) and np.isnan(val)):
                        return default
                    try:
                        return int(val)
                    except (TypeError, ValueError):
                        return default

                option = {
                    "contract_symbol": str(row.get("contractSymbol", "")),
                    "option_type": option_type,
                    "strike": safe_float(row.get("strike")),
                    "expiration": expiration,
                    "last_price": safe_float(row.get("lastPrice")),
                    "bid": safe_float(row.get("bid")),
                    "ask": safe_float(row.get("ask")),
                    "volume": safe_int(row.get("volume")),
                    "open_interest": safe_int(row.get("openInterest")),
                    "implied_volatility": safe_float(row.get("impliedVolatility")) if row.get("impliedVolatility") is not None else None,
                }

                # Add Greeks if available (yfinance may not always have these)
                # Greeks would need to be calculated or fetched from another source
                # For now, we'll leave them as None unless yfinance provides them

                options.append(option)

            return options

        calls = process_options(calls_df, "call")
        puts = process_options(puts_df, "put")

        return underlying_price, calls, puts

    except Exception as e:
        logger.error(f"yfinance chain error for {symbol} {expiration}: {e}")
        raise


def _calculate_greeks(
    option_type: str,
    strike: float,
    underlying_price: float,
    dte: int,
    iv: float,
    risk_free_rate: float = 0.05,
    dividend_yield: float = 0.013
) -> dict:
    """
    Calculate option Greeks using Black-Scholes formula.
    Returns dict with delta, gamma, theta, vega, rho.
    """
    import numpy as np
    from scipy.stats import norm

    if dte <= 0 or iv <= 0 or underlying_price <= 0 or strike <= 0:
        return {"delta": None, "gamma": None, "theta": None, "vega": None, "rho": None}

    S = underlying_price
    K = strike
    r = risk_free_rate
    q = dividend_yield
    sigma = iv if iv < 1 else iv / 100  # Handle both decimal and percentage
    T = dte / 365.0
    sqrt_T = np.sqrt(T)

    # d1 and d2
    d1 = (np.log(S / K) + (r - q + 0.5 * sigma ** 2) * T) / (sigma * sqrt_T)
    d2 = d1 - sigma * sqrt_T

    # Standard normal PDF
    n_d1 = norm.pdf(d1)

    # Calculate Greeks
    if option_type == "call":
        delta = np.exp(-q * T) * norm.cdf(d1)
        rho = K * T * np.exp(-r * T) * norm.cdf(d2) / 100
    else:  # put
        delta = np.exp(-q * T) * (norm.cdf(d1) - 1)
        rho = -K * T * np.exp(-r * T) * norm.cdf(-d2) / 100

    # Gamma (same for calls and puts)
    gamma = np.exp(-q * T) * n_d1 / (S * sigma * sqrt_T)

    # Vega (same for calls and puts)
    vega = S * np.exp(-q * T) * n_d1 * sqrt_T / 100

    # Theta
    common_term = -S * np.exp(-q * T) * n_d1 * sigma / (2 * sqrt_T)
    if option_type == "call":
        theta = (common_term - r * K * np.exp(-r * T) * norm.cdf(d2) +
                 q * S * np.exp(-q * T) * norm.cdf(d1)) / 365
    else:
        theta = (common_term + r * K * np.exp(-r * T) * norm.cdf(-d2) -
                 q * S * np.exp(-q * T) * norm.cdf(-d1)) / 365

    return {
        "delta": round(delta, 4) if not np.isnan(delta) else None,
        "gamma": round(gamma, 4) if not np.isnan(gamma) else None,
        "theta": round(theta, 4) if not np.isnan(theta) else None,
        "vega": round(vega, 4) if not np.isnan(vega) else None,
        "rho": round(rho, 4) if not np.isnan(rho) else None,
    }


# =============================================================================
# API Endpoints
# =============================================================================

@router.get("/expirations/{symbol}", response_model=ExpirationDateResponse)
@limiter.limit("30/minute")
async def get_expirations(request: Request, symbol: str):
    """
    Get available expiration dates for a ticker.
    Uses CBOE as primary data source with yfinance as fallback.

    Args:
        symbol: Stock ticker (1-5 uppercase letters)

    Returns:
        List of valid expiration dates (YYYY-MM-DD format)
    """
    # Validate symbol
    try:
        symbol = validate_ticker_symbol(symbol)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Try CBOE first (better data quality)
    try:
        logger.info(f"Fetching expirations from CBOE for {symbol}")
        underlying_price, expirations = _fetch_expirations_cboe(symbol)
        valid_expirations = _filter_valid_expirations(expirations)

        if valid_expirations:
            return ExpirationDateResponse(
                symbol=symbol,
                underlying_price=underlying_price,
                expirations=valid_expirations,
                timestamp=datetime.now().isoformat()
            )
    except Exception as cboe_error:
        logger.warning(f"CBOE failed for {symbol}, trying yfinance: {cboe_error}")

    # Fallback to yfinance
    try:
        logger.info(f"Fetching expirations from yfinance for {symbol}")
        underlying_price, expirations = _fetch_expirations_yfinance(symbol)
        valid_expirations = _filter_valid_expirations(expirations)

        if not valid_expirations:
            raise HTTPException(
                status_code=404,
                detail=f"No valid expiry dates available for {symbol}"
            )

        return ExpirationDateResponse(
            symbol=symbol,
            underlying_price=underlying_price,
            expirations=valid_expirations,
            timestamp=datetime.now().isoformat()
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching expirations for {symbol}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch expiration dates for {symbol}"
        )


@router.get("/options/{symbol}/{expiration}", response_model=OptionsChainResponse)
@limiter.limit("20/minute")
async def get_options_chain(
    request: Request,
    symbol: str,
    expiration: str,
    include_greeks: bool = Query(default=True, description="Calculate and include Greeks")
):
    """
    Get options chain data for a specific ticker and expiration.

    Args:
        symbol: Stock ticker (1-5 uppercase letters)
        expiration: Expiration date (YYYY-MM-DD format)
        include_greeks: Whether to calculate and include Greeks (default: True)

    Returns:
        Options chain with calls and puts, sorted by strike price
    """
    # Validate inputs
    try:
        symbol = validate_ticker_symbol(symbol)
        expiration = validate_expiration_date(expiration)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Calculate DTE
    exp_date = datetime.strptime(expiration, "%Y-%m-%d").date()
    today = datetime.now().date()
    dte = (exp_date - today).days

    underlying_price = None
    calls = None
    puts = None
    data_source = None

    # Try CBOE first (better data quality, includes Greeks)
    try:
        logger.info(f"Fetching options chain from CBOE for {symbol} {expiration}")
        underlying_price, calls, puts = _fetch_options_chain_cboe(symbol, expiration)
        data_source = "cboe"
        logger.info(f"CBOE returned {len(calls)} calls and {len(puts)} puts")
    except Exception as cboe_error:
        logger.warning(f"CBOE failed for {symbol} {expiration}, trying yfinance: {cboe_error}")

    # Fallback to yfinance if CBOE failed
    if calls is None or puts is None:
        try:
            logger.info(f"Fetching options chain from yfinance for {symbol} {expiration}")
            underlying_price, calls, puts = _fetch_options_chain_yfinance(symbol, expiration)
            data_source = "yfinance"

            # Add Greeks if requested (yfinance doesn't include them, CBOE does)
            if include_greeks:
                for option in calls:
                    if option.get("implied_volatility"):
                        greeks = _calculate_greeks(
                            "call", option["strike"], underlying_price,
                            dte, option["implied_volatility"]
                        )
                        option.update(greeks)

                for option in puts:
                    if option.get("implied_volatility"):
                        greeks = _calculate_greeks(
                            "put", option["strike"], underlying_price,
                            dte, option["implied_volatility"]
                        )
                        option.update(greeks)

        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except Exception as e:
            logger.error(f"Error fetching chain for {symbol} {expiration}: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to fetch options chain for {symbol} {expiration}"
            )

    # Sort by strike price
    calls.sort(key=lambda x: x["strike"])
    puts.sort(key=lambda x: x["strike"])

    # Convert to Pydantic models
    call_contracts = [OptionContract(**c) for c in calls]
    put_contracts = [OptionContract(**p) for p in puts]

    logger.info(f"Returning {len(call_contracts)} calls and {len(put_contracts)} puts from {data_source}")

    return OptionsChainResponse(
        symbol=symbol,
        underlying_price=underlying_price,
        expiration=expiration,
        dte=dte,
        calls=call_contracts,
        puts=put_contracts,
        total_calls=len(call_contracts),
        total_puts=len(put_contracts),
        timestamp=datetime.now().isoformat()
    )


@router.get("/quote/{symbol}")
@limiter.limit("60/minute")
async def get_quote(request: Request, symbol: str):
    """
    Get current quote for a ticker.

    Args:
        symbol: Stock ticker (1-5 uppercase letters)

    Returns:
        Current price and basic info
    """
    try:
        symbol = validate_ticker_symbol(symbol)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        import yfinance as yf

        ticker = yf.Ticker(symbol)
        history = ticker.history(period="1d")

        if history.empty:
            raise HTTPException(status_code=404, detail=f"No data for {symbol}")

        info = ticker.info

        return {
            "symbol": symbol,
            "price": float(history['Close'].iloc[-1]),
            "name": info.get("shortName", symbol),
            "change": float(history['Close'].iloc[-1] - history['Open'].iloc[-1]),
            "change_pct": float((history['Close'].iloc[-1] - history['Open'].iloc[-1]) / history['Open'].iloc[-1] * 100),
            "timestamp": datetime.now().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching quote for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch quote for {symbol}")
