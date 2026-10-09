import os
from datetime import date
from uuid import uuid4

import httpx
import psycopg

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from psycopg.rows import dict_row
from pydantic import BaseModel, Field, field_validator


app = FastAPI(
    title="Car Value API",
    description="Backend сервиса оценки стоимости автомобилей",
    version="1.0.0"
)

DATABASE_URL = os.environ.get("DATABASE_URL")
WEB_SERVICE_URL = os.environ.get(
    "WEB_SERVICE_URL",
    "http://web-service:8001"
)


# Подключение к PostgreSQL

def get_connection():
    return psycopg.connect(
        DATABASE_URL,
        row_factory=dict_row,
        connect_timeout=5
    )


# Модель входных данных

class EstimateRequest(BaseModel):
    year: int = Field(ge=1980)
    mileage: int = Field(ge=0, le=1500000)

    @field_validator("year")
    @classmethod
    def validate_year(cls, value):
        if value > date.today().year:
            raise ValueError(
                "Год выпуска не может быть в будущем"
            )
        return value


# Модель результата Web-service

class EstimateResult(BaseModel):
    year: int
    mileage: int
    vehicle_age: int
    annual_mileage: int
    mileage_category: str
    estimated_value: int
    price_min: int
    price_max: int
    depreciation_percent: float
    currency: str
    model_note: str


# Обработка ошибок PostgreSQL

@app.exception_handler(psycopg.Error)
async def database_error_handler(
    request: Request,
    exc: psycopg.Error
):
    return JSONResponse(
        status_code=503,
        content={
            "detail": "Ошибка доступа к базе данных"
        }
    )


# Проверка работоспособности

@app.get("/api/health")
def health():
    with get_connection() as conn:
        conn.execute("SELECT 1")

    return {
        "status": "ok",
        "backend": "running",
        "database": "connected"
    }


# Расчёт стоимости автомобиля

@app.post("/api/estimate", status_code=201)
def estimate_car(car: EstimateRequest):

    # Отправка запроса отдельному Web-service

    try:
        response = httpx.post(
            f"{WEB_SERVICE_URL}/estimate",
            json=car.model_dump(),
            timeout=10.0
        )

        response.raise_for_status()

        result = EstimateResult.model_validate(
            response.json()
        )

    except httpx.RequestError:
        raise HTTPException(
            status_code=502,
            detail="Сервис оценки автомобилей недоступен"
        )

    except (httpx.HTTPStatusError, ValueError):
        raise HTTPException(
            status_code=502,
            detail="Ошибка обработки данных сервисом оценки"
        )

    # Сохранение результата в PostgreSQL

    with get_connection() as conn:
        record = conn.execute(
            """
            INSERT INTO valuation_history (
                request_id,
                year,
                mileage,
                vehicle_age,
                annual_mileage,
                mileage_category,
                estimated_value,
                price_min,
                price_max,
                depreciation_percent,
                currency,
                model_note
            )
            VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s
            )
            RETURNING *
            """,
            (
                uuid4(),
                result.year,
                result.mileage,
                result.vehicle_age,
                result.annual_mileage,
                result.mileage_category,
                result.estimated_value,
                result.price_min,
                result.price_max,
                result.depreciation_percent,
                result.currency,
                result.model_note
            )
        ).fetchone()

    return record


# Получение истории оценок

@app.get("/api/history")
def get_history(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0)
):

    with get_connection() as conn:

        total = conn.execute(
            "SELECT COUNT(*) AS total FROM valuation_history"
        ).fetchone()["total"]

        records = conn.execute(
            """
            SELECT *
            FROM valuation_history
            ORDER BY created_at DESC, id DESC
            LIMIT %s OFFSET %s
            """,
            (limit, offset)
        ).fetchall()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": records
    }


# Получение одной оценки по ID

@app.get("/api/history/{record_id}")
def get_history_record(record_id: int):

    with get_connection() as conn:
        record = conn.execute(
            """
            SELECT *
            FROM valuation_history
            WHERE id = %s
            """,
            (record_id,)
        ).fetchone()

    if record is None:
        raise HTTPException(
            status_code=404,
            detail="Запись не найдена"
        )

    return record


# Удаление конкретной оценки

@app.delete("/api/history/{record_id}")
def delete_history_record(record_id: int):

    with get_connection() as conn:
        deleted = conn.execute(
            """
            DELETE FROM valuation_history
            WHERE id = %s
            RETURNING id
            """,
            (record_id,)
        ).fetchone()

    if deleted is None:
        raise HTTPException(
            status_code=404,
            detail="Запись не найдена"
        )

    return {
        "message": "Запись успешно удалена",
        "deleted_id": record_id
    }


# Очистка истории

@app.delete("/api/history")
def clear_history():

    with get_connection() as conn:
        deleted = conn.execute(
            """
            DELETE FROM valuation_history
            RETURNING id
            """
        ).fetchall()

    return {
        "message": "История оценок очищена",
        "deleted_count": len(deleted)
    }
