"""DGT V16 Live Map - FastAPI Backend.

Real-time traffic incident visualization from DGT España.
"""
import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlmodel import Session, SQLModel, create_engine, select, text
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from config import get_settings
from models import Beacon, SyncLog
from worker import run_sync_task


def is_v16_beacon(beacon: Beacon) -> bool:
    """Check if a beacon is a V16 (vehicleStuck or vehicleObstruction).

    This function provides consistent V16 detection across all endpoints.
    A V16 beacon is one where:
    - detailed_cause_type == 'vehicleStuck', OR
    - incident_type (case-insensitive) == 'vehicleobstruction'

    Args:
        beacon: Beacon model instance

    Returns:
        True if the beacon is a V16, False otherwise
    """
    if beacon.detailed_cause_type == 'vehicleStuck':
        return True
    if beacon.incident_type and beacon.incident_type.lower() == 'vehicleobstruction':
        return True
    return False

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

settings = get_settings()

# Database engine
engine = create_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,
)

# APScheduler instance
scheduler = AsyncIOScheduler()


def init_db():
    """Initialize database tables. PostGIS is optional."""
    # Create tables
    SQLModel.metadata.create_all(engine)
    
    # Try to add PostGIS extension (optional - not available on Railway)
    with Session(engine) as session:
        try:
            # Enable PostGIS
            session.exec(text("CREATE EXTENSION IF NOT EXISTS postgis"))
            session.commit()
            
            # Check if geom column exists
            result = session.exec(text("""
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'beacons' AND column_name = 'geom'
            """))
            if not result.first():
                # Add geometry column
                session.exec(text("""
                    ALTER TABLE beacons 
                    ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326)
                """))
                session.commit()
                logger.info("Added geom column to beacons table")
            
            # Create spatial index
            session.exec(text("""
                CREATE INDEX IF NOT EXISTS idx_beacons_geom 
                ON beacons USING GIST (geom)
            """))
            session.commit()
            logger.info("PostGIS enabled")
            
            # Create performance indices manually (since create_all doesn't update existing tables)
            # Index for common filters
            session.exec(text("CREATE INDEX IF NOT EXISTS idx_beacons_incident_type ON beacons (incident_type)"))
            session.exec(text("CREATE INDEX IF NOT EXISTS idx_beacons_detailed_cause ON beacons (detailed_cause_type)"))
            session.exec(text("CREATE INDEX IF NOT EXISTS idx_beacons_is_active ON beacons (is_active)"))
            session.exec(text("CREATE INDEX IF NOT EXISTS idx_beacons_source ON beacons (source)"))
            session.commit()
            logger.info("Performance indices created")
            
        except Exception as e:
            logger.warning(f"PostGIS not available (running without spatial features): {e}")
            session.rollback()



def get_session():
    """Get database session dependency."""
    with Session(engine) as session:
        yield session


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    logger.info("Starting DGT V16 Backend...")
    
    # Initialize database
    init_db()
    logger.info("Database initialized")
    
    # Schedule sync task
    scheduler.add_job(
        run_sync_task,
        "interval",
        seconds=settings.sync_interval_seconds,
        args=[engine],
        id="sync_dgt_data",
        replace_existing=True,
    )
    
    # Schedule isolation score prefetch (every 5 minutes)
    scheduler.add_job(
        prefetch_beacon_isolation_scores,
        "interval",
        seconds=300,  # 5 minutes
        args=[engine],
        id="prefetch_isolation",
        replace_existing=True,
    )
    
    scheduler.start()
    logger.info(f"Scheduler started (interval: {settings.sync_interval_seconds}s)")
    
    # Run initial sync
    asyncio.create_task(run_sync_task(engine))
    
    yield
    
    # Shutdown
    scheduler.shutdown()
    logger.info("Scheduler stopped")


async def prefetch_beacon_isolation_scores(engine):
    """Pre-fetch isolation scores for V16 beacons using Overpass API."""
    from geospatial import prefetch_isolation_scores

    try:
        with Session(engine) as session:
            # Get active V16 beacons using unified helper
            all_active = session.exec(
                select(Beacon).where(Beacon.is_active == True)
            ).all()
            beacons = [b for b in all_active if is_v16_beacon(b)]

            if not beacons:
                return

            # Get coordinates
            coords = [(b.lat, b.lng) for b in beacons]
            logger.info(f"Pre-fetching isolation scores for {len(coords)} V16 beacons...")
            
            # Prefetch (with rate limiting built in)
            await prefetch_isolation_scores(coords)
            
            logger.info("Isolation score prefetch complete")
    except Exception as e:
        logger.error(f"Error pre-fetching isolation scores: {e}")


