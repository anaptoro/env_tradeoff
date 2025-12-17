from flask import Flask, request, jsonify
from flask_cors import CORS

from model import Session
from model.compensation import Compensation
from model.patch_compensation import PatchCompensation
from model.utils import load_compensacao_from_csv_once, load_patch_compensacao_from_csv_once

app = Flask(__name__)
CORS(app)

@app.before_first_request
def init_compensation():
    load_compensacao_from_csv_once()
    load_patch_compensacao_from_csv_once()

@app.route('/')
def home():
    return jsonify({
        "status": "ok",
        "message": "Tree compensation API is running"
    }), 200


@app.route('/api/municipios', methods=['GET'])
def listar_municipios():
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
    data = request.get_json() or {}

    items = data.get("items")
    if not isinstance(items, list) or not items:
        return jsonify({"error": "You need to sen a list with at least one item"}), 400

    session = Session()
    resultados = []
    total_geral = 0
    itens_sem_regra = []

    for idx, item in enumerate(items):
        municipality = item.get("municipality")
        group = item.get("group")
        quantidade = item.get("quantidade")

        if not municipality or quantidade is None:
            itens_sem_regra.append({
                "index": idx,
                "motivo": "Municipality and quantity cant be None",
                "item": item
            })
            continue

        try:
            quantidade = int(quantidade)
        except ValueError:
            itens_sem_regra.append({
                "index": idx,
                "motivo": "Quantity must be an Integer value",
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
                "Filters used:": {
                    "municipality": municipality,
                    "group": group
                }
            })
            continue

        total_item = quantidade * regra.compensation
        total_geral += total_item

        resultados.append({
            "municipality": municipality,
            "group": group,
            "quantidade": quantidade,
            "compensacao_por_arvore": regra.compensation,
            "compensacao_total_item": total_item
        })

    session.close()

    return jsonify({
        "processed items": resultados,
        "total compensation": total_geral,
        "items without compensation": itens_sem_regra
    }), 200

@app.route('/api/compensacao/patch', methods=['POST'])
def calcular_compensacao_patch():
    data = request.get_json() or {}
    print("Received data for patch:", data)  # debug

    patches = data.get("patches")
    if not isinstance(patches, list) or not patches:
        return jsonify({"erro": "Envie uma lista 'patches' com pelo menos um elemento"}), 400

    session = Session()

    resultados = []
    total_geral = 0.0
    patches_sem_regra = []

    for idx, patch in enumerate(patches):
        municipality = patch.get("municipality")
        area_m2 = patch.get("area_m2")

        # Campos obrigatórios
        missing = []
        if not municipality:
            missing.append("municipality")
        if area_m2 is None:
            missing.append("area_m2")

        if missing:
            patches_sem_regra.append({
                "index": idx,
                "motivo": f"Campos obrigatórios faltando ({', '.join(missing)})",
                "item": patch
            })
            continue

        # Converte área para número
        try:
            area_m2 = float(area_m2)
        except (TypeError, ValueError):
            patches_sem_regra.append({
                "index": idx,
                "motivo": "area_m2 não é número",
                "item": patch
            })
            continue

        # Busca regra na tabela PatchCompensation
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

        # Supondo coluna 'compensation_m2' no modelo PatchCompensation
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

