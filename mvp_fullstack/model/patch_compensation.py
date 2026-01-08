from sqlalchemy import Column, String, Integer, Float, UniqueConstraint
from model import Base


class PatchCompensation(Base):
    __tablename__ = "patch_compensation"

    id = Column(Integer, primary_key=True)
    municipality = Column(String, nullable=False)
    successional_stage = Column(String, nullable=True)  # NEW COLUMN
    compensation_m2 = Column(Float, nullable=False)

    def __init__(self, municipality, compensation_m2, successional_stage=None):
        """
        Custom __init__ that *does* accept successional_stage,
        so PatchCompensation(..., successional_stage=...) works.
        """
        self.municipality = municipality
        self.compensation_m2 = compensation_m2
        self.successional_stage = successional_stage

    def __repr__(self) -> str:
        return (
            f"<PatchCompensation(municipality={self.municipality!r}, "
            f"successional_stage={self.successional_stage!r}, "
            f"compensation_m2={self.compensation_m2})>"
        )