# FastAPI application
app = FastAPI(
    title="DGT V16 Live Map API",
    description="Real-time traffic incident data from DGT España",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gzip compression
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}


# In-memory cache for beacons
# Valid for 10 seconds to avoid constant DB hits/serialization
_beacons_cache = {
    "data": None,
    "last_update": 0
}

@app.get("/api/v1/beacons")
async def get_beacons(session: Session = Depends(get_session)) -> dict[str, Any]:
    """Get all ACTIVE beacons as GeoJSON.
    
    Returns:
        GeoJSON FeatureCollection with all active beacons.
    """
    import time
    
    # Check cache (15s TTL)
    now = time.time()
    if _beacons_cache["data"] and (now - _beacons_cache["last_update"] < 15):
        return _beacons_cache["data"]

    # Query only active beacons

    beacons = session.exec(select(Beacon).where(Beacon.is_active == True)).all()
    
    # Build GeoJSON FeatureCollection
    from datetime import datetime, timezone
    
    features = []
    now_utc = datetime.now(timezone.utc)
    MAX_HOURS_BEFORE_STALE = 10  # Beacons active >10h are likely DGT system errors
    
    for beacon in beacons:
        # Calculate minutes active
        minutes_active = 0
        is_stale = False
        if beacon.activation_time:
            activation = beacon.activation_time
            if activation.tzinfo is None:
                activation = activation.replace(tzinfo=timezone.utc)
            delta = now_utc - activation
            minutes_active = int(delta.total_seconds() / 60)
            is_stale = minutes_active > (MAX_HOURS_BEFORE_STALE * 60)
        
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [beacon.lng, beacon.lat]
            },
            "properties": {
                "id": str(beacon.id),
                "external_id": beacon.external_id,
                "source": beacon.source,
                "incident_type": beacon.incident_type,
                "road_name": beacon.road_name,
                "road_type": beacon.road_type,
                "severity": beacon.severity,
                "municipality": beacon.municipality,
                "province": beacon.province,
                "direction": beacon.direction,
                "pk": beacon.pk,
                "autonomous_community": beacon.autonomous_community,
                "activation_time": beacon.activation_time.isoformat() if beacon.activation_time else None,
                "created_at": beacon.created_at.isoformat() if beacon.created_at else None,
                "updated_at": beacon.updated_at.isoformat() if beacon.updated_at else None,
                "source_identification": beacon.source_identification,
                "detailed_cause_type": beacon.detailed_cause_type,
                "is_v16": is_v16_beacon(beacon),
                "minutes_active": minutes_active,
                "is_stale": is_stale,
            }
        }
        features.append(feature)
    
    result = {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "total_count": len(features),
            "sources": {
                "nacional": sum(1 for f in features if f["properties"]["source"] == "nacional"),
                "pais_vasco": sum(1 for f in features if f["properties"]["source"] == "pais_vasco"),
                "cataluna": sum(1 for f in features if f["properties"]["source"] == "cataluna"),
            }
        }
    }
    
    # Update cache
    _beacons_cache["data"] = result
    _beacons_cache["last_update"] = time.time()
    
    return result


@app.get("/api/v1/beacons/stats")
async def get_beacon_stats(session: Session = Depends(get_session)) -> dict[str, Any]:
    """Get beacon statistics per source and incident type."""
    # Get all beacons (active and inactive)
    all_beacons = session.exec(select(Beacon)).all()
    active_beacons = [b for b in all_beacons if b.is_active]
    inactive_beacons = [b for b in all_beacons if not b.is_active]
    
    # Aggregate active by source
    by_source = {}
    by_type = {}
    by_road_type = {}
    
    for beacon in active_beacons:
        by_source[beacon.source] = by_source.get(beacon.source, 0) + 1
        by_type[beacon.incident_type] = by_type.get(beacon.incident_type, 0) + 1
        if beacon.road_type:
            by_road_type[beacon.road_type] = by_road_type.get(beacon.road_type, 0) + 1
    
    return {
        "active": len(active_beacons),
        "historical": len(inactive_beacons),
        "total": len(all_beacons),
        "by_source": by_source,
        "by_incident_type": by_type,
        "by_road_type": by_road_type,
    }


