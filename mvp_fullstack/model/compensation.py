from sqlalchemy import Column, String, Integer, Float
from model import Base

class Compensation(Base):
    __tablename__ = "federal_compensation"

    id = Column(Integer, primary_key=True, autoincrement=True)
    group = Column(String())  
    municipality = Column(String())    
    compensation = Column(Integer)               
    endangered = Column(Integer, default=1)

    def __init__(self, group: str, municipality:str,compensation:int, endangered:int):
        self.group = group 
        self.municipality = municipality 
        self.compensation = compensation
        self.endangered = endangered

class SpeciesStatus(Base):
    __tablename__ = "species_status"

    id = Column(Integer, primary_key=True)
    family = Column(String, nullable=False, index=True)
    specie = Column(String, nullable=False, index=True)
    status = Column(String, nullable=False)