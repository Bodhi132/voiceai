"use client";

import { useState, useEffect } from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { motion, AnimatePresence } from "framer-motion";

const loadingMessages = [
  "Uploading audio file...",
  "Transcribing speech using Whisper...",
  "Aligning words with timestamps...",
  "Detecting dictionary words & proper nouns...",
  "Extracting actual phonemes via Wav2Vec2...",
  "Running Levenshtein phonetic distance...",
  "Compiling pronunciation score breakdown...",
];

export default function LoadingScreen({ step = "transcribing" }: { step?: "detecting" | "transcribing" }) {
  const [loadingIndex, setLoadingIndex] = useState(0);

  // Rotating loading messages
  useEffect(() => {
    const interval = setInterval(() => {
      setLoadingIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full py-16 flex flex-col items-center text-center">
      <div className="w-40 h-40 flex items-center justify-center mb-8">
        <DotLottieReact
          src="/Smooth Triple Dot Loading.lottie"
          loop
          autoplay
          style={{ width: "100%", height: "100%" }}
        />
      </div>
      
      <h2 className="text-[28px] font-semibold text-[#3B3F45] mb-3 tracking-tight">
        Analyzing Speech
      </h2>
      
      <AnimatePresence mode="wait">
        <motion.p
          key={step === "detecting" ? "detecting" : loadingIndex}
          className="text-[14px] text-[#838589] font-medium tracking-wide h-6"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
        >
          {step === "detecting" ? "Detecting spoken language..." : loadingMessages[loadingIndex]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
