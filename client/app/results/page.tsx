"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

interface WordScore {
  word: string;
  classification: "dictionary_word" | "proper_noun";
  expected: string;
  actual: string;
  score: number;
}

interface ResultsData {
  transcript: string;
  overall_score: number;
  words: WordScore[];
  ai_feedback?: string;
}

// Helpers to parse AI Feedback sections
function parseFeedback(feedback: string) {
  const sections: { [key: string]: string } = {};
  const headings = [
    "Error Analysis Summary",
    "Practice Plan",
    "Top 5 Sounds To Practice",
    "Final Encouragement"
  ];
  
  headings.forEach((heading) => {
    const headingRegex = new RegExp(
      `(?:^|\\n)#\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n#\\s+(?:${headings.join("|")})|$)`,
      "i"
    );
    const match = feedback.match(headingRegex);
    if (match) {
      sections[heading] = match[1].trim();
    }
  });

  return sections;
}

interface SoundItem {
  rank: number;
  sound: string;
  description: string;
}

function parseSoundsList(soundsText?: string): SoundItem[] {
  if (!soundsText) return [];
  const lines = soundsText.split("\n");
  const sounds: SoundItem[] = [];
  
  lines.forEach((line) => {
    // Match format: 1. **Sound [Symbol]** - Description
    const match = line.match(/^\d+\.\s+\*\*(.+?)\*\*\s*-\s*(.*)$/);
    if (match) {
      sounds.push({
        rank: sounds.length + 1,
        sound: match[1].trim(),
        description: match[2].trim()
      });
    } else {
      // Fallback match for: 1. Sound [Symbol] - Description or similar
      const fallbackMatch = line.match(/^\d+\.\s+(.+?)(?:\s*-\s*|\s*:\s*)(.*)$/);
      if (fallbackMatch) {
        sounds.push({
          rank: sounds.length + 1,
          sound: fallbackMatch[1].replace(/\*\*/g, "").trim(),
          description: fallbackMatch[2].trim()
        });
      }
    }
  });
  return sounds;
}

// Circular Score Ring Component
function ScoreRing({ score }: { score: number }) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  let strokeColor = "#51BC8F";
  if (score < 50) strokeColor = "#E5534B";
  else if (score < 80) strokeColor = "#D4A72C";

  return (
    <div className="relative w-48 h-48 flex items-center justify-center">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
        {/* Track */}
        <circle
          cx="80" cy="80" r={radius}
          fill="none"
          stroke="#E3E5EA"
          strokeWidth="8"
        />
        {/* Fill */}
        <motion.circle
          cx="80" cy="80" r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-extrabold text-[#111827] tracking-tight flex items-baseline gap-1">
          {score} <span className="text-2xl font-bold text-[#676C73]">%</span>
        </span>
      </div>
    </div>
  );
}