@app.get("/api/v1/beacons/history")
async def get_beacon_history(
    session: Session = Depends(get_session),
    limit: int = 100,
    include_active: bool = False
) -> dict[str, Any]:
    """Get historical beacons (inactive ones).
    
    Args:
        limit: Maximum number of records to return.
        include_active: Whether to include currently active beacons.
    
    Returns:
        List of beacons with their duration.
    """
    if include_active:
        query = select(Beacon).order_by(Beacon.created_at.desc()).limit(limit)
    else:
        query = select(Beacon).where(Beacon.is_active == False).order_by(Beacon.deleted_at.desc()).limit(limit)
    
    beacons = session.exec(query).all()
    
    history = []
    for beacon in beacons:
        # Calculate duration if beacon is inactive
        duration_seconds = None
        if beacon.deleted_at and beacon.created_at:
            duration_seconds = int((beacon.deleted_at - beacon.created_at).total_seconds())
        
        history.append({
            "id": str(beacon.id),
            "external_id": beacon.external_id,
            "source": beacon.source,
            "incident_type": beacon.incident_type,
            "road_name": beacon.road_name,
            "municipality": beacon.municipality,
            "province": beacon.province,
            "lat": beacon.lat,
            "lng": beacon.lng,
            "is_active": beacon.is_active,
            "created_at": beacon.created_at.isoformat() if beacon.created_at else None,
            "deleted_at": beacon.deleted_at.isoformat() if beacon.deleted_at else None,
            "duration_seconds": duration_seconds,
        })
    
    return {
        "count": len(history),
        "history": history,
    }


@app.get("/api/v1/sync/logs")
async def get_sync_logs(
    session: Session = Depends(get_session),
    limit: int = 50,
    source: str = None
) -> dict[str, Any]:
    """Get sync operation logs.
    
    Args:
        limit: Maximum number of logs to return.
        source: Filter by source (nacional, pais_vasco, cataluna).
    
    Returns:
        List of sync logs with metrics.
    """
    query = select(SyncLog).order_by(SyncLog.sync_started_at.desc()).limit(limit)
    
    if source:
        query = query.where(SyncLog.source == source)
    
    logs = session.exec(query).all()
    
    result = []
    for log in logs:
        duration_seconds = None
        if log.sync_completed_at and log.sync_started_at:
            duration_seconds = (log.sync_completed_at - log.sync_started_at).total_seconds()
        
        result.append({
            "id": log.id,
            "source": log.source,
            "sync_started_at": log.sync_started_at.isoformat() if log.sync_started_at else None,
            "sync_completed_at": log.sync_completed_at.isoformat() if log.sync_completed_at else None,
            "sync_duration_seconds": duration_seconds,
            "beacons_in_feed": log.beacons_in_feed,
            "beacons_created": log.beacons_created,
            "beacons_updated": log.beacons_updated,
            "beacons_deactivated": log.beacons_deactivated,
            "success": log.success,
            "error_message": log.error_message,
        })
    
    return {
        "count": len(result),
        "logs": result,
    }


