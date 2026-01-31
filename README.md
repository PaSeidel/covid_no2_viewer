
# Project Description

This is an interactive web application for visualizing nitrogen dioxide (NO2) pollution levels across German cities from 2019-2023g. The application provides a map-based interface with timeline controls to explore temporal variations in air quality and their correlation with COVID-19 incidence rates.

The project combines satellite data from Sentinel-5P with COVID-19 case data to enable statistical analysis of NO2 level changes compared to pre-pandemic baselines.

# Setup

## Docker configuration

The project can be run using Docker with two different data loading strategies:

### Local Data

For deployment with pre-processed data, uncomment the following section in the Dockerfile:

```dockerfile
# Copy data from zip file and unzip
RUN apk add --no-cache unzip
COPY data.zip /app/data.zip
RUN mkdir -p public \
    && unzip data.zip -d public \
    && rm data.zip
```

This approach requires a `data.zip` file containing the pre-processed NO2 data and city information in the `public/` directory.

### Fetch data on startup

For dynamic data fetching and processing on container startup, uncomment the data fetch section in the Dockerfile:

```dockerfile
# Copy Python preprocessing scripts
COPY data_preparation ./data_preparation

# Install Python dependencies
COPY ./requirements.txt ./requirements.txt
RUN pip install -r requirements.txt --no-cache-dir

# Copy startup script
COPY data-preparation.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/data-preparation.sh
ENTRYPOINT ["data-preparation.sh"]
```

This will run the data preparation scripts automatically when the container starts.

## Run without docker

Run `npm i` to install the dependencies.

Run `npm run dev` to start the development server.

The application will be available at `http://localhost:3000`.

# Documentation

## Data Sources

### NO2 Satellite Data

Nitrogen dioxide (NO2) tropospheric column data is sourced from the Sentinel-5P satellite mission through the Copernicus Data Space Ecosystem (CDSE):

- **Satellite**: Sentinel-5P (Sentinel-5 Precursor)
- **Instrument**: TROPOMI (TROPOspheric Monitoring Instrument)
- **Product**: Offline NO2 tropospheric column density
- **Spatial Resolution**: 7 km × 3.5 km (5.5 km × 3.5 km from August 2019)
- **Temporal Coverage**: 2019-2023 (daily measurements)
- **Data Format**: GeoTIFF files with NO2 concentration in mol/m²
- **Source**: Copernicus Data Space Ecosystem (CDSE)
- **Legal Notice**: https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice

The NO2 data represents the total atmospheric column density of nitrogen dioxide in the troposphere, a key indicator of air pollution primarily from combustion processes (vehicles, industry, power plants).

Additional data sources include:

### Germany Polygon

German administrative boundaries (VG250) are sourced from the Federal Agency for Cartography and Geodesy (BKG):
- Source: https://gdz.bkg.bund.de/index.php/default/verwaltungsgebiete-1-250-000-stand-01-01-vg250-01-01.html
- License: [Data licence Germany – attribution – Version 2.0](https://www.govdata.de/dl-de/by-2-0)

### City Data

City locations and population data are extracted from the VG250 administrative boundaries dataset. The application includes major German cities with their geographic coordinates and population statistics. City data is stored in `/public/city_data/cities.json` and includes:
- City name
- Geographic coordinates (latitude/longitude)
- Population

### Incidence Data

COVID-19 7-day incidence data per district (Landkreis) is sourced from the Robert Koch Institute (RKI):
- Source: https://github.com/robert-koch-institut/COVID-19_7-Tage-Inzidenz_in_Deutschland
- License: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/deed.de)

The incidence data is matched to cities based on the district identifier (AGS - Amtlicher Gemeindeschlüssel) and averaged over each month for display.

## Data Preparation

The data preparation pipeline processes Sentinel-5P NO2 satellite data and COVID-19 incidence data to create monthly aggregated datasets. Python scripts in `data_preparation/` handle:

1. **NO2 Data Extraction**: Reading GeoTIFF files containing daily NO2 measurements from Sentinel-5P
2. **City Polygon Processing**: Calculating zonal statistics (mean NO2) within city boundaries using `rasterstats`
3. **Incidence Matching**: Merging COVID-19 incidence data with city NO2 values based on administrative district codes
4. **Monthly Aggregation**: Creating time-series data files (`city_timepoints_YYYY_MM.json`) for each month

### Statistical Tests

The application performs two-sample t-tests to determine if NO2 levels during the COVID-19 period are significantly different from baseline (pre-COVID) levels. The statistical methodology:

- **Baseline Period**: Monthly data from 2019 (same month as target), with additional data from January/February 2020 for those respective months
- **Test Period**: Any month from March 2020 onwards
- **Method**: Independent samples t-test comparing daily NO2 measurements between baseline and target periods
- **Significance Level**: α = 0.05
- **Sample Size**: Approximately 30 daily measurements per month per city

Additional statistics calculated:
- Cohen's d (effect size)
- Percentage change from baseline
- P-value for significance testing

Results are stored in the monthly JSON files as `pValue` and `interpretation` fields for each city.

## Implementational Details

### UI and Frontend

The application is built with:
- **React 18** with TypeScript for type-safe component development
- **Vite** as the build tool and development server
- **Radix UI** for accessible component primitives
- **Tailwind CSS** for styling
- **Recharts** for data visualization
- **Lucide React** for iconography

Key components:
- `MapViewer`: Renders OpenStreetMap tiles and overlays NO2 data visualization
- `TimelineControl`: Slider interface for temporal navigation (2019-2023)
- `InfoPanel`: Displays detailed statistics for selected cities
- `Legend`: Color scale for NO2 concentration values

### Data import

The application uses a `GeoTIFFDataSource` class to handle data loading:

- **Cities Data**: Loaded once on application mount from `/city_data/cities.json`
- **Monthly NO2 Data**: Dynamically loaded from `/city_data/city_timepoints_YYYY_MM.json` based on the selected date
- **Satellite Data Source**: Sentinel-5P NO2 tropospheric column data
  - Legal notice: https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice
  - Processed through Copernicus Data Space Ecosystem (CDSE)

### Efficient Rendering

The map rendering uses a multi-layer canvas approach:
- **Base Layer**: OpenStreetMap tiles cached in memory
  - Tile Server: OpenStreetMap
  - Usage Policy: https://operations.osmfoundation.org/policies/tiles/
- **Overlay Layer**: NO2 concentration gradient rendered as colored circles/heatmap
- **City Markers**: Interactive markers with click handlers for city selection

Optimizations:
- Tile caching to reduce network requests
- Canvas-based rendering for smooth panning and zooming
- Lazy loading of monthly data files
- Grid-based data sampling for continuous overlay visualization (configurable density)