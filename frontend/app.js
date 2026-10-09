"use strict";

// ========================================
// CAR VALUE — FRONTEND
// Вариант №46
// ========================================

const API_URL = "/api";

const state = {
    limit: 10,
    offset: 0,
    total: 0,
    historyLoaded: false
};

const elements = {
    form: document.getElementById("estimate-form"),
    year: document.getElementById("year"),
    mileage: document.getElementById("mileage"),

    calculateBtn: document.getElementById("calculate-btn"),
    historyBtn: document.getElementById("history-btn"),

    formMessage: document.getElementById("form-message"),

    resultPlaceholder: document.getElementById("result-placeholder"),
    resultContent: document.getElementById("result-content"),

    estimatedValue: document.getElementById("estimated-value"),
    priceMin: document.getElementById("price-min"),
    priceMax: document.getElementById("price-max"),
    vehicleAge: document.getElementById("vehicle-age"),
    annualMileage: document.getElementById("annual-mileage"),
    mileageCategory: document.getElementById("mileage-category"),
    depreciation: document.getElementById("depreciation"),

    historySection: document.getElementById("history-section"),
    historyMessage: document.getElementById("history-message"),
    historyTableWrapper: document.getElementById("history-table-wrapper"),
    historyBody: document.getElementById("history-body"),

    refreshBtn: document.getElementById("refresh-btn"),
    clearBtn: document.getElementById("clear-btn"),

    pagination: document.getElementById("pagination"),
    prevBtn: document.getElementById("prev-btn"),
    nextBtn: document.getElementById("next-btn"),
    pageInfo: document.getElementById("page-info")
};


// ========================================
// ФОРМАТИРОВАНИЕ ДАННЫХ
// ========================================

const numberFormatter = new Intl.NumberFormat("ru-RU");

const currencyFormatter = new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0
});

function formatNumber(value) {
    return numberFormatter.format(Number(value));
}

function formatCurrency(value) {
    return currencyFormatter.format(Number(value));
}

function formatDate(value) {
    return new Date(value).toLocaleString("ru-RU", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}


// ========================================
// СООБЩЕНИЯ
// ========================================

function showFormMessage(message, type = "error") {
    elements.formMessage.textContent = message;
    elements.formMessage.className = `form-message ${type}`;
    elements.formMessage.hidden = false;
}

function hideFormMessage() {
    elements.formMessage.hidden = true;
    elements.formMessage.textContent = "";
}

function showHistoryMessage(message, type = "") {
    elements.historyMessage.textContent = message;
    elements.historyMessage.className = `history-message ${type}`;
    elements.historyMessage.hidden = false;
}

function hideHistoryMessage() {
    elements.historyMessage.hidden = true;
}


// ========================================
// HTTP-ЗАПРОСЫ
// ========================================

async function apiRequest(endpoint, options = {}) {
    let response;

    try {
        response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {})
            }
        });
    } catch (error) {
        throw new Error(
            "Не удалось подключиться к серверу. Проверьте работу приложения."
        );
    }

    let data;

    try {
        data = await response.json();
    } catch (error) {
        throw new Error("Сервер вернул некорректный ответ.");
    }

    if (!response.ok) {
        let message = `Ошибка сервера: ${response.status}`;

        if (typeof data.detail === "string") {
            message = data.detail;
        } else if (Array.isArray(data.detail)) {
            message = data.detail
                .map(item => item.msg || "Ошибка проверки данных")
                .join("; ");
        }

        throw new Error(message);
    }

    return data;
}


// ========================================
// ПРОВЕРКА ВВЕДЁННЫХ ДАННЫХ
// ========================================

