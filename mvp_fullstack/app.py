from flask import Flask, request, jsonify
from flask_cors import CORS
from flasgger import Swagger 

from model import Session
from model.compensation import Compensation, SpeciesStatus
from model.patch_compensation import PatchCompensation
from model.app_compensation import AppCompensation
from model.utils import load_compensacao_from_csv_once,load_patch_compensacao_from_csv_once,load_species_status_from_csv_once,load_app_compensacao_from_csv_once

app = Flask(__name__)
CORS(app)

app.config["SWAGGER"] = {
    "title": "Environmental trade-off API", 
    "uiversion": 3
}
swagger = Swagger(app)

STATUS_DESCRIPTIONS = {
    "family": "ACANTHACEAE",
    "specie": "Aphelandra squarrosa Nees",
    "status": "EW",
    "descricao": "Presumed extinct in the wild"
  }

@app.before_first_request
def init_compensation():
    load_compensacao_from_csv_once()
    load_patch_compensacao_from_csv_once()
    load_species_status_from_csv_once()
    load_app_compensacao_from_csv_once()

@app.route('/')
def home():
    """
    Healthcheck da API.

    ---
    tags:
      - Info
    responses:
      200:
        description: API is running
        content:
          application/json:
            schema:
              type: object
              properties:
                status:
                  type: string
                message:
                  type: string
    """
    return jsonify({
        "status": "ok",
        "message": "Tree trade-off API is running"
    }), 200

@app.route("/api/app_municipios", methods=["GET"])
def listar_app_municipios():
    session = Session()
    rows = (
        session.query(AppCompensation.municipality)
        .distinct()
        .order_by(AppCompensation.municipality)
        .all()
    )
    municipios = [r[0] for r in rows if r[0]]
    session.close()
    return jsonify({"municipios": municipios}), 200



@app.route("/api/species/status")
def get_species_status():
    """
    Verification of species status, goal is to double check if its endangered or not

    ---
    tags:
      - Species status
    parameters:
      - name: family
        in: query
        required: false
        schema:
          type: string
        description: Family name
      - name: specie
        in: query
        required: false
        schema:
          type: string
        description: Specie name
    responses:
      200:
        description: List of found species/families
        content:
          application/json:
            schema:
              type: array
              items:
                type: object
                properties:
                  family:
                    type: string
                  specie:
                    type: string
                  status:
                    type: string
                  descricao:
                    type: string
    """
    family = request.args.get("family", "").strip()
    specie = request.args.get("specie", "").strip()  
    session = Session()
    try:
        q = session.query(SpeciesStatus)

        if family:
            
            q = q.filter(SpeciesStatus.family.ilike(f"%{family}%"))
        if specie:
            
            q = q.filter(SpeciesStatus.specie.ilike(f"%{specie}%"))

        rows = q.all()

        
        result = [
            {
                "family": row.family,
                "specie": row.specie,  
                "status": row.status,
                "description": STATUS_DESCRIPTIONS.get(row.status, ""),
            }
            for row in rows
        ]

        return jsonify(result), 200
    finally:
        session.close()


@app.route('/api/municipios', methods=['GET'])
def listar_municipios():
    """
    Lists the municipalities with trade-off values for isolated trees.

    ---
    tags:
      - Isolated trees
    responses:
      200:
        description: Municipalities list
        content:
          application/json:
            schema:
              type: object
              properties:
                municipios:
                  type: array
                  items:
                    type: string
    """
    session = Session()
    rows = (
        session.query(Compensation.municipality)
        .distinct()
        .order_by(Compensation.municipality)
        .all()
    )
    municipios = [r[0] for r in rows if r[0]]
    session.close()
    return jsonify({"municipios": municipios}), 200

@app.route("/api/patch_municipios", methods=["GET"])
def listar_patch_municipios():
    """
    Lists the municipalities with trade-off values for patches.

    ---
    tags:
      - Patches
    responses:
      200:
        description: Municipalities list
        content:
          application/json:
            schema:
              type: object
              properties:
                municipios:
                  type: array
                  items:
                    type: string
    """
    session = Session()
    rows = (
        session.query(PatchCompensation.municipality)
        .distinct()
        .order_by(PatchCompensation.municipality)
        .all()
    )
    municipios = [r[0] for r in rows if r[0]]
    session.close()
    return jsonify({"municipios": municipios}), 200


