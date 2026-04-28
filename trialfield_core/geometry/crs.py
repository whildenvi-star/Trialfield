"""Auto UTM zone selection and cached pyproj Transformer construction."""

from functools import lru_cache

from pyproj import CRS, Transformer


def utm_epsg(lon: float, lat: float) -> int:
    """Return the EPSG code for the UTM zone containing (lon, lat)."""
    zone = int((lon + 180) / 6) + 1
    if lat >= 0:
        return 32600 + zone
    return 32700 + zone


@lru_cache(maxsize=16)
def wgs84_to_utm(epsg: int) -> Transformer:
    """Return a cached Transformer from WGS84 to the given UTM EPSG."""
    return Transformer.from_crs(CRS("EPSG:4326"), CRS(f"EPSG:{epsg}"), always_xy=True)


@lru_cache(maxsize=16)
def utm_to_wgs84(epsg: int) -> Transformer:
    """Return a cached Transformer from the given UTM EPSG to WGS84."""
    return Transformer.from_crs(CRS(f"EPSG:{epsg}"), CRS("EPSG:4326"), always_xy=True)
