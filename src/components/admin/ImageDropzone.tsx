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
        className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-[#FF5500] bg-[#FF5500]/10 shadow-orange-glow-sm'
            : 'border-[#272732] hover:border-[#FF5500]/70 bg-[#121218]'
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

        <div className="flex flex-col items-center justify-center space-y-2.5">
          {isUploading ? (
            <div className="flex flex-col items-center space-y-2 text-[#FF5500]">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-xs font-bold uppercase tracking-wider">Pushing images to product-media storage...</p>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-2xl bg-[#FF5500]/10 border border-[#FF5500]/30 text-[#FF5500] flex items-center justify-center mb-1 shadow-orange-glow-sm">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-white uppercase tracking-wide">
                Click or drag & drop equipment photos here
              </p>
              <p className="text-xs text-neutral-400">
                PNG, JPEG, WEBP up to 5MB each. Max {maxFiles} images.
              </p>
            </>
          )}
        </div>
      </div>

      {uploadError && (
        <p className="text-xs text-red-300 font-medium bg-red-950/60 p-3 rounded-xl border border-red-800">
          {uploadError}
        </p>
      )}

      {/* Uploaded Images Preview Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 pt-2">
          {images.map((imgUrl, idx) => (
            <div
              key={idx}
              className="group relative aspect-square rounded-2xl border border-[#272732] overflow-hidden bg-[#14141B] flex items-center justify-center p-2 shadow-md"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgUrl} alt={`Upload ${idx + 1}`} className="w-full h-full object-contain" />

              {idx === 0 && (
                <span className="absolute bottom-2 left-2 bg-[#FF5500] text-black text-[10px] font-black uppercase px-2 py-0.5 rounded shadow-sm">
                  Cover
                </span>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveImage(idx);
                }}
                className="absolute top-2 right-2 bg-black/80 hover:bg-red-600 text-white p-1.5 rounded-full shadow-sm transition-colors"
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
