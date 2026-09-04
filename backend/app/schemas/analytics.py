from datetime import date, datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class FleetUtilizationResponse(BaseModel):
    fleet_utilization_rate_pct: float = 0.0
    utilized_vehicles: int = 0
    total_active_vehicles: int = 0
    total_vehicles: int = 0
    status_counts: dict[str, int]
    status_percentages: dict[str, float]


class DriverPerformanceItem(BaseModel):
    driver_id: UUID
    driver_name: str | None = None
    email: str | None = None
    license_number: str | None = None
    trips_completed: int = 0
    total_delivered_shipments: int = 0
    on_time_deliveries: int = 0
    delayed_deliveries: int = 0
    on_time_rate_pct: float | None = None
    attendance_rate_pct: float | None = None
    attendance_summary: dict = {}


class DriverPerformanceResponse(BaseModel):
    total_drivers: int
    drivers: list[DriverPerformanceItem]


class DeliveryPerformanceResponse(BaseModel):
    total_shipments: int
    delivered_count: int
    on_time_count: int
    delayed_count: int
    in_transit_count: int
    cancelled_count: int
    on_time_rate_pct: float | None = None
    delayed_rate_pct: float | None = None
    average_delivery_time_hours: float | None = None


class CostPerVehicleItem(BaseModel):
    vehicle_id: UUID
    registration_number: str | None = None
    brand_model: str | None = None
    total_maintenance_cost: float
    record_count: int


class MaintenanceFrequencyItem(BaseModel):
    service_type: str
    count: int
    total_cost: float


class MaintenanceAnalyticsResponse(BaseModel):
    total_maintenance_records: int
    total_maintenance_cost: float
    cost_per_vehicle: list[CostPerVehicleItem]
    frequency_by_type: list[MaintenanceFrequencyItem]


class FuelEfficiencyItem(BaseModel):
    vehicle_id: UUID
    registration_number: str | None = None
    assigned_driver_name: str | None = None
    total_distance_km: float
    total_fuel_liters: float
    total_fuel_cost: float
    fuel_efficiency_km_per_liter: float | None = None
    notes: str = "Approximated by correlating vehicle trip distances with total logged fuel refill liters."


class FuelEfficiencyResponse(BaseModel):
    fleet_avg_km_per_liter: float | None = None
    vehicles: list[FuelEfficiencyItem]


class VehicleFuelTrendItem(BaseModel):
    month: str
    liters: float
    cost: float
    record_count: int


class VehicleFuelTrendResponse(BaseModel):
    vehicle_id: UUID
    registration_number: str | None = None
    total_liters: float
    total_cost: float
    avg_cost_per_liter: float | None = None
    monthly_trends: list[VehicleFuelTrendItem]


class ShipmentVolumeTrendItem(BaseModel):
    period: str
    count: int


class OperationalSummaryResponse(BaseModel):
    period_total_shipments: int
    active_dispatches_count: int
    delayed_shipments_count: int
    fleet_utilization_pct: float | None = None
    shipment_volume_trend: list[ShipmentVolumeTrendItem]
