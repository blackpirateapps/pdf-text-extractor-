import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, X, Copy, Check, Loader2, Sparkles, ArrowRight, Moon, Sun, Settings, Key, AlertCircle, ExternalLink, RefreshCw, Search, Layers, Merge, Download } from 'lucide-react';
import { PDFDocument } from 'pdf-lib'; 

// --- Configuration ---
// In Vercel/Vite, we access environment variables via import.meta.env
// FOR PRODUCTION: Uncomment the line below to use the environment variable
// const ENV_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

// FOR PREVIEW: We use an empty string so you can set the key in the UI settings
const ENV_API_KEY = "";

// 20MB is the hard limit for Gemini API inline files.
// We split PDFs to stay well under this limit.
const MAX_CHUNK_SIZE_MB = 19.5; 
const MAX_CHUNK_SIZE_BYTES = MAX_CHUNK_SIZE_MB * 1024 * 1024;

const DEFAULT_MODEL = "gemini-1.5-flash"; 
const DEFAULT_PROMPT = "Please transcribe the full text of this PDF document accurately. Maintain the logical flow of paragraphs. If there are tables, represent them with simple markdown formatting.";

const VALID_MODELS = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-1.5-flash-8b"];

// --- Helper: File to Base64 ---
const fileToGenerativePart = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// --- Component: Header ---
const Header = ({ isDarkMode, toggleTheme, onOpenSettings }) => (
  <div className="mb-8 pt-8 px-4 flex items-center justify-between">
    <div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
        <Sparkles className="w-6 h-6 text-blue-500" />
        PDF Extract <span className="text-xs font-normal text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">Pro</span>
      </h1>
      <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">
        Extract text from large documents using AI.
      </p>
    </div>
    <div className="flex items-center gap-3">
      <button 
        onClick={toggleTheme}
        className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        title="Toggle Theme"
      >
        {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>
      <button 
        onClick={onOpenSettings}
        className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        title="Settings"
      >
        <Settings className="w-5 h-5" />
      </button>
    </div>
  </div>
);

// --- Component: SettingsModal ---
const SettingsModal = ({ isOpen, onClose, apiKey, setApiKey, model, setModel, prompt, setPrompt }) => {
  const [checkingModels, setCheckingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState(null);
  const [checkError, setCheckError] = useState("");

  if (!isOpen) return null;
  const isUsingEnvKey = !!ENV_API_KEY;

  const checkAvailableModels = async () => {
    const keyToUse = ENV_API_KEY || apiKey;
    if (!keyToUse) {
      setCheckError("Please enter an API Key first.");
      return;
    }
    setCheckingModels(true);
    setAvailableModels(null);
    setCheckError("");

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${keyToUse}`);
      if (!response.ok) throw new Error("Failed to fetch models");
      const data = await response.json();
      const geminiModels = data.models
        .filter(m => m.name.includes("gemini") && m.supportedGenerationMethods.includes("generateContent"))
        .map(m => m.name.replace("models/", ""));
      setAvailableModels(geminiModels);
    } catch (err) {
      setCheckError(err.message || "Could not verify models.");
    } finally {
      setCheckingModels(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg m-4 p-6 border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Settings className="w-5 h-5" /> Settings
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Google Gemini API Key
            </label>
            <div className="relative">
              <input 
                type="password" 
                value={isUsingEnvKey ? "**********************" : apiKey}
                onChange={(e) => !isUsingEnvKey && setApiKey(e.target.value)}
                disabled={isUsingEnvKey}
                className={`w-full pl-10 pr-4 py-2 rounded-lg border ${isUsingEnvKey ? "bg-gray-100 dark:bg-gray-700/30 text-gray-500 cursor-not-allowed" : "bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white"} border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all`}
              />
              <Key className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>
          </div>
          
          <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
            <div className="flex justify-between items-baseline mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Model Selection</label>
              <button onClick={checkAvailableModels} disabled={checkingModels} className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1">
                {checkingModels ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />} Check
              </button>
            </div>
            <select 
              value={model} 
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white outline-none"
            >
              <option value="gemini-1.5-flash">Gemini 1.5 Flash (Stable)</option>
              <option value="gemini-1.5-pro">Gemini 1.5 Pro (Best Quality)</option>
              <option value="gemini-1.5-flash-8b">Gemini 1.5 Flash 8B (Fastest)</option>
              {!["gemini-1.5-flash", "gemini-1.5-pro", "gemini-1.5-flash-8b"].includes(model) && <option value={model}>{model} (Custom)</option>}
            </select>
            {availableModels && (
              <div className="mt-3 flex flex-wrap gap-2">
                {availableModels.map(m => (
                  <button key={m} onClick={() => setModel(m)} className="text-[10px] px-2 py-1 rounded-full border bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">System Prompt</label>
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>
        </div>
        <div className="mt-8 flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
};

// --- Component: CopyButton ---
const CopyButton = ({ text, label = "Copy" }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) { console.error(err); }
    document.body.removeChild(textArea);
  };
  return (
    <Button variant="secondary" onClick={handleCopy} className="!py-1.5 !px-3 !text-xs">
      {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : label}
    </Button>
  );
};

// --- Component: DownloadButton (New) ---
const DownloadButton = ({ text, filename = "extracted-text.txt" }) => {
  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([text], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };
  return (
    <Button variant="secondary" onClick={handleDownload} className="!py-1.5 !px-3 !text-xs">
      <Download className="w-3 h-3" /> Download .txt
    </Button>
  );
};

// --- Component: ResultChunk ---
const ResultChunk = ({ chunkIndex, text, totalChunks }) => (
  <div className="mb-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        Chunk {chunkIndex + 1} of {totalChunks}
      </span>
      <div className="flex gap-2">
         <CopyButton text={text} />
      </div>
    </div>
    <div className="p-4 max-h-64 overflow-y-auto">
      <pre className="font-mono text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{text}</pre>
    </div>
  </div>
);

// --- Main Application ---

export default function App() {
  // State
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, processing, success, error
  const [progressData, setProgressData] = useState({ current: 0, total: 0, text: '' });
  const [results, setResults] = useState([]); // Array of { index, text }
  const [errorMsg, setErrorMsg] = useState('');
  
  // Settings
  const [chunkSize, setChunkSize] = useState(20);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || "");
  
  // Safe model init
  const [modelName, setModelName] = useState(() => {
    const saved = localStorage.getItem('gemini_model');
    return (saved && VALID_MODELS.includes(saved)) ? saved : DEFAULT_MODEL;
  });
  const [customPrompt, setCustomPrompt] = useState(() => localStorage.getItem('gemini_prompt') || DEFAULT_PROMPT);

  // Persistence
  useEffect(() => {
    localStorage.setItem('gemini_api_key', apiKey);
    localStorage.setItem('gemini_model', modelName);
    localStorage.setItem('gemini_prompt', customPrompt);
  }, [apiKey, modelName, customPrompt]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);
  const reset = () => { setFile(null); setStatus('idle'); setResults([]); setErrorMsg(''); setProgressData({ current:0, total:0, text:'' }); };

  // --- CORE LOGIC: PDF SPLIT & PROCESS ---
  const processPDF = async () => {
    if (!file) return;
    const key = ENV_API_KEY || apiKey;
    if (!key) { setShowSettings(true); return; }

    setStatus('processing');
    setErrorMsg('');
    setResults([]);
    
    try {
      setProgressData({ current: 0, total: 0, text: 'Loading PDF...' });
      
      // 1. Load PDF
      const arrayBuffer = await file.arrayBuffer();
      const srcDoc = await PDFDocument.load(arrayBuffer);
      const totalPages = srcDoc.getPageCount();
      const totalChunks = Math.ceil(totalPages / chunkSize);
      
      setProgressData({ current: 0, total: totalChunks, text: `Splitting ${totalPages} pages...` });

      const chunks = [];
      
      // 2. Split PDF logic
      for (let i = 0; i < totalPages; i += chunkSize) {
        const subDoc = await PDFDocument.create();
        const pageIndices = Array.from({ length: Math.min(chunkSize, totalPages - i) }, (_, k) => i + k);
        const copiedPages = await subDoc.copyPages(srcDoc, pageIndices);
        copiedPages.forEach((page) => subDoc.addPage(page));
        
        // Convert chunk to base64
        const base64 = await subDoc.saveAsBase64();
        
        // 3. Size Check
        const sizeInBytes = base64.length * 0.75; // Approx decoding size
        if (sizeInBytes > MAX_CHUNK_SIZE_BYTES) {
          throw new Error(`Chunk ${chunks.length + 1} (Pages ${i+1}-${Math.min(i+chunkSize, totalPages)}) is too large (${(sizeInBytes/1024/1024).toFixed(2)}MB). Limit is ${MAX_CHUNK_SIZE_MB}MB. Please reduce "Pages per chunk" and try again.`);
        }
        
        chunks.push({ base64, index: chunks.length });
      }

      // 4. Sequential Processing
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        setProgressData({ current: i + 1, total: totalChunks, text: `Processing chunk ${i+1} of ${totalChunks}...` });
        
        const text = await extractFromChunk(chunk.base64, key);
        setResults(prev => [...prev, { index: i, text }]);
      }

      setStatus('success');

    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Extraction failed.");
      setStatus('error');
    }
  };

  const extractFromChunk = async (base64Data, key) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
    const payload = {
      contents: [{
        parts: [
          { text: customPrompt },
          { inlineData: { mimeType: "application/pdf", data: base64Data } }
        ]
      }]
    };

    let attempt = 0;
    while (attempt <= 3) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
           if (response.status === 429) throw new Error("RATE_LIMIT"); // Retry on rate limit
           if (response.status === 404) throw new Error("Model not found. Please check settings.");
           throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "[No Text Extracted]";
      } catch (e) {
        if (attempt === 3) throw e;
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1))); // Backoff
        attempt++;
      }
    }
  };

  const mergedResult = results.map(r => r.text).join("\n\n--- [Next Chunk] ---\n\n");

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${isDarkMode ? 'bg-[#1a1a1a] text-white' : 'bg-[#f8f9fa] text-gray-900'} flex flex-col`}>
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} apiKey={apiKey} setApiKey={setApiKey} model={modelName} setModel={setModelName} prompt={customPrompt} setPrompt={setCustomPrompt} />

      <div className="flex-grow max-w-3xl mx-auto w-full pt-6 md:pt-12 px-4 pb-12">
        <Header isDarkMode={isDarkMode} toggleTheme={toggleTheme} onOpenSettings={() => setShowSettings(true)} />
        
        <div className="space-y-6">
          <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden p-6 md:p-8`}>
            <FileDropZone selectedFile={file} onFileSelect={setFile} onClear={reset} />

            {/* Batch Settings */}
            {file && status === 'idle' && (
              <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700 animate-in fade-in">
                 <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-blue-500" />
                      Pages per Chunk
                    </label>
                    <input 
                      type="number" 
                      min="1" 
                      max="100" 
                      value={chunkSize} 
                      onChange={(e) => setChunkSize(parseInt(e.target.value) || 1)}
                      className="w-20 p-1.5 text-center rounded border border-gray-200 dark:border-gray-600 bg-transparent dark:text-white text-sm"
                    />
                 </div>
                 <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
                   Splitting the PDF ensures we don't exceed the AI's size limits. If you get a size error, reduce this number.
                 </p>

                 <div className="flex justify-end">
                    <Button onClick={processPDF} className="w-full md:w-auto">
                      Start Batch Extraction <ArrowRight className="w-4 h-4" />
                    </Button>
                 </div>
              </div>
            )}

            {/* Progress View */}
            {status === 'processing' && (
              <div className="py-8 px-4 text-center animate-in fade-in">
                 <div className="mb-4 relative h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden max-w-xs mx-auto">
                    <div 
                      className="absolute top-0 left-0 h-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${(progressData.current / (progressData.total || 1)) * 100}%` }}
                    />
                 </div>
                 <p className="text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center justify-center gap-2">
                   <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                   {progressData.text}
                 </p>
                 <p className="text-xs text-gray-400 mt-1">Do not close this tab.</p>
              </div>
            )}

            {/* Error View */}
            {status === 'error' && (
              <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 rounded-lg text-sm flex items-start gap-3 animate-in shake">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Extraction Error</p>
                  <p className="opacity-90">{errorMsg}</p>
                  <button onClick={processPDF} className="mt-2 text-xs underline hover:text-red-800">Retry</button>
                </div>
              </div>
            )}
          </div>

          {/* Results Section */}
          {(results.length > 0) && (
            <div className="animate-in slide-in-from-bottom-4 duration-500 space-y-6">
               {/* Merged Header */}
               <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Merge className="w-4 h-4" /> Combined Results
                  </h3>
                  <div className="flex gap-2">
                    <DownloadButton text={mergedResult} filename={`extracted-${file?.name.replace('.pdf', '')}.txt`} />
                    <CopyButton text={mergedResult} label="Copy All" />
                  </div>
               </div>

               {/* Individual Chunks */}
               <div className="space-y-4">
                 {results.map((r) => (
                   <ResultChunk key={r.index} chunkIndex={r.index} text={r.text} totalChunks={progressData.total} />
                 ))}
               </div>
            </div>
          )}

          <Footer />
        </div>
      </div>
    </div>
  );
}

