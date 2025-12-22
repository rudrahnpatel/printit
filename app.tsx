import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    Upload,
    Printer,
    Settings,
    Trash2,
    RotateCw,
    Maximize2,
    Move,
    FileImage,
    Check,
    AlertCircle,
    Layout,
    Scissors,
    Scaling,
    List,
    GripVertical,
    MousePointer2
} from 'lucide-react';

/**
 * --- BIN PACKING ALGORITHM (MaxRects Heuristic) ---
 */

interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface BinImage {
    id: string;
    width: number; // Current physical width in mm
    height: number; // Current physical height in mm
    originalWidth: number; // Base physical width in mm (derived from import)
    originalHeight: number; // Base physical height in mm
    src: string;
    rotated: boolean;
    scale: number; // Individual scale factor (default 1.0)
    name: string;
}

interface PackedImage extends BinImage {
    x: number;
    y: number;
    pageIndex: number;
    renderWidth: number;
    renderHeight: number;
}

class Packer {
    width: number;
    height: number;
    freeRects: Rect[];

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.freeRects = [{ x: 0, y: 0, width: width, height: height }];
    }

    pack(width: number, height: number, allowRotation: boolean): { x: number, y: number, rotated: boolean } | null {
        let bestScore = Number.MAX_VALUE;
        let bestRectIndex = -1;
        let bestRotated = false;

        for (let i = 0; i < this.freeRects.length; i++) {
            const free = this.freeRects[i];

            // Check normal orientation
            if (free.width >= width && free.height >= height) {
                const score = Math.min(free.width - width, free.height - height);
                if (score < bestScore) {
                    bestScore = score;
                    bestRectIndex = i;
                    bestRotated = false;
                }
            }

            // Check rotated
            if (allowRotation && free.width >= height && free.height >= width) {
                const score = Math.min(free.width - height, free.height - width);
                if (score < bestScore) {
                    bestScore = score;
                    bestRectIndex = i;
                    bestRotated = true;
                }
            }
        }

        if (bestRectIndex === -1) return null;

        const free = this.freeRects[bestRectIndex];
        const placedWidth = bestRotated ? height : width;
        const placedHeight = bestRotated ? width : height;

        const newNode = { x: free.x, y: free.y, width: placedWidth, height: placedHeight, rotated: bestRotated };

        this.splitFreeRects(newNode);
        this.pruneFreeRects();

        return newNode;
    }

    splitFreeRects(placedRect: Rect) {
        const newFreeRects: Rect[] = [];

        for (let i = 0; i < this.freeRects.length; i++) {
            const free = this.freeRects[i];

            if (!this.intersect(placedRect, free)) {
                newFreeRects.push(free);
                continue;
            }

            if (placedRect.x < free.x + free.width && placedRect.x + placedRect.width > free.x) {
                if (placedRect.y > free.y && placedRect.y < free.y + free.height) {
                    newFreeRects.push({ x: free.x, y: free.y, width: free.width, height: placedRect.y - free.y });
                }
                if (placedRect.y + placedRect.height < free.y + free.height) {
                    newFreeRects.push({ x: free.x, y: placedRect.y + placedRect.height, width: free.width, height: free.y + free.height - (placedRect.y + placedRect.height) });
                }
            }

            if (placedRect.y < free.y + free.height && placedRect.y + placedRect.height > free.y) {
                if (placedRect.x > free.x && placedRect.x < free.x + free.width) {
                    newFreeRects.push({ x: free.x, y: free.y, width: placedRect.x - free.x, height: free.height });
                }
                if (placedRect.x + placedRect.width < free.x + free.width) {
                    newFreeRects.push({ x: placedRect.x + placedRect.width, y: free.y, width: free.x + free.width - (placedRect.x + placedRect.width), height: free.height });
                }
            }
        }
        this.freeRects = newFreeRects;
    }

    intersect(r1: Rect, r2: Rect): boolean {
        return !(r2.x >= r1.x + r1.width || r2.x + r2.width <= r1.x || r2.y >= r1.y + r1.height || r2.y + r2.height <= r1.y);
    }

    pruneFreeRects() {
        for (let i = 0; i < this.freeRects.length; i++) {
            for (let j = 0; j < this.freeRects.length; j++) {
                if (i === j) continue;
                if (this.isContained(this.freeRects[i], this.freeRects[j])) {
                    this.freeRects.splice(i, 1);
                    i--;
                    break;
                }
            }
        }
    }

    isContained(r1: Rect, r2: Rect): boolean {
        return r1.x >= r2.x && r1.y >= r2.y && r1.x + r1.width <= r2.x + r2.width && r1.y + r1.height <= r2.y + r2.height;
    }
}