@app.get("/api/v1/alerts/vulnerable")
async def get_vulnerable_beacons(
    min_score: float = 50.0,
    session: Session = Depends(get_session)
) -> dict[str, Any]:
    """Get beacons with high vulnerability scores.

    Args:
        min_score: Minimum vulnerability score (0-100) to include.

    Returns:
        List of vulnerable beacons with scores and risk factors.
    """
    from vulnerability import analyze_beacon_vulnerability, HIGH_RISK_THRESHOLD

    # Fetch all active beacons and filter to V16 using unified helper
    all_active = session.exec(select(Beacon).where(Beacon.is_active == True)).all()
    beacons = [b for b in all_active if is_v16_beacon(b)]
    
    vulnerable = []
    for beacon in beacons:
        # Convert to dict for analysis
        beacon_data = {
            'id': beacon.id,
            'external_id': beacon.external_id,
            'lat': beacon.lat,
            'lng': beacon.lng,
            'road_name': beacon.road_name,
            'road_type': beacon.road_type,
            'municipality': beacon.municipality,
            'province': beacon.province,
            'activation_time': beacon.activation_time,
        }
        
        score = analyze_beacon_vulnerability(beacon_data)
        
        if score.total_score >= min_score:
            vulnerable.append({
                'beacon_id': score.beacon_id,
                'external_id': score.external_id,
                'lat': score.lat,
                'lng': score.lng,
                'road_name': score.road_name,
                'municipality': score.municipality,
                'province': score.province,
                'total_score': score.total_score,
                'risk_level': score.risk_level,
                'risk_factors': score.risk_factors,
                'minutes_active': score.minutes_active,
                'scores': {
                    'isolation': score.isolation_score,
                    'exposure': score.exposure_score,
                    'nighttime': score.nighttime_score,
                    'road_type': score.road_type_score,
                }
            })
    
    # Sort by score descending
    vulnerable.sort(key=lambda x: x['total_score'], reverse=True)
    
    return {
        'count': len(vulnerable),
        'threshold': min_score,
        'alerts': vulnerable,
    }


def calculate_normalized_time_stats(active_times: list[int]) -> dict[str, Any]:
    """Calculate normalized time statistics excluding outliers.

    Uses IQR (Interquartile Range) method to detect and exclude outliers:
    - Values below Q1 - 1.5*IQR are excluded (likely test activations)
    - Values above Q3 + 1.5*IQR are excluded (likely system errors)
    - Also excludes times < 2 min (definitely tests) and > 600 min (10h, likely errors)

    Returns dict with avg, median, valid_count, excluded_count, and range info.
    """
    import statistics

    if not active_times:
        return {
            "avg_minutes": 0,
            "median_minutes": 0,
            "valid_count": 0,
            "excluded_count": 0,
            "min_minutes": 0,
            "max_minutes": 0,
        }

    # Step 1: Apply hard limits first (2 min to 10 hours)
    MIN_VALID_MINUTES = 2      # Less than 2 min = likely a test
    MAX_VALID_MINUTES = 600    # More than 10 hours = likely system error

    preliminary = [t for t in active_times if MIN_VALID_MINUTES <= t <= MAX_VALID_MINUTES]

    if len(preliminary) < 4:
        # Not enough data for IQR, use preliminary filtered data
        if preliminary:
            return {
                "avg_minutes": int(statistics.mean(preliminary)),
                "median_minutes": int(statistics.median(preliminary)),
                "valid_count": len(preliminary),
                "excluded_count": len(active_times) - len(preliminary),
                "min_minutes": min(preliminary),
                "max_minutes": max(preliminary),
            }
        return {
            "avg_minutes": 0,
            "median_minutes": 0,
            "valid_count": 0,
            "excluded_count": len(active_times),
            "min_minutes": 0,
            "max_minutes": 0,
        }

    # Step 2: Calculate IQR on preliminary data
    sorted_times = sorted(preliminary)
    n = len(sorted_times)
    q1_idx = n // 4
    q3_idx = (3 * n) // 4
    q1 = sorted_times[q1_idx]
    q3 = sorted_times[q3_idx]
    iqr = q3 - q1

    # Step 3: Define bounds (1.5 * IQR is standard for outlier detection)
    lower_bound = max(MIN_VALID_MINUTES, q1 - 1.5 * iqr)
    upper_bound = min(MAX_VALID_MINUTES, q3 + 1.5 * iqr)

    # Step 4: Filter to valid range
    valid_times = [t for t in preliminary if lower_bound <= t <= upper_bound]

    if not valid_times:
        valid_times = preliminary  # Fallback to preliminary if IQR too aggressive

    return {
        "avg_minutes": int(statistics.mean(valid_times)),
        "median_minutes": int(statistics.median(valid_times)),
        "valid_count": len(valid_times),
        "excluded_count": len(active_times) - len(valid_times),
        "min_minutes": int(min(valid_times)),
        "max_minutes": int(max(valid_times)),
    }


