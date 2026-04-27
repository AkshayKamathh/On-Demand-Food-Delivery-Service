from decimal import Decimal

import pytest
from fastapi import HTTPException

from routers import checkout


def test_as_money_rounds_half_up():
    assert checkout.as_money(Decimal("1")) == Decimal("1.00")
    assert checkout.as_money(Decimal("1.234")) == Decimal("1.23")
    assert checkout.as_money(Decimal("1.235")) == Decimal("1.24")


def test_delivery_fee_for_weight_threshold():
    assert checkout.delivery_fee_for_weight(Decimal("0")) == Decimal("0.00")
    assert checkout.delivery_fee_for_weight(Decimal("20")) == Decimal("0.00")
    assert checkout.delivery_fee_for_weight(Decimal("20.0001")) == Decimal("10.00")


def test_build_checkout_summary_computes_totals_and_fee():
    rows = [
        {
            "item_id": 1,
            "description": "Apples",
            "quantity": 2,
            "price": Decimal("3.00"),
            "weight": Decimal("12.5"),
        },
        {
            "item_id": 2,
            "description": "Bananas",
            "quantity": 1,
            "price": Decimal("4.00"),
            "weight": Decimal("1.0"),
        },
    ]

    summary = checkout.build_checkout_summary(rows)

    assert summary.subtotal == pytest.approx(10.00)
    assert summary.total_weight == pytest.approx(26.0)
    assert summary.delivery_fee == pytest.approx(10.00)
    assert summary.total == pytest.approx(20.00)
    assert len(summary.items) == 2


def test_build_checkout_summary_rejects_overweight_order():
    rows = [
        {
            "item_id": 1,
            "description": "Heavy thing",
            "quantity": 1,
            "price": Decimal("1.00"),
            "weight": Decimal("201"),
        }
    ]
    with pytest.raises(HTTPException) as exc:
        checkout.build_checkout_summary(rows)
    assert exc.value.status_code == 409

