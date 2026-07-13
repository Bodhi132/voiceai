"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import LoadingScreen from "../../components/LoadingScreen";

export default function LoadingPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<"detecting" | "transcribing">("detecting");

  useEffect(() => {
    const processAudio = async () => {
      const audioData = sessionStorage.getItem("audio_data");
      const audioName = sessionStorage.getItem("audio_name");

      if (!audioData || !audioName) {
        router.push("/");
        return;
      }

      try {
        // Convert base64 back to blob and File
        const res = await fetch(audioData);
        const blob = await res.blob();
        const file = new File([blob], audioName, { type: blob.type });

        const formData = new FormData();
        formData.append("file", file);

        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        
        // Step 1: Detect Language
        setStep("detecting");
        const detectRes = await fetch(`${API_URL}/detect-language`, {
          method: "POST",
          body: formData,
        });

        if (!detectRes.ok) {
          throw new Error("Language detection failed.");
        }

        const detectData = await detectRes.json();
        
        if (detectData.language !== "en" || detectData.probability < 0.5) {
          const probDisplay = Math.round(detectData.probability * 100);
          let languageName = detectData.language;
          try {
            languageName = new Intl.DisplayNames(['en'], { type: 'language' }).of(detectData.language) || detectData.language;
          } catch (e) {
            // Fallback if language code is invalid
          }
          throw new Error(`This tool requires English speech. Detected language: ${languageName}. Please upload an English recording.`);
        }

        // Step 2: Transcribe
        setStep("transcribing");
        const response = await fetch(`${API_URL}/transcribe`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Upload failed with status ${response.status}`);
        }

        const data = await response.json();
        
        // Save results to sessionStorage
        sessionStorage.setItem("pronunciation_results", JSON.stringify(data));
        // Redirect to results page
        router.push("/results");
      } catch (err: any) {
        console.error("Processing error:", err);
        setError(err.message || "An error occurred during transcription.");
        sessionStorage.setItem("upload_error", err.message || "An error occurred during transcription.");
        
        // Redirect back immediately if detection fails
        router.push("/");
      }
    };

    processAudio();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16" style={{ fontFamily: "var(--font-sans)" }}>
      <motion.div
        className="w-full max-w-lg"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="bg-white rounded-2xl border border-[#E3E5EA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-8 flex flex-col items-center">
          <LoadingScreen step={step} />
          
          {error && (
            <div className="w-full mt-6 p-4 bg-[#E5534B]/5 border border-[#E5534B]/15 rounded-xl text-[#E5534B] text-[13px]">
              {error}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