@app.get("/api/v1/stats")
async def get_stats(
    days: int = 0,
    session: Session = Depends(get_session)
) -> dict[str, Any]:
    """Get statistics about V16 beacons.

    Args:
        days: Time range filter. 0 = current active only (real-time),
              1 = today, 7 = last 7 days, 30 = last 30 days.

    Time statistics are normalized to exclude outliers (test activations and system errors).
    """
    from datetime import datetime, timezone, timedelta

    now = datetime.now(timezone.utc)

    if days == 0:
        # Real-time: only active beacons
        all_active = session.exec(select(Beacon).where(Beacon.is_active == True)).all()
        beacons = [b for b in all_active if is_v16_beacon(b)]
    else:
        # Historical range: get beacons created within the time range
        start_date = now - timedelta(days=days)
        all_beacons = session.exec(
            select(Beacon).where(Beacon.created_at >= start_date)
        ).all()
        beacons = [b for b in all_beacons if is_v16_beacon(b)]

    total_beacons = len(beacons)

    if total_beacons == 0:
        return {
            "total_vehicles": 0,
            "avg_minutes_active": 0,
            "median_minutes_active": 0,
            "period": "realtime" if days == 0 else f"{days}d",
            "time_stats": {
                "valid_count": 0,
                "excluded_count": 0,
                "min_minutes": 0,
                "max_minutes": 0,
            },
            "top_provinces": [],
            "by_road_type": {},
        }

    active_times = []
    provinces: dict[str, int] = {}
    road_types: dict[str, int] = {}

    for beacon in beacons:
        # Count provinces
        prov = beacon.province or "Desconocida"
        provinces[prov] = provinces.get(prov, 0) + 1

        # Count road types
        rt = beacon.road_type or "desconocida"
        road_types[rt] = road_types.get(rt, 0) + 1

        # Calculate active time
        if days == 0:
            # For real-time, calculate from activation_time to now
            if beacon.activation_time:
                act_time = beacon.activation_time
                if act_time.tzinfo is None:
                    act_time = act_time.replace(tzinfo=timezone.utc)
                delta = now - act_time
                minutes = int(delta.total_seconds() / 60)
                active_times.append(minutes)
        else:
            # For historical, calculate actual duration (deleted_at - created_at)
            if beacon.deleted_at and beacon.created_at:
                delta = beacon.deleted_at - beacon.created_at
                minutes = int(delta.total_seconds() / 60)
                active_times.append(minutes)
            elif beacon.is_active and beacon.activation_time:
                # Still active, calculate from activation to now
                act_time = beacon.activation_time
                if act_time.tzinfo is None:
                    act_time = act_time.replace(tzinfo=timezone.utc)
                delta = now - act_time
                minutes = int(delta.total_seconds() / 60)
                active_times.append(minutes)

    # Calculate normalized time statistics
    time_stats = calculate_normalized_time_stats(active_times)

    # Sort top provinces
    sorted_provinces = sorted(provinces.items(), key=lambda x: x[1], reverse=True)[:5]
    top_provinces = [{"name": name, "count": count} for name, count in sorted_provinces]

    # Sort road types
    sorted_road_types = dict(sorted(road_types.items(), key=lambda x: -x[1]))

    return {
        "total_vehicles": total_beacons,
        "avg_minutes_active": time_stats["avg_minutes"],
        "median_minutes_active": time_stats["median_minutes"],
        "period": "realtime" if days == 0 else f"{days}d",
        "time_stats": {
            "valid_count": time_stats["valid_count"],
            "excluded_count": time_stats["excluded_count"],
            "min_minutes": time_stats["min_minutes"],
            "max_minutes": time_stats["max_minutes"],
        },
        "top_provinces": top_provinces,
        "by_road_type": sorted_road_types,
    }


