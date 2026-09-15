import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    Upload,
    Printer,
    Settings,
    Trash2,
    RotateCw,
    Layout,
    AlertCircle,
    Scaling,
    List,
    GripVertical,
    MousePointer2,
    ImagePlus,
    Loader2,
    ZoomIn,
    ZoomOut,
    Maximize,
    ChevronUp,
    ChevronDown,
    Plus,
    Minus,
    X,
    Wand2,
    Gauge,
    Sun,
    Moon,
    Monitor,
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
    clamped: boolean; // True when the image had to be shrunk to fit the page
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
    A4: { width: 210, height: 297, label: "A4", sub: "210 × 297 mm" },
    Letter: { width: 215.9, height: 279.4, label: "Letter", sub: "8.5 × 11 in" },
    Legal: { width: 215.9, height: 355.6, label: "Legal", sub: "8.5 × 14 in" },
    A3: { width: 297, height: 420, label: "A3", sub: "297 × 420 mm" },
    Photo4x6: { width: 101.6, height: 152.4, label: "4×6 Photo", sub: "4 × 6 in" },
};

type PaperKey = keyof typeof PAPER_SIZES;

/** CSS defines 1mm as exactly 96/25.4 px, so previews line up with print output. */
const PX_PER_MM = 96 / 25.4;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const MIN_PRINTABLE_MM = 10;
const MAX_GAP_MM = 25;

let idCounter = 0;
const nextId = () => `img-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

type Theme = 'light' | 'dark' | 'system';
const THEME_KEY = 'ezzprint-theme';
const THEME_ORDER: Theme[] = ['system', 'light', 'dark'];
const THEME_META: Record<Theme, { icon: React.ElementType, label: string }> = {
    system: { icon: Monitor, label: 'Theme: match system' },
    light: { icon: Sun, label: 'Theme: light' },
    dark: { icon: Moon, label: 'Theme: dark' },
};

/** --- SMALL UI PRIMITIVES --------------------------------------------- */

function SectionTitle({ icon: Icon, children }: { icon: React.ElementType, children: React.ReactNode }) {
    return (
        <h2 className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-2">
            <Icon className="w-3.5 h-3.5" aria-hidden="true" /> {children}
        </h2>
    );
}

function Toggle({ checked, onChange, label, id }: { checked: boolean, onChange: (v: boolean) => void, label: string, id: string }) {
    return (
        <button
            id={id}
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            onClick={() => onChange(!checked)}
            className={`w-11 h-6 shrink-0 rounded-full transition-colors relative focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 ${checked ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
        >
            <span className={`absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full transition-transform shadow-sm ${checked ? 'translate-x-5' : ''}`} />
        </button>
    );
}

function SliderRow({ id, label, value, display, min, max, step = 1, onChange, hint }: {
    id: string, label: string, value: number, display: string, min: number, max: number, step?: number,
    onChange: (v: number) => void, hint?: string
}) {
    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center gap-2">
                <label htmlFor={id} className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{label}</label>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/15 px-2 py-0.5 rounded tabular-nums">{display}</span>
            </div>
            <input
                id={id}
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full h-5 appearance-none bg-transparent cursor-pointer touch-manipulation rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            />
            {hint && <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-snug">{hint}</p>}
        </div>
    );
}

function Stepper({ id, label, value, min, max, step = 1, unit, onChange }: {
    id: string, label: string, value: number, min: number, max: number, step?: number, unit: string,
    onChange: (v: number) => void
}) {
    const set = (v: number) => onChange(clamp(Math.round(v * 10) / 10, min, max));
    return (
        <div>
            <label htmlFor={id} className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1.5 block">{label}</label>
            <div className="flex items-stretch rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-sm overflow-hidden focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
                <button
                    type="button"
                    aria-label={`Decrease ${label}`}
                    onClick={() => set(value - step)}
                    disabled={value <= min}
                    className="w-10 shrink-0 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 active:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                >
                    <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                    id={id}
                    type="number"
                    inputMode="decimal"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') return;
                        set(Number(raw));
                    }}
                    onBlur={(e) => set(Number(e.target.value) || 0)}
                    className="flex-1 min-w-0 text-sm text-center border-0 bg-transparent text-zinc-900 dark:text-zinc-100 py-2 px-1 tabular-nums focus:outline-none focus:ring-0"
                />
                <span className="self-center text-[11px] text-zinc-400 dark:text-zinc-500 pr-2 select-none">{unit}</span>
                <button
                    type="button"
                    aria-label={`Increase ${label}`}
                    onClick={() => set(value + step)}
                    disabled={value >= max}
                    className="w-10 shrink-0 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 active:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors border-l border-zinc-100 dark:border-zinc-700"
                >
                    <Plus className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}

/** --- MAIN APP --------------------------------------------------------- */

