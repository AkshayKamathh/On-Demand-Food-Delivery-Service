from fastapi import APIRouter, HTTPException
from typing import List
from schemas.inventory import InventoryItem, InventoryUpdate, InventoryCreate

router = APIRouter(prefix="/inventory", tags=["inventory"])

#Mock data in memory instead of database for now
INVENTORY_DB = {
    "APL-001": InventoryItem(sku="APL-001", name="Organic Apples", category="Fruits", price=2.49, weight_lb=1.0, stock=42, status="In Stock"),
    "BAN-002": InventoryItem(sku="BAN-002", name="Organic Bananas", category="Fruits", price=1.99, weight_lb=2.0, stock=8, status="Low Stock"),
    "KAL-003": InventoryItem(sku="KAL-003", name="Organic Kale", category="Vegetables", price=3.49, weight_lb=0.5, stock=0, status="Out of Stock"),
}

#GET /inventory
@router.get("/", response_model=List[InventoryItem])
def list_inventory():
    #Return all items as a list
    return list(INVENTORY_DB.values())

#GET /inventory/{sku}
@router.get("/{sku}", response_model=InventoryItem)
def get_inventory_item(sku: str):
    item = INVENTORY_DB.get(sku)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

#PATCH /inventory/{sku}
@router.patch("/{sku}", response_model=InventoryItem)
def update_inventory_item(sku: str, payload: InventoryUpdate):
    item = INVENTORY_DB.get(sku)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    updated = item.model_copy(update=payload.model_dump(exclude_unset=True))

    #Inventory stock business rules:
    if updated.stock < 0:
        raise HTTPException(status_code=400, detail="Stock cannot be negative")

    #Auto-status rule
    if updated.stock == 0:
        updated = updated.model_copy(update={"status": "Out of Stock"})

    INVENTORY_DB[sku] = updated
    return updated

#DELETE /inventory/{sku}
@router.delete("/{sku}")
def delete_inventory_item(sku: str):
    if sku not in INVENTORY_DB:
        raise HTTPException(status_code=404, detail="Item not found")
    del INVENTORY_DB[sku]
    return {"deleted": sku}

#POST /inventory
@router.post("/", response_model=InventoryItem, status_code=201)
def create_inventory_item(payload: InventoryCreate):
    sku = payload.sku.strip()

    if not sku:
        raise HTTPException(status_code=400, detail="SKU is required")

    if sku in INVENTORY_DB:
        raise HTTPException(status_code=409, detail="SKU already exists")

    if payload.stock < 0:
        raise HTTPException(status_code=400, detail="Stock cannot be negative")

    item = InventoryItem(**payload.model_dump())

    # Optional: auto-status based on stock
    if item.stock == 0:
        item = item.model_copy(update={"status": "Out of Stock"})

    INVENTORY_DB[sku] = item
    return item