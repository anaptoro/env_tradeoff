import csv
import os
from pathlib import Path
from model import Session
from model.compensation import Compensation, SpeciesStatus
from model.patch_compensation import PatchCompensation
from model.app_compensation import AppCompensation



BASE_DIR = Path(__file__).resolve().parent.parent
FEDERAL_CSV = BASE_DIR / "federal_compensation.csv"
PATCH_CSV = BASE_DIR / "patch_compensation.csv"
_STATUS_LOADED = False
_app_loaded = False
STATUS_CSV_PATH = BASE_DIR / "species_status.csv"
APP_CSV = BASE_DIR / "app_compensation.csv"



def load_compensacao_from_csv_once(force: bool = False):
    session = Session()

    
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
            group = row["group"].strip()
            municipality = row["municipality"].strip()
            comp = int(row["compensation"])

            
            end_str = row.get("endangered", "").strip()
            if not end_str:
                endangered = 1.0
            else:
                try:
                    endangered = float(end_str)
                except ValueError:
                    endangered = 1.0   

            rows.append(
                Compensation(
                    group=group,
                    municipality=municipality,
                    compensation=comp,
                    endangered=endangered,
                )
            )

    if rows:
        session.add_all(rows)
        session.commit()
        print("Compensation table loaded from CSV")

    session.close()


# model/utils.py  (relevant part)
def load_patch_compensacao_from_csv_once():
    session = Session()

    # If there's already data, don't reload
    if session.query(PatchCompensation).first():
        session.close()
        print("Patch compensation table already populated.")
        return

    csv_path = Path(".") / "patch_compensation.csv"

    with csv_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            municipality = row["municipality"].strip()
            successional_stage = row.get("successional_stage", "").strip().lower() or None
            compensation_m2 = float(row["compensation_m2"])

            pc = PatchCompensation(
                municipality=municipality,
                compensation_m2=compensation_m2,
                successional_stage=successional_stage,
            )
            session.add(pc)

    session.commit()
    session.close()
    print("Patch compensation table loaded from CSV.")


def load_species_status_from_csv_once():
    global _STATUS_LOADED
    if _STATUS_LOADED:
        return

    session = Session()
    try:
        
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
                family = (raw_row.get("family") or "").strip()
                specie = (raw_row.get("specie") or raw_row.get("species") or "").strip()
                status = (raw_row.get("status") or "").strip()

                if not family or not specie or not status:
                    continue  

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

def load_app_compensacao_from_csv_once(force: bool = False):
    """Carrega app_compensation.csv uma única vez na tabela app_compensation."""
    global _app_loaded

    session = Session()

    if not force:
        # já tem dados? não recarrega
        if session.query(AppCompensation).count() > 0:
            session.close()
            _app_loaded = True
            print("App compensation table already populated.")
            return

    if not APP_CSV.exists():
        print(f"APP CSV not found at {APP_CSV}")
        session.close()
        return

    if force:
        session.query(AppCompensation).delete()
        session.commit()

    rows = []
    seen = set()

    with APP_CSV.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            muni = (row.get("municipality") or "").strip()
            if not muni:
                continue
            if muni in seen:
                continue
            seen.add(muni)

            comp_str = row.get("compensation")
            if comp_str is None:
                continue
            try:
                comp = float(comp_str)
            except ValueError:
                continue

            rows.append(
                AppCompensation(
                    municipality=muni,
                    compensation=comp,
                )
            )

    if rows:
        session.add_all(rows)
        session.commit()
        print("App compensation table loaded from CSV.")

    session.close()
    _app_loaded = True
