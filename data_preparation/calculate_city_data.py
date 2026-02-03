import os
import sys
import json
import stat
import pandas as pd
from tqdm import tqdm
import geopandas as gpd
from data_utils import calculate_period_no2_coord_polygon, calculate_no2_significance, copy_cdse_responses_into_one_dir

# Create detailed city_data/city_timepoints_YYYY_MM.json files
def create_detailed_city_timepoints(
        input_geojson='cities_major.geojson',
        incidence_csv='COVID-19-Faelle_7-Tage-Inzidenz_Landkreise.csv',
        output_folder='../public/city_data/',
        no2_daily_folder='../public/no2_daily/',
        no2_monthly_folder='../public/data/'
    ):
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)
    cities_geojson = gpd.read_file(input_geojson)
    
    # Load incidence data for COVID era
    incidence_df = pd.read_csv(
        incidence_csv, 
        parse_dates=['Meldedatum'],
        dtype={'Landkreis_id': str}
    ).rename(columns={
        'Landkreis_id': 'AGS',
        'Meldedatum': 'date',
        'Inzidenz_7-Tage': 'incidence'})

    cities_geojson["Gemeindeschlüssel_AGS"] = cities_geojson["Gemeindeschlüssel_AGS"].apply(
        lambda x: str(x)[:5]  # Match to Landkreis_id
    )
    
    def is_covid_era(year, month):
        """Check if period is COVID era (2020-03 onwards)"""
        return year > 2020 or (year == 2020 and month >= 3)
    
    def get_baseline_periods(month):
        """Get baseline periods for a given month"""
        baseline_periods = [f'2019_{month:02d}']
        if month == 1:
            baseline_periods.append('2020_01')
        elif month == 2:
            baseline_periods.append('2020_02')
        return baseline_periods
    
    # Find all NO2 files to determine date range
    no2_files = [f for f in os.listdir(no2_daily_folder) 
                 if f.startswith('no2_data_') and f.endswith('.tif')]
    
    date_periods = set()
    for filename in no2_files:
        # Extract date from no2_data_YYYY-MM-DD.tif
        period_str = filename.replace('no2_data_', '').replace('.tif', '')
        
        # Handle YYYY-MM-DD format
        if '-' in period_str and len(period_str) >= 7:
            # Format: YYYY-MM-DD, convert to YYYY_MM
            date_parts = period_str.split('-')
            if len(date_parts) >= 2:
                year, month = date_parts[0], date_parts[1]
                period_str = f'{year}_{month}'
        
        date_periods.add(period_str)
    
    # Sort chronologically
    date_periods = sorted(list(date_periods))
    
    print(f"Found {len(date_periods)} date periods: {date_periods[0]} to {date_periods[-1]}")
    
    for period_str in tqdm(date_periods):
        year, month = map(int, period_str.split('_'))
        covid = is_covid_era(year, month)
        
        output_path = f"{output_folder}city_timepoints_{period_str}.json"
        
        city_timepoints = []
        
        if covid:
            # COVID era: merge with incidence data
            period_start = pd.Timestamp(year=year, month=month, day=1)
            period_end = (period_start + pd.DateOffset(months=1)) - pd.DateOffset(days=1)
            
            # Get incidence data for this month
            month_incidence = incidence_df[
                (incidence_df['date'] >= period_start) & 
                (incidence_df['date'] <= period_end)
            ]
            
            baseline_periods = get_baseline_periods(month)
            
            for _, city in cities_geojson.iterrows():
                city_name = city['GeografischerName_GEN']
                
                # Get incidence for this city
                ags = str(city['Gemeindeschlüssel_AGS'])[:5]
                city_incidence_data = month_incidence[month_incidence['AGS'] == ags]
                incidence_value = city_incidence_data['incidence'].mean() if len(city_incidence_data) > 0 else 0.0
                
                # Calculate NO2
                no2_value = calculate_period_no2_coord_polygon(city.geometry, period_str, no2_monthly_folder)
                
                # Significance test
                stat_test = calculate_no2_significance(
                    coord_polygon=city.geometry,
                    target_period=period_str,
                    baseline_period=baseline_periods,
                    daily_data_folder=no2_daily_folder
                )
                
                city_timepoints.append({
                    'cityName': city_name,
                    'timestamp': f'{year:04d}-{month:02d}',
                    'value': no2_value if no2_value else 0.0,
                    'incidence': float(incidence_value),
                    'pValue': stat_test['p_value'],
                    'interpretation': stat_test['interpretation']
                })
        else:
            # Precovid era: simple baseline data without significance test
            for _, city in cities_geojson.iterrows():
                city_name = city['GeografischerName_GEN']
                
                # Calculate NO2 only
                no2_value = calculate_period_no2_coord_polygon(city.geometry, period_str, no2_monthly_folder)
                
                city_timepoints.append({
                    'cityName': city_name,
                    'timestamp': f'{year:04d}-{month:02d}',
                    'value': no2_value if no2_value else 0.0,
                    'incidence': 0.0,  # Hardcoded 0.0 for precovid
                    'pValue': 1.0,
                    'interpretation': 'Precovid baseline'
                })
        
        with open(output_path, 'w') as f:
            json.dump(city_timepoints, f)
        
        print(f"Created {output_path} ({len(city_timepoints)} cities)")


