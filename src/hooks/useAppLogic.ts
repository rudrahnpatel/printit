import { useState, useEffect, useRef } from 'react';
import { useMemo } from 'react';

// --- TYPES ---
export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface BinImage {
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

export interface PackedImage extends BinImage {
    x: number;
    y: number;
    pageIndex: number;
    renderWidth: number;
    renderHeight: number;
}

// --- BIN PACKING CLASS ---
export class Packer {
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

// --- CONSTANTS ---
export const PAPER_SIZES = {
    A4: { width: 210, height: 297, label: "A4 (210 x 297 mm)" },
    Letter: { width: 215.9, height: 279.4, label: "Letter (8.5 x 11 in)" },
    Legal: { width: 215.9, height: 355.6, label: "Legal (8.5 x 14 in)" },
    A3: { width: 297, height: 420, label: "A3 (297 x 420 mm)" },
    Photo4x6: { width: 101.6, height: 152.4, label: "4x6 Photo (4 x 6 in)" },
};

// --- HOOK ---
export function useAppLogic() {
    // --- STATE ---
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

    // Mobile Specific
    const [mobileAdjustMode, setMobileAdjustMode] = useState<'individual' | 'global' | 'spacing'>('global');
    const [activeMobileTool, setActiveMobileTool] = useState<'import' | 'adjust' | 'layout' | null>(null);
    const [previewScale, setPreviewScale] = useState(1);

    // UI State
    const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'settings' | 'sequence'>('settings');
    const [showMobilePanel, setShowMobilePanel] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Drag and Drop
    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);

    // Derived
    const activePaper = PAPER_SIZES[paperSize];
    const selectedImage = useMemo(() => images.find(i => i.id === selectedImageId), [images, selectedImageId]);

    // --- ACTIONS ---

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

    const handleSort = () => {
        let _images = [...images];
        const draggedItemContent = _images.splice(dragItem.current!, 1)[0];
        _images.splice(dragOverItem.current!, 0, draggedItemContent);
        dragItem.current = null;
        dragOverItem.current = null;
        setImages(_images);
    };

    const toggleMobileTab = (tab: 'settings' | 'sequence') => {
        if (activeTab === tab) {
            setShowMobilePanel(!showMobilePanel);
        } else {
            setActiveTab(tab);
            setShowMobilePanel(true);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    // --- PACKING EFFECT ---
    useEffect(() => {
        const packImages = () => {
            if (images.length === 0) {
                setPackedPages([]);
                return;
            }

            const currentPaper = PAPER_SIZES[paperSize];
            const printableWidth = currentPaper.width - (margin * 2);
            const printableHeight = currentPaper.height - (margin * 2);

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

                // Safety
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

            if (sortStrategy === 'smart') {
                todoList.sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height));
            }

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
                        node = { x: 0, y: 0, rotated: false };
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

        packImages();
    }, [images, paperSize, margin, gap, allowRotation, globalScale, useUniformSize, targetSize, sortStrategy]);

    return {
        // State
        images,
        packedPages,
        paperSize, setPaperSize,
        margin, setMargin,
        gap, setGap,
        allowRotation, setAllowRotation,
        sortStrategy, setSortStrategy,
        useUniformSize, setUseUniformSize,
        targetSize, setTargetSize,
        globalScale, setGlobalScale,
        mobileAdjustMode, setMobileAdjustMode,
        activeMobileTool, setActiveMobileTool,
        previewScale, setPreviewScale,
        selectedImageId, setSelectedImageId,
        activeTab, setActiveTab,
        showMobilePanel, setShowMobilePanel,
        isProcessing, setIsProcessing,
        dragItem, dragOverItem,

        // Derived
        activePaper,
        selectedImage,

        // Actions
        handleFileUpload,
        removeImage,
        clearAll,
        updateImageScale,
        handleSort,
        toggleMobileTab,
        handlePrint
    };
}
