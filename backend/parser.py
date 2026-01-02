"""DATEX II XML Parser for DGT feeds.

Supports both DATEX II v3.6 (Nacional) and v1.0 (Pais Vasco, Cataluna).
"""
from dataclasses import dataclass
from typing import Optional
from datetime import datetime
from lxml import etree
import logging

logger = logging.getLogger(__name__)


@dataclass
class ParsedBeacon:
    """Parsed beacon data from DATEX II XML."""
    external_id: str
    lat: float
    lng: float
    incident_type: str
    road_name: Optional[str] = None
    severity: Optional[str] = None
    municipality: Optional[str] = None
    province: Optional[str] = None
    direction: Optional[str] = None
    pk: Optional[str] = None
    autonomous_community: Optional[str] = None
    activation_time: Optional[datetime] = None


@dataclass
class ParseResult:
    """Result of parsing a DGT XML feed."""
    beacons: list[ParsedBeacon]
    publication_time: Optional[datetime] = None
    source: Optional[str] = None


# Namespaces for DATEX II v3.6 (DGT Nacional)
NS_V36 = {
    "d2": "http://levelC/schema/3/d2Payload",
    "sit": "http://levelC/schema/3/situation",
    "loc": "http://levelC/schema/3/locationReferencing",
    "com": "http://levelC/schema/3/common",
    "lse": "http://levelC/schema/3/locationReferencingSpanishExtension",
    "xsi": "http://www.w3.org/2001/XMLSchema-instance",
}

# Namespace for DATEX II v1.0 (Pais Vasco, Cataluna)
NS_V10 = {
    "d2": "http://datex2.eu/schema/1_0/1_0",
    "xsi": "http://www.w3.org/2001/XMLSchema-instance",
}

# Direction translations
DIRECTION_MAP = {
    "bothWays": "Ambos sentidos",
    "both": "Ambos sentidos",
    "positive": "Creciente",
    "negative": "Decreciente",
    "creciente": "Creciente",
    "decreciente": "Decreciente",
}


def parse_datetime(value: str) -> Optional[datetime]:
    """Parse ISO datetime string."""
    if not value:
        return None
    try:
        # Handle timezone offset
        if '+' in value:
            value = value.split('+')[0]
        if '.' in value:
            return datetime.strptime(value, "%Y-%m-%dT%H:%M:%S.%f")
        return datetime.strptime(value, "%Y-%m-%dT%H:%M:%S")
    except:
        return None


import re

# Road classification patterns
ROAD_PATTERNS = [
    # Autopistas y autovias (A-1, AP-7, etc)
    (re.compile(r'^A[P]?-?\d', re.IGNORECASE), 'autopista'),
    # Nacionales (N-I, N-340, etc)
    (re.compile(r'^N-?\d', re.IGNORECASE), 'nacional'),
    # Autonomicas - prefijos de 2 letras (CA-1, BI-20, GI-11, etc)
    (re.compile(r'^[A-Z]{2}-?\d', re.IGNORECASE), 'autonomica'),
    # Provinciales y comarcales (C-12, L-501, etc) - 1 letra
    (re.compile(r'^[A-Z]-?\d', re.IGNORECASE), 'provincial'),
]


def classify_road_type(road_name: Optional[str]) -> Optional[str]:
    """Classify road type based on name prefix.
    
    Spanish road classification:
    - autopista: A-X, AP-X (autopistas, autovias de peaje)
    - nacional: N-X (carreteras nacionales)
    - autonomica: XX-X (carreteras autonomicas, 2 letras)
    - provincial: X-X (provinciales/comarcales, 1 letra)
    - local: anything else
    
    Returns:
        Road type string or None if can't classify.
    """
    if not road_name:
        return None
    
    road_name = road_name.strip().upper()
    
    for pattern, road_type in ROAD_PATTERNS:
        if pattern.match(road_name):
            return road_type
    
    # If has letters and numbers but didn't match, probably local
    if road_name and any(c.isalpha() for c in road_name):
        return 'local'
    
    return None


