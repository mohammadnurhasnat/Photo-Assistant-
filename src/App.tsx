/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, User, Sparkles, Shirt, FileType, Check, Loader2, RotateCcw, LayoutGrid, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { detectFace, editPortrait, BoundingBox, OutfitType, DetectionResult } from './services/geminiService';

const PRIMARY_COLOR = "#FF8006";
const ACCENT_COLOR = "#0C8493";
const SECONDARY_COLOR = "#00C4D1";
const BG_COLOR = "#E9FFFC";

export default function App() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'male' | 'female'>('male');
  const [earsVisible, setEarsVisible] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const resizeForDetection = (base64: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 800; // Efficient size for AI detection
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height *= maxDim / width;
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width *= maxDim / height;
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = base64;
    });
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setOriginalImage(base64);
      setCroppedImage(null);
      setFinalImage(null);
      await handleFaceDetection(base64, file.type);
    };
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false
  } as any);

  const handleFaceDetection = async (base64: string, mimeType: string) => {
    setIsProcessing(true);
    setProcessStep("Speeding up & Detecting Face...");
    
    // Optimization: Resize image before sending to Gemini for detection
    const smallBase64 = await resizeForDetection(base64);
    
    const result = await detectFace(smallBase64, 'image/jpeg');
    if (result) {
      setEarsVisible(result.earsVisible);
      cropImage(base64, result.box);
    } else {
      setCroppedImage(base64);
      setEarsVisible(null);
    }
    setProcessStep(null);
    setIsProcessing(false);
  };

  const cropImage = (base64: string, box: BoundingBox) => {
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const ymin = (box.ymin / 1000) * img.height;
      const xmin = (box.xmin / 1000) * img.width;
      const ymax = (box.ymax / 1000) * img.height;
      const xmax = (box.xmax / 1000) * img.width;

      const faceWidth = xmax - xmin;
      const faceHeight = ymax - ymin;
      const centerX = xmin + faceWidth / 2;
      const centerY = ymin + faceHeight / 2;

      // Professional headshot ratios based on reference
      // Size the crop so the face height is about 55-60% of the total frame
      const size = faceHeight * 1.7;
      
      // Horizontal centering, vertical offset to match reference (eyes at ~60% from bottom)
      const cropX = centerX - size / 2;
      const cropY = centerY - (size * 0.45); 

      canvas.width = 600;
      canvas.height = 600;
      
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, 600, 600);

      ctx.drawImage(img, cropX, cropY, size, size, 0, 0, 600, 600);
      setCroppedImage(canvas.toDataURL('image/jpeg', 0.95));
    };
    img.src = base64;
  };

  const handleEdit = async (outfit: OutfitType) => {
    if (!croppedImage) return;
    
    setIsProcessing(true);
    setErrorMessage(null);
    setProcessStep("Applying AI Transformation...");
    setFinalImage(null);

    const colors = [
      "Light Blue", "Deep Maroon", "Emerald Green", "Royal Navy", "Soft Lavender", 
      "Neutral Grey", "Charcoal", "Burgundy", "Peach", "Mint Green", 
      "Sky Blue", "Classic Black", "Ivory White", "Rose Pink"
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    try {
      const edited = await editPortrait(croppedImage, 'image/jpeg', outfit, randomColor);
      if (edited) {
        setFinalImage(edited);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsProcessing(false);
      setProcessStep(null);
    }
  };

  const reset = () => {
    setOriginalImage(null);
    setCroppedImage(null);
    setFinalImage(null);
    setEarsVisible(null);
  };

  return (
    <div 
      id="app-root"
      className="min-h-screen flex flex-col font-sans"
      style={{ backgroundColor: BG_COLOR }}
    >
      <header className="py-4 px-8 flex justify-between items-center border-b border-opacity-10 bg-white/50 backdrop-blur-md sticky top-0 z-10" style={{ borderColor: ACCENT_COLOR }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg" style={{ backgroundColor: PRIMARY_COLOR }}>
            <Sparkles size={22} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">Visa Portrait AI</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 text-[10px] font-bold uppercase tracking-wider rounded-md border border-green-100">
            <Check size={12} />
            Optimized Performance
          </div>
          <button 
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all hover:bg-white hover:shadow-md"
            style={{ color: ACCENT_COLOR }}
          >
            <RotateCcw size={16} />
            Reset
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-6xl mx-auto w-full gap-8">
        {!originalImage ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            {...getRootProps()}
            className={cn(
              "w-full max-w-2xl aspect-[16/9] border-2 border-dashed rounded-3xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-300",
              isDragActive ? "bg-white shadow-xl scale-105" : "hover:bg-white/50"
            )}
            style={{ 
              borderColor: isDragActive ? PRIMARY_COLOR : ACCENT_COLOR + "40",
            }}
          >
            <input {...getInputProps()} />
            <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-sm text-[#FF8006]">
              <Upload size={32} />
            </div>
            <div className="text-center px-4">
              <p className="text-xl font-semibold text-gray-800">Drop your photo here</p>
              <p className="text-gray-500 mt-1 max-w-md">Instantly create professional 2x2 portraits with AI-powered face positioning and outfit swaps</p>
            </div>
          </motion.div>
        ) : (
          <div className="w-full flex flex-col lg:flex-row gap-8 items-start relative">
            {/* Left Column: Previews */}
            <div className="flex-1 space-y-6 w-full">
              <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative group overflow-hidden">
                <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-2 py-1 bg-black/40 backdrop-blur-md rounded-md text-[10px] text-white font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                   Input Source
                </div>
                <div className="relative aspect-square max-w-[400px] mx-auto rounded-xl overflow-hidden bg-gray-50 ring-1 ring-gray-100">
                  <img 
                    src={originalImage} 
                    alt="Original" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  {isProcessing && (
                    <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                      <div className="relative">
                        <Loader2 className="animate-spin" style={{ color: PRIMARY_COLOR }} size={40} />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Sparkles size={16} className="text-[#0C8493] animate-pulse" />
                        </div>
                      </div>
                      <p className="text-sm font-bold tracking-tight" style={{ color: ACCENT_COLOR }}>{processStep}</p>
                    </div>
                  )}
                </div>
              </section>

              {croppedImage && (
                <motion.section 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-40 h-40 rounded-xl overflow-hidden border-4 border-white shadow-xl bg-white ring-1 ring-gray-200 shrink-0">
                      <img 
                        src={croppedImage} 
                        alt="Cropped" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Aligned Frame</div>
                      <h3 className="text-lg font-bold text-gray-900 mb-2">Professional 2x2 Format</h3>
                      
                      <AnimatePresence>
                        {earsVisible === true && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="mb-4 p-2 bg-green-50 border border-green-100 rounded-xl flex items-center gap-2"
                          >
                            <Check className="text-green-600 shrink-0" size={14} />
                            <p className="text-[10px] font-bold text-green-700 uppercase tracking-tight">Ears Visible • Visa Compliant</p>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <p className="text-sm text-gray-500 leading-relaxed max-w-sm">
                        AI-positioned to match embassy standards. Head centered with correct vertical clearance.
                      </p>
                      <div className="flex gap-2 mt-3">
                        <span className="px-2 py-0.5 bg-gray-100 text-[10px] font-bold text-gray-500 rounded uppercase">600 PX</span>
                        <span className="px-2 py-0.5 bg-gray-100 text-[10px] font-bold text-gray-500 rounded uppercase">300 DPI</span>
                      </div>
                    </div>
                  </div>
                </motion.section>
              )}
            </div>

            {/* Right Column: Actions & Final Result */}
            <div className="w-full lg:w-[450px] space-y-6">
              <section className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100 sticky top-24">
                <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-2xl mb-6">
                  <button 
                    onClick={() => setActiveTab('male')}
                    className={cn(
                      "flex-1 py-2 px-4 rounded-xl text-sm font-bold transition-all",
                      activeTab === 'male' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    Male Styles
                  </button>
                  <button 
                    onClick={() => setActiveTab('female')}
                    className={cn(
                      "flex-1 py-2 px-4 rounded-xl text-sm font-bold transition-all",
                      activeTab === 'female' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    Female Styles
                  </button>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  {errorMessage && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-2 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3"
                    >
                      <AlertTriangle className="text-red-500 shrink-0" size={18} />
                      <div className="text-xs font-semibold text-red-700 leading-tight">
                        {errorMessage}
                      </div>
                    </motion.div>
                  )}
                  
                  {activeTab === 'male' ? (
                    <>
                      <ActionButton 
                        icon={<Shirt size={18} />}
                        label="Change Shirt"
                        sublabel="Professional button-down"
                        onClick={() => handleEdit('random_shirt')}
                        disabled={isProcessing}
                      />
                      <ActionButton 
                        icon={<LayoutGrid size={18} />}
                        label="Change T-shirt"
                        sublabel="Clean solid-color casual"
                        onClick={() => handleEdit('tshirt')}
                        disabled={isProcessing}
                      />
                      <ActionButton 
                        icon={<FileType size={18} />}
                        label="Wear Suit & Tie"
                        sublabel="Formal coat, shirt, and tie"
                        onClick={() => handleEdit('suit')}
                        disabled={isProcessing}
                        variant="accent"
                      />
                    </>
                  ) : (
                    <>
                      <ActionButton 
                         icon={<Shirt size={18} />}
                        label="Kameez Change"
                        sublabel="Elegant professional Kameez"
                        onClick={() => handleEdit('female_dress')}
                        disabled={isProcessing}
                      />
                      <ActionButton 
                        icon={<FileType size={18} />}
                        label="Three-Piece Kameez"
                        sublabel="Traditional dress and scarf"
                        onClick={() => handleEdit('female_suit')}
                        disabled={isProcessing}
                        variant="accent"
                      />
                      <ActionButton 
                        icon={<Shirt size={18} />}
                        label="Professional Blouse"
                        sublabel="Formal corporate look"
                        onClick={() => handleEdit('female_blouse')}
                        disabled={isProcessing}
                      />
                      <ActionButton 
                        icon={<Sparkles size={18} />}
                        label="Elegant Saree"
                        sublabel="Traditional classic Saree"
                        onClick={() => handleEdit('female_saree')}
                        disabled={isProcessing}
                        variant="accent"
                      />
                    </>
                  )}
                  
                  <div className="h-px bg-gray-100 my-2" />
                  
                  <ActionButton 
                    icon={<Sparkles size={18} />}
                    label="Upscale & Enhance"
                    sublabel="Sharpen details & fix resolution"
                    onClick={() => handleEdit('enhance')}
                    disabled={isProcessing}
                    variant="primary"
                  />
                </div>

                <AnimatePresence>
                  {finalImage && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-8 pt-8 border-t border-gray-100"
                    >
                      <div className="flex justify-between items-center mb-4">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-[#FF8006]">Generated Portrait</h2>
                        <div className="flex gap-2">
                          <a 
                            href={finalImage} 
                            download="visa-portrait.jpg"
                            className="flex items-center gap-2 text-[10px] font-bold px-3 py-2 rounded-full text-white shadow-lg transition-transform active:scale-95"
                            style={{ backgroundColor: PRIMARY_COLOR }}
                          >
                            Download
                          </a>
                          <button 
                            onClick={reset}
                            className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors shadow-sm"
                          >
                            <RotateCcw size={12} />
                            New Image
                          </button>
                        </div>
                      </div>
                      <div className="aspect-square bg-white rounded-2xl overflow-hidden shadow-2xl border-2 border-white ring-8 ring-[#FF8006]/5">
                        <img 
                          src={finalImage} 
                          alt="Final result" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            </div>
          </div>
        )}
      </main>

      <footer className="py-8 px-8 text-center text-gray-400 text-xs border-t border-gray-100 bg-white/50">
        <p>© 2026 AI Portrait Studio • Certified Visa Portrait Aligned</p>
      </footer>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  onClick: () => void;
  disabled: boolean;
  variant?: 'default' | 'primary' | 'accent';
}

function ActionButton({ icon, label, sublabel, onClick, disabled, variant = 'default' }: ActionButtonProps) {
  const getStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          bg: "bg-[#FF8006]/5 hover:bg-[#FF8006]/10",
          iconBg: "bg-[#FF8006] text-white",
          label: "text-[#FF8006]"
        };
      case 'accent':
        return {
          bg: "bg-[#0C8493]/5 hover:bg-[#0C8493]/10",
          iconBg: "bg-[#0C8493] text-white",
          label: "text-[#0C8493]"
        };
      default:
        return {
          bg: "bg-gray-50 hover:bg-gray-100",
          iconBg: "bg-gray-200 text-gray-600",
          label: "text-gray-800"
        };
    }
  };

  const styles = getStyles();

  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-4 p-4 rounded-2xl transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed group",
        styles.bg
      )}
    >
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", styles.iconBg)}>
        {icon}
      </div>
      <div className="flex-1">
        <p className={cn("text-sm font-bold", styles.label)}>{label}</p>
        <p className="text-[11px] text-gray-500 font-medium">{sublabel}</p>
      </div>
    </button>
  );
}
