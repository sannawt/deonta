# ComplianceTwin: React UI + FastAPI (same as local `make run` on port 8000).
FROM node:20-bookworm-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim AS runtime
WORKDIR /app
ENV PYTHONUNBUFFERED=1
ENV PORT=8000
ENV ACCOUNTS_DATA_DIR=/tmp/ct-accounts

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py ./
COPY logic/ ./logic/
COPY api/ ./api/
COPY rules/ ./rules/
COPY schemas/ ./schemas/
COPY scripts/ ./scripts/
COPY build/ ./build/
COPY data/ ./data/
COPY static/ ./static/
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
