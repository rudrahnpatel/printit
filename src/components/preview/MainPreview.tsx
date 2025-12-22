import React, { useRef, useEffect, useState } from 'react';
import { Layout } from 'lucide-react';
import { PackedImage, PAPER_SIZES } from '../../hooks/useAppLogic';

interface MainPreviewProps {
    imagesCount: number;
    packedPages: PackedImage[][];
    activePaper: { width: number; height: number; label: string };
    margin: number;
    previewScale: number;
    setPreviewScale: (scale: number) => void;
    selectedImageId: string | null;
    setSelectedImageId: (id: string) => void;
    setActiveTab: (tab: 'settings' | 'sequence') => void;
    setShowMobilePanel: (show: boolean) => void;
    setActiveMobileTool: (tool: 'import' | 'adjust' | 'layout' | null) => void;
    setMobileAdjustMode: (mode: 'individual' | 'global') => void;
}

export const MainPreview: React.FC<MainPreviewProps> = ({
    imagesCount,
    packedPages,
    activePaper,
    margin,
    previewScale,
    setPreviewScale,
    selectedImageId,
    setSelectedImageId,
    setActiveTab,
    setShowMobilePanel,
    setActiveMobileTool,
    setMobileAdjustMode
}) => {
    const mainContainerRef = useRef<HTMLElement>(null);

    // --- SCALING LOGIC MOVED HERE ---
    useEffect(() => {
        const updateScale = () => {
            if (!mainContainerRef.current) return;
            const paperWidthPx = activePaper.width * 3.78;
            const containerWidth = mainContainerRef.current.clientWidth;
            const padding = 48;

            if (containerWidth < paperWidthPx + padding) {
                const newScale = (containerWidth - padding) / paperWidthPx;
                setPreviewScale(Math.max(newScale, 0.1));
            } else {
                setPreviewScale(1);
            }
        };

        updateScale();
        const observer = new ResizeObserver(updateScale);
        if (mainContainerRef.current) observer.observe(mainContainerRef.current);

        return () => observer.disconnect();
    }, [activePaper, setPreviewScale]);


    return (
        <main
            ref={mainContainerRef}
            onClick={() => setShowMobilePanel(false)}
            className="flex-1 overflow-auto bg-zinc-100/50 p-4 md:p-12 pb-32 md:pb-12 flex flex-col items-center relative z-0"
        // Z-0 is crucial to ensure it stays below fixed elements but visible
        >
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

            {imagesCount === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-400 space-y-6 animate-in fade-in zoom-in duration-500">
                    <div className="w-32 h-32 bg-white rounded-full shadow-xl shadow-zinc-200 flex items-center justify-center relative">
                        <div className="absolute inset-0 bg-indigo-50/50 rounded-full animate-ping opacity-75"></div>
                        <Layout className="w-12 h-12 text-indigo-300 relative z-10" />
                    </div>
                    <div className="text-center max-w-sm">
                        <h3 className="text-xl font-bold text-zinc-700 mb-2">Ready to Start</h3>
                        <p className="text-sm text-zinc-500">Upload your images to automatically generate an optimized layout for printing.</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-12 pb-20 print-container relative z-10 w-full flex flex-col items-center">
                    {/* Width Full and Flex Col Center added to fix visibility */}
                    {packedPages.map((pageImages, pageIdx) => (
                        <div key={pageIdx} className="relative group page-wrapper w-full flex flex-col items-center">
                            {/* Page Label (Screen Only) */}
                            <div className="absolute -left-32 top-0 text-sm font-bold text-zinc-300 no-print w-24 text-right pt-4 hidden md:block">
                                Page {pageIdx + 1}
                            </div>
                            <div className="md:hidden pb-2 text-xs font-bold text-zinc-400 self-start">
                                Page {pageIdx + 1}
                            </div>

                            {/* Responsive Scaling Container */}
                            <div
                                className="relative transition-transform duration-300 origin-top"
                                style={{
                                    width: `${activePaper.width * 3.78 * previewScale}px`,
                                    height: `${activePaper.height * 3.78 * previewScale}px`
                                }}
                            >
                                {/* The Paper Sheet (Scaled) */}
                                <div
                                    className="absolute top-0 left-0 bg-white shadow-2xl shadow-zinc-300/50 overflow-hidden print-sheet sheet ring-1 ring-zinc-900/5 transition-transform duration-300 origin-top-left"
                                    style={{
                                        width: `${activePaper.width}mm`,
                                        height: `${activePaper.height}mm`,
                                        transform: `scale(${previewScale})`
                                    }}
                                >
                                    {/* Visual Guide for Margins (Screen Only) */}
                                    <div
                                        className="absolute border border-dashed border-zinc-200 pointer-events-none no-print"
                                        style={{
                                            left: `${margin}mm`,
                                            top: `${margin}mm`,
                                            right: `${margin}mm`,
                                            bottom: `${margin}mm`,
                                            zIndex: 10
                                        }}
                                    />

                                    {/* Images */}
                                    {pageImages.map((img, imgIdx) => (
                                        <div
                                            key={`${img.id}-${imgIdx}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedImageId(img.id);
                                                setActiveTab('settings');
                                                setShowMobilePanel(true);
                                                setActiveMobileTool('adjust');
                                                setMobileAdjustMode('individual');
                                            }}
                                            className={`
                    absolute overflow-hidden group/img transition-all duration-200 cursor-pointer hover:shadow-lg
                    ${selectedImageId === img.id ? 'z-30 ring-4 ring-indigo-500/50 shadow-2xl scale-[1.01]' : 'hover:z-20 hover:ring-2 hover:ring-indigo-200 hover:-translate-y-0.5'}
                  `}
                                            style={{
                                                left: `${img.x + margin}mm`,
                                                top: `${img.y + margin}mm`,
                                                width: `${img.renderWidth}mm`,
                                                height: `${img.renderHeight}mm`,
                                            }}
                                            title={`${Math.round(img.width)}x${Math.round(img.height)}mm`}
                                        >
                                            {selectedImageId === img.id && (
                                                <div className="absolute inset-0 bg-indigo-600/10 pointer-events-none z-10 no-print mix-blend-multiply" />
                                            )}

                                            {img.rotated ? (
                                                <img
                                                    src={img.src}
                                                    alt=""
                                                    className="absolute w-full h-full object-cover"
                                                    style={{
                                                        width: `${img.width}mm`,
                                                        height: `${img.height}mm`,
                                                        left: '50%',
                                                        top: '50%',
                                                        transform: 'translate(-50%, -50%) rotate(90deg)',
                                                        maxWidth: 'none',
                                                    }}
                                                />
                                            ) : (
                                                <img
                                                    src={img.src}
                                                    alt=""
                                                    className="w-full h-full object-cover block"
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </main>
    );
}
