'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  Camera,
  X,
  Loader2,
  Link as LinkIcon,
  Check,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

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

  // Direct URL paste state
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  // Live Camera Modal State (Webcam)
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // File and Camera Native Input Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mobileCameraInputRef = useRef<HTMLInputElement>(null);

  // Handle uploading files (from drag-drop, file dialog, or camera)
  const handleUploadFiles = React.useCallback(
    async (files: FileList | File[]) => {
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

      if (images.length + validFiles.length > maxFiles) {
        setUploadError(`You can only upload up to ${maxFiles} photos per product.`);
        return;
      }

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
    },
    [images, maxFiles, onChange]
  );

  // Handle Clipboard Paste (Ctrl+V anywhere in this component or window)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        handleUploadFiles(imageFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleUploadFiles]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  // Add Direct URL
  const handleAddUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    if (!urlInput.startsWith('http://') && !urlInput.startsWith('https://')) {
      setUploadError('Please provide a valid image URL starting with http:// or https://');
      return;
    }

    if (images.length >= maxFiles) {
      setUploadError(`Maximum ${maxFiles} photos reached.`);
      return;
    }

    onChange([...images, urlInput.trim()]);
    setUrlInput('');
    setShowUrlInput(false);
    setUploadError(null);
  };

  // Live Camera Streaming (Laptop/Desktop or Mobile)
  const startCamera = async () => {
    setCameraError(null);
    setIsCameraOpen(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.warn('Direct webcam access failed or unavailable, falling back to native capture input:', err);
      // Fallback: trigger native file camera input
      setIsCameraOpen(false);
      mobileCameraInputRef.current?.click();
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo-${Date.now()}.webp`, { type: 'image/webp' });
        stopCamera();
        await handleUploadFiles([file]);
      },
      'image/webp',
      0.9
    );
  };

  // Image manipulation (Set cover & remove)
  const handleSetCover = (index: number) => {
    if (index === 0) return;
    const item = images[index];
    const remaining = images.filter((_, i) => i !== index);
    onChange([item, ...remaining]);
  };

  const handleRemoveImage = (index: number) => {
    const updated = images.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      {/* Hidden File Inputs */}
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

      {/* Native Mobile Camera Input */}
      <input
        ref={mobileCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleUploadFiles(e.target.files);
        }}
      />

      {/* Big Action Bar: 2 One-Click Buttons (Camera or Upload) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Button 1: Take Photo */}
        <button
          type="button"
          onClick={startCamera}
          disabled={images.length >= maxFiles || isUploading}
          className="flex items-center justify-center space-x-3 p-4 rounded-2xl bg-[#FF5500] hover:bg-[#FF6600] disabled:opacity-40 text-black font-black uppercase tracking-wider text-xs shadow-orange-glow transition-all active:scale-98 group"
        >
          <Camera className="w-5 h-5 text-black group-hover:scale-110 transition-transform" />
          <span>Snap Photo with Camera</span>
        </button>

        {/* Button 2: Upload Files */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={images.length >= maxFiles || isUploading}
          className="flex items-center justify-center space-x-3 p-4 rounded-2xl bg-[#14141B] hover:bg-[#1C1C26] border border-[#272735] hover:border-[#FF5500]/60 text-white font-black uppercase tracking-wider text-xs transition-all active:scale-98 group"
        >
          <UploadCloud className="w-5 h-5 text-[#FF5500] group-hover:scale-110 transition-transform" />
          <span>Upload Image Files</span>
        </button>
      </div>

      {/* Drag & Drop Surface with Paste & URL options */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-3xl p-6 sm:p-8 text-center transition-all ${
          isDragging
            ? 'border-[#FF5500] bg-[#FF5500]/10 shadow-orange-glow-sm'
            : 'border-[#272732] hover:border-[#FF5500]/50 bg-[#101016]'
        }`}
      >
        <div className="flex flex-col items-center justify-center space-y-2">
          {isUploading ? (
            <div className="flex flex-col items-center space-y-2.5 text-[#FF5500]">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-xs font-black uppercase tracking-widest">
                Optimizing & Saving Photo...
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs font-bold text-neutral-300 uppercase tracking-wide">
                Drag and drop equipment images here, or paste from clipboard (Ctrl+V)
              </p>
              <p className="text-[11px] text-neutral-500">
                PNG, JPEG, WEBP up to 5MB each. ({images.length} of {maxFiles} slots filled)
              </p>

              {/* Extra Utility: Add via URL */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  className="inline-flex items-center space-x-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400 hover:text-[#FF5500] transition-colors"
                >
                  <LinkIcon className="w-3.5 h-3.5 text-[#FF5500]" />
                  <span>{showUrlInput ? 'Hide URL Input' : 'Or paste an Image Link directly'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* URL Input Bar */}
      {showUrlInput && (
        <div className="p-4 bg-[#14141C] border border-[#262634] rounded-2xl space-y-2 animate-in fade-in">
          <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400">
            Paste Web Image URL (Unsplash, Manufacturer CDN, etc.)
          </label>
          <div className="flex space-x-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://images.unsplash.com/photo-..."
              className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-[#272730] bg-[#0E0E14] text-white focus:outline-none focus:border-[#FF5500]"
            />
            <button
              type="button"
              onClick={handleAddUrl}
              className="px-4 py-2.5 rounded-xl bg-[#FF5500] hover:bg-[#FF6600] text-black font-black uppercase tracking-wider text-xs transition-colors"
            >
              Add URL
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {uploadError && (
        <div className="p-3.5 rounded-2xl bg-red-950/70 border border-red-800 text-red-200 text-xs font-semibold flex items-center justify-between">
          <span>{uploadError}</span>
          <button onClick={() => setUploadError(null)} className="text-red-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Uploaded Images Preview Grid */}
      {images.length > 0 && (
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-neutral-400">
              Equipment Photos ({images.length}/{maxFiles})
            </span>
            <span className="text-[10px] text-neutral-500">
              Click any photo to set as primary cover
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {images.map((imgUrl, idx) => (
              <div
                key={idx}
                onClick={() => handleSetCover(idx)}
                className={`group relative aspect-square rounded-2xl border overflow-hidden bg-[#121218] flex items-center justify-center p-2 shadow-md cursor-pointer transition-all ${
                  idx === 0
                    ? 'border-[#FF5500] ring-2 ring-[#FF5500]/30 shadow-orange-glow-sm'
                    : 'border-[#272735] hover:border-neutral-400'
                }`}
                title={idx === 0 ? 'Primary Cover Photo' : 'Click to make Cover Photo'}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imgUrl}
                  alt={`Photo ${idx + 1}`}
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                />

                {/* Badge for Cover */}
                {idx === 0 ? (
                  <span className="absolute bottom-2 left-2 bg-[#FF5500] text-black text-[9px] font-black uppercase px-2 py-0.5 rounded shadow-sm flex items-center space-x-1">
                    <Check className="w-3 h-3 text-black" />
                    <span>Cover</span>
                  </span>
                ) : (
                  <span className="absolute bottom-2 left-2 bg-black/80 text-white text-[9px] font-bold uppercase px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    Make Cover
                  </span>
                )}

                {/* Remove button */}
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
        </div>
      )}

      {/* Live Webcam Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0E0E14] border border-[#272732] rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-[#1C1C24]">
              <div className="flex items-center space-x-2">
                <Camera className="w-5 h-5 text-[#FF5500]" />
                <h3 className="font-display uppercase text-xl font-black text-white">
                  Snap Equipment Photo
                </h3>
              </div>
              <button
                type="button"
                onClick={stopCamera}
                className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-[#181822]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Viewfinder */}
            <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-[#22222A] relative flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 border-2 border-[#FF5500]/30 rounded-2xl pointer-events-none" />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={stopCamera}
                className="px-5 py-2.5 rounded-xl border border-[#272735] text-neutral-400 hover:text-white text-xs font-bold uppercase tracking-wider"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={capturePhoto}
                className="px-8 py-3 rounded-xl bg-[#FF5500] hover:bg-[#FF6600] text-black font-black uppercase tracking-wider text-xs shadow-orange-glow flex items-center space-x-2 active:scale-95"
              >
                <Camera className="w-4 h-4 text-black" />
                <span>Capture & Use Photo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
