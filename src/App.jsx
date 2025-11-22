import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, X, Copy, Check, Loader2, Sparkles, ArrowRight, Moon, Sun, Settings, Key, AlertCircle, ExternalLink, RefreshCw, Search, CheckCircle2 } from 'lucide-react';

// --- Configuration ---
// In Vercel/Vite, we access environment variables via import.meta.env
// FOR PRODUCTION: Uncomment the line below to use the environment variable
// const ENV_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

// FOR PREVIEW: We use an empty string so you can set the key in the UI settings
const ENV_API_KEY = "";

// 20MB is the rough limit for inline base64 payloads in the Gemini API
const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const DEFAULT_MODEL = "gemini-1.5-flash"; 
const DEFAULT_PROMPT = "Please transcribe the full text of this PDF document accurately. Maintain the logical flow of paragraphs. If there are tables, represent them with simple markdown formatting.";

// Valid models allowlist to prevent 404s from stale localStorage data
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
        PDF Extract
      </h1>
      <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">
        Extract text from your documents using AI.
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
      if (!response.ok) {
        if (response.status === 400) throw new Error("Invalid API Key");
        throw new Error("Failed to fetch models");
      }
      
      const data = await response.json();
      // Filter to just Gemini models that support content generation
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
          {/* API Key Section */}
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
                placeholder={isUsingEnvKey ? "Provided by Environment" : "Enter your API Key..."}
                className={`w-full pl-10 pr-4 py-2 rounded-lg border ${isUsingEnvKey ? "bg-gray-100 dark:bg-gray-700/30 text-gray-500 cursor-not-allowed" : "bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white"} border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all`}
              />
              <Key className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {isUsingEnvKey ? (
                <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Key configured via Environment Variables
                </span>
              ) : (
                <>
                  Your key is stored locally in your browser. 
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline ml-1">
                    Get a key here.
                  </a>
                </>
              )}
            </p>
          </div>
          
          <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
            <div className="flex justify-between items-baseline mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Model Selection
              </label>
              <button 
                onClick={checkAvailableModels}
                disabled={checkingModels || (!apiKey && !isUsingEnvKey)}
                className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checkingModels ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                Check Availability
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
              {/* Add an option for custom inputs if the check reveals other models */}
              {!["gemini-1.5-flash", "gemini-1.5-pro", "gemini-1.5-flash-8b"].includes(model) && (
                <option value={model}>{model} (Custom/Saved)</option>
              )}
            </select>
            
            {/* Availability Results */}
            {checkError && (
              <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {checkError}
              </p>
            )}
            {availableModels && (
              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-100 dark:border-gray-600">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Models available to your API Key:</p>
                <div className="flex flex-wrap gap-2">
                  {availableModels.map(m => (
                    <button
                      key={m}
                      onClick={() => setModel(m)}
                      className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                        model === m 
                          ? 'bg-blue-100 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300' 
                          : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {m} {model === m && "✓"}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
              <span>System Prompt</span>
              <button 
                onClick={() => setPrompt(DEFAULT_PROMPT)}
                className="text-xs text-blue-500 hover:underline font-normal"
              >
                Reset to Default
              </button>
            </label>
            <div className="relative">
              <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Customize how the AI reads the document. E.g., "Extract as a JSON list" or "Summarize in 3 bullet points".
            </p>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
};

// --- Component: Footer ---
const Footer = () => (
  <div className="text-center py-8 space-y-2">
    <p className="text-xs text-gray-400 dark:text-gray-600">
      Powered by Google Gemini • Supports PDF up to {MAX_FILE_SIZE_MB}MB
    </p>
    <a 
      href="https://blackpiratex.com" 
      target="_blank" 
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 transition-colors"
    >
      Made by blackpiratex
      <ExternalLink className="w-3 h-3" />
    </a>
  </div>
);

const Card = ({ children, className = "" }) => (
  <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] dark:shadow-none border border-gray-100 dark:border-gray-700 overflow-hidden ${className}`}>
    {children}
  </div>
);

const Button = ({ children, onClick, disabled, variant = "primary", className = "" }) => {
  const baseStyle = "px-5 py-2.5 rounded-full font-medium transition-all duration-200 flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed active:scale-95";
  
  const variants = {
    primary: "bg-blue-500 hover:bg-blue-600 text-white shadow-md hover:shadow-lg shadow-blue-500/20 disabled:shadow-none",
    secondary: "bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200",
    ghost: "bg-transparent hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200",
    danger: "bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:text-red-400"
  };

  return (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      className={`${baseStyle} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

// --- Component: FileDropZone ---
const FileDropZone = ({ onFileSelect, selectedFile, onClear }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const validateAndSetFile = (file) => {
    if (file.type !== "application/pdf") {
      alert("Please upload a PDF file.");
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      alert(`File is too large. Max size is ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }
    onFileSelect(file);
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  if (selectedFile) {
    return (
      <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 flex items-center justify-between animate-in fade-in duration-300">
        <div className="flex items-center gap-4 overflow-hidden">
          <div className="w-12 h-12 bg-white dark:bg-gray-700 rounded-lg shadow-sm flex items-center justify-center border border-gray-100 dark:border-gray-600 flex-shrink-0">
            <FileText className="w-6 h-6 text-red-500" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{selectedFile.name}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
        </div>
        <Button variant="ghost" onClick={onClear} className="!p-2 rounded-full">
          <X className="w-5 h-5" />
        </Button>
      </div>
    );
  }

  return (
    <div
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`
        relative group cursor-pointer
        flex flex-col items-center justify-center
        h-48 rounded-xl border-2 border-dashed transition-all duration-300
        ${isDragging 
          ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20" 
          : "border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-500"
        }
      `}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleChange}
        accept="application/pdf"
        className="hidden"
      />
      <div className="bg-white dark:bg-gray-700 p-3 rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform duration-300">
        <Upload className={`w-6 h-6 ${isDragging ? 'text-blue-500' : 'text-gray-400 dark:text-gray-300'}`} />
      </div>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Click or drop PDF here</p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Up to {MAX_FILE_SIZE_MB}MB</p>
    </div>
  );
};

// --- Component: ProcessingStatus ---
const ProcessingStatus = ({ statusText, progress }) => {
  return (
    <div className="py-8 px-4 flex flex-col items-center justify-center animate-in fade-in duration-500">
      <div className="w-full max-w-xs mb-4">
        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all duration-300 ease-out rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        <span className="text-sm font-medium font-mono">{statusText}</span>
      </div>
    </div>
  );
};

// --- Component: ResultView ---
const ResultView = ({ text }) => {
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
    } catch (err) {
      console.error('Fallback: Oops, unable to copy', err);
    }
    document.body.removeChild(textArea);
  };

  return (
    <div className="animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Extracted Content</h3>
        <Button variant="secondary" onClick={handleCopy} className="!py-1.5 !px-3 !text-sm">
          {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-inner min-h-[200px] max-h-[500px] overflow-y-auto relative group">
        <pre className="p-6 font-mono text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
          {text}
        </pre>
      </div>
    </div>
  );
};

// --- Main Application ---

export default function App() {
  // State
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle');
  const [progressData, setProgressData] = useState({ percent: 0, text: '' });
  const [result, setResult] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Config State
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || "");
  
  // SAFE MODEL INITIALIZATION:
  const [modelName, setModelName] = useState(() => {
    const saved = localStorage.getItem('gemini_model');
    if (saved && VALID_MODELS.includes(saved)) {
      return saved;
    }
    return DEFAULT_MODEL;
  });
  
  const [customPrompt, setCustomPrompt] = useState(() => localStorage.getItem('gemini_prompt') || DEFAULT_PROMPT);

  // Effect: Persist Config
  useEffect(() => {
    localStorage.setItem('gemini_api_key', apiKey);
    localStorage.setItem('gemini_model', modelName);
    localStorage.setItem('gemini_prompt', customPrompt);
  }, [apiKey, modelName, customPrompt]);

  // Effect: Dark Mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const handleResetModel = () => {
    setModelName(DEFAULT_MODEL);
    setStatus('idle');
    setErrorMsg('');
    handleExtract(DEFAULT_MODEL); // Retry with default
  };

  const handleExtract = async (overrideModel = null) => {
    if (!file) return;
    
    const effectiveKey = ENV_API_KEY || apiKey;
    const effectiveModel = overrideModel || modelName;
    
    if (!effectiveKey) {
        setShowSettings(true);
        setErrorMsg("Please configure your API Key in settings first.");
        setStatus('error');
        return;
    }

    setStatus('processing');
    setErrorMsg('');
    setResult('');
    
    try {
      // Stage 1: Reading File
      setProgressData({ percent: 10, text: 'Reading PDF...' });
      const filePart = await fileToGenerativePart(file);
      
      // Stage 2: Preparing Request
      setProgressData({ percent: 30, text: 'Connecting to Gemini...' });
      
      const payload = {
        contents: [{
          parts: [
            { text: customPrompt },
            filePart
          ]
        }]
      };

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${effectiveKey}`;
      
      // Stage 3: Sending & Waiting
      setProgressData({ percent: 40, text: 'Analyzing document structure...' });
      
      let attempt = 0;
      const maxRetries = 5;
      const delays = [1000, 2000, 4000, 8000, 16000];
      
      const progressInterval = setInterval(() => {
        setProgressData(prev => {
          if (prev.percent < 90) {
            let newText = prev.text;
            if (prev.percent > 50) newText = 'Extracting text content...';
            if (prev.percent > 75) newText = 'Formatting output...';
            return { percent: prev.percent + 5, text: newText };
          }
          return prev;
        });
      }, 800);

      let extractedText = "No text found.";

      try {
        while (attempt <= maxRetries) {
          try {
            const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });

            if (!response.ok) {
               const errorData = await response.json().catch(() => ({}));
               
               // Handle specific HTTP errors
               if (response.status === 404) {
                 throw new Error("MODEL_NOT_FOUND");
               }
               if (response.status === 403 || response.status === 400) {
                   throw new Error(errorData.error?.message || "Invalid API Key or Bad Request");
               }
               throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.error) {
              throw new Error(data.error.message);
            }

            extractedText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No text found.";
            break; // Success

          } catch (e) {
            if (e.message === "MODEL_NOT_FOUND") throw e;
            if (attempt === maxRetries || e.message.includes("Invalid API Key")) throw e;
            
            setProgressData({ percent: 40 + (attempt * 10), text: `Retrying connection (${attempt + 1}/${maxRetries})...` });
            await new Promise(resolve => setTimeout(resolve, delays[attempt]));
            attempt++;
          }
        }
      } finally {
        clearInterval(progressInterval);
      }
      
      setProgressData({ percent: 100, text: 'Complete!' });
      
      setTimeout(() => {
        setResult(extractedText);
        setStatus('success');
      }, 500);

    } catch (err) {
      console.error(err);
      if (err.message === "MODEL_NOT_FOUND") {
        setErrorMsg("Model not found. Please reset model settings.");
        // Auto-recover: force reset state to default if current model failed
        if (modelName !== DEFAULT_MODEL) {
             setModelName(DEFAULT_MODEL);
        }
      } else {
        setErrorMsg(err.message || "Failed to extract text. Please try again.");
      }
      setStatus('error');
    }
  };

  const reset = () => {
    setFile(null);
    setStatus('idle');
    setResult('');
    setErrorMsg('');
    setProgressData({ percent: 0, text: '' });
  };

  const hasEnvKey = !!ENV_API_KEY;
  const hasUserKey = !!apiKey && apiKey.length > 5;
  const isReady = hasEnvKey || hasUserKey;

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${isDarkMode ? 'bg-[#1a1a1a] text-white selection:bg-blue-500 selection:text-white' : 'bg-[#f8f9fa] text-gray-900 selection:bg-blue-100 selection:text-blue-900'} flex flex-col`}>
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)}
        apiKey={apiKey}
        setApiKey={setApiKey}
        model={modelName}
        setModel={setModelName}
        prompt={customPrompt}
        setPrompt={setCustomPrompt}
      />

      <div className="flex-grow max-w-2xl mx-auto w-full pt-6 md:pt-12 px-4 pb-12">
        <Header 
          isDarkMode={isDarkMode} 
          toggleTheme={toggleTheme} 
          onOpenSettings={() => setShowSettings(true)}
        />
        
        <div className="space-y-6">
          {/* Input Section */}
          <Card className="p-6 md:p-8 transition-colors duration-300">
            <div className="space-y-6">
              <FileDropZone 
                selectedFile={file}
                onFileSelect={setFile}
                onClear={reset}
              />

              {file && status !== 'processing' && status !== 'success' && (
                <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
                   {!isReady && (
                      <div className="flex items-center gap-2 text-amber-500 text-xs justify-end">
                        <AlertCircle className="w-3 h-3" />
                        <span>API Key required in settings</span>
                      </div>
                   )}
                  <div className="flex justify-end">
                    <Button onClick={() => handleExtract()} className="w-full md:w-auto" disabled={!isReady}>
                      Start Extraction
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {status === 'processing' && (
                <ProcessingStatus 
                  statusText={progressData.text} 
                  progress={progressData.percent} 
                />
              )}

              {status === 'error' && (
                <div className="flex flex-col gap-3 animate-in shake">
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 rounded-lg text-sm flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    {errorMsg}
                  </div>
                  {errorMsg.includes("Model not found") && (
                     <div className="flex justify-end">
                       <Button onClick={handleResetModel} variant="secondary" className="text-sm">
                         <RefreshCw className="w-4 h-4" />
                         Reset Model to Defaults
                       </Button>
                     </div>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Result Section */}
          {status === 'success' && (
            <ResultView text={result} />
          )}

          <Footer />
        </div>
      </div>
    </div>
  );
}