
from flask import Blueprint, request, jsonify, session

from services.shop_service import (
    ShopError,
    get_shop_items,
    get_student_wallet,
    get_student_inventory,
    purchase_decoration
)

from services.decoration_service import (
    DecorationError,
    update_decoration_placement,
    unbox_decoration
)


shop_bp = Blueprint("shop", __name__)


def current_student_id():
    return session.get("student_id")


@shop_bp.route("/api/shop/items", methods=["GET"])
def shop_items():
    if not current_student_id():
        return jsonify({"error": "Not logged in."}), 401

    return jsonify({
        "items": get_shop_items()
    })


@shop_bp.route("/api/shop/wallet", methods=["GET"])
def shop_wallet():
    student_id = current_student_id()

    if not student_id:
        return jsonify({"error": "Not logged in."}), 401

    return jsonify(get_student_wallet(student_id))


@shop_bp.route("/api/shop/inventory", methods=["GET"])
def shop_inventory():
    student_id = current_student_id()

    if not student_id:
        return jsonify({"error": "Not logged in."}), 401

    return jsonify({
        "items": get_student_inventory(student_id)
    })


@shop_bp.route("/api/shop/purchase", methods=["POST"])
def shop_purchase():
    student_id = current_student_id()

    if not student_id:
        return jsonify({"error": "Not logged in."}), 401

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON body."}), 400

    item_id = data.get("item_id")

    if type(item_id) is not int or item_id <= 0:
        return jsonify({"error": "Invalid item_id."}), 400

    try:
        result = purchase_decoration(student_id, item_id)
        return jsonify(result), 201

    except ShopError as error:
        return jsonify({"error": str(error)}), 400


@shop_bp.route("/api/shop/place", methods=["POST"])
def shop_place():
    student_id = current_student_id()

    if not student_id:
        return jsonify({"error": "Not logged in."}), 401

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON body."}), 400

    inventory_id = data.get("inventory_id")

    if type(inventory_id) is not int or inventory_id <= 0:
        return jsonify({
            "error": "Invalid inventory_id."
        }), 400

    try:
        result = update_decoration_placement(
            student_id=student_id,
            inventory_id=inventory_id,
            is_placed=data.get("is_placed"),
            position_x=data.get("position_x"),
            position_y=data.get("position_y")
        )
        return jsonify(result)

    except DecorationError as error:
        return jsonify({"error": str(error)}), 400


@shop_bp.route("/api/shop/unbox", methods=["POST"])
def shop_unbox():
    student_id = current_student_id()

    if not student_id:
        return jsonify({"error": "Not logged in."}), 401

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON body."}), 400

    inventory_id = data.get("inventory_id")

    if type(inventory_id) is not int or inventory_id <= 0:
        return jsonify({"error": "Invalid inventory_id."}), 400

    try:
        return jsonify(unbox_decoration(student_id, inventory_id))
    except DecorationError as error:
        return jsonify({"error": str(error)}), 400
