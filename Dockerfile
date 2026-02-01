FROM node:18-alpine

# Add Python
RUN apk add --no-cache python3 py3-pip

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY vite.config.ts ./
COPY index.html ./  

# === FOR STARTUP WITH LOCAL DATA ===
# Copy data from zip file and unzip
RUN apk add --no-cache unzip

COPY data.zip /app/data.zip
RUN mkdir -p public \
    && unzip data.zip -d public \
    && rm data.zip
# === END ===

# === FOR STARTUP WITH DATA FETCH ===
# Install git for cloning COVID data
# RUN apk add --no-cache git

# Copy Python preprocessing scripts
# COPY data_preparation ./data_preparation

# Install Python dependencies
# RUN pip install -r data_preparation/requirements.txt --no-cache-dir --break-system-packages

# Copy .env file (must be created from .env.template)
# COPY .env .env

# Copy cities GeoJSON file
# COPY data_preparation/cities_major.geojson ./data_preparation/cities_major.geojson

# Create public directories
# RUN mkdir -p /app/public/data /app/public/city_data

# Run the download script to fetch NO2 data (download structure)
# RUN python3 data_preparation/download_sentinel5P_no2_data.py /tmp/no2_daily

# Clone COVID-19 Incidence Data from RKI GitHub
# RUN git clone https://github.com/robert-koch-institut/COVID-19_7-Tage-Inzidenz_in_Deutschland.git /tmp/covid_data

# Run post-processing script to aggregate daily to monthly data
# RUN python3 data_preparation/postprocess_data.py /tmp/no2_daily /tmp/no2_daily_flat /app/public/data

# Calculate city-specific data
# RUN python3 data_preparation/calculate_city_data.py \
#     data_preparation/cities_major.geojson \
#     /tmp/covid_data/COVID-19-Faelle_7-Tage-Inzidenz_Landkreise.csv \
#     /app/public/city_data \
#     /app/public/data \
#     /tmp/no2_daily_flat

# Clean up temporary data (daily NO2 files and COVID data not needed in app)
# RUN rm -rf /tmp/no2_daily /tmp/no2_daily_flat /tmp/covid_data
# === END ===

# Install dependencies
RUN npm i

# Copy source code
COPY src ./src

EXPOSE 3000

# ENTRYPOINT ["data-preparation.sh"]
CMD ["npm", "run", "dev"]