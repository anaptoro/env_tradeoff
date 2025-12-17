from sqlalchemy import Column, Integer, String, Float, UniqueConstraint
from model import Base


class AppCompensation(Base):
    __tablename__ = "app_compensation"

    id = Column(Integer, primary_key=True, autoincrement=True)
    municipality = Column(String(), nullable=False)
    compensation = Column(Float, nullable=False) 

    __table_args__ = (
        UniqueConstraint("municipality", name="uix_app_muni"),
    )

    def __init__(self, municipality: str, compensation: float):
        self.municipality = municipality
        self.compensation = compensation