@app.get("/api/v1/debug/beacon-types")
async def debug_beacon_types(session: Session = Depends(get_session)) -> dict[str, Any]:
    """Debug endpoint to see unique values of incident_type and detailed_cause_type.

    This helps diagnose why V16 filtering might not be working.
    """
    # Get all active beacons
    all_active = session.exec(select(Beacon).where(Beacon.is_active == True)).all()

    # Collect unique values
    incident_types: dict[str, int] = {}
    detailed_cause_types: dict[str, int] = {}
    source_ids: dict[str, int] = {}
    v16_matches = 0

    for beacon in all_active:
        # Count incident_type values
        it = beacon.incident_type or "(None)"
        incident_types[it] = incident_types.get(it, 0) + 1

        # Count detailed_cause_type values
        dct = beacon.detailed_cause_type or "(None)"
        detailed_cause_types[dct] = detailed_cause_types.get(dct, 0) + 1

        # Count source_identification values
        si = beacon.source_identification or "(None)"
        source_ids[si] = source_ids.get(si, 0) + 1

        # Check if matches V16 filter
        if is_v16_beacon(beacon):
            v16_matches += 1

    return {
        "total_active_beacons": len(all_active),
        "v16_matches": v16_matches,
        "v16_filter_logic": "detailed_cause_type == 'vehicleStuck' OR incident_type.lower() == 'vehicleobstruction'",
        "incident_type_values": dict(sorted(incident_types.items(), key=lambda x: -x[1])),
        "detailed_cause_type_values": dict(sorted(detailed_cause_types.items(), key=lambda x: -x[1])),
        "source_identification_values": dict(sorted(source_ids.items(), key=lambda x: -x[1])),
    }


@app.get("/api/v1/stats/trends")
async def get_stats_trends(
    days: int = 7,
    session: Session = Depends(get_session)
) -> dict[str, Any]:
    """Get historical trend data for charts.

    Returns:
    - hourly_distribution: Incidents by hour of day (0-23) for active V16 beacons
    - daily_trend: Incidents per day for the last N days
    - by_source: Distribution by data source
    """
    from datetime import datetime, timezone, timedelta
    from collections import defaultdict

    now = datetime.now(timezone.utc)
    days_ago = now - timedelta(days=days)

    # Get all V16 beacons (active and recently inactive)
    all_beacons = session.exec(
        select(Beacon).where(Beacon.created_at >= days_ago)
    ).all()

    v16_beacons = [b for b in all_beacons if is_v16_beacon(b)]

    # 1. Hourly distribution - use ALL beacons in period, not just active ones
    # For historical view, we want to see when incidents occurred throughout the day
    hourly: dict[int, int] = defaultdict(int)

    for beacon in v16_beacons:
        # Use activation_time if available, otherwise created_at
        timestamp = beacon.activation_time or beacon.created_at
        if timestamp:
            if timestamp.tzinfo is None:
                timestamp = timestamp.replace(tzinfo=timezone.utc)
            # Approximate Spain timezone (UTC+1)
            spain_hour = (timestamp.hour + 1) % 24
            hourly[spain_hour] += 1

    # Fill all 24 hours
    hourly_distribution = [{"hour": h, "count": hourly.get(h, 0)} for h in range(24)]

    # 2. Daily trend (using created_at)
    daily: dict[str, int] = defaultdict(int)

    for beacon in v16_beacons:
        if beacon.created_at:
            day_str = beacon.created_at.strftime("%Y-%m-%d")
            daily[day_str] += 1

    # Generate all days in range
    daily_trend = []
    for i in range(days, -1, -1):
        day = now - timedelta(days=i)
        day_str = day.strftime("%Y-%m-%d")
        daily_trend.append({
            "date": day_str,
            "label": day.strftime("%d/%m"),
            "count": daily.get(day_str, 0)
        })

    # 3. By source distribution (for active beacons)
    active_v16 = [b for b in v16_beacons if b.is_active]
    by_source: dict[str, int] = defaultdict(int)
    for beacon in active_v16:
        by_source[beacon.source] += 1

    # 4. Calculate trend percentage (today vs yesterday)
    today_str = now.strftime("%Y-%m-%d")
    yesterday_str = (now - timedelta(days=1)).strftime("%Y-%m-%d")
    today_count = daily.get(today_str, 0)
    yesterday_count = daily.get(yesterday_str, 0)

    if yesterday_count > 0:
        trend_pct = round(((today_count - yesterday_count) / yesterday_count) * 100)
    else:
        trend_pct = 0 if today_count == 0 else 100

    return {
        "period_days": days,
        "total_v16_in_period": len(v16_beacons),
        "active_now": len(active_v16),
        "hourly_distribution": hourly_distribution,
        "daily_trend": daily_trend,
        "by_source": dict(by_source),
        "trend_vs_yesterday": {
            "today": today_count,
            "yesterday": yesterday_count,
            "percentage": trend_pct,
            "direction": "up" if trend_pct > 0 else ("down" if trend_pct < 0 else "stable")
        }
    }

