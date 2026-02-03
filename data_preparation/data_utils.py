import os
import shutil
import calendar
import rasterio
import numpy as np
from pathlib import Path
from datetime import datetime
from scipy.stats import ttest_ind
from rasterstats import zonal_stats

# Calculate NO2 data per city for a given month based on city's polygon
def calculate_period_no2_coord_polygon(coord_polygon, period, no2_data_folder='../public/data/'):
    """
    Calculate weighted average NO2 for a city polygon.
    
    Args:
        coord_polygon: GeoJSON-like geometry (shapely Polygon or MultiPolygon)
        period: datetime or string 'YYYY_MM'
        no2_data_folder: path to folder with GeoTIFF files
    
    Returns:
        float: weighted average NO2 value for the city
    """
    # it is expected, that period is a year, month combination as string or datetime
    period_str = period if isinstance(period, str) else period.strftime('%Y_%m')
    # Load NO2 data for the given period
    no2_data_path = os.path.join(no2_data_folder, f"no2_data_{period_str}.tif")
    if not os.path.exists(no2_data_path):
        print(f"Warning: NO2 file not found: {no2_data_path}")
        return None
    
    try:
        # Use zonal_statistics to calculate mean within polygon
        # This automatically handles partial pixel overlaps
        with rasterio.open(no2_data_path) as src:
            # Get statistics for the polygon geometry
            stats = zonal_stats(
                coord_polygon,
                src.read(1),  # Read first band
                affine=src.transform,
                stats=['mean']
            )
            
            if stats and len(stats) > 0:
                mean_no2 = stats[0]['mean']
                return mean_no2
            else:
                print(f"No data found for polygon in {period_str}")
                return None
                
    except Exception as e:
        print(f"Error processing {period_str}: {e}")
        return None
    

def calculate_no2_significance(
    coord_polygon, 
    target_period, 
    baseline_period='2019',
    daily_data_folder='../public/no2_daily/',
    alpha=0.05
):
    """
    Test if NO2 levels in target period are significantly different from baseline.
    
    Uses daily measurements within a month, averaged per day across city polygon,
    then performs two-sample t-test (n ≈ 30 days per group).
    
    Args:
        coord_polygon: GeoJSON-like geometry (shapely Polygon or MultiPolygon)
        target_period: datetime or string 'YYYY_MM' (e.g., '2021_04' for April 2021)
        baseline_period: datetime, string 'YYYY_MM', or list of strings/datetimes
                        (e.g., '2019_04' or ['2019_04', '2020_04'])
                        or just year 'YYYY' to use same month (default: '2019')
        daily_data_folder: path to folder with daily GeoTIFF files
        alpha: significance level (default: 0.05)
    
    Returns:
        dict with test results, or None if insufficient data
    """
    
    # Parse target period
    target_dt = _parse_period(target_period)
    
    # Handle baseline_period as list or single value
    if isinstance(baseline_period, (list, tuple)):
        baseline_periods = baseline_period
    else:
        baseline_periods = [baseline_period]
    
    # Extract baseline data from all baseline periods
    baseline_daily_all = []
    baseline_dts = []
    
    for baseline_p in baseline_periods:
        # If baseline is just a year, use same month as target
        if len(str(baseline_p)) == 4:  # Just a year like '2019'
            baseline_dt = datetime(int(baseline_p), target_dt.month, 1)
        else:
            baseline_dt = _parse_period(baseline_p)
        
        baseline_daily = _extract_daily_no2_for_month(
            coord_polygon, baseline_dt, daily_data_folder
        )
        
        if baseline_daily is not None:
            baseline_daily_all.extend(baseline_daily)
            baseline_dts.append(baseline_dt)
    
    # Extract target daily NO2 values
    target_daily = _extract_daily_no2_for_month(
        coord_polygon, target_dt, daily_data_folder
    )
    
    if target_daily is None:
        print(f"Warning: Could not extract data for target period {target_period}")
        return {
            'significant': False,
            'p_value': 1.0,
            'interpretation': "Insufficient data for this month for a statistical test."
        }
    
    # Check if we have enough data
    if len(baseline_daily_all) < 3 or len(target_daily) < 3:
        print(f"Warning: Insufficient baseline data (need at least 3 days per period)")
        print(f"  Target days: {len(target_daily)}, Baseline days: {len(baseline_daily_all)}")
        return {
            'significant': False,
            'p_value': 1.0,
            'interpretation': "Insufficient data for this month for a statistical test."
        }
    
    # Perform two-sample t-test
    t_stat, p_value = ttest_ind(baseline_daily_all, target_daily)
    
    # Calculate statistics
    target_mean = np.mean(target_daily)
    baseline_mean = np.mean(baseline_daily_all)
    target_std = np.std(target_daily, ddof=1)
    baseline_std = np.std(baseline_daily_all, ddof=1)
    
    # Calculate effect size (Cohen's d)
    pooled_std = np.sqrt(
        ((len(baseline_daily_all)-1)*baseline_std**2 + 
         (len(target_daily)-1)*target_std**2) / 
        (len(baseline_daily_all) + len(target_daily) - 2)
    )
    cohens_d = (target_mean - baseline_mean) / pooled_std if pooled_std > 0 else 0
    
    # Calculate percent change
    percent_change = ((target_mean - baseline_mean) / baseline_mean) * 100 if baseline_mean != 0 else 0
    
    # Determine significance
    is_significant = p_value < alpha
    
    # Generate interpretation
    interpretation = _generate_interpretation(
        is_significant, p_value, percent_change, cohens_d
    )
    
    # Format baseline periods string
    baseline_periods_str = ', '.join([dt.strftime('%Y-%m') for dt in baseline_dts])
    
    return {
        'significant': is_significant,
        'p_value': p_value,
        't_statistic': t_stat,
        'target_mean': target_mean,
        'baseline_mean': baseline_mean,
        'target_std': target_std,
        'baseline_std': baseline_std,
        'percent_change': percent_change,
        'cohens_d': cohens_d,
        'n_target': len(target_daily),
        'n_baseline': len(baseline_daily_all),
        'target_period': target_dt.strftime('%Y-%m'),
        'baseline_period': baseline_periods_str,
        'interpretation': interpretation
    }


