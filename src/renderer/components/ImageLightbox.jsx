import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, ExternalLink, Copy, Check } from 'lucide-react';

export default function ImageLightbox({ src, alt, onClose }) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);

  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialPosRef = useRef({ x: 0, y: 0 });

  // Keyboard shortcut listener: Escape to close, + / - to zoom, 0 to reset
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setScale((prev) => Math.min(prev + 0.25, 4));
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setScale((prev) => Math.max(prev - 0.25, 0.5));
      } else if (e.key === '0') {
        e.preventDefault();
        setScale(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Prevent scroll propagation to background while lightbox is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      if (navigator.clipboard && src) {
        await navigator.clipboard.writeText(src);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // ignore clipboard write errors
    }
  }, [src]);

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.25, 4));
  const zoomOut = () =>
    setScale((prev) => {
      const next = Math.max(prev - 0.25, 0.5);
      if (next <= 1) setPosition({ x: 0, y: 0 });
      return next;
    });

  const zoomReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Wheel-to-zoom handler with delta scaling, clamped between 0.5x and 4x
  const handleWheel = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.15 : -0.15;
    setScale((prev) => {
      const next = Math.min(4, Math.max(0.5, Math.round((prev + zoomFactor) * 100) / 100));
      if (next <= 1) {
        setPosition({ x: 0, y: 0 });
      }
      return next;
    });
  };

  // Pan / Drag handlers when zoomed in (scale > 1)
  const handleMouseDown = (e) => {
    if (scale <= 1) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    initialPosRef.current = { ...position };
  };

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPosition({
      x: initialPosRef.current.x + dx,
      y: initialPosRef.current.y + dy,
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
    }
  }, [isDragging]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer lightbox"
      className="fixed top-[38px] inset-x-0 bottom-0 z-40 flex flex-col bg-[#121314]/90 backdrop-blur-md animate-in fade-in duration-150 select-none border-t border-[#2A2B2C]"
      onClick={onClose}
    >
      {/* Top Bar: Title / Alt & Close Button */}
      <div
        className="h-11 px-4 bg-[#191A1B]/80 border-b border-[#2A2B2C] flex items-center justify-between gap-4 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-medium text-[#ededed] truncate max-w-xl">
            {alt || 'Image Preview'}
          </span>
          <span className="text-[10px] text-[#8C8C8C] bg-[#121314] px-1.5 py-0.5 rounded border border-[#2A2B2C]">
            {Math.round(scale * 100)}%
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-[#bfbfbf] hover:text-[#ededed] bg-[#242526] hover:bg-[#333536] px-2 py-1 rounded border border-[#2A2B2C] transition"
            title="Copy Image URL / Source"
            aria-label="Copy image source"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#48A0C7]" />
                <span className="text-[11px]">Copy Source</span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="p-1 text-[#8C8C8C] hover:text-[#ededed] hover:bg-white/[0.08] rounded transition"
            title="Close (Esc)"
            aria-label="Close image lightbox"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Center Image Viewport */}
      <div
        onWheel={handleWheel}
        className="flex-1 overflow-hidden flex items-center justify-center p-6 cursor-zoom-out relative"
      >
        <img
          src={src}
          alt={alt || 'Enlarged README image'}
          onMouseDown={handleMouseDown}
          draggable={false}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            maxHeight: '85vh',
            maxWidth: '90vw',
          }}
          className={`object-contain rounded-md shadow-2xl select-none border border-[#2A2B2C] ${
            scale > 1
              ? isDragging
                ? 'cursor-grabbing'
                : 'cursor-grab'
              : 'cursor-default'
          }`}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Bottom Floating Toolbar: Zoom In, Out, Reset */}
      <div
        className="h-10 px-4 bg-[#191A1B]/90 border-t border-[#2A2B2C] flex items-center justify-center gap-2 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1 bg-[#242526] p-1 rounded-md border border-[#2A2B2C]">
          <button
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="p-1 text-[#bfbfbf] hover:text-white disabled:opacity-40 hover:bg-white/[0.06] rounded transition"
            title="Zoom Out (-)"
            aria-label="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <button
            onClick={zoomReset}
            className="px-2 py-0.5 text-[11px] text-[#ededed] hover:text-white hover:bg-white/[0.06] rounded font-mono transition"
            title="Reset Zoom (0)"
            aria-label="Reset Zoom"
          >
            Reset
          </button>

          <button
            onClick={zoomIn}
            disabled={scale >= 4}
            className="p-1 text-[#bfbfbf] hover:text-white disabled:opacity-40 hover:bg-white/[0.06] rounded transition"
            title="Zoom In (+)"
            aria-label="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        <span className="text-[11px] text-[#8C8C8C] ml-3 hidden sm:inline">
          Esc to close • Scroll or +/- to zoom • {scale > 1 ? "Drag to pan" : "Zoom in to drag"}
        </span>
      </div>
    </div>
  );
}