const PAPER_SIZES = {
    A4: { width: 210, height: 297, label: "A4 (210 x 297 mm)" },
    Letter: { width: 215.9, height: 279.4, label: "Letter (8.5 x 11 in)" },
    Legal: { width: 215.9, height: 355.6, label: "Legal (8.5 x 14 in)" },
    A3: { width: 297, height: 420, label: "A3 (297 x 420 mm)" },
    Photo4x6: { width: 101.6, height: 152.4, label: "4x6 Photo (4 x 6 in)" },
};

export default function PrintNest() {
    const [images, setImages] = useState<BinImage[]>([]);
    const [packedPages, setPackedPages] = useState<PackedImage[][]>([]);

    // Settings
    const [paperSize, setPaperSize] = useState<keyof typeof PAPER_SIZES>('A4');
    const [margin, setMargin] = useState(10); // mm
    const [gap, setGap] = useState(2); // mm
    const [allowRotation, setAllowRotation] = useState(true);
    const [sortStrategy, setSortStrategy] = useState<'smart' | 'manual'>('smart');

    // Scaling Logic
    const [useUniformSize, setUseUniformSize] = useState(true);
    const [targetSize, setTargetSize] = useState(85); // mm
    const [globalScale, setGlobalScale] = useState(100); // %

    // Selection & UI State
    const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'settings' | 'sequence'>('settings');
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Drag and Drop Reordering State
    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);

    // --- HANDLERS ---

    const handleFileUpload = async (files: FileList | null) => {
        if (!files) return;

        setIsProcessing(true);
        const newImages: BinImage[] = [];

        const loadPromises = Array.from(files).map(file => {
            return new Promise<void>((resolve) => {
                if (!file.type.startsWith('image/')) {
                    resolve();
                    return;
                }

                const img = new Image();
                const objectUrl = URL.createObjectURL(file);

                img.onload = () => {
                    const widthMM = (img.width / 96) * 25.4;
                    const heightMM = (img.height / 96) * 25.4;

                    newImages.push({
                        id: Math.random().toString(36).substr(2, 9),
                        src: objectUrl,
                        width: widthMM,
                        height: heightMM,
                        originalWidth: widthMM,
                        originalHeight: heightMM,
                        rotated: false,
                        scale: 1.0, // Individual scale
                        name: file.name
                    });
                    resolve();
                };
                img.src = objectUrl;
            });
        });

        await Promise.all(loadPromises);
        setImages(prev => [...prev, ...newImages]);
        setIsProcessing(false);
        // If we just added files, maybe switch to sequence tab so user can see them?
        if (images.length === 0) setActiveTab('sequence');
    };

    const removeImage = (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setImages(prev => prev.filter(img => img.id !== id));
        if (selectedImageId === id) setSelectedImageId(null);
    };

    const clearAll = () => {
        setImages([]);
        setPackedPages([]);
        setSelectedImageId(null);
    };

    const updateImageScale = (id: string, newScale: number) => {
        setImages(prev => prev.map(img => img.id === id ? { ...img, scale: newScale } : img));
    };

    // --- REORDERING LOGIC ---

    const handleSort = () => {
        // Duplicate items
        let _images = [...images];
        // Remove and save the dragged item content
        const draggedItemContent = _images.splice(dragItem.current!, 1)[0];
        // Switch the position
        _images.splice(dragOverItem.current!, 0, draggedItemContent);
        // Update actual array
        dragItem.current = null;
        dragOverItem.current = null;
        setImages(_images);
    };

    // --- PACKING LOGIC ---

    useEffect(() => {
        packImages();
    }, [images, paperSize, margin, gap, allowRotation, globalScale, useUniformSize, targetSize, sortStrategy]);

    const packImages = () => {
        if (images.length === 0) {
            setPackedPages([]);
            return;
        }

        const currentPaper = PAPER_SIZES[paperSize];
        const printableWidth = currentPaper.width - (margin * 2);
        const printableHeight = currentPaper.height - (margin * 2);

        // 1. Prepare & Normalize Images
        let todoList = images.map(img => {
            let finalW = img.originalWidth;
            let finalH = img.originalHeight;

            if (useUniformSize) {
                const aspectRatio = img.originalWidth / img.originalHeight;
                if (aspectRatio > 1) {
                    finalW = targetSize;
                    finalH = targetSize / aspectRatio;
                } else {
                    finalH = targetSize;
                    finalW = targetSize * aspectRatio;
                }
            } else {
                const scaleFactor = globalScale / 100;
                finalW = img.originalWidth * scaleFactor;
                finalH = img.originalHeight * scaleFactor;
            }

            // Apply Individual Scale
            finalW *= img.scale;
            finalH *= img.scale;

            // Safety: Ensure no image exceeds the printable area
            if (finalW > printableWidth) {
                const ratio = printableWidth / finalW;
                finalW = printableWidth;
                finalH = finalH * ratio;
            }
            if (finalH > printableHeight) {
                const ratio = printableHeight / finalH;
                finalH = printableHeight;
                finalW = finalW * ratio;
            }

            return {
                ...img,
                width: finalW,
                height: finalH
            };
        });

        // 2. Sort based on strategy
        if (sortStrategy === 'smart') {
            // Sort by height desc (usually good for packing) or max side
            todoList.sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height));
        }
        // If 'manual', we keep the order of `images` array which is controlled by the list

        // 3. Pack
        const pages: PackedImage[][] = [];
        let currentPageIndex = 0;
        let currentPacker = new Packer(printableWidth, printableHeight);
        let currentPageImages: PackedImage[] = [];

        for (const img of todoList) {
            const wWithGap = img.width + gap;
            const hWithGap = img.height + gap;

            let node = currentPacker.pack(wWithGap, hWithGap, allowRotation);

            if (!node) {
                pages.push(currentPageImages);
                currentPageIndex++;
                currentPacker = new Packer(printableWidth, printableHeight);
                currentPageImages = [];
                node = currentPacker.pack(wWithGap, hWithGap, allowRotation);

                if (!node) {
                    node = { x: 0, y: 0, rotated: false }; // Fallback
                }
            }

            currentPageImages.push({
                ...img,
                x: node.x,
                y: node.y,
                rotated: node.rotated,
                pageIndex: currentPageIndex,
                renderWidth: node.rotated ? img.height : img.width,
                renderHeight: node.rotated ? img.width : img.height
            });
        }

        if (currentPageImages.length > 0) {
            pages.push(currentPageImages);
        }

        setPackedPages(pages);
    };

    const handlePrint = () => {
        // Timeout helps ensure any recent React renders (like removing selection UI) are done
        setTimeout(() => window.print(), 100);
    };

    const currentPaper = PAPER_SIZES[paperSize];
    const selectedImage = images.find(i => i.id === selectedImageId);

    return (
        <div className="flex h-screen bg-zinc-50 text-zinc-900 font-sans overflow-hidden app-container selection:bg-indigo-100 selection:text-indigo-900">

            {/* --- SIDEBAR --- */}
            <aside className="w-96 bg-white flex flex-col z-20 shadow-xl border-r border-zinc-100 no-print">
                <div className="p-6 pb-2 bg-white z-10">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="bg-indigo-600 rounded-lg p-1.5 shadow-lg shadow-indigo-200">
                            <Layout className="w-5 h-5 text-white" />
                        </div>
                        <h1 className="text-xl font-bold text-zinc-800 tracking-tight">PrintNest</h1>
                    </div>

                    {/* Segmented Control Tabs */}
                    <div className="flex p-1 bg-zinc-100/80 rounded-xl mb-2 relative">
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${activeTab === 'settings' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                        >
                            Settings
                        </button>
                        <button
                            onClick={() => setActiveTab('sequence')}
                            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${activeTab === 'sequence' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                        >
                            Images ({images.length})
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-8 scrollbar-hide">

                    {/* TAB: SETTINGS */}
                    {activeTab === 'settings' && (
                        <>
                            {/* Import */}
                            <div className="space-y-3">
                                <div
                                    className={`group border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer relative overflow-hidden
                    ${isDraggingFile ? 'border-indigo-500 bg-indigo-50/50 scale-[0.99]' : 'border-zinc-200 hover:border-indigo-400 hover:bg-zinc-50'}`}
                                    onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
                                    onDragLeave={() => setIsDraggingFile(false)}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        setIsDraggingFile(false);
                                        handleFileUpload(e.dataTransfer.files);
                                    }}
                                >
                                    <input
                                        type="file"
                                        multiple
                                        accept="image/*"
                                        className="hidden"
                                        id="file-upload"
                                        onChange={(e) => handleFileUpload(e.target.files)}
                                    />
                                    <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center relative z-10">
                                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                                            <Upload className="w-5 h-5" />
                                        </div>
                                        <span className="text-sm font-semibold text-zinc-700">Click to upload</span>
                                        <span className="text-xs text-zinc-400 mt-1">or drag and drop images</span>
                                    </label>
                                </div>
                            </div>

                            {/* Selected Image Editor */}
                            {selectedImage && (
                                <div className="bg-white border border-indigo-100 p-4 rounded-2xl shadow-sm space-y-4 ring-4 ring-indigo-50/50 animate-in slide-in-from-top-4 fade-in duration-300">
                                    <div className="flex justify-between items-start">
                                        <h3 className="text-xs font-bold uppercase text-indigo-500 tracking-wider flex items-center gap-1.5">
                                            <MousePointer2 className="w-3 h-3" /> Selected Image
                                        </h3>
                                        <button onClick={() => setSelectedImageId(null)} className="text-zinc-400 hover:text-zinc-600 transition-colors">
                                            <span className="sr-only">Close</span>
                                            <div className="bg-zinc-100 hover:bg-zinc-200 rounded-full p-1">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </div>
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-3 bg-zinc-50 p-2 rounded-xl border border-zinc-100">
                                        <img src={selectedImage.src} className="w-12 h-12 object-cover rounded-lg bg-white shadow-sm border border-zinc-200" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold truncate text-zinc-700">{selectedImage.name}</p>
                                            <p className="text-[10px] text-zinc-500 font-medium font-mono">{(selectedImage.width * selectedImage.scale).toFixed(0)} x {(selectedImage.height * selectedImage.scale).toFixed(0)} mm</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <label className="text-xs font-medium text-zinc-500">Scale</label>
                                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{(selectedImage.scale * 100).toFixed(0)}%</span>
                                        </div>
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

                                    <button
                                        onClick={(e) => removeImage(selectedImage.id, e)}
                                        className="w-full py-2 flex items-center justify-center gap-2 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 hover:border-rose-200 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> Remove Image
                                    </button>
                                </div>
                            )}

                            {/* General Sizing */}
                            <div className="space-y-4">
                                <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                                    <Scaling className="w-3 h-3" /> Global Sizing
                                </h2>
                                <div className="bg-zinc-50/50 p-4 rounded-xl border border-zinc-100 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-medium text-zinc-700">Uniform Size</label>
                                        <button
                                            onClick={() => setUseUniformSize(!useUniformSize)}
                                            className={`w-10 h-6 rounded-full transition-colors relative ${useUniformSize ? 'bg-indigo-600' : 'bg-zinc-200'}`}
                                        >
                                            <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm ${useUniformSize ? 'translate-x-4' : ''}`} />
                                        </button>
                                    </div>

                                    {useUniformSize ? (
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <label className="text-xs text-zinc-500">Max Length</label>
                                                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{targetSize} mm</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="20"
                                                max="280"
                                                value={targetSize}
                                                onChange={(e) => setTargetSize(Number(e.target.value))}
                                                className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-500"
                                            />
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <label className="text-xs text-zinc-500">Scale</label>
                                                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{globalScale}%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="10"
                                                max="200"
                                                value={globalScale}
                                                onChange={(e) => setGlobalScale(Number(e.target.value))}
                                                className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-500"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Layout Settings */}
                            <div className="space-y-4">
                                <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                                    <Settings className="w-3 h-3" /> Paper & Layout
                                </h2>

                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-medium text-zinc-600 mb-1.5 block">Paper Size</label>
                                        <div className="relative">
                                            <select
                                                value={paperSize}
                                                onChange={(e) => setPaperSize(e.target.value as keyof typeof PAPER_SIZES)}
                                                className="w-full text-sm border-zinc-200 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 py-2 pl-3 pr-8 bg-white appearance-none cursor-pointer"
                                            >
                                                {Object.entries(PAPER_SIZES).map(([key, config]) => (
                                                    <option key={key} value={key}>{config.label}</option>
                                                ))}
                                            </select>
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                                                <List className="w-4 h-4" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-medium text-zinc-600 mb-1.5 block">Margin (mm)</label>
                                            <input
                                                type="number"
                                                value={margin}
                                                onChange={(e) => setMargin(Number(e.target.value))}
                                                className="w-full text-sm border-zinc-200 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 py-2 px-3"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-zinc-600 mb-1.5 block">Gap (mm)</label>
                                            <input
                                                type="number"
                                                value={gap}
                                                onChange={(e) => setGap(Number(e.target.value))}
                                                className="w-full text-sm border-zinc-200 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 py-2 px-3"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between p-3 bg-zinc-50/50 rounded-xl border border-zinc-100">
                                        <div className="flex items-center gap-2">
                                            <RotateCw className="w-4 h-4 text-zinc-400" />
                                            <span className="text-xs font-medium text-zinc-600">Auto Rotate</span>
                                        </div>
                                        <button
                                            onClick={() => setAllowRotation(!allowRotation)}
                                            className={`w-10 h-6 rounded-full transition-colors relative ${allowRotation ? 'bg-indigo-600' : 'bg-zinc-200'}`}
                                        >
                                            <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm ${allowRotation ? 'translate-x-4' : ''}`} />
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        <span className="text-xs font-medium text-zinc-600 block">Packing Logic</span>
                                        <div className="flex p-1 bg-zinc-100/80 rounded-lg">
                                            <button
                                                onClick={() => setSortStrategy('smart')}
                                                className={`flex-1 py-1.5 text-[10px] font-semibold rounded-md transition-all ${sortStrategy === 'smart' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                                            >
                                                Smart Check
                                            </button>
                                            <button
                                                onClick={() => setSortStrategy('manual')}
                                                className={`flex-1 py-1.5 text-[10px] font-semibold rounded-md transition-all ${sortStrategy === 'manual' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                                            >
                                                Manual
                                            </button>
                                        </div>
                                        {sortStrategy === 'manual' && (
                                            <p className="text-[10px] text-amber-600 flex items-center gap-1.5 bg-amber-50/50 p-2 rounded-lg border border-amber-100/50">
                                                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                                                Drag images in "Images" tab to order.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* TAB: SEQUENCE (List View & Drag Drop) */}
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
                                            onClick={() => {
                                                setSelectedImageId(img.id);
                                                setActiveTab('settings');
                                            }}
                                            className={`
                          group flex items-center gap-3 p-3 rounded-xl border cursor-grab active:cursor-grabbing transition-all duration-200 relative
                          ${selectedImageId === img.id ? 'border-indigo-500 bg-indigo-50/50 shadow-md ring-1 ring-indigo-500 z-10' : 'border-zinc-200 bg-white hover:border-indigo-300 hover:shadow-sm'}
                        `}
                                        >
                                            <div className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 group-hover:text-indigo-500 transition-colors">
                                                <span className="text-xs font-bold">{index + 1}</span>
                                            </div>

                                            <img src={img.src} className="w-10 h-10 rounded-lg object-cover bg-zinc-100 border border-zinc-200 shadow-sm" />

                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-zinc-700 truncate group-hover:text-indigo-700 transition-colors">{img.name}</p>
                                                <p className="text-[10px] text-zinc-400">Scale: {(img.scale * 100).toFixed(0)}%</p>
                                            </div>

                                            <button
                                                onClick={(e) => removeImage(img.id, e)}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-300 hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100"
                                                title="Remove"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>

                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab text-zinc-300">
                                                <GripVertical className="w-4 h-4" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                </div>

                <div className="p-6 border-t border-zinc-100 bg-white z-10">
                    <button
                        onClick={handlePrint}
                        disabled={images.length === 0}
                        className="group w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:from-zinc-300 disabled:to-zinc-300 disabled:cursor-not-allowed text-white rounded-xl shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 font-semibold flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
                    >
                        <Printer className="w-5 h-5 group-hover:animate-pulse" />
                        <span>Print Layout</span>
                    </button>
                </div>
            </aside>

            {/* --- MAIN PREVIEW AREA --- */}
            <main className="flex-1 overflow-auto bg-zinc-100/50 p-12 flex flex-col items-center relative">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

                {images.length === 0 ? (
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
                    <div className="space-y-12 pb-20 print-container relative z-10">
                        {packedPages.map((pageImages, pageIdx) => (
                            <div key={pageIdx} className="relative group page-wrapper">
                                {/* Page Label (Screen Only) */}
                                <div className="absolute -left-32 top-0 text-sm font-bold text-zinc-300 no-print w-24 text-right pt-4">
                                    Page {pageIdx + 1}
                                </div>

                                {/* The Paper Sheet */}
                                <div
                                    className="bg-white shadow-2xl shadow-zinc-300/50 relative overflow-hidden transition-all duration-500 print-sheet sheet ring-1 ring-zinc-900/5"
                                    style={{
                                        width: `${currentPaper.width}mm`,
                                        height: `${currentPaper.height}mm`,
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
                                            {/* Selection Overlay (Active) */}
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
                        ))}
                    </div>
                )}
            </main>

            {/* --- PRINT STYLES --- */}
            <style>{`
        @media print {
          /* Reset parent containers that might block overflow */
          body, html, #root, .app-container {
            height: auto !important;
            overflow: visible !important;
            display: block !important;
            background: white !important;
          }

          /* Hide UI */
          .no-print {
            display: none !important;
          }

          /* Page Setup */
          @page {
            size: ${paperSize === 'A4' ? 'A4' : paperSize === 'A3' ? 'A3' : 'auto'};
            margin: 0;
          }

          /* Container Reset */
          .print-container {
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            position: static !important;
            width: 100% !important;
          }
          
          /* Page Breaks */
          .page-wrapper {
            break-after: page;
            page-break-after: always;
            margin-bottom: 0 !important;
            position: relative !important;
          }
          .page-wrapper:last-child {
            break-after: auto;
          }

          .print-sheet {
            box-shadow: none !important;
            margin: 0 !important;
            border: none !important;
            overflow: hidden !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
        </div>
    );
}