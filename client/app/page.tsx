"use client";

import { useState, useRef, useEffect, DragEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export default function AudioUpload() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [durationWarning, setDurationWarning] = useState<string | null>(null);
  const [showDpdpModal, setShowDpdpModal] = useState(false);
  const [dpdpConsent, setDpdpConsent] = useState(false);
  const [dpdpDontAskAgain, setDpdpDontAskAgain] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MIN_DURATION = 30;
  const MAX_DURATION = 45;

  // Validate audio duration using an HTML Audio element
  const validateAndSetFile = (audioFile: File) => {
    setDurationWarning(null);
    setError(null);
    const url = URL.createObjectURL(audioFile);
    const audio = new Audio(url);
    audio.addEventListener("loadedmetadata", () => {
      const dur = Math.round(audio.duration);
      setDuration(dur);
      URL.revokeObjectURL(url);

      if (dur < MIN_DURATION) {
        setDurationWarning(
          `Your recording is ${dur} seconds — that's a bit short. Please upload a clip between 30 and 45 seconds for the best results.`
        );
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else if (dur > MAX_DURATION) {
        setDurationWarning(
          `Your recording is ${dur} seconds — that's a little long. For the most accurate analysis, please trim it to 30–45 seconds.`
        );
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        setFile(audioFile);
      }
    });
    audio.addEventListener("error", () => {
      URL.revokeObjectURL(url);
      setDurationWarning("Could not read the audio duration. Please try a different file.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  };

  // Load previous error if returning from a failed upload
  useEffect(() => {
    const storedError = sessionStorage.getItem("upload_error");
    if (storedError) {
      setError(storedError);
      sessionStorage.removeItem("upload_error");
    }
  }, []);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type.startsWith("audio/")) {
        validateAndSetFile(droppedFile);
      } else {
        alert("Please upload an audio file.");
      }
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleRemove = () => {
    setFile(null);
    setDuration(null);
    setDurationWarning(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const isDurationValid = duration !== null && duration >= MIN_DURATION && duration <= MAX_DURATION;

  const handleUploadWrapper = () => {
    if (!file || !isDurationValid) return;
    
    const dontAskAgain = localStorage.getItem("dpdp_dont_ask_again");
    if (dontAskAgain === "true") {
      executeUpload();
    } else {
      setShowDpdpModal(true);
    }
  };

  const executeUpload = async () => {
    if (!file || !isDurationValid) return;
    
    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await fetch("http://localhost:8000/detect-language", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Language detection failed.");
      }

      const data = await res.json();
      
      if (data.language !== "en" || data.probability < 0.5) {
        const probDisplay = Math.round(data.probability * 100);
        let languageName = data.language;
        try {
          languageName = new Intl.DisplayNames(['en'], { type: 'language' }).of(data.language) || data.language;
        } catch (e) {
          // Fallback if language code is invalid
        }
        setError(`This tool requires English speech. Detected language: ${languageName}. Please upload an English recording.`);
        setIsProcessing(false);
        return;
      }

      // If valid English, proceed to read and store
      const reader = new FileReader();
      reader.onload = () => {
        try {
          sessionStorage.clear(); // Clear old values
          sessionStorage.setItem("audio_data", reader.result as string);
          sessionStorage.setItem("audio_name", file.name);
          
          // Navigate to the loader page which will process the file
          router.push("/loading");
        } catch (e) {
          console.error("Storage error:", e);
          setError("Audio file is too large to process. Please use a smaller clip (30-45 seconds).");
          setIsProcessing(false);
        }
      };
      reader.onerror = () => {
        setError("Failed to read the audio file.");
        setIsProcessing(false);
      };
      reader.readAsDataURL(file);

    } catch (err: any) {
      console.error("Detection error:", err);
      setError(err.message || "An error occurred checking the language.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16" style={{ fontFamily: "var(--font-sans)" }}>
      <motion.div
        className="w-full max-w-2xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-[48px] font-bold tracking-tight text-[#3B3F45] leading-tight">
            AI Pronunciation Assessment
          </h1>
          <p className="text-[#838589] text-[16px] mt-3 leading-relaxed max-w-md mx-auto">
            Improve your spoken English with AI-powered pronunciation analysis.
          </p>
        </div>

        {/* Upload Card */}
        <div className="bg-white rounded-2xl border border-[#E3E5EA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-8">
          {!file ? (
            <div
              className={`w-full border-2 border-dashed rounded-xl p-14 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
                isDragging 
                  ? "border-[#51BC8F] bg-[#51BC8F]/5" 
                  : "border-[#AEB2B9] bg-[#FCFCFD] hover:border-[#51BC8F] hover:bg-[#51BC8F]/[0.03]"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-5 transition-colors duration-200 ${
                isDragging ? "bg-[#51BC8F]/15 text-[#51BC8F]" : "bg-[#F4F5F7] text-[#838589]"
              }`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              
              <p className="text-[15px] font-medium text-[#3B3F45] mb-1">
                Click to upload or drag audio file here
              </p>
              <p className="text-[13px] text-[#AEB2B9]">
                Supports MP3, WAV, M4A — 30 to 45 seconds recommended
              </p>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="audio/*" 
                className="hidden" 
              />
            </div>
          ) : (
            <div className="w-full bg-[#F4F5F7] border border-[#E3E5EA] rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 rounded-lg bg-[#51BC8F]/10 flex items-center justify-center text-[#51BC8F] shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <span className="text-[14px] text-[#3B3F45] font-medium truncate">
                  {file.name}
                </span>
                {duration !== null && (
                  <span className="text-[12px] text-[#AEB2B9] shrink-0">
                    {duration}s
                  </span>
                )}
              </div>
              <button 
                disabled={isProcessing}
                onClick={handleRemove}
                className="p-2 text-[#AEB2B9] hover:text-[#E5534B] hover:bg-[#E5534B]/10 rounded-lg transition-colors shrink-0 cursor-pointer"
                aria-label="Remove file"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <button 
            disabled={!file || isProcessing || !isDurationValid}
            onClick={handleUploadWrapper}
            className="w-full mt-6 flex justify-center items-center bg-[#51BC8F] hover:bg-[#46a77e] disabled:bg-[#E3E5EA] text-white disabled:text-[#AEB2B9] font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)] disabled:shadow-none disabled:cursor-not-allowed cursor-pointer text-[15px]"
          >
            {isProcessing ? "Reading file..." : "Analyze Pronunciation"}
          </button>

          {durationWarning && (
            <div className="w-full mt-4 p-4 bg-[#D4A72C]/[0.07] border border-[#D4A72C]/20 rounded-xl flex items-start gap-3">
              <svg className="w-5 h-5 text-[#D4A72C] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              <p className="text-[13px] text-[#8B6914] leading-relaxed">{durationWarning}</p>
            </div>
          )}

          {error && (
            <div className="w-full mt-5 p-4 bg-[#E5534B]/5 border border-[#E5534B]/15 rounded-xl text-[#E5534B] text-[13px]">
              {error}
            </div>
          )}
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
          {[
            {
              title: "AI Pronunciation Score",
              description: "Get an overall accuracy score for your spoken English.",
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              ),
            },
            {
              title: "Word-Level Analysis",
              description: "Compare expected vs. actual phonemes for every word.",
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
              ),
            },
            {
              title: "Personalized AI Feedback",
              description: "Receive tailored coaching tips powered by AI.",
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
              ),
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="bg-white rounded-2xl border border-[#E3E5EA] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
            >
              <div className="w-10 h-10 rounded-xl bg-[#51BC8F]/10 text-[#51BC8F] flex items-center justify-center mb-4">
                {feature.icon}
              </div>
              <h3 className="text-[15px] font-semibold text-[#3B3F45] mb-1">{feature.title}</h3>
              <p className="text-[13px] text-[#838589] leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* DPDP Compliance Modal */}
      <AnimatePresence>
        {showDpdpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-7 max-w-md w-full shadow-2xl border border-[#E3E5EA]"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#FCFCFD] border border-[#E3E5EA] text-[#51BC8F] flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                </div>
                <h3 className="text-[20px] font-bold text-[#111827]">DPDP Compliance Notice</h3>
              </div>
              
              <p className="text-[14px] text-[#676C73] leading-relaxed mb-6">
                To provide you with pronunciation analysis, we need to process your audio recording. 
                Your audio will <strong className="text-[#3B3F45]">only be used for this specific purpose</strong> and will not be stored permanently or shared with third parties.
              </p>
              
              <div className="flex items-start gap-3 mb-4">
                <input 
                  type="checkbox" 
                  id="dpdp-consent"
                  checked={dpdpConsent}
                  onChange={(e) => setDpdpConsent(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-[#AEB2B9] text-[#51BC8F] focus:ring-[#51BC8F] cursor-pointer"
                />
                <label htmlFor="dpdp-consent" className="text-[14px] text-[#3B3F45] cursor-pointer leading-tight pt-0.5">
                  I agree to the processing of my audio data for pronunciation analysis.
                </label>
              </div>
              
              <div className="flex items-center gap-3 mb-8">
                <input 
                  type="checkbox" 
                  id="dpdp-dont-ask"
                  checked={dpdpDontAskAgain}
                  onChange={(e) => setDpdpDontAskAgain(e.target.checked)}
                  className="w-4 h-4 rounded border-[#AEB2B9] text-[#51BC8F] focus:ring-[#51BC8F] cursor-pointer"
                />
                <label htmlFor="dpdp-dont-ask" className="text-[13px] text-[#838589] cursor-pointer">
                  Don't ask me again
                </label>
              </div>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowDpdpModal(false)}
                  className="flex-1 py-2.5 rounded-lg border border-[#E3E5EA] text-[#676C73] font-medium hover:bg-[#F4F5F7] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  disabled={!dpdpConsent}
                  onClick={() => {
                    if (dpdpDontAskAgain) {
                      localStorage.setItem("dpdp_dont_ask_again", "true");
                    }
                    setShowDpdpModal(false);
                    executeUpload();
                  }}
                  className="flex-1 py-2.5 rounded-lg bg-[#51BC8F] text-white font-medium hover:bg-[#46a77e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Continue
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
