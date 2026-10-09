from datetime import date

from fastapi import FastAPI
from pydantic import BaseModel, Field, field_validator

app = FastAPI(
    title="Car Value Service",
    description="Микросервис расчёта ориентировочной стоимости автомобиля",
    version="1.0.0"
)

BASE_PRICE = 4_000_000
NORMAL_MILEAGE_PER_YEAR = 15_000


class CarRequest(BaseModel):
    year: int = Field(ge=1980)
    mileage: int = Field(ge=0, le=1_500_000)

    @field_validator("year")
    @classmethod
    def validate_year(cls, value):
        if value > date.today().year:
            raise ValueError("Год выпуска не может быть в будущем")
        return value


@app.get("/health")
def health():
    return {"status": "ok", "service": "car-value"}


@app.post("/estimate")
def estimate_car(car: CarRequest):
    current_year = date.today().year
    age = current_year - car.year

    # Амортизация автомобиля по возрасту
    age_factor = 1.0

    for year_number in range(1, age + 1):
        if year_number == 1:
            age_factor *= 0.85
        elif year_number <= 3:
            age_factor *= 0.90
        elif year_number <= 7:
            age_factor *= 0.93
        else:
            age_factor *= 0.95

    # Сравнение фактического пробега с нормативным
    expected_mileage = age * NORMAL_MILEAGE_PER_YEAR
    mileage_difference = car.mileage - expected_mileage

    if mileage_difference > 0:
        mileage_factor = 1 - (
            mileage_difference / 10_000 * 0.018
        )
    else:
        mileage_factor = 1 + (
            abs(mileage_difference) / 10_000 * 0.008
        )

    mileage_factor = max(0.55, min(1.08, mileage_factor))

    # Итоговая стоимость с округлением до 1000 рублей
    estimated_value = round(
        BASE_PRICE * age_factor * mileage_factor / 1000
    ) * 1000

    price_min = round(estimated_value * 0.93 / 1000) * 1000
    price_max = round(estimated_value * 1.07 / 1000) * 1000

    annual_mileage = round(car.mileage / max(age, 1))

    if annual_mileage < 10_000:
        mileage_category = "Низкий"
    elif annual_mileage <= 20_000:
        mileage_category = "Нормальный"
    else:
        mileage_category = "Высокий"

    depreciation_percent = round(
        max(0, (1 - estimated_value / BASE_PRICE) * 100), 1
    )

    return {
        "year": car.year,
        "mileage": car.mileage,
        "vehicle_age": age,
        "annual_mileage": annual_mileage,
        "mileage_category": mileage_category,
        "estimated_value": estimated_value,
        "price_min": price_min,
        "price_max": price_max,
        "depreciation_percent": depreciation_percent,
        "currency": "RUB",
        "model_note": "Ориентировочная оценка по учебной модели"
    }
