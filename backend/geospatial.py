"""Geospatial enrichment module using Overpass API.

Queries OpenStreetMap data to calculate real isolation scores
based on nearby amenities (hospitals, gas stations, restaurants).
"""
import asyncio
import logging
import time
from typing import Optional
import httpx

logger = logging.getLogger(__name__)

# Overpass API endpoint
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Cache for isolation scores (coordinate -> (score, timestamp))
# Prevents overwhelming Overpass API with repeated queries
_isolation_cache: dict[tuple[float, float], tuple[float, float]] = {}
CACHE_TTL_SECONDS = 3600  # 1 hour cache

# Rate limiting
_last_request_time = 0
MIN_REQUEST_INTERVAL = 1.0  # 1 second between requests


def _round_coords(lat: float, lng: float, precision: int = 3) -> tuple[float, float]:
    """Round coordinates for cache key (reduces precision for better cache hit rate).
    
    With precision=3, we get ~111m resolution which is good enough for isolation.
    """
    return (round(lat, precision), round(lng, precision))


def _get_cached_score(lat: float, lng: float) -> Optional[float]:
    """Get cached isolation score if available and not expired."""
    key = _round_coords(lat, lng)
    if key in _isolation_cache:
        score, timestamp = _isolation_cache[key]
        if time.time() - timestamp < CACHE_TTL_SECONDS:
            return score
    return None


def _cache_score(lat: float, lng: float, score: float) -> None:
    """Cache an isolation score."""
    key = _round_coords(lat, lng)
    _isolation_cache[key] = (score, time.time())


def _build_overpass_query(lat: float, lng: float, radius_meters: int = 5000) -> str:
    """Build Overpass QL query to count amenities near coordinates.
    
    Counts:
    - Hospitals
    - Fuel stations (gas stations)
    - Restaurants
    - Cafes
    - Police stations
    - Fire stations
    """
    return f"""
[out:json][timeout:10];
(
  node["amenity"="hospital"](around:{radius_meters},{lat},{lng});
  node["amenity"="fuel"](around:{radius_meters},{lat},{lng});
  node["amenity"="restaurant"](around:{radius_meters},{lat},{lng});
  node["amenity"="cafe"](around:{radius_meters},{lat},{lng});
  node["amenity"="police"](around:{radius_meters},{lat},{lng});
  node["amenity"="fire_station"](around:{radius_meters},{lat},{lng});
  way["amenity"="hospital"](around:{radius_meters},{lat},{lng});
  way["amenity"="fuel"](around:{radius_meters},{lat},{lng});
);
out count;
"""


async def _rate_limited_request(query: str) -> Optional[dict]:
    """Make rate-limited request to Overpass API."""
    global _last_request_time
    
    # Rate limiting
    elapsed = time.time() - _last_request_time
    if elapsed < MIN_REQUEST_INTERVAL:
        await asyncio.sleep(MIN_REQUEST_INTERVAL - elapsed)
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                OVERPASS_URL,
                data={"data": query},
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            _last_request_time = time.time()
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.warning(f"Overpass API returned {response.status_code}")
                return None
    except Exception as e:
        logger.error(f"Overpass API error: {e}")
        return None


def _count_from_response(data: dict) -> int:
    """Extract count from Overpass response."""
    if not data:
        return 0
    
    # For "out count" queries, the count is in elements
    elements = data.get("elements", [])
    if elements and "tags" in elements[0]:
        # Count response format
        return int(elements[0]["tags"].get("total", 0))
    
    # Fallback: count elements directly
    return len(elements)


def _score_from_amenity_count(count: int) -> float:
    """Convert amenity count to isolation score (0-100).
    
    More amenities = less isolated = lower score.
    """
    if count == 0:
        return 100.0  # Completely isolated
    elif count <= 2:
        return 85.0   # Very isolated (1-2 amenities in 5km)
    elif count <= 5:
        return 70.0   # Quite isolated
    elif count <= 10:
        return 50.0   # Moderate
    elif count <= 20:
        return 35.0   # Some services nearby
    elif count <= 50:
        return 20.0   # Urban area
    else:
        return 10.0   # Dense urban area


async def calculate_real_isolation_score(lat: float, lng: float) -> float:
    """Calculate real isolation score using Overpass API.
    
    Args:
        lat: Latitude
        lng: Longitude
        
    Returns:
        Isolation score 0-100 (100 = most isolated)
    """
    # Check cache first
    cached = _get_cached_score(lat, lng)
    if cached is not None:
        logger.debug(f"Cache hit for ({lat}, {lng}): {cached}")
        return cached
    
    # Build and execute query
    query = _build_overpass_query(lat, lng, radius_meters=5000)
    result = await _rate_limited_request(query)
    
    if result is None:
        # Fallback to default moderate isolation on API error
        logger.warning(f"Overpass query failed for ({lat}, {lng}), using fallback")
        return 50.0
    
    count = _count_from_response(result)
    score = _score_from_amenity_count(count)
    
    # Cache the result
    _cache_score(lat, lng, score)
    
    logger.info(f"Isolation score for ({lat:.3f}, {lng:.3f}): {score} (amenities: {count})")
    return score


def calculate_isolation_score_sync(lat: float, lng: float) -> float:
    """Synchronous wrapper for isolation score calculation.
    
    Uses cached value if available, otherwise returns default.
    For async contexts, use calculate_real_isolation_score instead.
    """
    cached = _get_cached_score(lat, lng)
    if cached is not None:
        return cached
    
    # Return default for sync context (will be updated async later)
    return 50.0


async def prefetch_isolation_scores(coordinates: list[tuple[float, float]]) -> None:
    """Pre-fetch isolation scores for multiple coordinates.
    
    Useful for batch processing beacons.
    """
    for lat, lng in coordinates:
        # Skip if already cached
        if _get_cached_score(lat, lng) is not None:
            continue
        
        await calculate_real_isolation_score(lat, lng)
        # Small delay to be nice to the API
        await asyncio.sleep(0.5)
