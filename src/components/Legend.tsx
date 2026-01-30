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
    
    // Gray in middle (no change)
    gradient.addColorStop(0.5, 'rgb(229, 231, 235)');
    
    // Red at bottom (strong increase)
    gradient.addColorStop(1, 'rgb(239, 68, 68)');

    // Draw the gradient
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  return (
    <div className="absolute top-6 left-6 bg-white rounded-lg shadow-xl p-4 w-64">
      <h3 className="font-semibold mb-3">NO₂ Change from Baseline</h3>
      
      <div className="flex gap-3 mb-2">
        <canvas 
          ref={canvasRef}
          width={32}
          height={160}
          className="rounded shadow-sm"
        />
        
        <div className="flex-1 flex flex-col justify-between text-sm py-1">
          <div className="font-medium">-50% change</div>
          <div className="font-medium">No change</div>
          <div className="font-medium">+50% change</div>
        </div>
      </div>

      <div className="pt-3 border-t border-gray-200 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white" />
          <span className="text-gray-600">City marker</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white relative">
            <div className="absolute inset-0 rounded-full border-3 border-blue-700" style={{ transform: 'scale(1.5)' }} />
          </div>
          <span className="text-gray-600">Statistically significant (p &lt; 0.05)</span>
        </div>
      </div>
    </div>
  );
}