function validateCar(year, mileage) {
    const currentYear = new Date().getFullYear();

    if (!Number.isInteger(year)) {
        throw new Error("Укажите корректный год выпуска.");
    }

    if (year < 1980 || year > currentYear) {
        throw new Error(
            `Год выпуска должен быть от 1980 до ${currentYear}.`
        );
    }

    if (!Number.isInteger(mileage)) {
        throw new Error("Пробег должен быть целым числом.");
    }

    if (mileage < 0 || mileage > 1500000) {
        throw new Error(
            "Пробег должен находиться в диапазоне от 0 до 1 500 000 км."
        );
    }

    return { year, mileage };
}


// ========================================
// ОТОБРАЖЕНИЕ РЕЗУЛЬТАТА
// ========================================

function displayResult(data) {
    elements.resultPlaceholder.hidden = true;
    elements.resultContent.hidden = false;

    elements.estimatedValue.textContent =
        formatCurrency(data.estimated_value);

    elements.priceMin.textContent =
        formatCurrency(data.price_min);

    elements.priceMax.textContent =
        formatCurrency(data.price_max);

    elements.vehicleAge.textContent =
        `${data.vehicle_age} лет`;

    elements.annualMileage.textContent =
        `${formatNumber(data.annual_mileage)} км`;

    elements.mileageCategory.textContent =
        data.mileage_category;

    elements.depreciation.textContent =
        `${formatNumber(data.depreciation_percent)} %`;
}


// ========================================
// РАСЧЁТ СТОИМОСТИ
// ========================================

async function calculateCar(event) {
    event.preventDefault();

    hideFormMessage();

    const year = Number(elements.year.value);
    const mileage = Number(elements.mileage.value);

    let car;

    try {
        car = validateCar(year, mileage);
    } catch (error) {
        showFormMessage(error.message);
        return;
    }

    elements.calculateBtn.disabled = true;
    elements.calculateBtn.textContent = "Выполняется расчёт...";

    try {
        const result = await apiRequest("/estimate", {
            method: "POST",
            body: JSON.stringify(car)
        });

        displayResult(result);

        showFormMessage(
            "Оценка выполнена и сохранена в истории.",
            "success"
        );

        if (state.historyLoaded) {
            state.offset = 0;
            await loadHistory();
        }

    } catch (error) {
        showFormMessage(error.message);

    } finally {
        elements.calculateBtn.disabled = false;
        elements.calculateBtn.textContent =
            "Рассчитать стоимость";
    }
}


// ========================================
// СОЗДАНИЕ СТРОКИ ТАБЛИЦЫ
// ========================================

function createCell(text) {
    const cell = document.createElement("td");
    cell.textContent = text;
    return cell;
}

function createHistoryRow(record) {
    const row = document.createElement("tr");

    row.appendChild(createCell(record.id));
    row.appendChild(createCell(formatDate(record.created_at)));
    row.appendChild(createCell(record.year));
    row.appendChild(
        createCell(`${formatNumber(record.mileage)} км`)
    );
    row.appendChild(
        createCell(formatCurrency(record.estimated_value))
    );

    const actionCell = document.createElement("td");

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-btn";
    deleteButton.textContent = "Удалить";
    deleteButton.dataset.id = record.id;

    actionCell.appendChild(deleteButton);
    row.appendChild(actionCell);

    return row;
}


// ========================================
// ОТОБРАЖЕНИЕ ИСТОРИИ
// ========================================

function renderHistory(data) {
    state.total = data.total;
    state.historyLoaded = true;

    elements.historyBody.replaceChildren();

    if (data.items.length === 0) {
        elements.historyTableWrapper.hidden = true;
        elements.pagination.hidden = true;

        showHistoryMessage(
            "История пока пуста. Выполните первую оценку автомобиля."
        );

        return;
    }

    hideHistoryMessage();

    for (const record of data.items) {
        elements.historyBody.appendChild(
            createHistoryRow(record)
        );
    }

    elements.historyTableWrapper.hidden = false;

    const currentPage =
        Math.floor(state.offset / state.limit) + 1;

    const totalPages =
        Math.ceil(state.total / state.limit);

    elements.pageInfo.textContent =
        `Страница ${currentPage} из ${totalPages} · Всего: ${state.total}`;

    elements.prevBtn.disabled =
        state.offset === 0;

    elements.nextBtn.disabled =
        state.offset + state.limit >= state.total;

    elements.pagination.hidden =
        state.total <= state.limit;
}


