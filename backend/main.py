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
    scheduler.start()
    logger.info(f"Scheduler started (interval: {settings.sync_interval_seconds}s)")
    
    # Run initial sync
    asyncio.create_task(run_sync_task(engine))
    
    yield
    
    # Shutdown
    scheduler.shutdown()
    logger.info("Scheduler stopped")


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
    MAX_HOURS_BEFORE_STALE = 15
    
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
                "is_v16": (
                    beacon.incident_type.lower() == "accident" or
                    beacon.incident_type.lower() == "vehicleobstruction" or
                    (beacon.incident_type.lower() == "environmentalobstruction" and beacon.detailed_cause_type == "vehicleStuck") or
                    (beacon.incident_type.lower() == "obstruction" and beacon.detailed_cause_type == "vehicleStuck")
                ),
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
    
    # Query active vehicleObstruction beacons (V16)
    beacons = session.exec(
        select(Beacon).where(
            Beacon.is_active == True,
            Beacon.incident_type == 'vehicleObstruction'
        )
    ).all()
    
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

