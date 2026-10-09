-- Car Value
-- Вариант №46
-- Инициализация базы данных PostgreSQL

CREATE TABLE IF NOT EXISTS valuation_history (
    id BIGSERIAL PRIMARY KEY,

    request_id UUID NOT NULL UNIQUE,

    year INTEGER NOT NULL
        CHECK (year BETWEEN 1980 AND 2100),

    mileage INTEGER NOT NULL
        CHECK (mileage BETWEEN 0 AND 1500000),

    vehicle_age INTEGER NOT NULL
        CHECK (vehicle_age >= 0),

    annual_mileage INTEGER NOT NULL
        CHECK (annual_mileage >= 0),

    mileage_category VARCHAR(30) NOT NULL,

    estimated_value BIGINT NOT NULL
        CHECK (estimated_value > 0),

    price_min BIGINT NOT NULL
        CHECK (price_min > 0),

    price_max BIGINT NOT NULL
        CHECK (price_max > 0),

    depreciation_percent NUMERIC(5,2) NOT NULL
        CHECK (depreciation_percent BETWEEN 0 AND 100),

    currency VARCHAR(3) NOT NULL DEFAULT 'RUB',

    model_note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_price_range CHECK (
        price_min <= estimated_value
        AND estimated_value <= price_max
    )
);

-- Индексы для истории и поиска

CREATE INDEX IF NOT EXISTS idx_valuation_created_at
ON valuation_history (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_valuation_year
ON valuation_history (year);

CREATE INDEX IF NOT EXISTS idx_valuation_mileage
ON valuation_history (mileage);

-- Настройки приложения

CREATE TABLE IF NOT EXISTS app_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL
);

INSERT INTO app_settings (key, value)
VALUES
    ('app_name', 'Car Value'),
    ('currency', 'RUB'),
    ('model_version', '1.0.0')
ON CONFLICT (key) DO NOTHING;
