FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for build (if needed)
RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy everything into a 'backend' folder inside /app
COPY . ./backend

EXPOSE 8000

# Run uvicorn with the package prefix
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
