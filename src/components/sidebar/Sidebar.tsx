import React, { useRef } from 'react';
import { List, X } from 'lucide-react';
import { useAppLogic } from '../../hooks/useAppLogic';
import { ImportPanel } from '../panels/ImportPanel';
import { AdjustPanel } from '../panels/AdjustPanel';
import { LayoutPanel } from '../panels/LayoutPanel';

interface SidebarProps {
    appState: ReturnType<typeof useAppLogic>;
}

export const Sidebar: React.FC<SidebarProps> = ({ appState }) => {
    // Destructure appState for easier usage
    const {
        images,
        handleFileUpload,
        isProcessing,
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
        paperSize,
        setPaperSize,
        allowRotation,
        setAllowRotation,
        activeTab,
        setActiveTab,
        clearAll,
        handleSort,
        dragItem,
        dragOverItem
    } = appState;

    const renderImport = <ImportPanel handleFileUpload={handleFileUpload} isProcessing={isProcessing} />;

    // DESKTOP: Render Sidebar 
    return (
        <aside className="w-[400px] bg-white border-r border-zinc-200 hidden md:flex flex-col z-20 h-screen shadow-[4px_0_24px_-5px_rgba(0,0,0,0.05)]">
            {/* Header */}
            <div className="p-6 border-b border-zinc-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-3 mb-1">
                    <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-lg shadow-indigo-200">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-700 to-indigo-500 bg-clip-text text-transparent">EzzPrint</h1>
                        <p className="text-[10px] items-center gap-2 font-medium bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full inline-flex">
                            v2.0 <span className="w-1 h-1 bg-indigo-400 rounded-full" /> Beta
                        </p>
                    </div>
                </div>
            </div>

            {/* Tabs Toggle */}
            <div className="px-6 py-4">
                <div className="bg-zinc-100 p-1 rounded-xl flex gap-1 border border-zinc-200/50">
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`flex-1 py-2.5 px-4 rounded-[10px] text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'settings' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50'}`}
                    >
                        Layout
                    </button>
                    <button
                        onClick={() => setActiveTab('sequence')}
                        className={`flex-1 py-2.5 px-4 rounded-[10px] text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'sequence' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50'}`}
                    >
                        Images
                        <span className={`px-2 py-0.5 rounded-full text-[10px] transition-colors ${activeTab === 'sequence' ? 'bg-indigo-50 text-indigo-700' : 'bg-zinc-200 min-w-[20px]'}`}>
                            {images.length}
                        </span>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-8 scrollbar-hide">
                {activeTab === 'settings' && (
                    <div className="space-y-8">
                        {renderImport}
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
                            isMobile={false}
                        />
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
                    </div>
                )}

                {activeTab === 'sequence' && (
                    <div className="space-y-4">
                        {images.length === 0 ? (
                            <div className="text-center text-zinc-400 py-12 flex flex-col items-center border-2 border-dashed border-zinc-200 rounded-2xl bg-zinc-50/50">
                                <List className="w-10 h-10 mb-3 opacity-20" />
                                <p className="text-sm font-medium text-zinc-500">No images yet</p>
                                <p className="text-xs">Upload images in the Settings tab.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center px-1">
                                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Drag to reorder</p>
                                    <button
                                        onClick={clearAll}
                                        className="text-xs text-rose-500 hover:text-rose-700 font-medium hover:underline"
                                    >
                                        Clear All
                                    </button>
                                </div>
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
                                        onDragOver={(e) => e.preventDefault()}
                                        className="group relative flex items-center gap-3 bg-white p-3 rounded-xl border border-zinc-100 shadow-sm hover:shadow-md transition-all cursor-move active:scale-95 active:shadow-inner"
                                    >
                                        <div className="text-zinc-300">
                                            {/* Grip Icon */}
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5v14M15 5v14" /></svg>
                                        </div>
                                        <div className="w-12 h-12 rounded-lg bg-zinc-100 overflow-hidden shrink-0 border border-zinc-200">
                                            <img src={img.src} alt="" className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-zinc-700 truncate">{img.name}</p>
                                            <p className="text-[10px] text-zinc-400 mt-0.5">{Math.round(img.originalWidth)} x {Math.round(img.originalHeight)} mm</p>
                                        </div>
                                        <button
                                            onClick={(e) => removeImage(img.id, e)}
                                            className="opacity-0 group-hover:opacity-100 p-2 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </aside>
    );
}
