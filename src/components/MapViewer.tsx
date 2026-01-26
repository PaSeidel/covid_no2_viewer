import { useEffect, useRef, useState } from "react";
import { Plus, Minus } from "lucide-react";
import {
  getCurrentMeasurementsAsync,
  getBaselineDataAsync,
  getMeasurementDifference,
  getGridDataAsync,
  GridPoint,
  City,
} from "../lib/no2Data";
import { GeoTIFFDataSource } from "../lib/geotiffDataSource";


interface MapViewerProps {
  currentDate: Date;
  onCitySelect: (city: any) => void;
}

// Germany center coordinates
const GERMANY_CENTER = { lat: 51.1657, lng: 10.4515 };
const INITIAL_ZOOM = 6;

// OpenStreetMap tile server URL
const OSM_TILE_URL = "https://tile.openstreetmap.org";

export function MapViewer({
  currentDate,
  onCitySelect,
}: MapViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [viewState, setViewState] = useState({
    center: GERMANY_CENTER,
    zoom: INITIAL_ZOOM,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({
    x: 0,
    y: 0,
    lat: GERMANY_CENTER.lat,
    lng: GERMANY_CENTER.lng,
  });
  const [tiles, setTiles] = useState<
    Map<string, HTMLImageElement>
  >(new Map());
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [gridData, setGridData] = useState<GridPoint[]>([]);
  const [cities, setCities] = useState<City[]>([]);

  // Load cities once on mount
  useEffect(() => {
    async function loadCities() {
      const dataSource = new GeoTIFFDataSource({
        mode: 'geotiff',
        geotiffBaseUrl: '/data',
        citiesDataUrl: '/city_data'
      });
      await dataSource.loadCities();
      setCities(dataSource.getCities());
    }
    loadCities();
  }, []);

  // Update measurements and grid when date changes
  useEffect(() => {

    async function fetchData() {
    const currentMeasurements =
      await getCurrentMeasurementsAsync(currentDate);
    const baseline = await getBaselineDataAsync(currentDate);

    const measurementsWithDiff = currentMeasurements
      .map((m) => {
        const baselineData = baseline.find(b => b.cityName === m.cityName);
        if (!baselineData) {
          console.warn('No baseline data for city:', m.cityName);
          return null;}
        const city = cities.find((c) => c.name === m.cityName);
        if (!city) {
          console.warn('No city data for:', m.cityName, 'Available cities:', cities.map(c => c.name));
          return null;
        }
        return {
          ...m,
          difference: getMeasurementDifference(m, baselineData),
          isSignificant: m.pValue < 0.05,
          city
        };
      })
      .filter(Boolean);

    setMeasurements(measurementsWithDiff);

    // Get grid data for continuous overlay
    // const grid = getGridData(currentDate);
    const grid = await getGridDataAsync(currentDate, 5);
    setGridData(grid);
  }
    fetchData();
  }, [currentDate, cities]);

  // Calculate tile coordinates from lat/lng
  const getTileCoordinates = (
    lat: number,
    lng: number,
    zoom: number,
  ) => {
    const n = Math.pow(2, zoom);
    const x = Math.floor(((lng + 180) / 360) * n);
    const y = Math.floor(
      ((1 -
        Math.log(
          Math.tan((lat * Math.PI) / 180) +
            1 / Math.cos((lat * Math.PI) / 180),
        ) /
          Math.PI) /
        2) *
        n,
    );
    return { x, y, zoom: Math.floor(zoom) };
  };

  // Load map tiles
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const zoom = Math.floor(viewState.zoom);
    const centerTile = getTileCoordinates(
      viewState.center.lat,
      viewState.center.lng,
      zoom,
    );

    // Calculate which tiles are visible
    const tilesWide = Math.ceil(canvas.width / 256) + 2;
    const tilesHigh = Math.ceil(canvas.height / 256) + 2;

    const newTiles = new Map<string, HTMLImageElement>();

    for (
      let dx = -Math.ceil(tilesWide / 2);
      dx <= Math.ceil(tilesWide / 2);
      dx++
    ) {
      for (
        let dy = -Math.ceil(tilesHigh / 2);
        dy <= Math.ceil(tilesHigh / 2);
        dy++
      ) {
        const tileX = centerTile.x + dx;
        const tileY = centerTile.y + dy;
        const key = `${zoom}/${tileX}/${tileY}`;

        if (tiles.has(key)) {
          newTiles.set(key, tiles.get(key)!);
        } else {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = `${OSM_TILE_URL}/${zoom}/${tileX}/${tileY}.png`;
          img.onload = () => {
            setTiles((prev) => new Map(prev).set(key, img));
          };
          newTiles.set(key, img);
        }
      }
    }

    // Draw tiles
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const n = Math.pow(2, zoom);
    const centerPixelX =
      ((viewState.center.lng + 180) / 360) * n * 256;
    const centerPixelY =
      ((1 -
        Math.log(
          Math.tan((viewState.center.lat * Math.PI) / 180) +
            1 /
              Math.cos((viewState.center.lat * Math.PI) / 180),
        ) /
          Math.PI) /
        2) *
      n *
      256;

    for (
      let dx = -Math.ceil(tilesWide / 2);
      dx <= Math.ceil(tilesWide / 2);
      dx++
    ) {
      for (
        let dy = -Math.ceil(tilesHigh / 2);
        dy <= Math.ceil(tilesHigh / 2);
        dy++
      ) {
        const tileX = centerTile.x + dx;
        const tileY = centerTile.y + dy;
        const key = `${zoom}/${tileX}/${tileY}`;
        const img = newTiles.get(key);

        if (img && img.complete) {
          const x =
            canvas.width / 2 + (tileX * 256 - centerPixelX);
          const y =
            canvas.height / 2 + (tileY * 256 - centerPixelY);
          ctx.drawImage(img, x, y, 256, 256);
        }
      }
    }
  }, [viewState, tiles]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!canvas || !overlayCanvas) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      overlayCanvas.width = window.innerWidth;
      overlayCanvas.height = window.innerHeight;
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    // Handle both mouse wheel and trackpad gestures
    const delta = e.deltaY > 0 ? -0.5 : 0.5;
    setViewState((prev) => ({
      ...prev,
      zoom: Math.max(6, Math.min(8, prev.zoom + delta)),
    }));
  };

  const handleZoomIn = () => {
    setViewState((prev) => ({
      ...prev,
      zoom: Math.min(8, prev.zoom + 1),
    }));
  };

  const handleZoomOut = () => {
    setViewState((prev) => ({
      ...prev,
      zoom: Math.max(6, prev.zoom - 1),
    }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      lat: viewState.center.lat,
      lng: viewState.center.lng,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    const zoom = Math.floor(viewState.zoom);
    const n = Math.pow(2, zoom);
    const pixelsPerDegree = (n * 256) / 360;

    setViewState((prev) => ({
      ...prev,
      center: {
        lat: dragStart.lat + dy / pixelsPerDegree,
        lng: dragStart.lng - dx / pixelsPerDegree,
      },
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Convert lat/lng to screen coordinates
  const latLngToScreen = (lat: number, lng: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const zoom = Math.floor(viewState.zoom);
    const n = Math.pow(2, zoom);

    const worldX = ((lng + 180) / 360) * n * 256;
    const worldY =
      ((1 -
        Math.log(
          Math.tan((lat * Math.PI) / 180) +
            1 / Math.cos((lat * Math.PI) / 180),
        ) /
          Math.PI) /
        2) *
      n *
      256;

    const centerWorldX =
      ((viewState.center.lng + 180) / 360) * n * 256;
    const centerWorldY =
      ((1 -
        Math.log(
          Math.tan((viewState.center.lat * Math.PI) / 180) +
            1 /
              Math.cos((viewState.center.lat * Math.PI) / 180),
        ) /
          Math.PI) /
        2) *
      n *
      256;

    const x = canvas.width / 2 + (worldX - centerWorldX);
    const y = canvas.height / 2 + (worldY - centerWorldY);

    return { x, y };
  };

  // Get color based on difference from baseline
  const getColorForDifference = (diff: number): string => {
  // NO2 difference in mol/m²
  // Typical NO2 column densities: ~1e-5 to 1e-4 mol/m²
  // Meaningful changes: ~1e-6 mol/m² or larger
  
  // Green for decrease (good), red for increase (bad)
  if (diff < -5e-6) return "rgba(34, 197, 94, 0.3)";   // Strong decrease - dark green
  if (diff < -2e-6) return "rgba(134, 239, 172, 0.3)"; // Moderate decrease - light green
  if (diff < -1e-6) return "rgba(187, 247, 208, 0.3)"; // Slight decrease - very light green
  if (diff < 1e-6) return "rgba(229, 231, 235, 0.3)";  // No significant change - gray
  if (diff < 2e-6) return "rgba(254, 215, 170, 0.3)";  // Slight increase - light orange
  if (diff < 5e-6) return "rgba(251, 146, 60, 0.3)";   // Moderate increase - orange
  return "rgba(239, 68, 68, 0.3)";                      // Strong increase - red
};

// Draw measurement overlay
useEffect(() => {
  const canvas = overlayCanvasRef.current;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ===== OPTIMIZED GRID RENDERING =====
  if (gridData.length > 0) {
    // Find unique lat/lng values to determine grid structure
    const lats = gridData.map(p => p.lat);
    const lngs = gridData.map(p => p.lng);
    const uniqueLats = [...new Set(lats)].sort((a, b) => b - a);
    const uniqueLngs = [...new Set(lngs)].sort((a, b) => a - b);
    const gridHeight = uniqueLats.length;
    const gridWidth = uniqueLngs.length;

    // Create off-screen canvas for the data grid
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = gridWidth;
    offscreenCanvas.height = gridHeight;
    const offscreenCtx = offscreenCanvas.getContext('2d');
    
    if (offscreenCtx) {
      const imageData = offscreenCtx.createImageData(gridWidth, gridHeight);
      const data = imageData.data;

      // Create lookup map for quick access
      const pointMap = new Map();
      gridData.forEach(point => {
        const key = `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
        pointMap.set(key, point);
      });

      // Fill the image data
      for (let row = 0; row < gridHeight; row++) {
        for (let col = 0; col < gridWidth; col++) {
          const lat = uniqueLats[row];
          const lng = uniqueLngs[col];
          const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
          const point = pointMap.get(key);

          if (point) {
            const color = getColorForDifference(point.difference);
            const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
            
            if (match) {
              const idx = (row * gridWidth + col) * 4;
              data[idx] = parseInt(match[1]);
              data[idx + 1] = parseInt(match[2]);
              data[idx + 2] = parseInt(match[3]);
              data[idx + 3] = parseFloat(match[4]) * 255;
            }
          }
        }
      }

      offscreenCtx.putImageData(imageData, 0, 0);

      // Get screen coordinates for the grid bounds
      const topLeft = latLngToScreen(uniqueLats[0], uniqueLngs[0]);
      const bottomRight = latLngToScreen(
        uniqueLats[uniqueLats.length - 1],
        uniqueLngs[uniqueLngs.length - 1]
      );

      if (topLeft && bottomRight && 
          isFinite(topLeft.x) && isFinite(topLeft.y) &&
          isFinite(bottomRight.x) && isFinite(bottomRight.y)) {
        
        const screenWidth = bottomRight.x - topLeft.x;
        const screenHeight = bottomRight.y - topLeft.y;

        // Draw with smooth interpolation
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.drawImage(
          offscreenCanvas,
          topLeft.x,
          topLeft.y,
          screenWidth,
          screenHeight
        );

        // Optional: Apply slight blur for extra smoothness
        ctx.save();
        ctx.filter = 'blur(1px)';
        ctx.globalAlpha = 1;
        ctx.drawImage(canvas, 0, 0);
        ctx.restore();
        ctx.filter = 'none';
      }
    }
  }

  // ===== CITY MARKERS (unchanged) =====
  measurements.forEach((measurement: any) => {
    const pos = latLngToScreen(measurement.city.lat, measurement.city.lng);
    
    if (!pos || !isFinite(pos.x) || !isFinite(pos.y)) {
      return;
    }
    
    const color = getColorForDifference(measurement.difference);

    // Draw city marker
    ctx.strokeStyle = "white";
    ctx.lineWidth = 3;
    ctx.fillStyle = color.replace(/[\d.]+\)$/, "1)"); // Full opacity for markers
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Draw significance indicator
    if (measurement.isSignificant) {
      ctx.strokeStyle = "#1e40af";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 15, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
}, [measurements, gridData, viewState]);

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) return;

    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if click is near any city
    for (const measurement of measurements) {
      const pos = latLngToScreen(
        measurement.city.lat,
        measurement.city.lng,
      );
      const distance = Math.sqrt(
        Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2),
      );

      if (distance < 15) {
        onCitySelect(measurement.city);
        return;
      }
    }
  };

  return (
    <div className="absolute inset-0">
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        onWheel={handleWheel}
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
      />
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0"
        width={window.innerWidth}
        height={window.innerHeight}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        style={{ cursor: isDragging ? "grabbing" : "grab", mixBlendMode: "multiply" }}
      />
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <button
          className="bg-white hover:bg-gray-100 p-2 rounded-lg shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleZoomIn}
          disabled={viewState.zoom >= 8}
          aria-label="Zoom in"
        >
          <Plus className="w-5 h-5" />
        </button>
        <button
          className="bg-white hover:bg-gray-100 p-2 rounded-lg shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleZoomOut}
          disabled={viewState.zoom <= 6}
          aria-label="Zoom out"
        >
          <Minus className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}