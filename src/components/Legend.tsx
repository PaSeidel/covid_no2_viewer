export function Legend() {
  return (
    <div className="absolute top-6 left-6 bg-white rounded-lg shadow-xl p-4 w-72">
      <h3 className="mb-3">NO₂ Change from Baseline</h3>
      
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded flex-shrink-0 shadow-sm" style={{ backgroundColor: 'rgba(34, 197, 94, 0.8)' }} />
          <div className="flex-1 text-sm">
            <div>&lt; -15 μg/m³</div>
            <div className="text-xs text-gray-500">Strong decrease</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded flex-shrink-0 shadow-sm" style={{ backgroundColor: 'rgba(134, 239, 172, 0.8)' }} />
          <div className="flex-1 text-sm">
            <div>-8 to -15 μg/m³</div>
            <div className="text-xs text-gray-500">Moderate decrease</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded flex-shrink-0 shadow-sm" style={{ backgroundColor: 'rgba(187, 247, 208, 0.8)' }} />
          <div className="flex-1 text-sm">
            <div>-3 to -8 μg/m³</div>
            <div className="text-xs text-gray-500">Slight decrease</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded flex-shrink-0 shadow-sm" style={{ backgroundColor: 'rgba(229, 231, 235, 0.8)' }} />
          <div className="flex-1 text-sm">
            <div>-3 to +3 μg/m³</div>
            <div className="text-xs text-gray-500">No change</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded flex-shrink-0 shadow-sm" style={{ backgroundColor: 'rgba(254, 215, 170, 0.8)' }} />
          <div className="flex-1 text-sm">
            <div>+3 to +8 μg/m³</div>
            <div className="text-xs text-gray-500">Slight increase</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded flex-shrink-0 shadow-sm" style={{ backgroundColor: 'rgba(251, 146, 60, 0.8)' }} />
          <div className="flex-1 text-sm">
            <div>+8 to +15 μg/m³</div>
            <div className="text-xs text-gray-500">Moderate increase</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded flex-shrink-0 shadow-sm" style={{ backgroundColor: 'rgba(239, 68, 68, 0.8)' }} />
          <div className="flex-1 text-sm">
            <div>&gt; +15 μg/m³</div>
            <div className="text-xs text-gray-500">Strong increase</div>
          </div>
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
