from sqlalchemy import Column, String, Integer, Float, UniqueConstraint
from model import Base


class PatchCompensation(Base):
    __tablename__ = "patch_compensation"

    id = Column(Integer, primary_key=True, autoincrement=True)
    municipality = Column(String(), nullable=False)
    compensation_m2 = Column(Float, nullable=False)

    __table_args__ = (
        UniqueConstraint("municipality", name="uix_patch_muni"),
    )

    def __init__(self, municipality: str, compensation_m2: float):
        self.municipality = municipality
        self.compensation_m2 = compensation_m2
