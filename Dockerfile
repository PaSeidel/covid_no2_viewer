# Stage 1: Base application with local data (lightweight)
FROM node:18-alpine AS app

# Install minimal dependencies
RUN apk add --no-cache unzip

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY vite.config.ts ./
COPY index.html ./

# Install Node.js dependencies
RUN npm i

# Copy local data (used when RUN_PIPELINE is not set)
COPY data.zip /app/data.zip
RUN mkdir -p public \
    && unzip data.zip -d public \
    && rm data.zip

# Copy application source code
COPY src ./src

# Copy and setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000

# Use entrypoint script to handle runtime options
ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "run", "dev", "--", "--host"]


# Stage 2: Extended image with data pipeline support (heavier)
FROM app AS pipeline

# Install Python, git, and geospatial system dependencies for data pipeline
RUN apk add --no-cache \
    python3 \
    py3-pip \
    git \
    gdal-dev \
    geos-dev \
    proj-dev \
    gcc \
    g++ \
    musl-dev \
    python3-dev

# Copy Python preprocessing scripts and dependencies
COPY data_preparation ./data_preparation

# Install Python dependencies for data pipeline
RUN pip install -r data_preparation/requirements.txt --no-cache-dir --break-system-packages

# Entrypoint and CMD inherited from base stage

FROM app