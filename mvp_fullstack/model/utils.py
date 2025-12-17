import csv
import os
from pathlib import Path
from model import Session
from model.compensation import Compensation, SpeciesStatus
from model.patch_compensation import PatchCompensation

BASE_DIR = Path(__file__).resolve().parent.parent
FEDERAL_CSV = BASE_DIR / "federal_compensation.csv"
PATCH_CSV = BASE_DIR / "patch_compensation.csv"
_STATUS_LOADED = False
STATUS_CSV_PATH = BASE_DIR / "species_status.csv"


def load_compensacao_from_csv_once(force: bool = False):
    session = Session()

    # se não for force e já tiver dados, não recarrega
    if not force and session.query(Compensation).first():
        session.close()
        return

    csv_path = Path(".") / "federal_compensation.csv"
    if not csv_path.exists():
        print("No compensation file, skipping")
        session.close()
        return

    if force:
        session.query(Compensation).delete()
        session.commit()

    with csv_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = []
        for row in reader:
            rows.append(
                Compensation(
                    group=row["group"].strip(),
                    municipality=row["municipality"].strip(),
                    compensation=int(row["compensation"])
                )
            )

    session.add_all(rows)
    session.commit()
    session.close()
    print("Compensation table loaded from CSV")

def load_patch_compensacao_from_csv_once():
    """Carrega patch_compensation.csv uma única vez na tabela patch_compensation."""
    session = Session()
    count = session.query(PatchCompensation).count()
    if count > 0:
        session.close()
        print("Patch compensation table already populated.")
        return

    if not PATCH_CSV.exists():
        session.close()
        print(f"PATCH CSV not found at {PATCH_CSV}")
        return

    rows = []
    seen = set()

    with PATCH_CSV.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            muni = (row.get("municipality") or "").strip()
            if not muni:
                continue
            if muni in seen:
                # se estiver duplicado, ignoramos as próximas repetições
                continue
            seen.add(muni)

            comp_m2_str = row.get("compensation_m2")
            if comp_m2_str is None:
                continue
            try:
                comp_m2 = float(comp_m2_str)
            except ValueError:
                continue

            rows.append(
                PatchCompensation(
                    municipality=muni,
                    compensation_m2=comp_m2
                )
            )

    if rows:
        session.add_all(rows)
        session.commit()
        print("Patch compensation table loaded from CSV.")

    session.close()

def load_species_status_from_csv_once():
    global _STATUS_LOADED
    if _STATUS_LOADED:
        return

    session = Session()
    try:
        # if table already has rows, do nothing
        if session.query(SpeciesStatus).first():
            print("Species status table already populated.")
            _STATUS_LOADED = True
            return

        if not STATUS_CSV_PATH.exists():
            print(f"Species CSV not found at: {STATUS_CSV_PATH}")
            return

        with STATUS_CSV_PATH.open(newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)

            for raw_row in reader:
                # CSV header is "family,specie,status" (your example),
                # but the DB column is "species" → we map it:
                family = (raw_row.get("family") or "").strip()
                specie = (raw_row.get("specie") or raw_row.get("species") or "").strip()
                status = (raw_row.get("status") or "").strip()

                if not family or not specie or not status:
                    continue  # skip incomplete row

                session.add(
                    SpeciesStatus(
                        family=family,
                        specie=specie,
                        status=status,
                    )
                )

        session.commit()
        _STATUS_LOADED = True
        print("Species status table loaded from CSV.")

    except Exception as e:
        session.rollback()
        print("Error loading species status CSV:", e)
        raise
    finally:
        session.close()


