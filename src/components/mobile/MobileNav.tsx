import React from 'react';
import { Settings, Printer, List, Upload, Scaling } from 'lucide-react';
import { useAppLogic } from '../../hooks/useAppLogic'; // We will fix imports later when App is refactored

interface MobileNavProps {
    toggleMobileTab: (tab: 'settings' | 'sequence') => void;
    handlePrint: () => void;
    activeTab: 'settings' | 'sequence';
    showMobilePanel: boolean;
    imagesCount: number;
    activeMobileTool: 'import' | 'adjust' | 'layout' | null;
    setActiveMobileTool: (tool: 'import' | 'adjust' | 'layout' | null) => void;
    setActiveTab: (tab: 'settings' | 'sequence') => void;
    setShowMobilePanel: (show: boolean) => void;
    setMobileAdjustMode: (mode: 'individual' | 'global') => void;
    hasSelection: boolean;
}

export const MobileNav: React.FC<MobileNavProps> = ({
    toggleMobileTab,
    handlePrint,
    activeTab,
    showMobilePanel,
    imagesCount,
    activeMobileTool,
    setActiveMobileTool,
    setActiveTab,
    setShowMobilePanel,
    setMobileAdjustMode,
    hasSelection
}) => {

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 z-50 grid grid-cols-5 items-end p-2 pb-safe no-print safe-area-bottom shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)]">
            {/* 1. Upload */}
            <button
                onClick={() => {
                    setActiveTab('settings');
                    setShowMobilePanel(true);
                    setActiveMobileTool('import');
                }}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-300 ${activeMobileTool === 'import' && showMobilePanel ? 'text-indigo-600 bg-indigo-50/50' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
                <Upload className="w-5 h-5" />
                <span className="text-[9px] font-medium">Upload</span>
            </button>

            {/* 2. Resize / Adjust */}
            <button
                onClick={() => {
                    setActiveTab('settings');
                    setShowMobilePanel(true);
                    setActiveMobileTool('adjust');
                    setMobileAdjustMode(hasSelection ? 'individual' : 'global');
                }}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-300 ${activeMobileTool === 'adjust' && showMobilePanel ? 'text-indigo-600 bg-indigo-50/50' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
                <Scaling className="w-5 h-5" />
                <span className="text-[9px] font-medium">Adjust</span>
            </button>

            {/* 3. Print (Center) */}
            <div className="relative -top-6 flex justify-center">
                <button
                    onClick={handlePrint}
                    disabled={imagesCount === 0}
                    className="flex flex-col items-center justify-center w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg shadow-indigo-300 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-500 ring-4 ring-white"
                >
                    <Printer className="w-6 h-6" />
                </button>
                <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-medium text-zinc-500 whitespace-nowrap">Print</span>
            </div>

            {/* 4. Layout */}
            <button
                onClick={() => {
                    setActiveTab('settings');
                    setShowMobilePanel(true);
                    setActiveMobileTool('layout');
                }}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-300 ${activeMobileTool === 'layout' && showMobilePanel ? 'text-indigo-600 bg-indigo-50/50' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
                <Settings className="w-5 h-5" />
                <span className="text-[9px] font-medium">Layout</span>
            </button>

            {/* 5. Images */}
            <button
                onClick={() => {
                    setActiveTab('sequence');
                    setShowMobilePanel(true);
                    setActiveMobileTool(null);
                }}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-300 ${activeTab === 'sequence' && showMobilePanel ? 'text-indigo-600 bg-indigo-50/50' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
                <div className="relative">
                    <List className={`w-5 h-5 transition-transform duration-300 ${activeTab === 'sequence' && showMobilePanel ? 'fill-indigo-100 scale-110' : ''}`} />
                    {imagesCount > 0 && (
                        <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[8px] font-bold px-1 py-0.5 rounded-full min-w-[14px] text-center border-2 border-white">
                            {imagesCount}
                        </span>
                    )}
                </div>
                <span className="text-[9px] font-medium">Images</span>
            </button>
        </nav>
    );
};