// --- Sub-Components ---
const Button = ({ children, onClick, disabled, variant="primary", className="" }) => {
  const variants = {
    primary: "bg-blue-500 hover:bg-blue-600 text-white shadow-blue-500/20",
    secondary: "bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200",
    ghost: "bg-transparent hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`px-5 py-2.5 rounded-full font-medium transition-all flex items-center gap-2 justify-center disabled:opacity-50 active:scale-95 ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

const FileDropZone = ({ onFileSelect, selectedFile, onClear }) => {
  const inputRef = useRef(null);
  const handleDrop = (e) => { e.preventDefault(); if(e.dataTransfer.files[0]) onFileSelect(e.dataTransfer.files[0]); };
  return (
    <div onDragOver={e=>e.preventDefault()} onDrop={handleDrop} onClick={()=>!selectedFile && inputRef.current.click()} className={`relative group flex flex-col items-center justify-center h-48 rounded-xl border-2 border-dashed transition-all ${selectedFile ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-blue-400 cursor-pointer'}`}>
      <input type="file" ref={inputRef} onChange={e=>onFileSelect(e.target.files[0])} accept="application/pdf" className="hidden" />
      {selectedFile ? (
        <div className="flex items-center justify-between w-full px-6">
           <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-white dark:bg-gray-700 rounded-lg shadow-sm flex items-center justify-center text-red-500"><FileText className="w-6 h-6"/></div>
             <div className="text-left"><p className="font-semibold dark:text-white">{selectedFile.name}</p><p className="text-sm text-gray-500">{(selectedFile.size/1024/1024).toFixed(2)} MB</p></div>
           </div>
           <button onClick={(e)=>{e.stopPropagation(); onClear();}} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full"><X className="w-5 h-5"/></button>
        </div>
      ) : (
        <>
          <Upload className="w-8 h-8 text-gray-400 mb-3 group-hover:text-blue-500 transition-colors" />
          <p className="font-medium text-gray-600 dark:text-gray-300">Click or drop PDF here</p>
          <p className="text-xs text-gray-400 mt-1">Supports large files (500MB+)</p>
        </>
      )}
    </div>
  );
};

const Footer = () => (
  <div className="text-center py-8 space-y-2">
    <p className="text-xs text-gray-400 dark:text-gray-600">Powered by Google Gemini</p>
    <a href="https://blackpiratex.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-blue-500 transition-colors">Made by blackpiratex <ExternalLink className="w-3 h-3" /></a>
  </div>
);