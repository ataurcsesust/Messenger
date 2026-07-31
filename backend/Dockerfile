FROM python:3.12-slim

WORKDIR /app

# System deps needed to build psycopg2 and Pillow wheels if no prebuilt wheel matches.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN mkdir -p uploads/avatars uploads/attachments uploads/group_images

EXPOSE 8000

# Run migrations then start the server. In production, prefer running
# `alembic upgrade head` as a separate release step instead of on every
# container start; kept together here for a simple single-command demo.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
