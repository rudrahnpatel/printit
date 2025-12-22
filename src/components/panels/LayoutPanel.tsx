import React from 'react';
import { Layout } from 'lucide-react';
import { PAPER_SIZES } from '../../hooks/useAppLogic';

interface LayoutPanelProps {
    paperSize: keyof typeof PAPER_SIZES;
    setPaperSize: (size: keyof typeof PAPER_SIZES) => void;
    allowRotation: boolean;
    setAllowRotation: (val: boolean) => void;
    margin: number;
    setMargin: (val: number) => void;
    gap: number;
    setGap: (val: number) => void;
}

export const LayoutPanel: React.FC<LayoutPanelProps> = ({
    paperSize,
    setPaperSize,
    allowRotation,
    setAllowRotation,
    margin,
    setMargin,
    gap,
    setGap
}) => {
    return (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-zinc-100">
            <h3 className="font-semibold text-zinc-800 text-sm flex items-center gap-2 mb-4">
                <Layout className="w-4 h-4 text-indigo-500" />
                Paper & Layout
            </h3>

            <div className="space-y-5">
                {/* Paper Size */}
                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500">Paper Size</label>
                    <div className="relative">
                        <select
                            value={paperSize}
                            onChange={(e) => setPaperSize(e.target.value as keyof typeof PAPER_SIZES)}
                            className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none font-medium transition-all"
                        >
                            {Object.entries(PAPER_SIZES).map(([key, size]) => (
                                <option key={key} value={key}>{size.label}</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                            <ListIcon />
                        </div>
                    </div>
                </div>

                {/* Margin & Gap Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-zinc-500 flex justify-between">
                            Margin (mm)
                            <span className="text-indigo-600">{margin}</span>
                        </label>
                        <input
                            type="number"
                            min="0"
                            max="50"
                            value={margin}
                            onChange={(e) => setMargin(Number(e.target.value))}
                            className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono text-zinc-700"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-zinc-500 flex justify-between">
                            Gap (mm)
                            <span className="text-indigo-600">{gap}</span>
                        </label>
                        <input
                            type="number"
                            min="0"
                            max="50"
                            value={gap}
                            onChange={(e) => setGap(Number(e.target.value))}
                            className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono text-zinc-700"
                        />
                    </div>
                </div>

                {/* Rotation Toggle */}
                <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                    <span className="text-sm font-medium text-zinc-600">Auto-Rotate</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={allowRotation} onChange={(e) => setAllowRotation(e.target.checked)} className="sr-only peer" />
                        <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                </div>
            </div>
        </div>
    );
};

// Helper Icon
const ListIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6"></line>
        <line x1="8" y1="12" x2="21" y2="12"></line>
        <line x1="8" y1="18" x2="21" y2="18"></line>
        <line x1="3" y1="6" x2="3.01" y2="6"></line>
        <line x1="3" y1="12" x2="3.01" y2="12"></line>
        <line x1="3" y1="18" x2="3.01" y2="18"></line>
    </svg>
)
