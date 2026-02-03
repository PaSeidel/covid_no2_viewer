import os
import time
import sys
import numpy as np
import pandas as pd
from pathlib import Path
from dotenv import load_dotenv
from sentinelhub import (
    SHConfig,
    CRS,
    BBox,
    DataCollection,
    MimeType,
    SentinelHubRequest,
)

def download_tropomi_data(
    evalscript: str,
    aoi_bbox,
    time_range,
    freq="D",
    resolution=(1000, 1000),
    save_data=True,
    save_data_folder="./data",
):
    """Download TROPOMI NO2 data from Sentinel-5P using Sentinel Hub.
    Args:
        evalscript (str): The evalscript to use for the request.
        aoi_bbox (BBox): The area of interest bounding box.
        time_range (tuple): A tuple of start and end dates in "YYYY-MM-DD" format.
        freq (str, optional): Frequency for splitting the time range. Defaults to "D" (daily).
        resolution (tuple, optional): Resolution of the output data. Defaults to (1000, 1000).
        save_data (bool, optional): Whether to save the downloaded data. Defaults to True.
        save_data_folder (str, optional): Folder to save the data. Defaults to "./data".
    Returns:
        raw_data_list (list): List of downloaded raw data arrays.
        df_report (pd.DataFrame): DataFrame summarizing the download results.
    """

    start, end = pd.to_datetime(time_range[0]), pd.to_datetime(time_range[1])

    daily_intervals = [
        (
            day.strftime("%Y-%m-%dT00:00:00Z"),
            day.strftime("%Y-%m-%dT23:59:59Z")
        )
        for day in pd.date_range(start, end, freq=freq)
    ]

    if not os.path.exists(save_data_folder):
        os.makedirs(save_data_folder)
        
    raw_data_list = []
    records = []  # rows for the dataframe

    data_5p = DataCollection.SENTINEL5P.define_from("5p", service_url=config.sh_base_url)

    for i, (t_from, t_to) in enumerate(daily_intervals):

        print(f"Downloading: {t_from} -> {t_to}", flush=True)

        # Build request
        request_raw = SentinelHubRequest(
            evalscript=evalscript,
            input_data=[
                SentinelHubRequest.input_data(
                    data_collection=data_5p,
                    time_interval=(t_from, t_to)
                )
            ],
            responses=[SentinelHubRequest.output_response("default", MimeType.TIFF)],
            bbox=aoi_bbox,
            resolution=resolution,
            config=config,
            data_folder=os.path.join(save_data_folder, f"{t_from[:10]}"),
        )

        # Execute request with timing + safety
        t0 = time.time()
        try:
            raw = request_raw.get_data(save_data=save_data, redownload=False)
            arr = raw[0]
            success = True
        except Exception as e:
            print("Request failed:", e)
            arr = None
            success = False
        load_time = time.time() - t0

        # Record download result
        if success and arr is not None:
            total_px = arr.size
            valid_px = np.count_nonzero(np.isfinite(arr))
            frac_valid = valid_px / total_px if total_px > 0 else 0.0
            mean_val = np.nanmean(arr) if valid_px > 0 else np.nan
        else:
            total_px = valid_px = 0
            frac_valid = 0.0
            mean_val = np.nan

        # Save raw array
        raw_data_list.append(arr)

        # Append one row to the report
        records.append({
            "date": t_from[:10],
            "success": success,
            "load_time_s": load_time,
            "total_pixels": total_px,
            "valid_pixels": valid_px,
            "fraction_valid": frac_valid,
            "mean_NO2": mean_val,
        })

        print(f"  success={success}, fraction_valid={frac_valid}, mean={mean_val}\n")

    # Build the DataFrame
    df_report = pd.DataFrame(records)

    return raw_data_list, df_report



# Load environment variables from .env file
load_dotenv()

# Configure Sentinel Hub access
config = SHConfig()
config.sh_client_id = os.getenv("SENTINELHUB_CLIENT_ID")
config.sh_client_secret = os.getenv("SENTINELHUB_CLIENT_SECRET")

# Validate that credentials are set
if not config.sh_client_id or not config.sh_client_secret:
    print("Error: SENTINELHUB_CLIENT_ID and SENTINELHUB_CLIENT_SECRET must be set in .env file")
    sys.exit(1)

config.sh_token_url = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
config.sh_base_url = "https://sh.dataspace.copernicus.eu"
config.save("cdse")
config = SHConfig("cdse", max_download_attempts=100)


# Define evalscript for NO2 data extraction
evalscript_raw = """
//VERSION=3
function setup() {
   return {
    input: ["NO2", "dataMask"],
    output: 
      {
        id: "default",
        bands: 1,
        sampleType: "FLOAT32"
      },
    mosaicking: "SIMPLE"
  };
}
function evaluatePixel(sample) {
  if (sample.dataMask == 1)  {
    return [sample.NO2];
  } else {
    return [NaN];
  }
}
"""

# define area of interest
germany_coords_wgs84 = [5.8663, 47.2701, 15.0419, 55.0992]
aoi_bbox = BBox(bbox=germany_coords_wgs84, crs=CRS.WGS84)

# define time interval
time_range = ("2019-01-01", "2024-12-31")

# Download the data
raw_data_list, df_report = download_tropomi_data(
    evalscript=evalscript_raw,
    aoi_bbox=aoi_bbox,
    time_range=time_range,
    resolution=(5000, 3500),
    save_data_folder=sys.argv[1] if len(sys.argv) > 1 else "./no2_daily",
)