def parse_datex_v36(xml_content: bytes) -> list[ParsedBeacon]:
    """Parse DATEX II v3.6 XML (DGT Nacional).
    
    Args:
        xml_content: Raw XML bytes from DGT Nacional feed.
        
    Returns:
        List of parsed beacon objects.
    """
    beacons = []
    
    try:
        root = etree.fromstring(xml_content)
    except etree.XMLSyntaxError as e:
        logger.error(f"Failed to parse v3.6 XML: {e}")
        return beacons
    
    # Find all situation records
    situations = root.findall(".//sit:situation", NS_V36)
    
    for situation in situations:
        situation_id = situation.get("id", "")
        severity = situation.findtext("sit:overallSeverity", namespaces=NS_V36)
        
        for record in situation.findall("sit:situationRecord", NS_V36):
            record_id = record.get("id", situation_id)
            
            # Get cause type
            cause_type = record.findtext(".//sit:causeType", namespaces=NS_V36)
            if not cause_type:
                continue
            
            lat, lng = None, None
            road_name = None
            municipality = None
            province = None
            direction = None
            pk = None
            autonomous_community = None
            activation_time = None
            
            # Get activation time
            time_str = record.findtext(".//sit:situationRecordCreationTime", namespaces=NS_V36)
            activation_time = parse_datetime(time_str)
            
            # Get road name
            road_name = record.findtext(".//loc:roadName", namespaces=NS_V36)
            
            # Get direction
            dir_val = record.findtext(".//loc:tpegDirection", namespaces=NS_V36)
            direction = DIRECTION_MAP.get(dir_val, dir_val)
            
            # Try to get coordinates from 'to' point
            to_point = record.find(".//loc:to/loc:pointCoordinates", NS_V36)
            if to_point is not None:
                lat_text = to_point.findtext("loc:latitude", namespaces=NS_V36)
                lng_text = to_point.findtext("loc:longitude", namespaces=NS_V36)
                if lat_text and lng_text:
                    lat = float(lat_text)
                    lng = float(lng_text)
            
            # If no 'to' point, try 'from' point
            if lat is None:
                from_point = record.find(".//loc:from/loc:pointCoordinates", NS_V36)
                if from_point is not None:
                    lat_text = from_point.findtext("loc:latitude", namespaces=NS_V36)
                    lng_text = from_point.findtext("loc:longitude", namespaces=NS_V36)
                    if lat_text and lng_text:
                        lat = float(lat_text)
                        lng = float(lng_text)
            
            # Get Spanish extension data (municipality, province)
            ext_point = record.find(".//loc:extendedTpegNonJunctionPoint", NS_V36)
            if ext_point is not None:
                municipality = ext_point.findtext("lse:municipality", namespaces=NS_V36)
                province = ext_point.findtext("lse:province", namespaces=NS_V36)
                autonomous_community = ext_point.findtext("lse:autonomousCommunity", namespaces=NS_V36)
            
            # Get PK from reference point
            pk = record.findtext(".//loc:referencePointDistance", namespaces=NS_V36)
            
            if lat is not None and lng is not None:
                beacons.append(ParsedBeacon(
                    external_id=record_id,
                    lat=lat,
                    lng=lng,
                    incident_type=cause_type,
                    road_name=road_name,
                    severity=severity,
                    municipality=municipality,
                    province=province,
                    direction=direction,
                    pk=pk,
                    autonomous_community=autonomous_community,
                    activation_time=activation_time,
                ))
    
    logger.info(f"Parsed {len(beacons)} beacons from v3.6 feed")
    return beacons


def parse_datex_v10(xml_content: bytes) -> list[ParsedBeacon]:
    """Parse DATEX II v1.0 XML (Pais Vasco, Cataluna).
    
    Args:
        xml_content: Raw XML bytes from regional feed.
        
    Returns:
        List of parsed beacon objects.
    """
    beacons = []
    
    try:
        root = etree.fromstring(xml_content)
    except etree.XMLSyntaxError as e:
        logger.error(f"Failed to parse v1.0 XML: {e}")
        return beacons
    
    # Remove namespace prefixes for easier parsing
    for elem in root.iter():
        if elem.tag.startswith("{"):
            elem.tag = elem.tag.split("}", 1)[1]
        for attr_name in list(elem.attrib.keys()):
            if attr_name.startswith("{"):
                new_name = attr_name.split("}", 1)[1]
                elem.attrib[new_name] = elem.attrib.pop(attr_name)
    
    # Find all situations
    situations = root.findall(".//situation")
    
    for situation in situations:
        situation_id = situation.get("id", "")
        
        for record in situation.findall(".//situationRecord"):
            record_id = record.get("id", situation_id)
            
            # Get record type from xsi:type
            record_type = record.get("type", "")
            
            lat, lng = None, None
            road_name = None
            municipality = None
            province = None
            direction = None
            pk = None
            autonomous_community = None
            activation_time = None
            
            # Get activation time
            time_str = record.findtext(".//situationRecordCreationTime")
            activation_time = parse_datetime(time_str)
            
            # Get direction
            dir_val = record.findtext(".//tpegDirection")
            if dir_val:
                direction = DIRECTION_MAP.get(dir_val, dir_val)
            dir_rel = record.findtext(".//directionRelative")
            if dir_rel and not direction:
                direction = DIRECTION_MAP.get(dir_rel, dir_rel)
            
            # Find coordinates in tpeglinearLocation or point
            to_point = record.find(".//to/pointCoordinates")
            if to_point is not None:
                lat_text = to_point.findtext("latitude")
                lng_text = to_point.findtext("longitude")
                if lat_text and lng_text:
                    lat = float(lat_text)
                    lng = float(lng_text)
            
            if lat is None:
                from_point = record.find(".//from/pointCoordinates")
                if from_point is not None:
                    lat_text = from_point.findtext("latitude")
                    lng_text = from_point.findtext("longitude")
                    if lat_text and lng_text:
                        lat = float(lat_text)
                        lng = float(lng_text)
            
            # Get road name from descriptors
            for name_elem in record.findall(".//name"):
                desc_type = name_elem.findtext("tpegDescriptorType")
                if desc_type == "linkName":
                    road_name = name_elem.findtext("descriptor/value")
                elif desc_type == "townName":
                    municipality = name_elem.findtext("descriptor/value")
                elif desc_type == "other":
                    province = name_elem.findtext("descriptor/value")
            
            # Try to get from roadName element
            if not road_name:
                road_name = record.findtext(".//roadName/value")
            if not road_name:
                road_name = record.findtext(".//roadNumber")
            
            # Get administrative area (province)
            if not province:
                province = record.findtext(".//administrativeArea/value")
            
            # Get PK
            pk = record.findtext(".//referencePointDistance")
            
            # Determine incident type from record type or other fields
            incident_type = record_type.replace("_0:", "").replace("Works", "roadMaintenance")
            if not incident_type:
                incident_type = "unknown"
            
            if lat is not None and lng is not None:
                beacons.append(ParsedBeacon(
                    external_id=record_id,
                    lat=lat,
                    lng=lng,
                    incident_type=incident_type,
                    road_name=road_name,
                    severity=None,
                    municipality=municipality,
                    province=province,
                    direction=direction,
                    pk=pk,
                    autonomous_community=autonomous_community,
                    activation_time=activation_time,
                ))
    
    logger.info(f"Parsed {len(beacons)} beacons from v1.0 feed")
    return beacons