export default function PrintNest() {
    const [images, setImages] = useState<BinImage[]>([]);

    // Settings
    const [paperSize, setPaperSize] = useState<PaperKey>('A4');
    const [margin, setMargin] = useState(10); // mm
    const [gap, setGap] = useState(2); // mm
    const [allowRotation, setAllowRotation] = useState(true);
    const [sortStrategy, setSortStrategy] = useState<'smart' | 'manual'>('smart');

    // Scaling
    const [useUniformSize, setUseUniformSize] = useState(true);
    const [targetSize, setTargetSize] = useState(85); // mm
    const [globalScale, setGlobalScale] = useState(100); // %

    // Selection & UI State
    const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'settings' | 'sequence'>('settings');
    const [showMobilePanel, setShowMobilePanel] = useState(false);
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [dragIndex, setDragIndex] = useState<number | null>(null);

    // Theme
    const [theme, setTheme] = useState<Theme>(() => {
        try {
            const saved = localStorage.getItem(THEME_KEY);
            return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
        } catch {
            return 'system';
        }
    });

    // Preview zoom
    const [fitToWidth, setFitToWidth] = useState(true);
    const [zoom, setZoom] = useState(1);
    const [fitScale, setFitScale] = useState(1);

    const canvasRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);
    const imagesRef = useRef<BinImage[]>(images);
    imagesRef.current = images;

    const currentPaper = PAPER_SIZES[paperSize];
    const maxMargin = Math.max(0, Math.floor((Math.min(currentPaper.width, currentPaper.height) - MIN_PRINTABLE_MM) / 2));
    const maxTargetSize = Math.max(20, Math.floor(Math.max(currentPaper.width, currentPaper.height) - margin * 2));

    // --- KEEP SETTINGS VALID WHEN PAPER CHANGES ---
    useEffect(() => {
        setMargin((m) => clamp(m, 0, maxMargin));
    }, [maxMargin]);

    useEffect(() => {
        setTargetSize((t) => clamp(t, 20, maxTargetSize));
    }, [maxTargetSize]);

    // --- THEME ---
    useEffect(() => {
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const apply = () => {
            const dark = theme === 'dark' || (theme === 'system' && media.matches);
            document.documentElement.classList.toggle('dark', dark);
            document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
        };
        apply();
        try {
            localStorage.setItem(THEME_KEY, theme);
        } catch {
            /* private mode: theme just will not persist */
        }
        media.addEventListener('change', apply);
        return () => media.removeEventListener('change', apply);
    }, [theme]);

    // --- AUTO-DISMISS NOTICES ---
    useEffect(() => {
        if (!notice) return;
        const timer = window.setTimeout(() => setNotice(null), 5000);
        return () => window.clearTimeout(timer);
    }, [notice]);

    // --- REVOKE OBJECT URLS ON UNMOUNT (avoids leaking blobs) ---
    useEffect(() => {
        return () => {
            imagesRef.current.forEach((img) => URL.revokeObjectURL(img.src));
        };
    }, []);

    // --- RESPONSIVE PREVIEW SCALE ---
    // Measured from the real content box, so it works for every paper size
    // instead of the hard-coded A4 assumption the CSS `zoom` hack made.
    useEffect(() => {
        const el = canvasRef.current;
        if (!el) return;

        const update = () => {
            const available = el.clientWidth;
            if (!available) return;
            const paperWidthPx = currentPaper.width * PX_PER_MM;
            setFitScale(clamp(available / paperWidthPx, 0.08, 1));
        };

        update();
        const observer = new ResizeObserver(update);
        observer.observe(el);
        return () => observer.disconnect();
    }, [currentPaper.width, images.length]);

    const previewScale = fitToWidth ? fitScale : zoom;

    const setManualZoom = (next: number) => {
        setFitToWidth(false);
        setZoom(clamp(next, 0.1, 3));
    };

    // --- HANDLERS ---

    const handleFileUpload = useCallback(async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        const fileList = Array.from(files);
        setIsProcessing(true);

        // Index-keyed slots so the imported order matches the order picked,
        // instead of whichever image happened to decode first.
        const slots: (BinImage | null)[] = new Array(fileList.length).fill(null);
        let skipped = 0;

        await Promise.all(fileList.map((file, index) => new Promise<void>((resolve) => {
            if (!file.type.startsWith('image/')) {
                skipped++;
                resolve();
                return;
            }

            const objectUrl = URL.createObjectURL(file);
            const img = new Image();

            const finish = (ok: boolean) => {
                if (ok) {
                    const widthMM = (img.naturalWidth / 96) * 25.4;
                    const heightMM = (img.naturalHeight / 96) * 25.4;
                    slots[index] = {
                        id: nextId(),
                        src: objectUrl,
                        width: widthMM,
                        height: heightMM,
                        originalWidth: widthMM,
                        originalHeight: heightMM,
                        rotated: false,
                        scale: 1.0,
                        name: file.name,
                    };
                } else {
                    // Decode failed: release the blob so it does not leak.
                    URL.revokeObjectURL(objectUrl);
                    skipped++;
                }
                resolve();
            };

            img.onload = () => finish(true);
            img.onerror = () => finish(false); // without this a bad file hung the upload forever
            img.src = objectUrl;
        })));

        const loaded = slots.filter((s): s is BinImage => s !== null);
        if (loaded.length > 0) setImages((prev) => [...prev, ...loaded]);
        setIsProcessing(false);

        if (skipped > 0) {
            setNotice(`${skipped} file${skipped > 1 ? 's' : ''} skipped — not a readable image.`);
        } else if (loaded.length > 0) {
            setNotice(`${loaded.length} image${loaded.length > 1 ? 's' : ''} added.`);
        }
    }, []);

    const openFilePicker = () => fileInputRef.current?.click();

    const cycleTheme = () => setTheme((t) => THEME_ORDER[(THEME_ORDER.indexOf(t) + 1) % THEME_ORDER.length]);

    const removeImage = useCallback((id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setImages((prev) => {
            const target = prev.find((img) => img.id === id);
            if (target) URL.revokeObjectURL(target.src);
            return prev.filter((img) => img.id !== id);
        });
        setSelectedImageId((current) => (current === id ? null : current));
    }, []);

    const clearAll = useCallback(() => {
        setImages((prev) => {
            prev.forEach((img) => URL.revokeObjectURL(img.src));
            return [];
        });
        setSelectedImageId(null);
        setNotice('All images removed.');
    }, []);

    const updateImageScale = (id: string, newScale: number) => {
        setImages((prev) => prev.map((img) => (img.id === id ? { ...img, scale: newScale } : img)));
    };

    const selectImage = (id: string) => {
        setSelectedImageId(id);
        setActiveTab('settings');
        // On mobile the editor lives inside the sheet, so surface it.
        if (window.matchMedia('(max-width: 767px)').matches) setShowMobilePanel(true);
    };

    // --- REORDERING ---

    const moveImage = useCallback((from: number, to: number) => {
        setImages((prev) => {
            if (from < 0 || from >= prev.length || to < 0 || to >= prev.length || from === to) return prev;
            const next = [...prev];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            return next;
        });
        if (sortStrategy !== 'manual') setSortStrategy('manual');
    }, [sortStrategy]);

    const handleSort = () => {
        const from = dragItem.current;
        const to = dragOverItem.current;
        dragItem.current = null;
        dragOverItem.current = null;
        setDragIndex(null);
        if (from === null || to === null) return; // guards the old `splice(null, 1)` corruption
        moveImage(from, to);
    };

    const toggleMobileTab = (tab: 'settings' | 'sequence') => {
        if (activeTab === tab && showMobilePanel) {
            setShowMobilePanel(false);
        } else {
            setActiveTab(tab);
            setShowMobilePanel(true);
        }
    };

    // --- PACKING ---

    const packedPages = useMemo<PackedImage[][]>(() => {
        if (images.length === 0) return [];

        const paper = PAPER_SIZES[paperSize];
        const safeMargin = clamp(margin, 0, maxMargin);
        const safeGap = clamp(gap, 0, MAX_GAP_MM);
        const printableWidth = Math.max(MIN_PRINTABLE_MM, paper.width - safeMargin * 2);
        const printableHeight = Math.max(MIN_PRINTABLE_MM, paper.height - safeMargin * 2);

        // 1. Resolve each image to its physical print size
        const todoList = images.map((img) => {
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

            finalW *= img.scale;
            finalH *= img.scale;

            // Shrink to fit the printable area. When rotation is on, take the
            // better of the two orientations so a wide image is not needlessly
            // squashed just because it does not fit upright.
            const upright = Math.min(printableWidth / finalW, printableHeight / finalH);
            const sideways = allowRotation ? Math.min(printableHeight / finalW, printableWidth / finalH) : 0;
            const ratio = Math.max(upright, sideways);
            let clamped = false;
            if (ratio < 1) {
                finalW *= ratio;
                finalH *= ratio;
                clamped = true;
            }

            return { ...img, width: finalW, height: finalH, clamped };
        });

        // 2. Order
        if (sortStrategy === 'smart') {
            todoList.sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height));
        }

        // 3. Pack. The bin is grown by one gap so the trailing gap of the last
        // row/column falls outside the printable area rather than stealing
        // space from it (this is what made full-width images spill onto their
        // own page before).
        const pages: PackedImage[][] = [];
        let currentPageIndex = 0;
        let currentPacker = new Packer(printableWidth + safeGap, printableHeight + safeGap);
        let currentPageImages: PackedImage[] = [];

        for (const img of todoList) {
            const wWithGap = img.width + safeGap;
            const hWithGap = img.height + safeGap;

            let node = currentPacker.pack(wWithGap, hWithGap, allowRotation);

            if (!node) {
                if (currentPageImages.length > 0) {
                    pages.push(currentPageImages);
                    currentPageIndex++;
                }
                currentPacker = new Packer(printableWidth + safeGap, printableHeight + safeGap);
                currentPageImages = [];
                node = currentPacker.pack(wWithGap, hWithGap, allowRotation);
                if (!node) node = { x: 0, y: 0, rotated: false }; // Fallback
            }

            currentPageImages.push({
                ...img,
                x: node.x,
                y: node.y,
                rotated: node.rotated,
                pageIndex: currentPageIndex,
                renderWidth: node.rotated ? img.height : img.width,
                renderHeight: node.rotated ? img.width : img.height,
            });
        }

        if (currentPageImages.length > 0) pages.push(currentPageImages);

        return pages;
    }, [images, paperSize, margin, gap, allowRotation, globalScale, useUniformSize, targetSize, sortStrategy, maxMargin]);

    // --- DERIVED ---

    const placedById = useMemo(() => {
        const map = new Map<string, PackedImage>();
        packedPages.forEach((page) => page.forEach((img) => map.set(img.id, img)));
        return map;
    }, [packedPages]);

    const stats = useMemo(() => {
        const safeMargin = clamp(margin, 0, maxMargin);
        const printableArea = Math.max(1, (currentPaper.width - safeMargin * 2) * (currentPaper.height - safeMargin * 2));
        const usedArea = packedPages.reduce(
            (sum, page) => sum + page.reduce((s, img) => s + img.width * img.height, 0),
            0
        );
        const coverage = packedPages.length ? Math.round((usedArea / (printableArea * packedPages.length)) * 100) : 0;
        return {
            pages: packedPages.length,
            coverage: clamp(coverage, 0, 100),
            saved: Math.max(0, images.length - packedPages.length),
            clamped: packedPages.some((page) => page.some((img) => img.clamped)),
        };
    }, [packedPages, currentPaper, margin, maxMargin, images.length]);

    const selectedImage = images.find((i) => i.id === selectedImageId);
    const selectedPlaced = selectedImageId ? placedById.get(selectedImageId) : undefined;

    const handlePrint = useCallback(() => {
        if (images.length === 0) return;
        setShowMobilePanel(false);
        setSelectedImageId(null);
        // Let React flush the selection chrome out of the DOM before printing.
        setTimeout(() => window.print(), 120);
    }, [images.length]);

    // --- KEYBOARD SHORTCUTS ---
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            const typing = !!target && (
                target.tagName === 'INPUT' || target.tagName === 'SELECT' ||
                target.tagName === 'TEXTAREA' || target.isContentEditable
            );

            if (e.key === 'Escape') {
                if (showMobilePanel) setShowMobilePanel(false);
                else setSelectedImageId(null);
                return;
            }
            if (typing) return;
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedImageId) {
                e.preventDefault();
                removeImage(selectedImageId);
            }
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p' && images.length > 0) {
                e.preventDefault();
                handlePrint();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [selectedImageId, showMobilePanel, removeImage, handlePrint, images.length]);

    // --- RENDER ---

    const paperWidthPx = currentPaper.width * PX_PER_MM;
    const paperHeightPx = currentPaper.height * PX_PER_MM;
    const safeMargin = clamp(margin, 0, maxMargin);

    const dropHandlers = {
        onDragOver: (e: React.DragEvent) => {
            if (!e.dataTransfer.types.includes('Files')) return;
            e.preventDefault();
            setIsDraggingFile(true);
        },
        onDragLeave: (e: React.DragEvent) => {
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setIsDraggingFile(false);
        },
        onDrop: (e: React.DragEvent) => {
            if (!e.dataTransfer.types.includes('Files')) return;
            e.preventDefault();
            setIsDraggingFile(false);
            handleFileUpload(e.dataTransfer.files);
        },
    };

    return (
        <div className="app-container flex flex-col md:flex-row overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 selection:bg-indigo-100 selection:text-indigo-900">

            {/* Single shared file input so every "add images" affordance works,
                including the ones rendered outside the (off-canvas) sidebar. */}
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                    handleFileUpload(e.target.files);
                    e.target.value = ''; // allow re-picking the same file
                }}
            />

            {/* --- MOBILE TOP BAR --- */}
            <header className="md:hidden no-print shrink-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 px-4 py-2.5 flex items-center gap-3 z-20">
                <div className="bg-indigo-600 rounded-lg p-1.5 shadow-sm shadow-indigo-200">
                    <Layout className="w-4 h-4 text-white" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                    <h1 className="text-base font-bold text-zinc-800 dark:text-zinc-100 tracking-tight leading-none">EzzPrint</h1>
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-tight mt-0.5 truncate">
                        {images.length === 0
                            ? 'No images yet'
                            : `${images.length} image${images.length > 1 ? 's' : ''} · ${stats.pages} page${stats.pages > 1 ? 's' : ''}`}
                    </p>
                </div>
                <button
                    onClick={openFilePicker}
                    aria-label="Add images"
                    className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 active:bg-zinc-100 dark:active:bg-zinc-800 transition-colors"
                >
                    <ImagePlus className="w-5 h-5" />
                </button>
                <button
                    onClick={handlePrint}
                    disabled={images.length === 0}
                    className="h-10 px-4 shrink-0 flex items-center gap-1.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow-sm shadow-indigo-200 dark:shadow-none disabled:bg-zinc-300 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-500 disabled:shadow-none active:scale-95 transition-all"
                >
                    <Printer className="w-4 h-4" />
                    Print
                </button>
            </header>

            {/* --- MOBILE SHEET BACKDROP --- */}
            <div
                onClick={() => setShowMobilePanel(false)}
                aria-hidden="true"
                className={`md:hidden fixed inset-0 bg-zinc-900/40 dark:bg-black/60 z-30 no-print transition-opacity duration-300 ${showMobilePanel ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            />

            {/* --- SIDEBAR (desktop) / BOTTOM SHEET (mobile) --- */}
            <aside
                aria-label="Layout controls"
                className={`no-print bg-white dark:bg-zinc-900 flex flex-col z-40
                    fixed inset-x-0 bottom-0 h-[78dvh] rounded-t-2xl shadow-2xl
                    transition-transform duration-300 ease-out
                    ${showMobilePanel ? 'translate-y-0' : 'translate-y-full'}
                    md:relative md:inset-auto md:translate-y-0 md:h-auto md:w-[21rem] lg:w-96
                    md:rounded-none md:shadow-none md:border-r md:border-zinc-200 dark:md:border-zinc-800`}
            >
                {/* Mobile sheet header */}
                <div className="md:hidden shrink-0 px-4 pt-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="mx-auto w-10 h-1 rounded-full bg-zinc-200 dark:bg-zinc-700 mb-3" />
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
                            {activeTab === 'settings' ? 'Settings' : `Images (${images.length})`}
                        </h2>
                        <button
                            onClick={() => setShowMobilePanel(false)}
                            aria-label="Close panel"
                            className="h-9 w-9 flex items-center justify-center rounded-lg text-zinc-400 active:bg-zinc-100 dark:active:bg-zinc-800"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Desktop header + tabs */}
                <div className="hidden md:block p-6 pb-2 bg-white dark:bg-zinc-900">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="bg-indigo-600 rounded-lg p-1.5 shadow-lg shadow-indigo-200">
                            <Layout className="w-5 h-5 text-white" aria-hidden="true" />
                        </div>
                        <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 tracking-tight">EzzPrint</h1>
                    </div>

                    <div role="tablist" className="flex p-1 bg-zinc-100/80 dark:bg-zinc-800 rounded-xl">
                        <button
                            role="tab"
                            aria-selected={activeTab === 'settings'}
                            onClick={() => setActiveTab('settings')}
                            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${activeTab === 'settings' ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'}`}
                        >
                            Settings
                        </button>
                        <button
                            role="tab"
                            aria-selected={activeTab === 'sequence'}
                            onClick={() => setActiveTab('sequence')}
                            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${activeTab === 'sequence' ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'}`}
                        >
                            Images ({images.length})
                        </button>
                    </div>
                </div>

                {/* Scrollable panel body. The extra bottom padding on mobile keeps
                    the last control clear of the fixed tab bar. */}
                <div
                    className="flex-1 overflow-y-auto overscroll-contain px-4 md:px-6 py-4 space-y-7"
                    style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
                >
                    {/* TAB: SETTINGS */}
                    {activeTab === 'settings' && (
                        <>
                            {/* Import */}
                            <div
                                {...dropHandlers}
                                className={`group border-2 border-dashed rounded-2xl p-6 text-center transition-colors duration-200 cursor-pointer
                                    ${isDraggingFile ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-500/10' : 'border-zinc-200 dark:border-zinc-700 hover:border-indigo-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'}`}
                                onClick={openFilePicker}
                            >
                                <button type="button" onClick={(e) => { e.stopPropagation(); openFilePicker(); }} className="w-full flex flex-col items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-xl py-1">
                                    <span className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 rounded-full flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                                        {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                                    </span>
                                    <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                                        {isProcessing ? 'Loading images…' : 'Add images'}
                                    </span>
                                    <span className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Tap to browse or drop files here</span>
                                </button>
                            </div>

                            {/* Selected Image Editor */}
                            {selectedImage && (
                                <div className="bg-white dark:bg-zinc-800/60 border border-indigo-100 dark:border-indigo-500/30 p-4 rounded-2xl shadow-sm space-y-4 ring-4 ring-indigo-50/50 dark:ring-indigo-500/10">
                                    <div className="flex justify-between items-start">
                                        <h3 className="text-[11px] font-bold uppercase text-indigo-500 dark:text-indigo-300 tracking-wider flex items-center gap-1.5">
                                            <MousePointer2 className="w-3 h-3" aria-hidden="true" /> Selected Image
                                        </h3>
                                        <button
                                            onClick={() => setSelectedImageId(null)}
                                            aria-label="Deselect image"
                                            className="h-7 w-7 -mt-1 -mr-1 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-900/60 p-2 rounded-xl border border-zinc-100 dark:border-zinc-700">
                                        <img src={selectedImage.src} alt="" className="w-12 h-12 object-cover rounded-lg bg-white shadow-sm border border-zinc-200" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold truncate text-zinc-700 dark:text-zinc-200">{selectedImage.name}</p>
                                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium tabular-nums">
                                                {selectedPlaced
                                                    ? `${selectedPlaced.width.toFixed(0)} × ${selectedPlaced.height.toFixed(0)} mm on page ${selectedPlaced.pageIndex + 1}`
                                                    : 'Not placed'}
                                            </p>
                                        </div>
                                    </div>

                                    <SliderRow
                                        id="selected-scale"
                                        label="Scale"
                                        value={selectedImage.scale * 100}
                                        display={`${(selectedImage.scale * 100).toFixed(0)}%`}
                                        min={10}
                                        max={200}
                                        step={5}
                                        onChange={(v) => updateImageScale(selectedImage.id, v / 100)}
                                    />

                                    {selectedPlaced?.clamped && (
                                        <p className="text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-1.5 bg-amber-50 dark:bg-amber-500/10 p-2 rounded-lg border border-amber-100 dark:border-amber-500/25">
                                            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
                                            Shrunk to fit the page. Lower the margin or pick a bigger paper size for more room.
                                        </p>
                                    )}

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => updateImageScale(selectedImage.id, 1)}
                                            disabled={selectedImage.scale === 1}
                                            className="flex-1 py-2.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-700/60 border border-zinc-200 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-40 rounded-lg transition-colors"
                                        >
                                            Reset
                                        </button>
                                        <button
                                            onClick={(e) => removeImage(selectedImage.id, e)}
                                            className="flex-1 py-2.5 flex items-center justify-center gap-2 text-xs font-semibold text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/25 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Remove
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Global Sizing */}
                            <div className="space-y-3">
                                <SectionTitle icon={Scaling}>Image Size</SectionTitle>
                                <div className="bg-zinc-50/70 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 space-y-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <label htmlFor="uniform-size" className="text-xs font-medium text-zinc-700 dark:text-zinc-200 cursor-pointer">
                                            Same size for all
                                            <span className="block text-[11px] font-normal text-zinc-400 dark:text-zinc-500 mt-0.5">
                                                {useUniformSize ? 'Every image fits one target size' : 'Keep original proportions'}
                                            </span>
                                        </label>
                                        <Toggle id="uniform-size" checked={useUniformSize} onChange={setUseUniformSize} label="Use one size for all images" />
                                    </div>

                                    {useUniformSize ? (
                                        <SliderRow
                                            id="target-size"
                                            label="Longest side"
                                            value={clamp(targetSize, 20, maxTargetSize)}
                                            display={`${targetSize} mm`}
                                            min={20}
                                            max={maxTargetSize}
                                            onChange={setTargetSize}
                                        />
                                    ) : (
                                        <SliderRow
                                            id="global-scale"
                                            label="Scale"
                                            value={globalScale}
                                            display={`${globalScale}%`}
                                            min={10}
                                            max={200}
                                            onChange={setGlobalScale}
                                            hint="Relative to the image's natural size at 96 DPI."
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Paper & Layout */}
                            <div className="space-y-3">
                                <SectionTitle icon={Settings}>Paper &amp; Layout</SectionTitle>

                                <div className="space-y-3">
                                    <div>
                                        <label htmlFor="paper-size" className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1.5 block">Paper size</label>
                                        <select
                                            id="paper-size"
                                            value={paperSize}
                                            onChange={(e) => setPaperSize(e.target.value as PaperKey)}
                                            className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 py-2.5 px-3 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 cursor-pointer"
                                        >
                                            {Object.entries(PAPER_SIZES).map(([key, config]) => (
                                                <option key={key} value={key}>{config.label} — {config.sub}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <Stepper id="margin" label="Margin" value={margin} min={0} max={maxMargin} unit="mm" onChange={setMargin} />
                                        <Stepper id="gap" label="Gap" value={gap} min={0} max={MAX_GAP_MM} unit="mm" onChange={setGap} />
                                    </div>

                                    <div className="flex items-center justify-between gap-3 p-3 bg-zinc-50/70 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                        <label htmlFor="auto-rotate" className="flex items-center gap-2 cursor-pointer">
                                            <RotateCw className="w-4 h-4 text-zinc-400" aria-hidden="true" />
                                            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">Auto rotate to fit</span>
                                        </label>
                                        <Toggle id="auto-rotate" checked={allowRotation} onChange={setAllowRotation} label="Auto rotate images to fit" />
                                    </div>

                                    <div className="space-y-2">
                                        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300 block">Arrangement</span>
                                        <div className="flex p-1 bg-zinc-100/80 dark:bg-zinc-800 rounded-lg gap-1">
                                            <button
                                                onClick={() => setSortStrategy('smart')}
                                                aria-pressed={sortStrategy === 'smart'}
                                                className={`flex-1 py-2 text-[11px] font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${sortStrategy === 'smart' ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'}`}
                                            >
                                                <Wand2 className="w-3 h-3" aria-hidden="true" /> Automatic
                                            </button>
                                            <button
                                                onClick={() => setSortStrategy('manual')}
                                                aria-pressed={sortStrategy === 'manual'}
                                                className={`flex-1 py-2 text-[11px] font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${sortStrategy === 'manual' ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'}`}
                                            >
                                                <List className="w-3 h-3" aria-hidden="true" /> My order
                                            </button>
                                        </div>
                                        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-snug">
                                            {sortStrategy === 'smart'
                                                ? 'Largest first — usually fits the most per sheet.'
                                                : 'Placed in the order shown on the Images tab.'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* TAB: SEQUENCE */}
                    {activeTab === 'sequence' && (
                        <div className="space-y-4">
                            {images.length === 0 ? (
                                <div className="text-center py-12 flex flex-col items-center border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-2xl bg-zinc-50/50 dark:bg-zinc-800/30">
                                    <List className="w-10 h-10 mb-3 text-zinc-300 dark:text-zinc-600" aria-hidden="true" />
                                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No images yet</p>
                                    <button onClick={openFilePicker} className="mt-3 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 underline underline-offset-2">
                                        Add some images
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center gap-2">
                                        <button
                                            onClick={openFilePicker}
                                            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 py-1.5"
                                        >
                                            <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" /> Add more
                                        </button>
                                        <button
                                            onClick={clearAll}
                                            className="text-xs text-rose-500 dark:text-rose-400 hover:text-rose-700 font-medium py-1.5"
                                        >
                                            Clear all
                                        </button>
                                    </div>

                                    {sortStrategy === 'smart' && (
                                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-start gap-1.5 bg-zinc-50 dark:bg-zinc-800/60 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-700">
                                            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
                                            <span>
                                                Arrangement is automatic, so this order is ignored.{' '}
                                                <button onClick={() => setSortStrategy('manual')} className="font-semibold text-indigo-600 dark:text-indigo-400 underline underline-offset-2">
                                                    Use my order
                                                </button>
                                            </span>
                                        </p>
                                    )}

                                    <ul className="space-y-2">
                                        {images.map((img, index) => {
                                            const placed = placedById.get(img.id);
                                            const manual = sortStrategy === 'manual';
                                            return (
                                                <li
                                                    key={img.id}
                                                    draggable={manual}
                                                    onDragStart={() => { dragItem.current = index; setDragIndex(index); }}
                                                    onDragEnter={() => { dragOverItem.current = index; }}
                                                    onDragEnd={handleSort}
                                                    onDragOver={(e) => e.preventDefault()}
                                                    className={`group flex items-center gap-2 p-2 rounded-xl border transition-colors relative
                                                        ${selectedImageId === img.id ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10 ring-1 ring-indigo-500' : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 hover:border-indigo-300 dark:hover:border-indigo-500/50'}
                                                        ${dragIndex === index ? 'opacity-50' : ''}`}
                                                >
                                                    {manual && (
                                                        <span className="hidden md:flex w-4 shrink-0 items-center justify-center text-zinc-300 dark:text-zinc-600 cursor-grab active:cursor-grabbing" title="Drag to reorder">
                                                            <GripVertical className="w-4 h-4" aria-hidden="true" />
                                                        </span>
                                                    )}

                                                    <button
                                                        onClick={() => selectImage(img.id)}
                                                        className="flex items-center gap-3 flex-1 min-w-0 text-left rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                                    >
                                                        <span className="relative shrink-0">
                                                            <img src={img.src} alt="" className="w-11 h-11 rounded-lg object-cover bg-zinc-100 dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600" />
                                                            <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-zinc-700 dark:bg-zinc-600 text-white text-[10px] font-bold flex items-center justify-center">
                                                                {index + 1}
                                                            </span>
                                                        </span>
                                                        <span className="flex-1 min-w-0">
                                                            <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 truncate">{img.name}</span>
                                                            <span className="block text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums">
                                                                {placed ? `${placed.width.toFixed(0)}×${placed.height.toFixed(0)} mm · p${placed.pageIndex + 1}` : '—'}
                                                                {img.scale !== 1 && ` · ${(img.scale * 100).toFixed(0)}%`}
                                                            </span>
                                                        </span>
                                                    </button>

                                                    <div className="flex items-center gap-0.5 shrink-0">
                                                        {manual && (
                                                            <div className="flex flex-col">
                                                                <button
                                                                    onClick={() => moveImage(index, index - 1)}
                                                                    disabled={index === 0}
                                                                    aria-label={`Move ${img.name} up`}
                                                                    className="h-5 w-8 flex items-center justify-center rounded text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/15 disabled:opacity-25 transition-colors"
                                                                >
                                                                    <ChevronUp className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => moveImage(index, index + 1)}
                                                                    disabled={index === images.length - 1}
                                                                    aria-label={`Move ${img.name} down`}
                                                                    className="h-5 w-8 flex items-center justify-center rounded text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/15 disabled:opacity-25 transition-colors"
                                                                >
                                                                    <ChevronDown className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        )}
                                                        <button
                                                            onClick={(e) => removeImage(img.id, e)}
                                                            aria-label={`Remove ${img.name}`}
                                                            className="h-10 w-10 flex items-center justify-center rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/15 transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Desktop footer: summary + print */}
                <div className="hidden md:block p-6 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3">
                    {images.length > 0 && (
                        <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                            <span className="flex items-center gap-1.5">
                                <Gauge className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
                                {stats.pages} sheet{stats.pages > 1 ? 's' : ''} · {stats.coverage}% used
                            </span>
                            {stats.saved > 0 && (
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                    {stats.saved} sheet{stats.saved > 1 ? 's' : ''} saved
                                </span>
                            )}
                        </div>
                    )}
                    <button
                        onClick={handlePrint}
                        disabled={images.length === 0}
                        className="group w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500 disabled:cursor-not-allowed text-white rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none hover:shadow-indigo-300 disabled:shadow-none font-semibold flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
                    >
                        <Printer className="w-5 h-5" aria-hidden="true" />
                        <span>Print layout</span>
                    </button>
                </div>
            </aside>

            {/* --- MAIN PREVIEW AREA --- */}
            <main className="print-main flex-1 min-w-0 flex flex-col overflow-hidden relative" {...dropHandlers}>

                {/* Preview toolbar */}
                <div className="no-print shrink-0 flex items-center justify-between gap-2 px-3 md:px-6 py-2 bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-2 min-w-0 text-[11px] md:text-xs text-zinc-500 dark:text-zinc-400">
                        {images.length > 0 ? (
                            <>
                                <span className="px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 font-semibold text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                                    {stats.pages} sheet{stats.pages > 1 ? 's' : ''}
                                </span>
                                <span className="hidden sm:inline whitespace-nowrap">{stats.coverage}% of paper used</span>
                                {stats.saved > 0 && (
                                    <span className="hidden md:inline text-emerald-600 dark:text-emerald-400 font-semibold whitespace-nowrap">
                                        {stats.saved} sheet{stats.saved > 1 ? 's' : ''} saved
                                    </span>
                                )}
                            </>
                        ) : (
                            <span className="truncate">{currentPaper.label} · {currentPaper.sub}</span>
                        )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            onClick={() => setManualZoom(previewScale - 0.1)}
                            aria-label="Zoom out"
                            disabled={previewScale <= 0.1}
                            className="h-9 w-9 flex items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors"
                        >
                            <ZoomOut className="w-4 h-4" />
                        </button>
                        <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 tabular-nums w-11 text-center select-none">
                            {Math.round(previewScale * 100)}%
                        </span>
                        <button
                            onClick={() => setManualZoom(previewScale + 0.1)}
                            aria-label="Zoom in"
                            disabled={previewScale >= 3}
                            className="h-9 w-9 flex items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors"
                        >
                            <ZoomIn className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setFitToWidth(true)}
                            aria-pressed={fitToWidth}
                            title="Fit to width"
                            className={`h-9 px-2.5 flex items-center gap-1.5 rounded-lg text-[11px] font-semibold transition-colors ${fitToWidth ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                        >
                            <Maximize className="w-3.5 h-3.5" aria-hidden="true" />
                            <span className="hidden sm:inline">Fit</span>
                        </button>

                        <span className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-0.5" aria-hidden="true" />

                        <button
                            onClick={cycleTheme}
                            aria-label={THEME_META[theme].label}
                            title={THEME_META[theme].label}
                            className="h-9 w-9 flex items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            {React.createElement(THEME_META[theme].icon, { className: 'w-4 h-4' })}
                        </button>
                    </div>
                </div>

                {/* Scroll surface */}
                <div
                    className="print-scroll flex-1 overflow-auto bg-zinc-100/60 dark:bg-zinc-950 px-4 md:px-8 py-5 md:py-8"
                    style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
                >
                    <div ref={canvasRef} className="print-canvas w-full max-w-[1400px] mx-auto">
                        {images.length === 0 ? (
                            <div className="flex items-center justify-center py-10">
                                <button
                                    onClick={openFilePicker}
                                    className={`w-full max-w-md flex flex-col items-center gap-5 px-6 py-12 rounded-3xl border-2 border-dashed transition-colors
                                        ${isDraggingFile ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-500/10' : 'border-zinc-300 dark:border-zinc-700 bg-white/70 dark:bg-zinc-900/50 hover:border-indigo-400 hover:bg-white dark:hover:bg-zinc-900'}`}
                                >
                                    <span className="w-20 h-20 bg-white dark:bg-zinc-800 rounded-full shadow-lg shadow-zinc-200 dark:shadow-none flex items-center justify-center">
                                        {isProcessing
                                            ? <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                                            : <Layout className="w-8 h-8 text-indigo-400" />}
                                    </span>
                                    <span className="text-center">
                                        <span className="block text-lg font-bold text-zinc-700 dark:text-zinc-200 mb-1">
                                            {isProcessing ? 'Loading images…' : 'Drop images to start'}
                                        </span>
                                        <span className="block text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                            They get arranged onto as few sheets as possible, ready to print and cut.
                                        </span>
                                    </span>
                                    <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow-sm shadow-indigo-200">
                                        <Upload className="w-4 h-4" aria-hidden="true" /> Choose images
                                    </span>
                                </button>
                            </div>
                        ) : (
                            <div className="print-container space-y-8 md:space-y-10">
                                {packedPages.map((pageImages, pageIdx) => (
                                    <div
                                        key={pageIdx}
                                        className="page-wrapper mx-auto"
                                        style={{ width: paperWidthPx * previewScale }}
                                    >
                                        <div className="no-print flex items-center justify-between mb-2 px-0.5">
                                            <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500">Page {pageIdx + 1}</span>
                                            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                                                {pageImages.length} image{pageImages.length > 1 ? 's' : ''}
                                            </span>
                                        </div>

                                        {/* The outer block reserves the scaled footprint so the
                                            document flows correctly; the inner one renders the sheet
                                            at true physical size and is scaled down with a transform
                                            (works in Firefox, unlike the old CSS `zoom` hack). */}
                                        <div
                                            className="page-block relative"
                                            style={{ height: paperHeightPx * previewScale }}
                                        >
                                            <div
                                                className="sheet-scaler absolute top-0 left-0"
                                                style={{
                                                    width: paperWidthPx,
                                                    height: paperHeightPx,
                                                    transform: `scale(${previewScale})`,
                                                    transformOrigin: 'top left',
                                                }}
                                            >
                                                <div
                                                    className="print-sheet bg-white shadow-xl shadow-zinc-300/50 dark:shadow-black/50 relative overflow-hidden ring-1 ring-zinc-900/5 dark:ring-white/10"
                                                    style={{
                                                        width: `${currentPaper.width}mm`,
                                                        height: `${currentPaper.height}mm`,
                                                    }}
                                                >
                                                    {/* Margin guide (screen only) */}
                                                    <div
                                                        className="absolute border border-dashed border-zinc-200 pointer-events-none no-print"
                                                        style={{
                                                            left: `${safeMargin}mm`,
                                                            top: `${safeMargin}mm`,
                                                            right: `${safeMargin}mm`,
                                                            bottom: `${safeMargin}mm`,
                                                            zIndex: 10,
                                                        }}
                                                    />

                                                    {pageImages.map((img) => (
                                                        <div
                                                            key={img.id}
                                                            role="button"
                                                            tabIndex={0}
                                                            aria-label={`Select ${img.name}`}
                                                            onClick={(e) => { e.stopPropagation(); selectImage(img.id); }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' || e.key === ' ') {
                                                                    e.preventDefault();
                                                                    selectImage(img.id);
                                                                }
                                                            }}
                                                            className={`absolute overflow-hidden cursor-pointer transition-shadow
                                                                ${selectedImageId === img.id
                                                                    ? 'z-30 ring-2 ring-indigo-600 ring-offset-2 ring-offset-white shadow-lg'
                                                                    : 'hover:z-20 hover:ring-2 hover:ring-indigo-400'}`}
                                                            style={{
                                                                left: `${img.x + safeMargin}mm`,
                                                                top: `${img.y + safeMargin}mm`,
                                                                width: `${img.renderWidth}mm`,
                                                                height: `${img.renderHeight}mm`,
                                                            }}
                                                            title={`${img.name} — ${Math.round(img.width)}×${Math.round(img.height)} mm`}
                                                        >
                                                            {selectedImageId === img.id && (
                                                                <div className="absolute inset-0 bg-indigo-600/10 pointer-events-none z-10 no-print" />
                                                            )}

                                                            {img.rotated ? (
                                                                <img
                                                                    src={img.src}
                                                                    alt=""
                                                                    className="absolute object-cover"
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
                                                                <img src={img.src} alt="" className="w-full h-full object-cover block" />
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Drop overlay while dragging files anywhere over the preview */}
                {isDraggingFile && (
                    <div className="no-print absolute inset-0 z-40 bg-indigo-600/10 border-4 border-dashed border-indigo-400 rounded-lg pointer-events-none flex items-center justify-center">
                        <span className="px-4 py-2 rounded-xl bg-white dark:bg-zinc-800 shadow-lg text-sm font-semibold text-indigo-600 dark:text-indigo-300">
                            Drop to add images
                        </span>
                    </div>
                )}
            </main>

            {/* --- MOBILE TAB BAR --- */}
            <nav
                aria-label="Panels"
                className="md:hidden no-print fixed bottom-0 inset-x-0 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 z-50 flex"
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
                {([
                    { key: 'settings' as const, label: 'Settings', Icon: Settings },
                    { key: 'sequence' as const, label: 'Images', Icon: List },
                ]).map(({ key, label, Icon }) => {
                    const active = activeTab === key && showMobilePanel;
                    return (
                        <button
                            key={key}
                            onClick={() => toggleMobileTab(key)}
                            aria-expanded={active}
                            className={`flex-1 h-16 flex flex-col items-center justify-center gap-1 transition-colors ${active ? 'text-indigo-600 dark:text-indigo-300' : 'text-zinc-400 dark:text-zinc-500 active:text-zinc-600'}`}
                        >
                            <span className="relative">
                                <Icon className="w-5 h-5" aria-hidden="true" />
                                {key === 'sequence' && images.length > 0 && (
                                    <span className="absolute -top-1.5 -right-2.5 bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-px rounded-full min-w-[16px] text-center">
                                        {images.length}
                                    </span>
                                )}
                            </span>
                            <span className="text-[11px] font-semibold">{label}</span>
                        </button>
                    );
                })}
            </nav>

            {/* --- TOAST --- */}
            {notice && (
                <div
                    role="status"
                    aria-live="polite"
                    className="no-print pointer-events-none fixed left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium shadow-xl max-w-[90vw] text-center transition-[bottom] duration-300"
                    style={{
                        bottom: showMobilePanel
                            ? 'calc(78dvh + 1rem)'
                            : 'calc(5.5rem + env(safe-area-inset-bottom, 0px))',
                    }}
                >
                    {notice}
                </div>
            )}

            {/* --- PRINT STYLES --- */}
            <style>{`
                @media print {
                    /* Only the sheets should survive */
                    .no-print { display: none !important; }

                    /* Paper is paper: print output ignores the dark theme. */
                    :root, html, body {
                        color-scheme: light !important;
                        color: #18181b !important;
                    }

                    body, html, #root, .app-container {
                        height: auto !important;
                        overflow: visible !important;
                        display: block !important;
                        background: #fff !important;
                    }

                    @page {
                        size: ${currentPaper.width}mm ${currentPaper.height}mm;
                        margin: 0;
                    }

                    .print-main, .print-scroll {
                        display: block !important;
                        overflow: visible !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        background: #fff !important;
                    }

                    .print-container {
                        display: block !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        width: 100% !important;
                    }

                    /* Undo the on-screen preview scaling — printing from a phone
                       used to emit tiny, shrunken pages. */
                    .print-canvas, .page-wrapper, .page-block, .sheet-scaler {
                        width: auto !important;
                        height: auto !important;
                        max-width: none !important;
                        transform: none !important;
                        position: static !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }

                    .page-wrapper {
                        break-after: page;
                        page-break-after: always;
                    }
                    .page-wrapper:last-child {
                        break-after: auto;
                        page-break-after: auto;
                    }

                    .print-sheet {
                        box-shadow: none !important;
                        border: none !important;
                        outline: none !important;
                        overflow: hidden !important;
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                    }
                }
            `}</style>
        </div>
    );
}
