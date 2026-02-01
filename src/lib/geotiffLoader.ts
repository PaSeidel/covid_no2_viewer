import { fromUrl, fromArrayBuffer } from 'geotiff';
import { GridPoint } from './no2Data';
import germanyBoundaryJson from '../data/germany-boundary.json?raw';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import * as turf from '@turf/turf';

// Type assertion if needed
const germanyBoundaryCollection = JSON.parse(germanyBoundaryJson);
const germanyBoundary = germanyBoundaryCollection.features[0];
console.log('Germany boundary:', germanyBoundary);
console.log('Geometry type:', germanyBoundary?.geometry?.type);

export interface GeoTIFFMetadata {
  width: number;
  height: number;
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  pixelScale: [number, number];
  origin: [number, number];
}

export async function loadGeoTIFF(url: string): Promise<{
  metadata: GeoTIFFMetadata;
  data: Float32Array | Int32Array | Uint16Array;
}> {
  try {
    console.log('1. Fetching from URL:', url);
    const response = await fetch(url);
    console.log('2. Response status:', response.status);
    console.log('3. Content-Type:', response.headers.get('content-type'));
    
    const arrayBuffer = await response.arrayBuffer();
    console.log('4. ArrayBuffer size:', arrayBuffer.byteLength, 'bytes');
    
    // Check first few bytes (TIFF magic number should be 0x4949 or 0x4D4D)
    const view = new DataView(arrayBuffer);
    const byte1 = view.getUint8(0);
    const byte2 = view.getUint8(1);
    console.log('5. First two bytes (hex):', 
      byte1.toString(16).padStart(2, '0'), 
      byte2.toString(16).padStart(2, '0')
    );
    console.log('6. Expected: 49 49 (little-endian) or 4d 4d (big-endian)');
    
    const tiff = await fromArrayBuffer(arrayBuffer);
    console.log('7. TIFF parsed successfully');
    
    const image = await tiff.getImage();
    console.log('8. Image loaded');
    
    const rasters = await image.readRasters();
    
    const width = image.getWidth();
    const height = image.getHeight();
    const bbox = image.getBoundingBox() as [number, number, number, number];

    const pixelScale = [
      (bbox[2] - bbox[0]) / width,
      (bbox[3] - bbox[1]) / height,
    ] as [number, number];
    
    const metadata: GeoTIFFMetadata = {
      width,
      height,
      bbox,
      pixelScale,
      origin: [bbox[0], bbox[3]],
    };
    
    return {
      metadata,
      data: rasters[0] as Float32Array | Int32Array | Uint16Array,
    };
  } catch (error) {
    console.error('Error loading GeoTIFF:', error);
    throw error;
  }
}

/**
 * Converts raster data to grid points for visualization
 * @param data - Raster data from GeoTIFF
 * @param metadata - GeoTIFF metadata
 * @param baselineData - Optional baseline raster for difference calculation
 * @param samplingRate - Sample every Nth pixel (default 1 = all pixels)
 */
export function rasterToGridPoints(
  data: Float32Array | Int32Array | Uint16Array,
  metadata: GeoTIFFMetadata,
  baselineData?: Float32Array | Int32Array | Uint16Array,
  samplingRate: number = 1
): GridPoint[] {
  const gridPoints: GridPoint[] = [];
  const { width, height, bbox, pixelScale, origin } = metadata;
  
  for (let y = 0; y < height; y += samplingRate) {
    for (let x = 0; x < width; x += samplingRate) {
      const index = y * width + x;
      const value = data[index];
      
      // Skip NoData values (commonly -9999, NaN, or very large negative numbers)
      if (value === -9999 || isNaN(value) || value < -1000) {
        continue;
      }
      
      // Calculate lat/lng from pixel coordinates
      const lng = origin[0] + x * pixelScale[0];
      const lat = origin[1] - y * pixelScale[1];
      
      // Check if point is within Germany's boundary
      try {
        const point = turf.point([lng, lat]);
        const geometry = germanyBoundary.geometry || germanyBoundary;
        if (!turf.booleanPointInPolygon(point, geometry)) {
          continue;
        }
      } catch (error) {
        // console.error('Error checking point:', error, { lng, lat });
        continue;
      }
      
      // Calculate difference if baseline is provided
      let difference = 0;
      let percentage_diff = 0;
      if (baselineData) {
        const baselineValue = baselineData[index];
        if (baselineValue !== -9999 && !isNaN(baselineValue) && baselineValue > -1000) {
          difference = value - baselineValue;
          percentage_diff = (difference / baselineValue) * 100;
        }
      }
      
      gridPoints.push({
        lat,
        lng,
        value: Number(value),
        difference: Number(percentage_diff),
      });
    }
  }
  
  return gridPoints;
}


/**
 * Loads time-series GeoTIFF data
 * Expects files named like: no2_data_2020_01.tif, no2_data_2020_02.tif, etc.
 */
export async function loadTimeSeriesGeoTIFF(
  baseUrl: string,
  year: number,
  month: number
): Promise<{
  metadata: GeoTIFFMetadata;
  data: Float32Array | Int32Array | Uint16Array;
} | null> {
  // Format month with leading zero
  const monthStr = month.toString().padStart(2, '0');
  const url = `${baseUrl}/no2_data_${year}_${monthStr}.tif`;
  
  try {
    return await loadGeoTIFF(url);
  } catch (error) {
    console.warn(`Failed to load GeoTIFF for ${year}-${monthStr}:`, error);
    return null;
  }
}

/**
 * Cache for loaded GeoTIFF data to avoid reloading
 */
class GeoTIFFCache {
  private cache: Map<string, {
    metadata: GeoTIFFMetadata;
    data: Float32Array | Int32Array | Uint16Array;
  }> = new Map();
  
  async get(
    key: string,
    loader: () => Promise<{
      metadata: GeoTIFFMetadata;
      data: Float32Array | Int32Array | Uint16Array;
    }>
  ) {
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }
    
    const data = await loader();
    this.cache.set(key, data);
    return data;
  }
  
  clear() {
    this.cache.clear();
  }
}

export const geotiffCache = new GeoTIFFCache();
