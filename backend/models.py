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
    severity: Optional[str] = Field(default=None, description="Incident severity")
    municipality: Optional[str] = Field(default=None, description="Municipality name")
    province: Optional[str] = Field(default=None, description="Province name")


class Beacon(BeaconBase, table=True):
    """Beacon database model with PostGIS geometry."""
    __tablename__ = "beacons"
    
    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        description="Unique beacon ID"
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Record creation timestamp"
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Last update timestamp"
    )
    
    # PostGIS geometry column - defined separately due to GeoAlchemy2
    # The geom column will be added via manual SQL during table creation
    
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
