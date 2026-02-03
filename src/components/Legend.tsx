import { useEffect, useRef } from 'react';

export function Legend() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    
    // Dark green at top (strong decrease)
    gradient.addColorStop(0, 'rgb(34, 197, 94)');
    gradient.addColorStop(0.25, 'rgb(134, 239, 172)');
    
    // Gray in middle (no change)
    gradient.addColorStop(0.48, 'rgb(243, 244, 246)');
    gradient.addColorStop(0.5, 'rgb(229, 231, 235)');
    gradient.addColorStop(0.52, 'rgb(243, 244, 246)');
    
    // Red at bottom (strong increase)
    gradient.addColorStop(0.75, 'rgb(252, 165, 165)');
    gradient.addColorStop(1, 'rgb(239, 68, 68)');

    // Draw the gradient
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  return (
    <div className="absolute top-6 left-6 bg-white rounded-lg shadow-xl p-4 w-64">
      <h3 className="font-semibold mb-3 text-gray-800">NO₂ Change from Baseline</h3>
      
      <div className="flex gap-4 mb-2">
        <div className="relative">
          <canvas 
            ref={canvasRef}
            width={40}
            height={180}
            className="rounded"
          />
          {/* Tick marks */}
          <div className="absolute top-0 -right-2 w-2 h-px bg-gray-400" />
          <div className="absolute top-1/2 -translate-y-1/2 -right-2 w-2 h-px bg-gray-400" />
          <div className="absolute bottom-0 -right-2 w-2 h-px bg-gray-400" />
        </div>
        
        <div className="flex-1 flex flex-col justify-between text-sm py-1">
          <div>
            <div className="font-semibold text-green-600">-50%</div>
            <div className="text-xs text-gray-500">Strong decrease</div>
          </div>
          <div>
            <div className="font-semibold text-gray-600">0%</div>
            <div className="text-xs text-gray-500">No change</div>
          </div>
          <div>
            <div className="font-semibold text-red-600">+50%</div>
            <div className="text-xs text-gray-500">Strong increase</div>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-gray-200 space-y-3">
        <div className="flex items-center gap-3 text-xs">
          <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white flex-shrink-0" />
          <span className="text-gray-600">City marker</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white relative flex-shrink-0">
            <div className="absolute inset-0 rounded-full border-2 border-blue-600" style={{ transform: 'scale(1.6)' }} />
          </div>
          <span className="text-gray-600">Statistically significant (p &lt; 0.05)</span>
        </div>
      </div>
    </div>
  );
}