@app.route('/api/compensacao/lote', methods=['POST'])
def calcular_compensacao_lote():
    """
    Calculate trade-off for a batch of isolated trees.

    ---
    tags:
      - Isolated trees
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        description: List of isolated tree items
        schema:
          type: object
          properties:
            items:
              type: array
              items:
                type: object
                properties:
                  municipality:
                    type: string
                    example: piracicaba
                  group:
                    type: string
                    example: native
                  quantidade:
                    type: integer
                    example: 5
                  endangered:
                    type: boolean
                    example: true
    responses:
      200:
        description: Trade-off calculation result
      400:
        description: Invalid input
    """
    data = request.get_json() or {}

    items = data.get("items")
    if not isinstance(items, list) or not items:
        return jsonify({"error": "You need to send a list with at least one item"}), 400

    session = Session()
    resultados = []
    total_geral = 0
    itens_sem_regra = []

    for idx, item in enumerate(items):
        municipality = item.get("municipality")
        group = item.get("group")
        quantidade = item.get("quantidade")
        endangered_flag = item.get("endangered", False)  

        if not municipality or quantidade is None:
            itens_sem_regra.append({
                "index": idx,
                "motivo": "Municipality and quantity can't be None",
                "item": item
            })
            continue

        try:
            quantidade = int(quantidade)
        except ValueError:
            itens_sem_regra.append({
                "index": idx,
                "motivo": "Quantity must be an integer",
                "item": item
            })
            continue

        query = session.query(Compensation).filter(
            Compensation.municipality == municipality,
        )
        if group:
            query = query.filter(Compensation.group == group)

        regra = query.first()
        if not regra:
            itens_sem_regra.append({
                "index": idx,
                "motivo": "No rule found",
                "filters_used": {
                    "municipality": municipality,
                    "group": group
                }
            })
            continue

        is_endangered = False
        if isinstance(endangered_flag, bool):
            is_endangered = endangered_flag
        elif isinstance(endangered_flag, str):
            is_endangered = endangered_flag.strip().lower() in ("true", "1", "yes", "sim")

        base_comp = regra.compensation
        multiplier = 1.0
        if is_endangered:
            
            multiplier = regra.endangered or 1.0

        comp_por_arvore = base_comp * multiplier
        total_item = quantidade * comp_por_arvore
        total_geral += total_item

        resultados.append({
            "municipality": municipality,
            "group": group,
            "quantidade": quantidade,
            "endangered": is_endangered,
            "compensacao_base": base_comp,
            "multiplicador_endangered": multiplier,
            "compensacao_por_arvore": comp_por_arvore,
            "compensacao_total_item": total_item,
        })

    session.close()

    return jsonify({
        "processed_items": resultados,
        "total_trade-off": total_geral,
        "items_without_trade-off": itens_sem_regra
    }), 200



@app.route('/api/compensacao/patch', methods=['POST'])
def calcular_compensacao_patch():
    """
    Trade-off calculation for patches(m²).

    ---
    tags:
      - Patch / talhão
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            patches:
              type: array
              items:
                type: object
                properties:
                  municipality:
                    type: string
                    example: piracicaba
                  area_m2:
                    type: number
                    example: 150.5
    responses:
      200:
        description: Patch trade-off
    """
    data = request.get_json() or {}
    print("Received data for patch:", data)  

    patches = data.get("patches")
    if not isinstance(patches, list) or not patches:
        return jsonify({"erro": "Send a list with at least one element"}), 400

    session = Session()

    resultados = []
    total_geral = 0.0
    patches_sem_regra = []

    for idx, patch in enumerate(patches):
        municipality = patch.get("municipality")
        area_m2 = patch.get("area_m2")

        
        missing = []
        if not municipality:
            missing.append("municipality")
        if area_m2 is None:
            missing.append("area_m2")

        if missing:
            patches_sem_regra.append({
                "index": idx,
                "motivo": f"Mandatory fields missing ({', '.join(missing)})",
                "item": patch
            })
            continue

        
        try:
            area_m2 = float(area_m2)
        except (TypeError, ValueError):
            patches_sem_regra.append({
                "index": idx,
                "motivo": "area_m2 is not a number",
                "item": patch
            })
            continue

        
        regra = (
            session.query(PatchCompensation)
            .filter(PatchCompensation.municipality == municipality)
            .first()
        )

        if not regra:
            patches_sem_regra.append({
                "index": idx,
                "motivo": "não existe regra de compensação para este município",
                "item": patch
            })
            continue

        
        comp_por_m2 = regra.compensation_m2
        total_patch = comp_por_m2 * area_m2
        total_geral += total_patch

        resultados.append({
            "municipality": municipality,
            "area_m2": area_m2,
            "compensacao_por_m2": comp_por_m2,
            "compensacao_total_patch": total_patch,
        })

    session.close()

    return jsonify({
        "patches_processados": resultados,
        "total_compensacao_geral": total_geral,
        "patches_sem_regra": patches_sem_regra,
    }), 200

@app.route("/api/compensacao/app", methods=["POST"])
def calcular_compensacao_app():
    """
    Estimates trade-off for PPAs.

    ---
    tags:
      - PPA
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            apps:
              type: array
              items:
                type: object
                properties:
                  municipality:
                    type: string
                    example: piracicaba
                  quantidade:
                    type: number
                    example: 2
    responses:
      200:
        description: Trade-off result for PPA
    """
    data = request.get_json() or {}
    apps = data.get("apps")

    if not isinstance(apps, list) or not apps:
        return jsonify({"erro": "Send a list with at least one element"}), 400

    session = Session()
    resultados = []
    total_geral = 0.0
    apps_sem_regra = []

    for idx, app_item in enumerate(apps):
        municipality = app_item.get("municipality")
        quantidade = app_item.get("quantidade", 1)

        missing = []
        if not municipality:
            missing.append("municipality")
        if quantidade is None:
            missing.append("quantidade")

        if missing:
            apps_sem_regra.append({
                "index": idx,
                "motivo": f"Campos obrigatórios faltando ({', '.join(missing)})",
                "item": app_item,
            })
            continue

        try:
            quantidade = float(quantidade)
        except (TypeError, ValueError):
            apps_sem_regra.append({
                "index": idx,
                "motivo": "quantidade não é número",
                "item": app_item,
            })
            continue

        regra = (
            session.query(AppCompensation)
            .filter(AppCompensation.municipality == municipality)
            .first()
        )

        if not regra:
            apps_sem_regra.append({
                "index": idx,
                "motivo": "There is no trade-off PPA rule for this municipality",
                "item": app_item,
            })
            continue

        comp_por_unidade = regra.compensation
        total_app = comp_por_unidade * quantidade
        total_geral += total_app

        resultados.append({
            "municipality": municipality,
            "quantidade": quantidade,
            "compensacao_por_unidade": comp_por_unidade,
            "compensacao_total_app": total_app,
        })

    session.close()

    return jsonify({
        "apps_processados": resultados,
        "total_compensacao_geral": total_geral,
        "apps_sem_regra": apps_sem_regra,
    }), 200
