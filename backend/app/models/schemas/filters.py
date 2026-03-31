"""Universal filter parameters — reusable across all fund-listing endpoints."""

from decimal import Decimal
from typing import Literal, Optional

from fastapi import Query
from pydantic import BaseModel


PLAN_TYPE_TO_PURCHASE_MODE = {
    "all": None,
    "regular": 1,
    "direct": 2,
}


class UniversalFilterParams(BaseModel):
    """Reusable filter query params for all fund-listing endpoints."""

    plan_type: Literal["all", "regular", "direct"] = "all"
    fund_type: str = "all"  # "all", "equity", "debt", "hybrid", or any broad_category
    min_aum: Optional[Decimal] = None  # In crores
    max_aum: Optional[Decimal] = None  # In crores
    category: Optional[str] = None  # Exact match on category_name
    amc: Optional[str] = None  # Exact match on amc_name
    search: Optional[str] = None  # ILIKE on fund_name

    @property
    def purchase_mode(self) -> Optional[int]:
        """Convert plan_type string to DB purchase_mode integer."""
        return PLAN_TYPE_TO_PURCHASE_MODE.get(self.plan_type)

    @property
    def broad_category(self) -> Optional[str]:
        """Convert fund_type to broad_category filter. None means no filter."""
        if self.fund_type == "all":
            return None
        return self.fund_type.capitalize()


def get_filter_params(
    plan_type: str = Query(default="all", description="all | regular | direct"),
    fund_type: str = Query(default="all", description="all | equity | debt | hybrid"),
    min_aum: Optional[float] = Query(default=None, description="Min AUM in crores"),
    max_aum: Optional[float] = Query(default=None, description="Max AUM in crores"),
    category: Optional[str] = Query(default=None, description="SEBI category name"),
    amc: Optional[str] = Query(default=None, description="AMC name"),
    search: Optional[str] = Query(default=None, description="Fund name search"),
) -> UniversalFilterParams:
    """FastAPI dependency for universal filter params."""
    return UniversalFilterParams(
        plan_type=plan_type,
        fund_type=fund_type,
        min_aum=Decimal(str(min_aum)) if min_aum is not None else None,
        max_aum=Decimal(str(max_aum)) if max_aum is not None else None,
        category=category,
        amc=amc,
        search=search,
    )
