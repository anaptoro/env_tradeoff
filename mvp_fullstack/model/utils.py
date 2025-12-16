import csv
from pathlib import Path
from model import Session
from model.compensation import Compensation
from model.patch_compensation import PatchCompensation

BASE_DIR = Path(__file__).resolve().parent.parent
FEDERAL_CSV = BASE_DIR / "federal_compensation.csv"
PATCH_CSV = BASE_DIR / "patch_compensation.csv"

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
                    name=row["name"].strip(),
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
