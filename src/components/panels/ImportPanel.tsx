import React from 'react';
import { Upload, FileImage } from 'lucide-react';

interface ImportPanelProps {
    handleFileUpload: (files: FileList | null) => void;
    isProcessing: boolean;
}

export const ImportPanel: React.FC<ImportPanelProps> = ({ handleFileUpload, isProcessing }) => {
    return (
        <div className="bg-white rounded-2xl border-2 border-dashed border-indigo-100 p-8 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer group relative overflow-hidden">
            <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => handleFileUpload(e.target.files)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                disabled={isProcessing}
            />
            {isProcessing ? (
                <div className="flex flex-col items-center animate-pulse">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full mb-3"></div>
                    <div className="h-4 bg-indigo-100 rounded w-24"></div>
                </div>
            ) : (
                <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-white group-hover:shadow-md transition-all duration-300">
                        <Upload className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-zinc-700 mb-1 group-hover:text-indigo-600 transition-colors">Click to upload</h3>
                    <p className="text-xs text-zinc-400">or drag and drop images</p>
                </div>
            )}
        </div>
    );
};
