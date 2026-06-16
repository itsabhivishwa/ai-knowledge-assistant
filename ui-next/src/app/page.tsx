"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: any[];
  feedback?: "good" | "bad" | null;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  isPinned?: boolean;
}

export default function Home() {
  // 🔥 NEXTAUTH LIVE ENGINE SESSIONS HOOKS
  const { data: session, status } = useSession();
  const loadingSession = status === "loading";
  const userIsAuthenticated = !!session;

  // Core App States
  const [sessions, setSessions] = useState<ChatSession[]>([
    { id: "default", title: "New Chat Session", messages: [] }
  ]);
  const [activeSessionId, setActiveSessionId] = useState("default");
  const [inputQuestion, setInputQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editInput, setEditInput] = useState("");
  
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeSourceMsgId, setActiveSourceMsgId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [showDashboard, setShowDashboard] = useState(false); 
  const [showAdminUploadGate, setShowAdminUploadGate] = useState(false);

  // DROP-UP EXPORT MENU STATE
  const [activeExportMenuId, setActiveExportMenuId] = useState<string | null>(null);

  // SIDEBAR SELECTION CONSOLE TRACKERS
  const [activeSessionMenuId, setActiveSessionMenuId] = useState<string | null>(null);
  const [sessionEditingId, setSessionEditingId] = useState<string | null>(null);
  const [sessionEditTitle, setSessionEditingTitle] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  // 🔥 DOM ANCHOR REFS FOR AUTO SCROLLING & OUTSIDE CLICK HANDLERS
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const dashboardButtonRef = useRef<HTMLButtonElement>(null);
  
  // Custom sorting configuration: Pinned tracks always stand at top
  const sortedSessions = [...sessions].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return 0;
  });

  const currentSession = sessions.find(s => s.id === activeSessionId) || sessions[0] || { id: "default", title: "New Chat Session", messages: [] };
  
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const signedInEmail = session?.user?.email?.toLowerCase() || "";
  const userIsAdmin = !!signedInEmail && adminEmails.includes(signedInEmail);

  // 🔥 FUNCTION: AUTOMATIC STREAM SCROLL TO BOTTOM LOGIC
  const scrollToBottom = (behavior: "smooth" | "auto" = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Trigger scroll whenever new message array changes or stream tokens flush
  useEffect(() => {
    scrollToBottom("smooth");
  }, [currentSession.messages, loading]);

  // Trigger forced fast scroll to bottom when user switches chat session room
  useEffect(() => {
    scrollToBottom("auto");
  }, [activeSessionId]);

  // Catch dynamic redirect handshake errors safely from URL state strings
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const errorParam = params.get("error");
      if (errorParam) {
        setAuthError(
          errorParam === "OAuthSignin" 
            ? "OAuth Handshake Rejection: Access Token Secret mismatch or Invalid Redirect URI setup on Developer Console." 
            : errorParam
        );
      }
    }
  }, []);

  useEffect(() => {
    if (session?.user?.email) {
      const savedHistory = localStorage.getItem(`chat_history_${session.user.email}`);
      if (savedHistory) {
        const historyParsed = jsonParseSafe(savedHistory);
        if (historyParsed && historyParsed.length > 0) {
          setSessions(historyParsed);
          setActiveSessionId(historyParsed[0].id);
        }
      }
    }
  }, [session]);

  // 🔥 GLOBAL CLICK WRAPPER: CLOSES OVERLAYS AND DYNAMIC CURVED TELEMETRY ON OUTSIDE CLICK
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      // Close dropdown menus
      setActiveExportMenuId(null);
      setActiveSessionMenuId(null);

      // Telemetry panel boundary outside click close check
      if (
        dashboardRef.current && 
        !dashboardRef.current.contains(e.target as Node) &&
        dashboardButtonRef.current &&
        !dashboardButtonRef.current.contains(e.target as Node)
      ) {
        setShowDashboard(false);
      }
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  const jsonParseSafe = (str: string) => {
    try { return JSON.parse(str); } catch (e) { return null; }
  };

  const updateLocalStorage = (updated: ChatSession[]) => {
    if (session?.user?.email) {
      localStorage.setItem(`chat_history_${session.user.email}`, JSON.stringify(updated));
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    if (!userIsAdmin) {
      setShowAdminUploadGate(true);
      setUploadStatus("Upload locked. Admin authorization required.");
      setTimeout(() => setUploadStatus(""), 4000);
      return;
    }
    setUploading(true);
    setUploadStatus(`Uploading ${file.name}...`);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed.");
      const data = await res.json();
      setUploadStatus(`✓ ${data.filename} indexed!`);
      setTimeout(() => setUploadStatus(""), 4000);
    } catch (err) {
      setUploadStatus("❌ Error ingesting asset.");
      setTimeout(() => setUploadStatus(""), 4000);
    } finally {
      setUploading(false);
    }
  };

  const handleUploadAccessRequest = () => {
    setShowAdminUploadGate(true);
  };

  const handleAdminUploadConfirm = () => {
    if (!userIsAdmin || uploading) return;
    setShowAdminUploadGate(false);
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 100);
  };

  const triggerStreamQuery = async (queryText: string, sessionId: string, targetMessageId?: string) => {
    setLoading(true);
    abortControllerRef.current = new AbortController();

    const targetSession = sessions.find(s => s.id === sessionId) || sessions[0];
    let updatedMessages = targetSession ? [...targetSession.messages] : [];
    
    if (targetMessageId) {
      const idx = updatedMessages.findIndex(m => m.id === targetMessageId);
      if (idx !== -1) updatedMessages = updatedMessages.slice(0, idx + 1);
    } else {
      updatedMessages.push({ id: `u-${Date.now()}`, role: "user", content: queryText });
    }

    const assistantMessageId = `a-${Date.now()}`;
    updatedMessages.push({ id: assistantMessageId, role: "assistant", content: "", citations: [], feedback: null });
    
    setSessions(prev => {
      const result = prev.map(s => s.id === sessionId ? {
        ...s,
        title: s.messages.length === 0 ? (queryText.substring(0, 24)) : s.title,
        messages: updatedMessages
      } : s);
      updateLocalStorage(result);
      return result;
    });

    try {
      const response = await fetch("http://127.0.0.1:8000/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: queryText }),
        signal: abortControllerRef.current.signal
      });

      if (!response.body) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedAnswer = "";
      let parsedCitations: any[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const rawData = JSON.parse(line.substring(6));
              if (rawData.citations) parsedCitations = rawData.citations;
              if (rawData.token) {
                accumulatedAnswer += rawData.token;
                setSessions(prev => {
                  const updated = prev.map(s => s.id === sessionId ? {
                    ...s,
                    messages: s.messages.map(m => m.id === assistantMessageId ? {
                      ...m, content: accumulatedAnswer, citations: parsedCitations
                    } : m)
                  } : s);
                  updateLocalStorage(updated);
                  return updated;
                });
              }
            } catch (e) {}
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") console.error(err);
    } finally {
      setLoading(false);
      setIsEditing(null);
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
    }
  };

  const handleSaveSessionRename = (sessionId: string) => {
    if (!sessionEditTitle.trim()) return;
    setSessions(prev => {
      const updated = prev.map(s => s.id === sessionId ? { ...s, title: sessionEditTitle.trim() } : s);
      updateLocalStorage(updated);
      return updated;
    });
    setSessionEditingId(null);
  };

  const handleTogglePinSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveSessionMenuId(null);
    setSessions(prev => {
      const updated = prev.map(s => s.id === sessionId ? { ...s, isPinned: !s.isPinned } : s);
      updateLocalStorage(updated);
      return updated;
    });
  };

  const handleDeleteSession = (sessionIdToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation(); 
    setActiveSessionMenuId(null);

    if (sessions.length === 1) {
      const freshId = `session-${Date.now()}`;
      const freshSessions = [{ id: freshId, title: "Fresh Chat Session", messages: [] }];
      setSessions(freshSessions);
      setActiveSessionId(freshId);
      updateLocalStorage(freshSessions);
      return;
    }

    const updatedSessions = sessions.filter(s => s.id !== sessionIdToDelete);
    setSessions(updatedSessions);

    if (activeSessionId === sessionIdToDelete) {
      setActiveSessionId(updatedSessions[0].id);
    }
    updateLocalStorage(updatedSessions);
  };

  const handleFeedback = (msgId: string, type: "good" | "bad") => {
    setSessions(prev => prev.map(s => s.id === activeSessionId ? {
      ...s,
      messages: s.messages.map(m => m.id === msgId ? { ...m, feedback: m.feedback === type ? null : type } : m)
    } : s));
  };

  const handleReload = (msgId: string) => {
    const msgIndex = currentSession.messages.findIndex(m => m.id === msgId);
    if (msgIndex <= 0) return; 
    const correspondingUserQuery = currentSession.messages[msgIndex - 1].content;
    triggerStreamQuery(correspondingUserQuery, activeSessionId, currentSession.messages[msgIndex - 1].id);
  };

  const handleCopyText = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportMessage = (text: string, format: "txt" | "json") => {
    let blobContent = text;
    let mimeType = "text/plain";
    let filename = `FloCard-Report-${Date.now()}.txt`;
    if (format === "json") {
      blobContent = JSON.stringify({ platform: "FloCard RAG", exportedAt: new Date().toISOString(), payload: text }, null, 2);
      mimeType = "application/json";
      filename = `FloCard-Report-${Date.now()}.json`;
    }
    const blob = new Blob([blobContent], { type: mimeType });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  const handleShareSession = () => {
    const shareUrl = `${window.location.origin}/share/session?id=${activeSessionId}`;
    navigator.clipboard.writeText(shareUrl);
    alert("🔗 Share URL link copied successfully!");
  };

  const handleNewChat = () => {
    const newId = `session-${Date.now()}`;
    setSessions(prev => [...prev, { id: newId, title: "Fresh Chat Session", messages: [] }]);
    setActiveSessionId(newId);
    setInputQuestion("");
  };

  const handleInitialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuestion.trim() || loading) return;
    const q = inputQuestion;
    setInputQuestion("");
    triggerStreamQuery(q, activeSessionId);
  };

  const handleOriginalSignIn = (provider: string) => {
    signIn(provider, { callbackUrl: "http://localhost:3000" });
  };

  const handleRewriteSubmit = (msgId: string) => {
    if (!editInput.trim() || loading) return;
    setSessions(prev => prev.map(s => s.id === activeSessionId ? {
      ...s,
      messages: s.messages.map(m => m.id === msgId ? { ...m, content: editInput } : m)
    } : s));
    setIsEditing(null);
    triggerStreamQuery(editInput, activeSessionId, msgId);
  };

  // HIGH-SECURITY PORTAL GATEWAY RENDER LAYER
  if (!userIsAuthenticated) {
    return (
      <main className="min-h-screen bg-[#030712] flex items-center justify-center p-6 font-sans antialiased text-slate-200 relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="w-full max-w-[440px] bg-slate-900/60 border border-slate-800/80 rounded-[28px] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl space-y-6 relative z-10">
          <div className="text-center space-y-2.5">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-500 to-emerald-400 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(59,130,246,0.3)]">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6 text-slate-950">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            <h1 className="text-[23px] font-bold tracking-tight text-white pt-1">AI Assistance Gateway</h1>
            <p className="text-xs text-slate-400 max-w-[280px] mx-auto leading-relaxed">Authorized personnel only. Sign-in using corporate identity nodes.</p>
          </div>

          {authError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3.5 flex items-start gap-3 animate-fadeIn">
              <span className="text-red-400 text-sm shrink-0 mt-0.5">⚠️</span>
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-red-400">Identity Authorization Blocked</p>
                <p className="text-[11px] text-red-300/80 leading-normal font-mono">{authError}</p>
              </div>
            </div>
          )}

          <div className="space-y-3 pt-1">
            <button onClick={() => handleOriginalSignIn("google")} className="w-full bg-slate-950/60 hover:bg-slate-950 border border-slate-800/80 hover:border-slate-700 text-slate-300 hover:text-white py-3 px-4 rounded-xl text-[13px] font-medium transition flex items-center justify-between group active:scale-[0.98]">
              <div className="flex items-center gap-3.5">
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5.04c1.64 0 3.12.56 4.28 1.67l3.2-3.2C17.52 1.58 14.96 1 12 1 7.35 1 3.37 3.67 1.39 7.56l3.86 3C6.18 7.37 8.87 5.04 12 5.04z" />
                  <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.27H12v4.51h6.44c-.28 1.47-1.08 2.71-2.33 3.55l3.62 2.81c2.12-1.95 3.36-4.83 3.36-8.6z" />
                  <path fill="#FBBC05" d="M5.25 14.44c-.24-.72-.38-1.5-.38-2.31s.14-1.59.38-2.31v-3.8H1.39C.5 7.74 0 9.81 0 12s.5 4.26 1.39 6.13l3.86-3.69z" />
                  <path fill="#34A853" d="M12 23c3.24 0 5.97-1.08 7.96-2.91l-3.62-2.81c-1.01.68-2.3 1.09-3.96 1.09-3.13 0-5.82-2.33-6.77-5.52l-3.86 3C3.37 20.33 7.35 23 12 23z" />
                </svg>
                <span>Continue with Google</span>
              </div>
              <span className="text-slate-600 group-hover:text-slate-400 transition font-mono">→</span>
            </button>

            <button onClick={() => handleOriginalSignIn("azure-ad")} className="w-full bg-slate-950/60 hover:bg-slate-950 border border-slate-800/80 hover:border-slate-700 text-slate-300 hover:text-white py-3 px-4 rounded-xl text-[13px] font-medium transition flex items-center justify-between group active:scale-[0.98]">
              <div className="flex items-center gap-3.5">
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 23 23">
                  <path fill="#f35325" d="M0 0h11v11H0z" /><path fill="#80bb00" d="M12 0h11v11H12z" /><path fill="#00a1f1" d="M0 12h11v11H0z" /><path fill="#ffb900" d="M12 12h11v11H12z" />
                </svg>
                <span>Continue with Microsoft</span>
              </div>
              <span className="text-slate-600 group-hover:text-slate-400 transition font-mono">→</span>
            </button>

            <button onClick={() => handleOriginalSignIn("linkedin")} className="w-full bg-slate-950/60 hover:bg-slate-950 border border-slate-800/80 hover:border-slate-700 text-slate-300 hover:text-white py-3 px-4 rounded-xl text-[13px] font-medium transition flex items-center justify-between group active:scale-[0.98]">
              <div className="flex items-center gap-3.5">
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.23 0H1.77C.8 0 0 .77 0 1.72v20.56C0 23.23.8 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.72V1.72C24 .77 23.2 0 22.23 0zM7.12 20.45H3.56V9H7.12v11.45zM5.34 7.43c-1.14 0-2.06-.92-2.06-2.06 0-1.14.92-2.06 2.06-2.06 1.14 0 2.06.92 2.06 2.06 0 1.14-.92 2.06-2.06 2.06zm15.11 13.02h-3.56v-5.6c0-1.34-.03-3.05-1.86-3.05-1.86 0-2.14 1.45-2.14 2.95v5.7H9.33V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29z"/>
                </svg>
                <span>Continue with LinkedIn</span>
              </div>
              <span className="text-slate-600 group-hover:text-slate-400 transition font-mono">→</span>
            </button>
          </div>
          <div className="pt-2 text-center"><p className="text-[10px] text-slate-500 font-mono tracking-wider">PROTECTED BY AI ASSISTANCE SECURITY POLICY</p></div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex font-sans select-none relative overflow-hidden">
      {showAdminUploadGate && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/75 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Admin Upload Gate</p>
                <h2 className="mt-1 text-lg font-bold text-white">Document upload authorization</h2>
              </div>
              <button onClick={() => setShowAdminUploadGate(false)} className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-xs font-bold text-slate-400 hover:text-white">X</button>
            </div>

            <div className="space-y-4 py-4 text-sm text-slate-300">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Signed-in identity</p>
                <p className="mt-1 truncate font-mono text-xs text-slate-300">{session?.user?.email || "No email found"}</p>
                <p className={`mt-2 text-xs font-semibold ${userIsAdmin ? "text-emerald-400" : "text-amber-400"}`}>
                  {userIsAdmin ? "Admin access confirmed" : "Upload access denied for this account"}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/10 p-3">
                  <p className="text-xs font-bold text-emerald-400">Admin task</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-400">Chat with documents and upload new or old files to refresh the knowledge base.</p>
                </div>
                <div className="rounded-xl border border-blue-900/60 bg-blue-950/10 p-3">
                  <p className="text-xs font-bold text-blue-400">User task</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-400">Use chat, history, citations, export, and sharing without changing uploaded documents.</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-4">
              <button onClick={() => setShowAdminUploadGate(false)} className="rounded-lg border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white">Cancel</button>
              <button
                onClick={handleAdminUploadConfirm}
                disabled={!userIsAdmin || uploading}
                className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                  userIsAdmin && !uploading
                    ? "bg-emerald-600 text-white hover:bg-emerald-500"
                    : "cursor-not-allowed bg-slate-800 text-slate-500"
                }`}
              >
                {uploading ? "Uploading..." : "Open upload"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR CONTAINER */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col p-4 space-y-4 shrink-0 relative">
        <button onClick={handleNewChat} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition text-sm shadow">+ New Chat</button>
        
        {/* 🔥 UPDATED DYNAMIC DRAG-AND-DROP PANEL WITH ADVANCED ACCENT LUSTER */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!uploading && e.dataTransfer.files?.[0]) {
              if (userIsAdmin) handleFileUpload(e.dataTransfer.files[0]);
              else handleUploadAccessRequest();
            }
          }}
          onClick={handleUploadAccessRequest}
          className={`border-2 border-dashed p-4 rounded-lg text-center cursor-pointer transition space-y-1 group relative overflow-hidden ${
            userIsAdmin
              ? "border-emerald-700/70 hover:border-emerald-500 bg-emerald-950/10"
              : "border-slate-800/80 hover:border-amber-600/40 bg-slate-950/30"
          }`}
        >
          {userIsAdmin ? (
            <>
              <span className="text-xl block">Makkhan Upload 📁</span>
              <p className="text-[11px] text-slate-300 font-semibold">Admin document upload</p>
              <p className="text-[10px] text-slate-500">Click or drop files to update knowledge</p>
            </>
          ) : (
            // 🔥 Locked Interface View with Lock SVG (Rest nodes are blurred on group hover)
            <div className="flex flex-col items-center justify-center transition-all duration-300">
              <div className="p-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl mb-1 shadow-sm shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
              </div>
              <div className="blur-[1.5px] opacity-40 select-none pointer-events-none space-y-0.5 transition-all duration-300 group-hover:blur-[2.5px]">
                <p className="text-[11px] text-slate-400 font-semibold">Document upload locked</p>
                <p className="text-[9px] text-slate-600">Admins can unlock this portal</p>
              </div>
            </div>
          )}
          <input type="file" ref={fileInputRef} onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])} className="hidden" />
        </div>
        
        {uploadStatus && <div className="text-[10px] bg-slate-950 text-center py-1.5 px-2 rounded font-mono text-emerald-400 border border-slate-800 animate-pulse">{uploadStatus}</div>}

        <div className="flex-1 overflow-y-auto space-y-1 pr-1 pt-2 mb-16 select-none">
          <p className="text-[11px] text-slate-500 uppercase font-bold tracking-wider px-2 mb-2">History Records</p>
          {sortedSessions.map(s => (
            <div key={s.id} className={`group flex items-center justify-between w-full rounded-lg text-xs transition px-3 py-2 relative ${s.id === activeSessionId ? "bg-slate-800 text-slate-100 font-medium" : "text-slate-400 hover:bg-slate-800/60"}`}>
              {sessionEditingId === s.id ? (
                <div className="flex items-center gap-1.5 w-full pr-2" onClick={(e) => e.stopPropagation()}>
                  <input type="text" value={sessionEditTitle} onChange={(e) => setSessionEditingTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSaveSessionRename(s.id); }} className="flex-1 bg-slate-950 border border-slate-800 text-[12px] text-white px-2 py-0.5 rounded-md focus:outline-none" autoFocus />
                  <button onClick={() => handleSaveSessionRename(s.id)} className="text-emerald-400 p-0.5">✓</button>
                </div>
              ) : (
                <button onClick={() => { setActiveSessionId(s.id); setIsEditing(null); }} className="text-left truncate flex-1 h-full focus:outline-none pr-6 text-[13px] flex items-center gap-1">
                  <span>{s.title}</span>
                  {s.isPinned && <span className="text-[10px]">📌</span>}
                </button>
              )}
              {sessionEditingId !== s.id && (
                <button onClick={(e) => { e.stopPropagation(); setActiveSessionMenuId(activeSessionMenuId === s.id ? null : s.id); }} className="opacity-0 group-hover:opacity-100 absolute right-2 p-1 rounded-md text-slate-400 hover:text-slate-200">•••</button>
              )}
              {activeSessionMenuId === s.id && (
                <div className="absolute left-4 top-8 w-48 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-1.5 z-[100] flex flex-col text-[13px]" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => { handleShareSession(); setActiveSessionMenuId(null); }} className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-800 flex items-center gap-2">🔗 Share</button>
                  <button onClick={(e) => handleTogglePinSession(s.id, e)} className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-800 flex items-center gap-2">📌 {s.isPinned ? "Unpin" : "Pin"}</button>
                  <button onClick={() => { setSessionEditingId(s.id); setSessionEditingTitle(s.title); setActiveSessionMenuId(null); }} className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-800 flex items-center gap-2">✏️ Rename</button>
                  <button onClick={(e) => handleDeleteSession(s.id, e)} className="w-full text-left px-3 py-2 rounded-xl text-red-400 hover:bg-red-950/40 border-t border-slate-800/60 mt-1 pt-2 flex items-center gap-2">🗑️ Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>

        {session?.user && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800 flex items-center justify-between bg-slate-900 z-50 h-[64px]">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-blue-500 to-emerald-500 flex items-center justify-center font-bold text-xs text-slate-950 shrink-0">{ (session.user.name || "E").substring(0, 2).toUpperCase() }</div>
              <div className="flex flex-col overflow-hidden text-left">
                <span className="text-xs font-semibold text-slate-200 truncate">{session.user.name}</span>
                <span className="text-[10px] text-slate-500 truncate font-mono">{session.user.email}</span>
              </div>
            </div>
            <button onClick={() => signOut()} className="text-[10px] text-slate-400 hover:text-red-400 font-bold px-2 py-1 rounded bg-slate-950 border border-slate-800 transition font-mono shrink-0">OUT</button>
          </div>
        )}
      </div>

      {/* CORE WORKSPACE PANEL */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-950 relative">
        <header className="border-b border-slate-800 p-4 flex justify-between items-center bg-slate-950/80 backdrop-blur-md shrink-0 z-30">
          <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">🤖 FloCard AI Intelligence Core</h1>
          
          {/* 🔥 DASHBOARD CONTROL TRIGGER SWITCH BUTTON NAME REVERTED */}
          <button 
            ref={dashboardButtonRef}
            onClick={(e) => { e.stopPropagation(); setShowDashboard(!showDashboard); }} 
            className={`text-xs font-semibold px-4 py-2 rounded-lg border transition-all duration-200 flex items-center gap-1.5 ${showDashboard ? "bg-blue-950/50 border-blue-500 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.2)]" : "bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500"}`}
          >
            📊 {showDashboard ? "Close Telemetry" : "Bot Performance Core"}
          </button>
        </header>

        <div className="flex-1 flex overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-slate-950 to-transparent pointer-events-none z-20" />

          {/* ACTIVE CHAT MAIN CONTAINER CONTAINER */}
          <div className="flex-1 overflow-y-auto px-6 py-10 space-y-6 scroll-smooth">
            {currentSession.messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm space-y-2">
                <span className="text-3xl">🛡️</span>
                <p>Welcome, <span className="text-slate-300 font-bold">{session?.user?.name}</span>. Secure enterprise OAuth node active.</p>
              </div>
            ) : (
              currentSession.messages.map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <div key={msg.id} className={`group flex flex-col w-full ${isUser ? "items-end" : "items-start"}`}>
                    <div className={`relative flex flex-col p-4 rounded-2xl border transition-all duration-200 ${isUser ? "bg-blue-600/10 border-blue-500/30 text-slate-100 rounded-tr-none w-fit max-w-[80%]" : "bg-transparent border-transparent text-slate-300 w-full max-w-3xl"}`}>
                      {isEditing === msg.id ? (
                        <div className="space-y-2 w-full min-w-[280px]">
                          <input type="text" value={editInput} onChange={(e) => setEditInput(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
                          <div className="flex gap-2">
                            <button onClick={() => handleRewriteSubmit(msg.id)} className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-medium">Rewrite</button>
                            <button onClick={() => setIsEditing(null)} className="bg-slate-800 text-slate-300 text-xs px-3 py-1 rounded-full font-medium">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm leading-relaxed whitespace-pre-line text-left">{msg.content}</p>
                      )}
                    </div>

                    {/* Visual Logos directly below user question layout (Gemini style) */}
                    {isUser && isEditing !== msg.id && (
                      <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pr-1 text-slate-500">
                        <button onClick={() => { setIsEditing(msg.id); setEditInput(msg.content); }} title="Edit message" className="p-1.5 rounded-full hover:bg-slate-900 hover:text-slate-300 transition">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                        <button onClick={() => handleCopyText(msg.id, msg.content)} title="Copy message" className="p-1.5 rounded-full hover:bg-slate-900 hover:text-slate-300 transition relative">
                          {copiedId === msg.id && <span className="text-[9px] text-emerald-400 absolute -top-5 left-1/2 -translate-x-1/2 bg-slate-950 px-1 rounded border border-emerald-800">Copied!</span>}
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125v-13.5A1.125 1.125 0 0 1 4.875 6H8.25m8.25 11.25H20.25M16.5 17.25V13.5M20.25 13.5H13.875c-.621 0-1.125-.504-1.125-1.125v-9.75c0-.621.504-1.125 1.125-1.125h4.125L20.25 6V13.5Z" />
                          </svg>
                        </button>
                      </div>
                    )}

                    {/* BOT ACTION CONTROLS ICON DOCK */}
                    {!isUser && msg.content && (
                      <div className="flex items-center gap-0.5 pt-1.5 pb-4 text-slate-400 relative max-w-3xl w-full">
                        <button onClick={() => handleFeedback(msg.id, "good")} className={`p-2 rounded-full hover:bg-slate-900 ${msg.feedback === "good" ? "text-emerald-400" : ""}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.896 0 1.7-.393 2.235-1.016a7.924 7.924 0 0 0 1.777-5.074 1.121 1.121 0 0 1 1.122-1.12h.112a1.122 1.122 0 0 1 1.122 1.12v1.64c0 .732.15 1.455.441 2.112l1.396 3.142m-10.205 6.188a1.125 1.125 0 0 1-1.631-1.455l1.631-3.531c.14-.303.44-.492.775-.492h4.383c.335 0 .634.19.775.492l1.631 3.531a1.125 1.125 0 0 1-1.631 1.455M14 20h3.5a2.5 2.5 0 0 0 2.5-2.5V11.5M14 20H8.5V10.5h5.5l1.396-3.142" /></svg>
                        </button>
                        <button onClick={() => handleFeedback(msg.id, "bad")} className={`p-2 rounded-full hover:bg-slate-900 ${msg.feedback === "bad" ? "text-red-400" : ""}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M17.367 13.75c-.896 0-1.7.393-2.235 1.016a7.924 7.924 0 0 0-1.777 5.074 1.121 1.121 0 0 1-1.122 1.12h-.112a1.122 1.122 0 0 1-1.122-1.12v-1.64c0-.732-.15-1.455-.441-2.112l-1.396-3.142m10.205-6.188a1.125 1.125 0 0 1 1.631 1.455l-1.631 3.531c-.14.303-.44.492-.775.492H10.1c-.335 0-.634-.19-.775-.492L7.694 8.708A1.125 1.125 0 0 1 9.325 7.253M10 4H6.5A2.5 2.5 0 0 0 4 6.5v6M10 4h5.5v9.5H10l-1.396 3.142" /></svg>
                        </button>
                        <button onClick={() => handleReload(msg.id)} className="p-2 rounded-full hover:bg-slate-900 text-slate-400 hover:text-blue-400"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg></button>
                        <button onClick={() => handleCopyText(msg.id, msg.content)} className="p-2 rounded-full hover:bg-slate-900 relative">
                          {copiedId === msg.id && <span className="text-[9px] text-emerald-400 absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-950 px-1 rounded border border-emerald-800">Copied!</span>}
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125v-13.5A1.125 1.125 0 0 1 4.875 6H8.25m8.25 11.25H20.25M16.5 17.25V13.5M20.25 13.5H13.875c-.621 0-1.125-.504-1.125-1.125v-9.75c0-.621.504-1.125 1.125-1.125h4.125L20.25 6V13.5Z" /></svg>
                        </button>

                        <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => setActiveExportMenuId(activeExportMenuId === msg.id ? null : msg.id)} className="p-2 rounded-full hover:bg-slate-900"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12Z" /></svg></button>
                          {activeExportMenuId === msg.id && (
                            <div className="absolute bottom-9 left-0 w-36 bg-slate-900/95 border border-slate-800 rounded-xl shadow-2xl p-1 z-50 flex flex-col">
                              <button onClick={() => { handleExportMessage(msg.content, "txt"); setActiveExportMenuId(null); }} className="w-full text-left px-3 py-2 text-[11px] font-medium rounded-lg text-slate-400 hover:bg-slate-800">📥 Export .TXT</button>
                              <button onClick={() => { handleExportMessage(msg.content, "json"); setActiveExportMenuId(null); }} className="w-full text-left px-3 py-2 text-[11px] font-medium rounded-lg text-slate-400 hover:bg-slate-800">📥 Export .JSON</button>
                              <button onClick={() => { handleShareSession(); setActiveExportMenuId(null); }} className="w-full text-left px-3 py-2 text-[11px] font-medium rounded-lg text-slate-400 hover:bg-slate-800 border-t border-slate-800/50 mt-0.5 pt-1.5">🔗 Share Session</button>
                            </div>
                          )}
                        </div>

                        {msg.citations && msg.citations.length > 0 && (
                          <button onClick={() => setActiveSourceMsgId(activeSourceMsgId === msg.id ? null : msg.id)} className="ml-auto text-[10px] px-2.5 py-1 rounded-full border border-slate-800 bg-slate-900/40 text-slate-400 font-medium">Citations</button>
                        )}
                      </div>
                    )}

                    {/* CITATIONS DISPLAY WINDOW */}
                    {msg.role === "assistant" && activeSourceMsgId === msg.id && msg.citations && (
                      <div className="mt-1 mb-4 grid grid-cols-1 md:grid-cols-2 gap-2 w-full max-w-3xl border-t border-slate-900 pt-3 animate-fadeIn">
                        {msg.citations.map((c: any, i: number) => (
                          <div key={c.id || i} className="bg-slate-950 p-3 rounded-xl border border-slate-900 text-[11px] text-slate-400 space-y-1">
                            <div className="flex justify-between items-center text-blue-400 font-bold font-mono">
                              <span>Fragment Matrix [{i+1}]: {c.title}</span>
                              <span className="text-[9px] bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-slate-500">{c.type}</span>
                            </div>
                            <div className="bg-slate-900/60 p-2 rounded text-slate-400 border border-slate-800 leading-normal max-h-24 overflow-y-auto">{c.text}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* NEON DYNAMIC "ANALYSING..." WAVES LOADER */}
            {loading && currentSession.messages[currentSession.messages.length - 1]?.content === "" && (
              <div className="flex flex-col gap-2 items-start w-full max-w-3xl mx-auto pl-1 mt-2">
                <div className="flex items-center gap-2 text-blue-400 text-sm font-medium tracking-wide">
                  <span>Analysing Knowledge Base</span>
                  <div className="flex items-center gap-1 h-3 pt-1">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-[bounce_1.4s_infinite_ease-in-out] [animation-delay:-0.32s]"></span>
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-[bounce_1.4s_infinite_ease-in-out] [animation-delay:-0.16s]"></span>
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-[bounce_1.4s_infinite_ease-in-out]"></span>
                  </div>
                </div>
              </div>
            )}

            {/* 🔥 AUTOMATIC BOTTOM ANCHOR SCROLL TARGET NODE NODE */}
            <div ref={messagesEndRef} />
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent pointer-events-none z-20" />

          {/* 🔥 HIGHLY MODIFIED: CURVED PROFILE DYNAMIC TELEMETRY PANEL WITH SLIDING AUTO-CLOSE */}
          {showDashboard && (
            <div 
              ref={dashboardRef}
              onClick={(e) => e.stopPropagation()}
              className="w-80 border-l border-slate-800/80 bg-slate-900/95 backdrop-blur-md p-5 flex flex-col space-y-4 absolute right-0 top-0 h-full z-40 shadow-[-10px_0_30px_rgba(0,0,0,0.5)] overflow-y-auto rounded-l-[24px] border-t border-b border-slate-800/60 transition-all duration-300 transform translate-x-0 animate-slideIn"
            >
              <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 font-mono flex items-center gap-2">
                  <span>⚡ Core Telemetry Node</span>
                </h3>
                <span className="h-2 w-2 rounded-full bg-emerald-500 relative flex">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>

              {/* Metric Card 1 - Curved Grid Layout */}
              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80 space-y-2 shadow-inner">
                <span className="text-[10px] text-slate-500 block font-mono uppercase tracking-tight">Active Message Registry</span>
                <div className="flex justify-between items-end">
                  <span className="text-xl font-bold font-mono text-slate-200">{currentSession.messages.length}</span>
                  <span className="text-[10px] text-slate-400 font-mono bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800">stack arrays</span>
                </div>
              </div>

              {/* Metric Card 2 - Curved Grid Layout */}
              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80 space-y-2 shadow-inner">
                <span className="text-[10px] text-slate-500 block font-mono uppercase tracking-tight">Knowledge Citations</span>
                <div className="flex justify-between items-end">
                  <span className="text-xl font-bold font-mono text-emerald-400">{currentSession.messages.reduce((total, msg) => total + (msg.citations?.length || 0), 0)}</span>
                  <span className="text-[10px] text-emerald-400 font-medium bg-emerald-950/30 border border-emerald-900/40 px-2 py-0.5 rounded-lg">Optimal Context</span>
                </div>
              </div>

              {/* Metric Card 3 - Curved Grid Layout */}
              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80 space-y-1.5 shadow-inner">
                <span className="text-[10px] text-slate-500 block font-mono uppercase tracking-tight">Handshake Node Access</span>
                <div className="flex justify-between items-center pt-0.5">
                  <span className={`text-[12px] font-bold font-mono ${userIsAdmin ? "text-emerald-400" : "text-amber-500"}`}>
                    {userIsAdmin ? "System Administrator" : "Standard Corporate Client"}
                  </span>
                </div>
              </div>

              <div className="text-[9px] text-slate-500 font-mono text-center pt-4 mt-auto border-t border-slate-800/40">
                User Session Active: {session?.user?.email}
              </div>
            </div>
          )}
        </div>

        {/* GEMINI PILL DESIGN INPUT AREA */}
        <div className="p-6 bg-slate-950 shrink-0 z-30 relative">
          <form onSubmit={handleInitialSubmit} className="max-w-3xl mx-auto relative flex items-center">
            <input type="text" value={inputQuestion} onChange={(e) => setInputQuestion(e.target.value)} disabled={loading} placeholder="Query corporate metrics, SOPs, or internal framework logs..." className="w-full bg-slate-900/90 border border-slate-800/80 rounded-[32px] pl-6 pr-14 py-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none" />
            <button type={loading ? "button" : "submit"} onClick={loading ? handleStopGeneration : undefined} className={`absolute right-3 p-2.5 rounded-full transition ${loading ? "bg-red-500 hover:bg-red-600 shadow-[0_0_12px_rgba(239,68,68,0.45)]" : "bg-blue-600 hover:bg-blue-500"}`}>
              {loading ? <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9z" clipRule="evenodd" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.6} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" /></svg>}
            </button>
          </form>
        </div>

      </div>
    </main>
  );
}