// Practice Plan Step Component
function PracticeStep({ step, index, total }: { step: string; index: number; total: number }) {
  return (
    <div className="flex gap-5">
      {/* Timeline */}
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-[#fcfcfd] border border-[#e3e5ea] flex items-center justify-center text-[#51bc8f] text-[13px] font-bold shrink-0 shadow-sm">
          {index + 1}
        </div>
        {index < total - 1 && (
          <div className="w-[2px] flex-1 bg-[#e3e5ea] my-1" />
        )}
      </div>
      {/* Content */}
      <div className="pb-6 pt-0.5">
        <p className="text-[15px] sm:text-base text-[#111827] leading-relaxed font-medium">{step}</p>
      </div>
    </div>
  );
}

export default function ResultsPage() {
  const router = useRouter();
  const [results, setResults] = useState<ResultsData | null>(null);
  const [selectedWord, setSelectedWord] = useState<WordScore | null>(null);
  const [showAllWords, setShowAllWords] = useState(false);
  const detailPanelRef = useRef<HTMLDivElement>(null);

  const VISIBLE_WORD_COUNT = 15;

  const handleWordClick = (w: WordScore) => {
    setSelectedWord(w);
    // Wait for the panel to render, then check if it's in view before scrolling
    setTimeout(() => {
      const panel = detailPanelRef.current;
      if (panel) {
        const rect = panel.getBoundingClientRect();
        const isInViewport = (
          rect.top >= 0 &&
          rect.bottom <= (window.innerHeight || document.documentElement.clientHeight)
        );
        if (!isInViewport) {
          panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }
    }, 50);
  };

  useEffect(() => {
    const storedResults = sessionStorage.getItem("pronunciation_results");
    if (!storedResults) {
      router.push("/");
      return;
    }
    try {
      setResults(JSON.parse(storedResults));
    } catch (e) {
      console.error("Error parsing stored results", e);
      router.push("/");
    }
  }, [router]);

  if (!results) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[#838589] text-[14px]">Loading results...</p>
      </div>
    );
  }

  const { overall_score, transcript, words, ai_feedback } = results;

  // Parse feedback if available
  const parsedFeedback = ai_feedback ? parseFeedback(ai_feedback) : {};
  const parsedSounds = parseSoundsList(parsedFeedback["Top 5 Sounds To Practice"]);

  // Parse practice plan into steps
  const practiceSteps: string[] = [];
  if (parsedFeedback["Practice Plan"]) {
    const raw = parsedFeedback["Practice Plan"];
    const stepLines = raw.split("\n").filter((l) => l.trim());
    stepLines.forEach((line) => {
      const cleaned = line.replace(/^\d+\.\s*/, "").replace(/^[-*]\s*/, "").replace(/\*/g, "").trim();
      if (cleaned) practiceSteps.push(cleaned);
    });
  }

  const handleNewAnalysis = () => {
    sessionStorage.clear();
    router.push("/");
  };

  return (
    <div className="min-h-screen px-6 py-12" style={{ fontFamily: "var(--font-sans)" }}>
      <motion.div
        className="w-full max-w-3xl mx-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#111827] tracking-tight">Pronunciation Results</h1>
            <p className="text-base text-[#676C73] mt-2">Your detailed pronunciation assessment</p>
          </div>
          <button
            onClick={handleNewAnalysis}
            className="flex items-center gap-2 text-[13px] text-[#676C73] hover:text-[#3B3F45] transition-colors bg-white hover:bg-[#F4F5F7] px-4 py-2 rounded-lg border border-[#E3E5EA] cursor-pointer font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            New Analysis
          </button>
        </div>

        {/* Overall Score */}
        <div className="bg-white rounded-2xl border border-[#E3E5EA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-10 flex flex-col items-center text-center mb-6">
          <ScoreRing score={overall_score} />
          <h2 className="text-xl font-bold text-[#111827] mt-6 mb-2">Overall Pronunciation Score</h2>
          <p className="text-[15px] text-[#676C73] max-w-sm leading-relaxed">
            Average pronunciation score across all evaluated words.
          </p>
        </div>

        {/* Transcript */}
        <div className="bg-white rounded-2xl border border-[#E3E5EA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-7 mb-8">
          <h3 className="text-xs font-bold text-[#838589] uppercase tracking-[0.1em] mb-4">Transcript</h3>
          <p className="text-lg text-[#111827] leading-[1.8] font-medium">{transcript}</p>
        </div>

        {/* AI Speech Coach Insights Dashboard */}
        {ai_feedback && (
          <div className="space-y-6 mb-6">
            
            {/* Error Analysis Summary */}
            {parsedFeedback["Error Analysis Summary"] && (
              <div className="bg-white rounded-2xl border border-[#e3e5ea] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-7 border-l-[3px] border-l-[#51bc8f]">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-[#fcfcfd] border border-[#e3e5ea] text-[#51bc8f] flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-[#111827]">AI Speech Coach Insights</h3>
                </div>
                
                <div className="text-[15px] sm:text-base text-[#3B3F45] leading-[1.8]">
                  <ReactMarkdown
                    components={{
                      p: ({ node, ...props }) => <p className="mb-4 text-[#676c73]" {...props} />,
                      ul: ({ node, ...props }) => <ul className="list-disc pl-6 space-y-2 mb-4 text-[#676c73]" {...props} />,
                      ol: ({ node, ...props }) => <ol className="list-decimal pl-6 space-y-2 mb-4 text-[#676c73]" {...props} />,
                      li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                      strong: ({ node, ...props }) => <strong className="text-[#111827] font-bold bg-[#fcfcfd] border border-[#e3e5ea] px-1.5 py-0.5 rounded" {...props} />,
                    }}
                  >
                    {parsedFeedback["Error Analysis Summary"]}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* Top 5 Sounds To Practice */}
            {parsedSounds.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#e3e5ea] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-7">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-[#fcfcfd] border border-[#e3e5ea] text-[#51bc8f] flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-[#111827]">Top Sounds to Practice</h3>
                </div>
                
                <div className="space-y-4">
                  {parsedSounds.map((item) => (
                    <div
                      key={item.rank}
                      className="flex items-start gap-4 p-5 bg-[#fcfcfd] rounded-xl transition-colors duration-150 hover:bg-[#e3e5ea]"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white border border-[#e3e5ea] shadow-sm flex items-center justify-center text-[#51bc8f] text-[14px] font-bold shrink-0">
                        {item.rank}
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <h4 className="text-base font-bold text-[#111827] mb-1">{item.sound}</h4>
                        <p className="text-[14px] text-[#676C73] leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Practice Plan */}
            {practiceSteps.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#e3e5ea] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-7">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-[#fcfcfd] border border-[#e3e5ea] text-[#51bc8f] flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-[#111827]">Recommended Practice Routine</h3>
                </div>
                
                <div>
                  {practiceSteps.map((step, i) => (
                    <PracticeStep key={i} step={step} index={i} total={practiceSteps.length} />
                  ))}
                </div>
              </div>
            )}

            {/* Encouragement */}
            {parsedFeedback["Final Encouragement"] && (
              <div className="bg-[#fcfcfd] rounded-2xl border border-[#e3e5ea] p-8">
                <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-xl bg-white border border-[#e3e5ea] text-[#51bc8f] flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <p className="text-base sm:text-lg text-[#111827] leading-[1.8] font-medium pt-1">
                    {parsedFeedback["Final Encouragement"].replace(/^"|"$/g, "")}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Phoneme Alignment Details */}
        {words && words.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#E3E5EA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-7 mb-6">
            <h3 className="text-lg font-bold text-[#111827] mb-2">Phoneme Alignment Details</h3>
            <p className="text-base text-[#676C73] mb-6">Click on any word to inspect its expected vs. actual pronunciation.</p>
            
            {/* Word Chips */}
            <div className="flex flex-wrap gap-2 leading-relaxed">
              {(showAllWords ? words : words.slice(0, VISIBLE_WORD_COUNT)).map((w, index) => {
                const isSelected = selectedWord === w;
                
                // Low score styling
                let chipStyle = "bg-[#F4F5F7] border-[#E3E5EA] text-[#676C73] hover:border-[#51BC8F] hover:text-[#51BC8F]";
                if (w.score < 50) {
                  chipStyle = "bg-[#E5534B]/5 border-[#E5534B]/20 text-[#E5534B]/80 hover:border-[#E5534B]/40 hover:text-[#E5534B]";
                } else if (w.score < 80) {
                  chipStyle = "bg-[#D4A72C]/5 border-[#D4A72C]/20 text-[#D4A72C]/80 hover:border-[#D4A72C]/40 hover:text-[#D4A72C]";
                }

                if (isSelected) {
                  chipStyle = "bg-[#51BC8F] border-[#51BC8F] text-white shadow-[0_1px_3px_rgba(81,188,143,0.3)]";
                }

                return (
                  <button
                    key={index}
                    onClick={() => handleWordClick(w)}
                    className={`px-4 py-2 rounded-full border text-[14px] font-medium transition-all duration-150 cursor-pointer ${chipStyle}`}
                  >
                    {w.word}
                  </button>
                );
              })}
            </div>

            {words.length > VISIBLE_WORD_COUNT && (
              <button
                onClick={() => setShowAllWords((prev) => !prev)}
                className="mt-3 text-[13px] font-medium text-[#51BC8F] hover:text-[#46a77e] transition-colors cursor-pointer flex items-center gap-1"
              >
                {showAllWords ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                    Show less
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    Show all {words.length} words
                  </>
                )}
              </button>
            )}

            {/* Word Details Panel */}
            <AnimatePresence>
              {selectedWord && (
                <motion.div
                  ref={detailPanelRef}
                  key="detail-panel"
                  className="mt-5 p-6 bg-[#F4F5F7] border border-[#E3E5EA] rounded-xl"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                      <h4 className="text-2xl font-extrabold text-[#111827]">
                        {selectedWord.word}
                      </h4>
                      <span className={`text-xs px-3 py-1 rounded-full font-bold ${
                        selectedWord.classification === 'proper_noun' 
                          ? 'bg-[#F4F5F7] text-[#838589] border border-[#E3E5EA]' 
                          : 'bg-[#51BC8F]/10 text-[#51BC8F] border border-[#51BC8F]/20'
                      }`}>
                        {selectedWord.classification === 'proper_noun' ? 'Proper Noun' : 'Dictionary Word'}
                      </span>
                    </div>
                    <div className={`text-[28px] font-extrabold ${
                      selectedWord.score >= 80 ? 'text-[#51BC8F]' : selectedWord.score >= 50 ? 'text-[#D4A72C]' : 'text-[#E5534B]'
                    }`}>
                      {selectedWord.score}%
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl border border-[#E3E5EA] p-5 shadow-sm">
                      <span className="text-xs font-bold text-[#838589] uppercase tracking-[0.1em] block mb-2">Expected</span>
                      <p className="text-base text-[#111827] tracking-wide" style={{ fontFamily: "var(--font-mono)" }}>
                        {selectedWord.expected || "—"}
                      </p>
                    </div>
                    <div className="bg-white rounded-xl border border-[#E3E5EA] p-5 shadow-sm">
                      <span className="text-xs font-bold text-[#838589] uppercase tracking-[0.1em] block mb-2">Actual</span>
                      <p className="text-base text-[#111827] tracking-wide" style={{ fontFamily: "var(--font-mono)" }}>
                        {selectedWord.actual || "—"}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

      </motion.div>
    </div>
  );
}
