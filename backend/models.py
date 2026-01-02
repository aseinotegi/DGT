"""Database models for DGT V16 beacons."""
import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel
from sqlalchemy import Column, text
from geoalchemy2 import Geometry


class BeaconBase(SQLModel):
    """Base beacon model with common fields."""
    external_id: str = Field(index=True, description="DGT situation record ID")
    source: str = Field(index=True, description="Data source: nacional, pais_vasco, cataluna")
    lat: float = Field(description="Latitude")
    lng: float = Field(description="Longitude")
    incident_type: str = Field(description="Type of incident (causeType)")
    road_name: Optional[str] = Field(default=None, description="Road identifier")
    road_type: Optional[str] = Field(default=None, index=True, description="Road type: autopista, nacional, autonomica, provincial, local")
    severity: Optional[str] = Field(default=None, description="Incident severity")
    municipality: Optional[str] = Field(default=None, description="Municipality name")
    province: Optional[str] = Field(default=None, description="Province name")
    # New fields
    direction: Optional[str] = Field(default=None, description="Direction: creciente, decreciente, both")
    pk: Optional[str] = Field(default=None, description="Kilometric point (PK)")
    autonomous_community: Optional[str] = Field(default=None, description="Autonomous community")
    activation_time: Optional[datetime] = Field(default=None, description="When the beacon was activated")


class Beacon(BeaconBase, table=True):
    """Beacon database model with PostGIS geometry."""
    __tablename__ = "beacons"
    
    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        description="Unique beacon ID"
    )
    is_active: bool = Field(
        default=True,
        index=True,
        description="Whether beacon is currently active in DGT feed"
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Record creation timestamp"
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Last update timestamp"
    )
    deleted_at: Optional[datetime] = Field(
        default=None,
        description="When beacon was removed from DGT feed"
    )
    
    class Config:
        arbitrary_types_allowed = True


class BeaconCreate(BeaconBase):
    """Schema for creating a beacon."""
    pass


class BeaconRead(BeaconBase):
    """Schema for reading a beacon."""
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class SyncLog(SQLModel, table=True):
    """Log of each sync operation from DGT feeds."""
    __tablename__ = "sync_logs"
    
    id: int = Field(default=None, primary_key=True)
    source: str = Field(index=True, description="Data source: nacional, pais_vasco, cataluna")
    sync_started_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="When sync started"
    )
    sync_completed_at: Optional[datetime] = Field(
        default=None,
        description="When sync completed"
    )
    publication_time: Optional[datetime] = Field(
        default=None,
        description="publicationTime from DGT XML feed"
    )
    beacons_in_feed: int = Field(
        default=0,
        description="Total beacons in the XML feed"
    )
    beacons_created: int = Field(
        default=0,
        description="New beacons created"
    )
    beacons_updated: int = Field(
        default=0,
        description="Existing beacons updated"
    )
    beacons_deactivated: int = Field(
        default=0,
        description="Beacons marked as inactive"
    )
    success: bool = Field(
        default=True,
        description="Whether sync completed successfully"
    )
    error_message: Optional[str] = Field(
        default=None,
        description="Error message if sync failed"
    )