def _parse_period(period):
    """Convert period string or datetime to datetime object."""
    if isinstance(period, datetime):
        return period
    elif isinstance(period, str):
        if '_' in period:  # Format: 'YYYY_MM'
            year, month = period.split('_')
            return datetime(int(year), int(month), 1)
        elif '-' in period:  # Format: 'YYYY-MM'
            year, month = period.split('-')
            return datetime(int(year), int(month), 1)
    raise ValueError(f"Cannot parse period: {period}")


def _extract_daily_no2_for_month(coord_polygon, period_dt, daily_data_folder):
    """
    Extract daily NO2 averages for a city polygon for all days in a month.
    
    Args:
        coord_polygon: shapely geometry
        period_dt: datetime for the month
        daily_data_folder: path to daily data
    
    Returns:
        list: daily average NO2 values, or None if insufficient data
    """
    daily_data_folder = Path(daily_data_folder)
    daily_values = []
    
    # Get number of days in month
    _, num_days = calendar.monthrange(period_dt.year, period_dt.month)
    
    # Iterate through each day in the month
    for day in range(1, num_days + 1):
        date = datetime(period_dt.year, period_dt.month, day)
        date_str = date.strftime('%Y-%m-%d')
        
        daily_tif_path = Path(os.path.join(daily_data_folder, f"no2_data_{date_str}.tif"))
        
        if not daily_tif_path.exists():
            continue
        
        # Calculate daily average for the polygon
        try:
            with rasterio.open(daily_tif_path) as src:
                stats = zonal_stats(
                    coord_polygon,
                    src.read(1),
                    affine=src.transform,
                    stats=['mean'],
                    nodata=src.nodata
                )
                
                # Handle cases where all pixels are NaN/nodata
                if stats is None:
                    continue
                if len(stats) == 0:
                    continue
                if stats[0] is None:
                    continue
                if stats[0].get('mean') is None:
                    continue
                if np.isnan(stats[0]['mean']):
                    continue
                
                daily_values.append(stats[0]['mean'])
        
        except Exception as e:
            print(f"Warning: Error processing {date_str}: {e}")
            continue
    
    if len(daily_values) == 0:
        return None
    
    return daily_values


def _generate_interpretation(is_significant, p_value, percent_change, cohens_d):
    """Generate human-readable interpretation of results."""
    
    # Significance statement
    if is_significant:
        if p_value < 0.001:
            sig_text = "highly significant (p < 0.001)"
        elif p_value < 0.01:
            sig_text = "very significant (p < 0.01)"
        else:
            sig_text = f"significant (p = {p_value:.3f})"
    else:
        sig_text = f"not statistically significant (p = {p_value:.3f})"
    
    # Effect size interpretation
    abs_d = abs(cohens_d)
    if abs_d < 0.2:
        effect_text = "negligible effect size"
    elif abs_d < 0.5:
        effect_text = "small effect size"
    elif abs_d < 0.8:
        effect_text = "medium effect size"
    else:
        effect_text = "large effect size"
    
    # Direction
    direction = "decrease" if percent_change < 0 else "increase"
    
    return f"{sig_text}, {effect_text} (d={cohens_d:.2f})"


def copy_cdse_responses_into_one_dir(base_dir, output_dir):
    """
    Find all response.tiff files in the directory structure.
    Returns dict: {date_str: tiff_path}
    """
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    tiff_files = {}
    
    for date_dir in sorted(base_dir.iterdir()):
        if not date_dir.is_dir():
            continue
            
        # Date format: YYYY-MM-DD
        date_str = date_dir.name
        
        try:
            # Find the hash subdirectory (should be only one)
            hash_dirs = [d for d in date_dir.iterdir() if d.is_dir()]
            
            if len(hash_dirs) != 1:
                print(f"Warning: Expected 1 subdirectory in {date_dir}, found {len(hash_dirs)}")
                continue
            
            hash_dir = hash_dirs[0]
            tiff_path = hash_dir / 'response.tiff'
            
            if tiff_path.exists():
                tiff_files[date_str] = output_dir / f"no2_data_{date_str}.tif"
                shutil.copy(tiff_path, tiff_files[date_str])
            else:
                print(f"Warning: No response.tiff found in {hash_dir}")
                
        except Exception as e:
            print(f"Error processing {date_dir}: {e}")
    
    return tiff_files

