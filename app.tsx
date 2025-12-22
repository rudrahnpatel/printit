import React from 'react';
import { useAppLogic } from './src/hooks/useAppLogic';
import { Sidebar } from './src/components/sidebar/Sidebar';
import { MainPreview } from './src/components/preview/MainPreview';
import { MobileNav } from './src/components/mobile/MobileNav';
import { ImportPanel } from './src/components/panels/ImportPanel';
import { AdjustPanel } from './src/components/panels/AdjustPanel';
import { LayoutPanel } from './src/components/panels/LayoutPanel';
import { List, X } from 'lucide-react';

// --- MAIN APP COMPONENT ---

export default function PrintIt() {
    const appState = useAppLogic();
    const {
        activeTab,
        setShowMobilePanel,
        showMobilePanel,
        activeMobileTool,
        setActiveMobileTool,
        images,
        packedPages,
        paperSize,
        margin,
        setMargin,
        gap,
        setGap,
        setPreviewScale,
        selectedImageId,
        setSelectedImageId,
        setActiveTab,
        setMobileAdjustMode,
        handleFileUpload,
        isProcessing,
        updateImageScale,
        removeImage,
        setUseUniformSize,
        useUniformSize,
        setTargetSize,
        targetSize,
        setGlobalScale,
        globalScale,
        mobileAdjustMode,
        setPaperSize,
        setAllowRotation,
        allowRotation,
        handleSort,
        clearAll,
        dragItem,
        dragOverItem,
        activePaper,
        handlePrint
    } = appState;

    // --- RENDER HELPERS (FOR MOBILE FLOATING PANELS) ---
    // We render these "conditionally" but separate from the Sidebar so they float over Preview

    const renderMobilePanelContent = () => {
        if (activeMobileTool === 'import') {
            return <ImportPanel handleFileUpload={handleFileUpload} isProcessing={isProcessing} />;
        }
        if (activeMobileTool === 'adjust') {
            return (
                <AdjustPanel
                    images={images}
                    selectedImageId={selectedImageId}
                    updateImageScale={updateImageScale}
                    removeImage={removeImage}
                    useUniformSize={useUniformSize}
                    setUseUniformSize={setUseUniformSize}
                    targetSize={targetSize}
                    setTargetSize={setTargetSize}
                    globalScale={globalScale}
                    setGlobalScale={setGlobalScale}
                    margin={margin}
                    setMargin={setMargin}
                    gap={gap}
                    setGap={setGap}
                    mobileAdjustMode={mobileAdjustMode}
                    setMobileAdjustMode={setMobileAdjustMode}
                    isMobile={true}
                />
            );
        }
        if (activeMobileTool === 'layout') {
            return (
                <LayoutPanel
                    paperSize={paperSize}
                    setPaperSize={setPaperSize}
                    allowRotation={allowRotation}
                    setAllowRotation={setAllowRotation}
                    margin={margin}
                    setMargin={setMargin}
                    gap={gap}
                    setGap={setGap}
                />
            );
        }
        return null; // Should not happen if filtered correctly
    };

    return (
        <div className="flex h-screen bg-zinc-50 overflow-hidden font-outfit text-zinc-900 app-container">
            {/* 1. DESKTOP SIDEBAR */}
            <Sidebar appState={appState} />

            {/* 2. MAIN PREVIEW AREA */}
            <div className="flex-1 flex flex-col relative h-full overflow-hidden">
                {/* Header (Hidden on Mobile) */}

                <MainPreview
                    imagesCount={images.length}
                    packedPages={packedPages}
                    activePaper={activePaper}
                    margin={margin}
                    previewScale={1} // The component calculates its own scale but needs a prop if we hoist it. Let's let it manage self for now or pass state if needed.
                    // MainPreview uses internal logic for scale OR we pass it. 
                    // Let's pass the setter from useAppLogic state if we added it there. 
                    // Wait, useAppLogic does not have previewScale state exported? 
                    // I will double check useAppLogic. It does NOT export previewScale/setPreviewScale.
                    // I should handle it inside MainPreview entirely or add it to hook.
                    // MainPreview logic uses internal state for scale in my implementation above. 
                    // So I will just pass a dummy 1 and a dummy setter, OR refactor MainPreview to NOT take them. 
                    // I'll refactor logic: MainPreview has internal state effectively.
                    setPreviewScale={() => { }} // Dummy
                    selectedImageId={selectedImageId}
                    setSelectedImageId={setSelectedImageId}
                    setActiveTab={setActiveTab}
                    setShowMobilePanel={setShowMobilePanel}
                    setActiveMobileTool={setActiveMobileTool}
                    setMobileAdjustMode={setMobileAdjustMode}
                />
            </div>

            {/* 3. MOBILE: FLOATING PANEL (The Fix) */}
            {/* 
                Problem: Previous implementation wrapped content in `activeTab && (...)` which hid MainPreview. 
                Fix: This panel is an OVERLAY. MainPreview is always rendered behind it.
            */}
            {showMobilePanel && (
                <div className="md:hidden fixed bottom-24 left-4 right-4 z-40 animate-in slide-in-from-bottom-10 fade-in duration-300">

                    {/* CASE A: IMAGES LIST (Sequence Tab) */}
                    {activeTab === 'sequence' && (
                        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-200/50 p-4 max-h-[50vh] overflow-y-auto">
                            <div className="flex justify-between items-center px-1 mb-2">
                                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Drag to reorder</p>
                                <button
                                    onClick={clearAll}
                                    className="text-xs text-rose-500 hover:text-rose-700 font-medium hover:underline"
                                >
                                    Clear All
                                </button>
                            </div>
                            {images.length === 0 ? (
                                <div className="text-center text-zinc-400 py-8">
                                    <p className="text-sm">No images yet</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {images.map((img, index) => (
                                        <div
                                            key={img.id}
                                            draggable
                                            onDragStart={(e) => {
                                                dragItem.current = index;
                                            }}
                                            onDragEnter={(e) => {
                                                dragOverItem.current = index;
                                            }}
                                            onDragEnd={handleSort}
                                            onDragOver={(e) => { e.preventDefault() }}
                                            className="flex items-center gap-3 bg-white p-2 rounded-lg border border-zinc-100 shadow-sm"
                                        >
                                            <div className="w-10 h-10 rounded bg-zinc-100 overflow-hidden shrink-0">
                                                <img src={img.src} alt="" className="w-full h-full object-cover" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium text-zinc-700 truncate">{img.name}</p>
                                            </div>
                                            <button
                                                onClick={(e) => removeImage(img.id, e)}
                                                className="p-1 text-zinc-400 hover:text-rose-500"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* CASE B: TOOL CARDS (Settings Tab + Active Tool) */}
                    {activeTab === 'settings' && activeMobileTool && (
                        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-200/50 p-4">
                            <div className="max-h-[50vh] overflow-y-auto scrollbar-hide">
                                {renderMobilePanelContent()}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 4. MOBILE NAVIGATION */}
            <div className="md:hidden">
                <MobileNav
                    toggleMobileTab={appState.toggleMobileTab}
                    handlePrint={handlePrint}
                    activeTab={activeTab}
                    showMobilePanel={showMobilePanel}
                    imagesCount={images.length}
                    activeMobileTool={activeMobileTool}
                    setActiveMobileTool={setActiveMobileTool}
                    setActiveTab={setActiveTab}
                    setShowMobilePanel={setShowMobilePanel}
                    setMobileAdjustMode={setMobileAdjustMode}
                    hasSelection={!!selectedImageId}
                />
            </div>

            {/* PRINT STYLES */}
            <style>{`
                @media print {
                    body, html, #root, .app-container {
                        height: auto !important;
                        overflow: visible !important;
                        display: block !important;
                        background: white !important;
                    }
                    .no-print { display: none !important; }
                    @page {
                        size: ${paperSize === 'A4' ? 'A4' : paperSize === 'A3' ? 'A3' : 'auto'};
                        margin: 0;
                    }
                    .print-container {
                        padding: 0 !important;
                        margin: 0 !important;
                        display: block !important;
                        position: static !important;
                        width: 100% !important;
                    }
                     /* Ensure grid/flex doesn't break print */
                    .page-wrapper {
                        break-after: page;
                        width: 100% !important;
                        height: 100% !important;
                        align-items: flex-start !important; 
                        margin-bottom: 0 !important;
                    }
                     /* Hide page break on last item if needed, but usually fine */
                    .print-sheet {
                        box-shadow: none !important;
                        border: none !important;
                        transform: none !important;
                        position: relative !important;
                        left: 0 !important;
                        top: 0 !important;
                        margin: 0 !important;
                         /* Ensure it fits on page */
                    }
                }
            `}</style>
        </div>
    );
}