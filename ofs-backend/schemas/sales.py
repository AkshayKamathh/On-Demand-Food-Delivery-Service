from typing import List

from pydantic import BaseModel


class SalesStats(BaseModel):
    total_revenue: float
    total_orders: int
    unique_customers: int
    items_sold: int


class MonthlyRevenuePoint(BaseModel):
    month: str
    revenue: float


class CategoryBreakdownItem(BaseModel):
    category: str
    revenue: float
    pct: float


class TopProductItem(BaseModel):
    name: str
    sku: str
    units: int
    revenue: float


class SalesSummaryResponse(BaseModel):
    year: int
    stats: SalesStats
    monthly_revenue: List[MonthlyRevenuePoint]
    category_breakdown: List[CategoryBreakdownItem]
    top_products: List[TopProductItem]
