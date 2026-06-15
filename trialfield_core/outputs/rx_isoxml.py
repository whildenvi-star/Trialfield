"""Write ISO 11783-10 (ISOXML) variable-rate prescription.

Produces a TASKDATA.XML with polygon treatment zones, compatible with
John Deere Operations Center, Trimble, CNH (Case/New Holland), and AGCO displays.
Returns None for categorical trials.
"""

from __future__ import annotations

import io
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Optional

from trialfield_core.geometry.plots import PlotRecord


def _polygon_element(coords: list[tuple[float, float]]) -> ET.Element:
    """Build an ISOXML <PLN> polygon element from WGS84 (lon, lat) tuples."""
    pln = ET.Element("PLN", A="1")  # A="1" = boundary type
    lsg = ET.SubElement(pln, "LSG", A="1")  # A="1" = exterior ring
    for lon, lat in coords:
        ET.SubElement(lsg, "PNT", A="2", C=f"{lat:.8f}", D=f"{lon:.8f}")
    return pln


def write_rx_isoxml(
    plots: list[PlotRecord],
    trial_name: str,
    out_dir: Path,
) -> Optional[Path]:
    """Write ISO 11783-10 prescription zip.

    Returns None (and writes nothing) for categorical trials.
    Output: {trial_name}_Rx_ISOXML.zip containing TASKDATA.XML.
    """
    if not plots or plots[0].treatment.is_categorical:
        return None

    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{trial_name}_Rx_ISOXML.zip"

    unit = plots[0].treatment.unit or "unit"

    iso = ET.Element("ISO11783_TaskData", {
        "VersionMajor": "4",
        "VersionMinor": "0",
        "ManagementSoftwareManufacturer": "Trialfield",
        "ManagementSoftwareName": "Trialfield",
        "DataTransferOrigin": "1",
    })

    # Product definition
    pdt = ET.SubElement(iso, "PDT", A="PDT1", B=trial_name, C=unit)
    _ = pdt  # referenced by TZN below

    # Task with variable-rate treatment zones
    tsk = ET.SubElement(iso, "TSK", A="TSK1", B=trial_name, G="1")

    for i, p in enumerate(plots, start=1):
        v = p.treatment.value
        rate = int(v) if v == int(v) else v  # type: ignore[arg-type]
        tzn_id = f"TZN{i}"
        tzn = ET.SubElement(tsk, "TZN", A=tzn_id)
        tzn.append(_polygon_element(p.polygon_wgs84))
        ET.SubElement(tzn, "TZA", A="PDT1", B=str(rate))

    tree = ET.ElementTree(iso)
    ET.indent(tree, space="  ")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        xml_bytes = io.BytesIO()
        tree.write(xml_bytes, encoding="UTF-8", xml_declaration=True)
        zf.writestr("TASKDATA.XML", xml_bytes.getvalue())

    out_path.write_bytes(buf.getvalue())
    return out_path
