import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, ZoomIn, ZoomOut, RotateCw, X } from "lucide-react";

interface PhotoViewerModalProps {
  photoUrl: string;
  onClose: () => void;
}

export const PhotoViewerModal = ({ photoUrl, onClose }: PhotoViewerModalProps) => {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.2, 3));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.2, 0.5));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = photoUrl;
    link.download = `contact-photo-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReset = () => {
    setScale(1);
    setRotation(0);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="relative w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Modal header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">Photo Viewer</h3>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Photo container */}
        <div className="flex-1 flex items-center justify-center overflow-hidden rounded-lg bg-black/20">
          <img
            ref={imgRef}
            src={photoUrl}
            alt="Contact submission photo"
            className="max-w-full max-h-[70vh] object-contain"
            style={{
              transform: `scale(${scale}) rotate(${rotation}deg)`,
              transition: "transform 0.2s ease"
            }}
          />
        </div>

        {/* Controls */}
        <div className="mt-4 flex flex-wrap gap-2 justify-center">
          <Button variant="secondary" onClick={handleZoomIn} className="flex items-center gap-2">
            <ZoomIn className="w-4 h-4" />
            Zoom In
          </Button>
          <Button variant="secondary" onClick={handleZoomOut} className="flex items-center gap-2">
            <ZoomOut className="w-4 h-4" />
            Zoom Out
          </Button>
          <Button variant="secondary" onClick={handleRotate} className="flex items-center gap-2">
            <RotateCw className="w-4 h-4" />
            Rotate
          </Button>
          <Button variant="secondary" onClick={handleReset} className="flex items-center gap-2">
            Reset
          </Button>
          <Button variant="default" onClick={handleDownload} className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Download
          </Button>
        </div>
      </div>
    </div>
  );
};