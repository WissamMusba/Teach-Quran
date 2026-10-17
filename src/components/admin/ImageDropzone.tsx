'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, X, Loader2 } from 'lucide-react';

interface ImageDropzoneProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxFiles?: number;
}

export const ImageDropzone: React.FC<ImageDropzoneProps> = ({
  images,
  onChange,
  maxFiles = 6,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadFiles = async (files: FileList | File[]) => {
    setUploadError(null);
    const validFiles: File[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        setUploadError(`File ${file.name} is not a valid format. Only PNG, JPEG, and WEBP are allowed.`);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setUploadError(`File ${file.name} exceeds the 5MB size limit.`);
        return;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      validFiles.forEach((file) => formData.append('files', file));

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      if (data.urls && data.urls.length > 0) {
        onChange([...images, ...data.urls]);
      }
    } catch (err: any) {
      setUploadError(err.message || 'Error uploading files');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveImage = (index: number) => {
    const updated = images.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-orange-500 bg-orange-50/50'
            : 'border-neutral-300 hover:border-neutral-400 bg-neutral-50/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleUploadFiles(e.target.files);
          }}
        />

        <div className="flex flex-col items-center justify-center space-y-2">
          {isUploading ? (
            <div className="flex flex-col items-center space-y-2 text-orange-600">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm font-semibold">Pushing images to product-media storage...</p>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mb-1">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-neutral-800">
                Click or drag & drop equipment photos here
              </p>
              <p className="text-xs text-neutral-500">
                PNG, JPEG, WEBP up to 5MB each. Max {maxFiles} images.
              </p>
            </>
          )}
        </div>
      </div>

      {uploadError && (
        <p className="text-xs text-red-600 font-medium bg-red-50 p-2.5 rounded-lg border border-red-200">
          {uploadError}
        </p>
      )}

      {/* Uploaded Images Preview Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 pt-2">
          {images.map((imgUrl, idx) => (
            <div
              key={idx}
              className="group relative aspect-square rounded-xl border border-neutral-200 overflow-hidden bg-neutral-100 flex items-center justify-center shadow-xs"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgUrl} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />

              {idx === 0 && (
                <span className="absolute bottom-1.5 left-1.5 bg-neutral-900/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded backdrop-blur-xs">
                  Cover
                </span>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveImage(idx);
                }}
                className="absolute top-1.5 right-1.5 bg-white/90 hover:bg-red-600 hover:text-white text-neutral-700 p-1 rounded-full shadow-sm opacity-90 group-hover:opacity-100 transition-colors"
                title="Remove photo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