// ========================================
// ЗАГРУЗКА ИСТОРИИ
// ========================================

async function loadHistory() {
    showHistoryMessage("Загрузка истории оценок...");

    try {
        let data = await apiRequest(
            `/history?limit=${state.limit}&offset=${state.offset}`
        );

        // Если последняя запись на странице удалена,
        // переходим на предыдущую страницу.
        if (
            data.items.length === 0 &&
            state.offset > 0
        ) {
            state.offset = Math.max(
                0,
                Math.floor(
                    Math.max(data.total - 1, 0) / state.limit
                ) * state.limit
            );

            data = await apiRequest(
                `/history?limit=${state.limit}&offset=${state.offset}`
            );
        }

        renderHistory(data);

    } catch (error) {
        elements.historyTableWrapper.hidden = true;
        elements.pagination.hidden = true;

        showHistoryMessage(error.message, "error");
    }
}


// ========================================
// УДАЛЕНИЕ ОДНОЙ ОЦЕНКИ
// ========================================

async function deleteHistoryRecord(id) {
    const confirmed = confirm(
        `Удалить оценку №${id} из истории?`
    );

    if (!confirmed) {
        return;
    }

    try {
        await apiRequest(`/history/${id}`, {
            method: "DELETE"
        });

        await loadHistory();

    } catch (error) {
        showHistoryMessage(error.message, "error");
    }
}


// ========================================
// ОЧИСТКА ВСЕЙ ИСТОРИИ
// ========================================

async function clearHistory() {
    const confirmed = confirm(
        "Вы действительно хотите удалить всю историю оценок? " +
        "Это действие нельзя отменить."
    );

    if (!confirmed) {
        return;
    }

    elements.clearBtn.disabled = true;

    try {
        const result = await apiRequest("/history", {
            method: "DELETE"
        });

        state.offset = 0;

        await loadHistory();

        if (result.deleted_count > 0) {
            showHistoryMessage(
                `История очищена. Удалено записей: ${result.deleted_count}.`,
                "success"
            );
        }

    } catch (error) {
        showHistoryMessage(error.message, "error");

    } finally {
        elements.clearBtn.disabled = false;
    }
}


// ========================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// ========================================

elements.form.addEventListener(
    "submit",
    calculateCar
);

elements.historyBtn.addEventListener(
    "click",
    async () => {
        state.offset = 0;

        await loadHistory();

        elements.historySection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
);

elements.refreshBtn.addEventListener(
    "click",
    loadHistory
);

elements.clearBtn.addEventListener(
    "click",
    clearHistory
);

elements.prevBtn.addEventListener(
    "click",
    async () => {
        state.offset = Math.max(
            0,
            state.offset - state.limit
        );

        await loadHistory();
    }
);

elements.nextBtn.addEventListener(
    "click",
    async () => {
        if (state.offset + state.limit < state.total) {
            state.offset += state.limit;
            await loadHistory();
        }
    }
);

elements.historyBody.addEventListener(
    "click",
    async (event) => {
        const button = event.target.closest(
            "button[data-id]"
        );

        if (!button) {
            return;
        }

        const id = Number(button.dataset.id);

        if (Number.isInteger(id) && id > 0) {
            await deleteHistoryRecord(id);
        }
    }
);


// ========================================
// ИНИЦИАЛИЗАЦИЯ
// ========================================

function initializeApplication() {
    const currentYear = new Date().getFullYear();

    elements.year.max = currentYear;
    elements.year.value = currentYear - 3;

    elements.mileage.value = 45000;

    console.info(
        "Car Value Frontend запущен. Вариант №46."
    );
}

initializeApplication();
