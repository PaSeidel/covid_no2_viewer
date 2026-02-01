import os
import sys
import shutil
import calendar
import numpy as np
import rasterio
from pathlib import Path
from datetime import datetime
from collections import defaultdict
from tqdm import tqdm


def copy_daily_tiffs(download_folder, output_daily_folder):
    """
    Copy daily TIFF files from download structure to flat directory.

    Args:
        download_folder: Folder containing downloaded data in structure: YYYY-MM-DD/hash/response.tiff
        output_daily_folder: Output folder for flat daily files: no2_data_YYYY-MM-DD.tif

    Returns:
        dict: {date_str: tiff_path} mapping of copied files
    """
    download_folder = Path(download_folder)
    output_daily_folder = Path(output_daily_folder)

    if not output_daily_folder.exists():
        output_daily_folder.mkdir(parents=True, exist_ok=True)

    tiff_files = {}

    print(f"Copying daily TIFF files from {download_folder} to {output_daily_folder}")

    for date_dir in sorted(download_folder.iterdir()):
        if not date_dir.is_dir():
            continue

        # Date format: YYYY-MM-DD
        date_str = date_dir.name

        try:
            # Validate date format
            datetime.strptime(date_str, '%Y-%m-%d')

            # Find the hash subdirectory (should be only one)
            hash_dirs = [d for d in date_dir.iterdir() if d.is_dir()]

            if len(hash_dirs) != 1:
                print(f"Warning: Expected 1 subdirectory in {date_dir}, found {len(hash_dirs)}")
                continue

            hash_dir = hash_dirs[0]
            tiff_path = hash_dir / 'response.tiff'

            if tiff_path.exists():
                output_path = output_daily_folder / f"no2_data_{date_str}.tif"
                shutil.copy(tiff_path, output_path)
                tiff_files[date_str] = output_path
                print(f"  Copied {date_str}")
            else:
                print(f"Warning: No response.tiff found in {hash_dir}")

        except ValueError:
            print(f"Skipping invalid date directory: {date_str}")
            continue
        except Exception as e:
            print(f"Error processing {date_dir}: {e}")
            continue

    print(f"\nCopied {len(tiff_files)} daily files")
    return tiff_files


def aggregate_daily_to_monthly(daily_folder, output_monthly_folder, require_all_days=True):
    """
    Aggregate daily NO2 data to monthly averages.

    Args:
        daily_folder: Folder with daily files (no2_data_YYYY-MM-DD.tif)
        output_monthly_folder: Output folder for monthly files (no2_data_YYYY_MM.tif)
        require_all_days: If True, only create monthly file if all days present

    Returns:
        list: Successfully created monthly files
    """
    daily_folder = Path(daily_folder)
    output_monthly_folder = Path(output_monthly_folder)

    if not output_monthly_folder.exists():
        output_monthly_folder.mkdir(parents=True, exist_ok=True)

    # Group daily files by year-month
    monthly_groups = defaultdict(list)

    for tiff_file in sorted(daily_folder.glob("no2_data_*.tif")):
        filename = tiff_file.name

        # Extract date from no2_data_YYYY-MM-DD.tif
        date_str = filename.replace('no2_data_', '').replace('.tif', '')

        try:
            date = datetime.strptime(date_str, '%Y-%m-%d')
            year_month = f"{date.year}_{date.month:02d}"
            monthly_groups[year_month].append((date, tiff_file))
        except ValueError:
            print(f"Skipping invalid filename: {filename}")
            continue

    print(f"\nFound {len(monthly_groups)} months of data")
    print("Aggregating daily data to monthly averages...")

    created_files = []

    for year_month in tqdm(sorted(monthly_groups.keys())):
        daily_files = monthly_groups[year_month]

        # Parse year and month
        year, month = map(int, year_month.split('_'))

        # Check if all days are present
        _, num_days_in_month = calendar.monthrange(year, month)

        if require_all_days and len(daily_files) != num_days_in_month:
            print(f"\nWarning: {year_month} has {len(daily_files)}/{num_days_in_month} days, skipping")
            continue

        # Read all daily files and compute monthly average
        try:
            daily_arrays = []
            metadata = None

            for date, tiff_path in sorted(daily_files):
                with rasterio.open(tiff_path) as src:
                    data = src.read(1)  # Read first band

                    # Store metadata from first file
                    if metadata is None:
                        metadata = src.meta.copy()

                    # Convert nodata to NaN for proper averaging
                    data = data.astype(np.float32)
                    if src.nodata is not None:
                        data[data == src.nodata] = np.nan

                    daily_arrays.append(data)

            # Stack arrays and compute mean across time dimension
            stacked = np.stack(daily_arrays, axis=0)

            # Compute mean, ignoring NaN values
            monthly_avg = np.nanmean(stacked, axis=0)

            # Set pixels with all NaN to nodata value
            nodata_value = -9999.0
            monthly_avg[np.isnan(monthly_avg)] = nodata_value

            # Update metadata
            metadata.update({
                'dtype': 'float32',
                'nodata': nodata_value,
                'compress': 'lzw'
            })

            # Write monthly file
            output_path = output_monthly_folder / f"no2_data_{year_month}.tif"

            with rasterio.open(output_path, 'w', **metadata) as dst:
                dst.write(monthly_avg, 1)

            created_files.append(output_path)

        except Exception as e:
            print(f"\nError processing {year_month}: {e}")
            continue

    print(f"\nCreated {len(created_files)} monthly files")
    return created_files


def main():
    """Main pipeline: copy daily files and aggregate to monthly."""

    # Parse command line arguments
    if len(sys.argv) != 4:
        print("Usage: python postprocess_data.py <download_folder> <output_daily_folder> <output_monthly_folder>")
        print("Example: python postprocess_data.py /tmp/no2_daily /app/public/no2_daily /app/public/data")
        sys.exit(1)

    download_folder = sys.argv[1]
    output_daily_folder = sys.argv[2]
    output_monthly_folder = sys.argv[3]

    print("="*80)
    print("NO2 DATA POST-PROCESSING PIPELINE")
    print("="*80)
    print(f"Download folder: {download_folder}")
    print(f"Output daily folder: {output_daily_folder}")
    print(f"Output monthly folder: {output_monthly_folder}")
    print("="*80)

    # Step 1: Copy daily files to flat structure
    daily_files = copy_daily_tiffs(download_folder, output_daily_folder)

    if len(daily_files) == 0:
        print("\nError: No daily files found to process")
        sys.exit(1)

    # Step 2: Aggregate to monthly averages
    monthly_files = aggregate_daily_to_monthly(
        output_daily_folder,
        output_monthly_folder,
        require_all_days=True
    )

    if len(monthly_files) == 0:
        print("\nWarning: No monthly files created (possibly missing days in some months)")

    print("\n" + "="*80)
    print("POST-PROCESSING COMPLETE")
    print("="*80)
    print(f"Daily files: {len(daily_files)}")
    print(f"Monthly files: {len(monthly_files)}")
    print("="*80)


if __name__ == "__main__":
    main()
