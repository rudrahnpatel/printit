import React from 'react';
import { Trash2, RotateCw, Maximize2, Move, GripVertical, Check } from 'lucide-react';
import { BinImage } from '../../hooks/useAppLogic'; // Fix path if needed

interface AdjustPanelProps {
    images: BinImage[];
    selectedImageId: string | null;
    updateImageScale: (id: string, scale: number) => void;
    removeImage: (id: string, e?: React.MouseEvent) => void;
    useUniformSize: boolean;
    setUseUniformSize: (val: boolean) => void;
    targetSize: number;
    setTargetSize: (val: number) => void;
    globalScale: number;
    setGlobalScale: (val: number) => void;
    margin: number;
    setMargin: (val: number) => void;
    gap: number;
    setGap: (val: number) => void;
    mobileAdjustMode: 'individual' | 'global' | 'spacing';
    setMobileAdjustMode: (mode: 'individual' | 'global' | 'spacing') => void;
    isMobile: boolean; // Flag to render mobile specific view
}

export const AdjustPanel: React.FC<AdjustPanelProps> = ({
    images,
    selectedImageId,
    updateImageScale,
    removeImage,
    useUniformSize,
    setUseUniformSize,
    targetSize,
    setTargetSize,
    globalScale,
    setGlobalScale,
    margin,
    setMargin,
    gap,
    setGap,
    mobileAdjustMode,
    setMobileAdjustMode,
    isMobile
}) => {
    const selectedImage = images.find(i => i.id === selectedImageId);

    // --- MOBILE VIEW ---
    if (isMobile) {
        return (
            <div className="flex flex-col h-full bg-white/50">
                {/* TABS */}
                <div className="flex p-1 bg-zinc-100/80 rounded-xl mb-4">
                    <button
                        onClick={() => setMobileAdjustMode('individual')}
                        disabled={!selectedImage}
                        className={`flex-1 py-1.5 text-[10px] font-semibold rounded-lg transition-all ${mobileAdjustMode === 'individual' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-400 hover:text-zinc-600 disabled:opacity-30'}`}
                    >
                        Single
                    </button>
                    <button
                        onClick={() => setMobileAdjustMode('global')}
                        className={`flex-1 py-1.5 text-[10px] font-semibold rounded-lg transition-all ${mobileAdjustMode === 'global' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setMobileAdjustMode('spacing')}
                        className={`flex-1 py-1.5 text-[10px] font-semibold rounded-lg transition-all ${mobileAdjustMode === 'spacing' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}
                    >
                        Space
                    </button>
                </div>

                {/* CONTENT */}
                <div className="flex-1">
                    {mobileAdjustMode === 'individual' && selectedImage && (
                        <div className="flex items-center gap-3">
                            <div className="flex-1">
                                <input
                                    type="range"
                                    min="10"
                                    max="200"
                                    step="5"
                                    value={selectedImage.scale * 100}
                                    onChange={(e) => updateImageScale(selectedImage.id, Number(e.target.value) / 100)}
                                    className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-500"
                                />
                            </div>
                            <span className="text-xs font-bold text-indigo-600 min-w-[3ch]">{(selectedImage.scale * 100).toFixed(0)}%</span>
                            <button
                                onClick={(e) => removeImage(selectedImage.id, e)}
                                className="p-2 text-rose-600 bg-rose-50 border border-rose-100 rounded-lg active:scale-95 transition-all"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {mobileAdjustMode === 'global' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-zinc-600">Uniform Size</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={useUniformSize} onChange={(e) => setUseUniformSize(e.target.checked)} className="sr-only peer" />
                                    <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>
                            {useUniformSize ? (
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-bold text-zinc-400 w-12 text-right">Max Len</span>
                                    <input
                                        type="range"
                                        min="20"
                                        max="200"
                                        value={targetSize}
                                        onChange={(e) => setTargetSize(Number(e.target.value))}
                                        className="flex-1 h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                    />
                                    <span className="text-[10px] font-bold text-zinc-500 min-w-[3ch]">{targetSize}</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-bold text-zinc-400 w-12 text-right">Scale</span>
                                    <input
                                        type="range"
                                        min="10"
                                        max="200"
                                        step="5"
                                        value={globalScale}
                                        onChange={(e) => setGlobalScale(Number(e.target.value))}
                                        className="flex-1 h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                    />
                                    <span className="text-[10px] font-bold text-zinc-500 min-w-[3ch]">{globalScale}%</span>
                                </div>
                            )}
                        </div>
                    )}

                    {mobileAdjustMode === 'spacing' && (
                        <div className="space-y-3">
                            {/* Margin Slider */}
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-zinc-400 w-12 text-right">Margin</span>
                                <input
                                    type="range"
                                    min="0"
                                    max="50"
                                    value={margin}
                                    onChange={(e) => setMargin(Number(e.target.value))}
                                    className="flex-1 h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                />
                                <span className="text-[10px] font-bold text-zinc-500 min-w-[3ch]">{margin}</span>
                            </div>

                            {/* Gap Slider */}
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-zinc-400 w-12 text-right">Gap</span>
                                <input
                                    type="range"
                                    min="0"
                                    max="20"
                                    value={gap}
                                    onChange={(e) => setGap(Number(e.target.value))}
                                    className="flex-1 h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                />
                                <span className="text-[10px] font-bold text-zinc-500 min-w-[3ch]">{gap}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // --- DESKTOP VIEW ---
    return (
        <div className="space-y-6">
            {/* Selected Image Editor */}
            {selectedImage ? (
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-zinc-100 ring-4 ring-zinc-50/50">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-zinc-800 text-sm flex items-center gap-2">
                            <Maximize2 className="w-4 h-4 text-indigo-500" />
                            Selected Image
                        </h3>
                        <button
                            onClick={(e) => removeImage(selectedImage.id, e)}
                            className="p-1.5 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Remove image"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between text-xs text-zinc-500">
                            <span>Scale</span>
                            <span className="font-mono bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-700">
                                {(selectedImage.scale * 100).toFixed(0)}%
                            </span>
                        </div>
                        <input
                            type="range"
                            min="10"
                            max="200"
                            step="5"
                            value={selectedImage.scale * 100}
                            onChange={(e) => updateImageScale(selectedImage.id, Number(e.target.value) / 100)}
                            className="w-full h-2 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-500"
                        />
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-400 font-mono">
                            <div>Original: {Math.round(selectedImage.originalWidth)}x{Math.round(selectedImage.originalHeight)}mm</div>
                            <div className="text-right">Current: {Math.round(selectedImage.width)}x{Math.round(selectedImage.height)}mm</div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="hidden md:block p-4 border-2 border-dashed border-zinc-200 rounded-xl text-center">
                    <p className="text-xs text-zinc-400">Select an image on the paper to edit it individually</p>
                </div>
            )}

            {/* Global Sizing */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-zinc-100">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-zinc-800 text-sm flex items-center gap-2">
                        <Check className="w-4 h-4 text-indigo-500" />
                        Global Sizing
                    </h3>
                </div>

                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-600">Uniform Size</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={useUniformSize} onChange={(e) => setUseUniformSize(e.target.checked)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>

                    {useUniformSize ? (
                        <div className="space-y-3">
                            <div className="flex justify-between text-xs mb-1">
                                <span className="font-medium text-zinc-500">Max Length</span>
                                <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-mono font-medium">{targetSize} mm</span>
                            </div>
                            <input
                                type="range"
                                min="20"
                                max="200"
                                value={targetSize}
                                onChange={(e) => setTargetSize(Number(e.target.value))}
                                className="w-full h-2 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-500"
                            />
                            <p className="text-[10px] text-zinc-400 leading-relaxed">
                                Resizes all images so their longest side matches this value.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex justify-between text-xs mb-1">
                                <span className="font-medium text-zinc-500">Scale All</span>
                                <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-mono font-medium">{globalScale}%</span>
                            </div>
                            <input
                                type="range"
                                min="10"
                                max="200"
                                step="5"
                                value={globalScale}
                                onChange={(e) => setGlobalScale(Number(e.target.value))}
                                className="w-full h-2 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-500"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
