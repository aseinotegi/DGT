"""DGT V16 Live Map - FastAPI Backend.

Real-time traffic incident visualization from DGT España.
"""
import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, SQLModel, create_engine, select, text
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from config import get_settings
from models import Beacon
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
    """Initialize database tables and PostGIS extension."""
    # Create tables
    SQLModel.metadata.create_all(engine)
    
    # Add PostGIS extension and geom column if not exists
    with Session(engine) as session:
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
        lambda: asyncio.create_task(run_sync_task(engine)),
        "interval",
        seconds=settings.sync_interval_seconds,
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


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}


@app.get("/api/v1/beacons")
async def get_beacons(session: Session = Depends(get_session)) -> dict[str, Any]:
    """Get all ACTIVE beacons as GeoJSON.
    
    Returns:
        GeoJSON FeatureCollection with all active beacons.
    """
    # Query only active beacons
    beacons = session.exec(select(Beacon).where(Beacon.is_active == True)).all()
    
    # Build GeoJSON FeatureCollection
    features = []
    for beacon in beacons:
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
                "severity": beacon.severity,
                "municipality": beacon.municipality,
                "province": beacon.province,
                "direction": beacon.direction,
                "pk": beacon.pk,
                "autonomous_community": beacon.autonomous_community,
                "activation_time": beacon.activation_time.isoformat() if beacon.activation_time else None,
                "created_at": beacon.created_at.isoformat() if beacon.created_at else None,
                "updated_at": beacon.updated_at.isoformat() if beacon.updated_at else None,
            }
        }
        features.append(feature)
    
    return {
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
    
    for beacon in active_beacons:
        by_source[beacon.source] = by_source.get(beacon.source, 0) + 1
        by_type[beacon.incident_type] = by_type.get(beacon.incident_type, 0) + 1
    
    return {
        "active": len(active_beacons),
        "historical": len(inactive_beacons),
        "total": len(all_beacons),
        "by_source": by_source,
        "by_incident_type": by_type,
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
