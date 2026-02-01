#!/bin/sh
set -e

echo "================================"
echo "COVID-19 NO2 Viewer - Startup"
echo "================================"

if [ "$RUN_PIPELINE" = "true" ]; then
    echo ""
    echo "RUN_PIPELINE=true detected - Running data fetch pipeline"
    echo ""

    # Validate environment variables
    if [ -z "$SENTINELHUB_CLIENT_ID" ] || [ -z "$SENTINELHUB_CLIENT_SECRET" ]; then
        echo "ERROR: SENTINELHUB_CLIENT_ID and SENTINELHUB_CLIENT_SECRET must be set when RUN_PIPELINE=true"
        echo "Please provide these via environment variables or --env-file"
        exit 1
    fi

    # Create output directories
    echo "Creating directories..."
    mkdir -p /app/public/data /app/public/city_data

    # Step 1: Download daily NO2 data
    echo ""
    echo "Step 1/4: Downloading daily NO2 data from Sentinel-5P..."
    echo "This may take a while depending on the date range..."
    python3 data_preparation/download_sentinel5P_no2_data.py /tmp/no2_daily

    # Step 2: Clone COVID-19 incidence data
    echo ""
    echo "Step 2/4: Cloning COVID-19 incidence data..."
    git clone --depth 1 https://github.com/robert-koch-institut/COVID-19_7-Tage-Inzidenz_in_Deutschland.git /tmp/covid_data

    # Step 3: Postprocess daily to monthly data
    echo ""
    echo "Step 3/4: Aggregating daily NO2 data to monthly averages..."
    python3 data_preparation/postprocess_data.py /tmp/no2_daily /tmp/no2_daily_flat /app/public/data

    # Step 4: Calculate city-specific data
    echo ""
    echo "Step 4/4: Calculating city-specific data..."
    python3 data_preparation/calculate_city_data.py \
        data_preparation/cities_major.geojson \
        /tmp/covid_data/COVID-19-Faelle_7-Tage-Inzidenz_Landkreise.csv \
        /app/public/city_data \
        /app/public/data \
        /tmp/no2_daily_flat

    # Cleanup temporary data
    echo ""
    echo "Cleaning up temporary files..."
    rm -rf /tmp/no2_daily /tmp/no2_daily_flat /tmp/covid_data

    echo ""
    echo "Pipeline complete! Data is ready."
else
    echo ""
    echo "Using pre-packaged data from data.zip"
    echo "To run the data pipeline instead, set RUN_PIPELINE=true"
    echo ""
fi

echo "================================"
echo "Starting application..."
echo "================================"
echo ""

# Execute the CMD (npm run dev)
exec "$@"
