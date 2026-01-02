"""ETL Worker for syncing DGT data to database."""
import asyncio
import logging
import ssl
from datetime import datetime
from typing import Optional
from enum import Enum

import httpx
from sqlmodel import Session, select

from config import get_settings
from models import Beacon, SyncLog
from parser import parse_datex_v36, parse_datex_v10, ParsedBeacon, classify_road_type

logger = logging.getLogger(__name__)
settings = get_settings()


class DataSource(str, Enum):
    """Available DGT data sources."""
    NACIONAL = "nacional"
    PAIS_VASCO = "pais_vasco"
    CATALUNA = "cataluna"


SOURCE_CONFIG = {
    DataSource.NACIONAL: {
        "url": settings.dgt_nacional_url,
        "parser": parse_datex_v36,
    },
    DataSource.PAIS_VASCO: {
        "url": settings.dgt_paisvasco_url,
        "parser": parse_datex_v10,
    },
    DataSource.CATALUNA: {
        "url": settings.dgt_cataluna_url,
        "parser": parse_datex_v10,
    },
}

# HTTP client headers to mimic a browser
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/xml, text/xml, */*",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
}


async def fetch_xml(url: str) -> Optional[bytes]:
    """Fetch XML content from a URL.
    
    Args:
        url: URL to fetch XML from.
        
    Returns:
        Raw XML bytes or None if request failed.
    """
    try:
        # Extended timeout and SSL verification for some government sites
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(60.0, connect=30.0),
            headers=HEADERS,
            follow_redirects=True,
            verify=True,  # Keep SSL verification
        ) as client:
            response = await client.get(url)
            response.raise_for_status()
            logger.info(f"Successfully fetched {url} ({len(response.content)} bytes)")
            return response.content
    except httpx.TimeoutException as e:
        logger.error(f"Timeout fetching {url}: {e}")
        return None
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error {e.response.status_code} fetching {url}: {e}")
        return None
    except httpx.RequestError as e:
        logger.error(f"Request error fetching {url}: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error fetching {url}: {type(e).__name__}: {e}")
        return None


async def fetch_and_parse_source(source: DataSource) -> list[ParsedBeacon]:
    """Fetch and parse a single data source.
    
    Args:
        source: The data source to fetch.
        
    Returns:
        List of parsed beacons.
    """
    config = SOURCE_CONFIG[source]
    logger.info(f"Fetching {source.value} from {config['url']}")
    
    xml_content = await fetch_xml(config["url"])
    if xml_content is None:
        logger.warning(f"No content received from {source.value}")
        return []
    
    parser = config["parser"]
    beacons = parser(xml_content)
    
    # Add source to each beacon
    for beacon in beacons:
        beacon.source = source.value
    
    logger.info(f"[{source.value}] Parsed {len(beacons)} beacons")
    return beacons


def sync_beacons_to_db(session: Session, beacons: list[ParsedBeacon], source: DataSource) -> dict:
    """Sync parsed beacons to database.
    
    Performs upsert for existing beacons and marks stale ones as inactive.
    Beacons are never deleted, only marked with deleted_at timestamp.
    
    Args:
        session: Database session.
        beacons: List of parsed beacons.
        source: The data source being synced.
    
    Returns:
        Dict with sync metrics: created, updated, deactivated counts.
    """
    source_value = source.value
    now = datetime.utcnow()
    
    # Get current external IDs from parsed data
    current_ids = {b.external_id for b in beacons}
    
    # Get existing ACTIVE beacons for this source
    existing_query = select(Beacon).where(
        Beacon.source == source_value,
        Beacon.is_active == True
    )
    existing_beacons = session.exec(existing_query).all()
    existing_map = {b.external_id: b for b in existing_beacons}
    
    # Upsert beacons
    updated_count = 0
    created_count = 0
    
    for parsed in beacons:
        if parsed.external_id in existing_map:
            # Update existing beacon
            beacon = existing_map[parsed.external_id]
            beacon.lat = parsed.lat
            beacon.lng = parsed.lng
            beacon.incident_type = parsed.incident_type
            beacon.road_name = parsed.road_name
            beacon.road_type = classify_road_type(parsed.road_name)
            beacon.severity = parsed.severity
            beacon.municipality = parsed.municipality
            beacon.province = parsed.province
            beacon.direction = parsed.direction
            beacon.pk = parsed.pk
            beacon.autonomous_community = parsed.autonomous_community
            beacon.activation_time = parsed.activation_time
            beacon.source_identification = parsed.source_identification
            beacon.detailed_cause_type = parsed.detailed_cause_type
            beacon.updated_at = now
            session.add(beacon)
            updated_count += 1
        else:
            # Create new beacon
            beacon = Beacon(
                external_id=parsed.external_id,
                source=source_value,
                lat=parsed.lat,
                lng=parsed.lng,
                incident_type=parsed.incident_type,
                road_name=parsed.road_name,
                road_type=classify_road_type(parsed.road_name),
                severity=parsed.severity,
                municipality=parsed.municipality,
                province=parsed.province,
                direction=parsed.direction,
                pk=parsed.pk,
                autonomous_community=parsed.autonomous_community,
                activation_time=parsed.activation_time,
                source_identification=parsed.source_identification,
                detailed_cause_type=parsed.detailed_cause_type,
                created_at=now,
                updated_at=now,
            )
            session.add(beacon)
            created_count += 1
    
    # Mark stale beacons as inactive (not in current feed)
    deactivated_count = 0
    for existing in existing_beacons:
        if existing.external_id not in current_ids:
            existing.is_active = False
            existing.deleted_at = now
            session.add(existing)
            deactivated_count += 1
    
    session.commit()
    logger.info(
        f"[{source_value}] Synced: {created_count} created, "
        f"{updated_count} updated, {deactivated_count} deactivated"
    )
    
    return {
        "in_feed": len(beacons),
        "created": created_count,
        "updated": updated_count,
        "deactivated": deactivated_count,
    }


async def run_sync_task(engine):
    """Run the full sync task for all data sources.
    
    Args:
        engine: SQLAlchemy engine for database connection.
    """
    logger.info("Starting sync task for all DGT sources...")
    
    # Fetch all sources concurrently
    tasks = [
        fetch_and_parse_source(DataSource.NACIONAL),
        fetch_and_parse_source(DataSource.PAIS_VASCO),
        fetch_and_parse_source(DataSource.CATALUNA),
    ]
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Process results
    with Session(engine) as session:
        for source, result in zip(DataSource, results):
            sync_started = datetime.utcnow()
            sync_log = SyncLog(
                source=source.value,
                sync_started_at=sync_started,
            )
            
            if isinstance(result, Exception):
                logger.error(f"Error fetching {source.value}: {result}")
                sync_log.success = False
                sync_log.error_message = str(result)
                sync_log.sync_completed_at = datetime.utcnow()
                session.add(sync_log)
                continue
            
            if result:
                metrics = sync_beacons_to_db(session, result, source)
                sync_log.beacons_in_feed = metrics["in_feed"]
                sync_log.beacons_created = metrics["created"]
                sync_log.beacons_updated = metrics["updated"]
                sync_log.beacons_deactivated = metrics["deactivated"]
                sync_log.sync_completed_at = datetime.utcnow()
                session.add(sync_log)
        
        session.commit()
    
    logger.info("Sync task completed")