# Create lightweight cities.json (for frontend)
def create_lightweight_city_data(
        input_geojson='cities_major.geojson', 
        output_json='../public/city_data/cities.json'
    ):
    cities_geojson = gpd.read_file(input_geojson)
    cities_light = []
    for _, city in cities_geojson.iterrows():
        lon, lat = city.geometry.representative_point().xy
        cities_light.append({
            'name': city['GeografischerName_GEN'],
            'lat': lat[0],
            'lng': lon[0],
            'population': int(city['Einwohnerzahl_EWZ'])
        })
    with open(output_json, 'w') as f:
        json.dump(cities_light, f)

if __name__ == "__main__":
    # Parse command line arguments
    if len(sys.argv) != 6:
        print("Usage: python calculate_city_data.py <cities_geojson> <incidence_csv> <output_city_data_folder> <no2_monthly_folder> <no2_daily_folder>")
        print("Example: python calculate_city_data.py cities_major.geojson /tmp/covid_data/COVID-19-Faelle_7-Tage-Inzidenz_Landkreise.csv /app/public/city_data /app/public/data /app/public/no2_daily")
        sys.exit(1)

    cities_geojson = sys.argv[1]
    incidence_csv = sys.argv[2]
    output_city_data_folder = sys.argv[3]
    no2_monthly_folder = sys.argv[4]
    no2_daily_folder = sys.argv[5]

    print("="*80)
    print("CITY DATA CALCULATION")
    print("="*80)
    print(f"Cities GeoJSON: {cities_geojson}")
    print(f"Incidence CSV: {incidence_csv}")
    print(f"Output folder: {output_city_data_folder}")
    print(f"NO2 monthly folder: {no2_monthly_folder}")
    print(f"NO2 daily folder: {no2_daily_folder}")
    print("="*80)

    # Create lightweight city data
    cities_json_output = os.path.join(output_city_data_folder, 'cities.json')
    print("\nCreating lightweight city data...")
    create_lightweight_city_data(
        input_geojson=cities_geojson,
        output_json=cities_json_output
    )

    # Create detailed city timepoints
    print("\nCreating detailed city timepoints...")
    create_detailed_city_timepoints(
        input_geojson=cities_geojson,
        incidence_csv=incidence_csv,
        output_folder=output_city_data_folder,
        no2_daily_folder=no2_daily_folder,
        no2_monthly_folder=no2_monthly_folder
    )

    print("\n" + "="*80)
    print("CITY DATA CALCULATION COMPLETE")
    print("="*80)