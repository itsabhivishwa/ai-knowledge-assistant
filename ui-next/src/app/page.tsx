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

interface AdminEntry {
  email: string;
  role: "admin" | "super_admin";
  addedAt: string;
  addedBy: string;
}

// 🏢 PREMIUM SYSTEM ERROR TRANSLATION MATRIX
const enterpriseErrorRegistry: Record<string, string> = {
  AccountNotRegistered: "This organizational account is not registered. Please create a local profile using your credentials before syncing identity nodes.",
  AccessDenied: "Access denied: Your token authorization profile does not hold clearance for this workspace core.",
  CredentialsSignin: "Invalid authorization handshake: Security password signature mismatch.",
  OAuthSignin: "OAuth Handshake Rejection: Access Token Secret mismatch or Invalid Redirect URI setup on Developer Console.",
  Default: "An active intercept boundary handshake error occurred. Please try again or contact IT operations management."
};

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
  
  // ⚡ SEPARATED MANAGEMENT CONTROLLER STATE
  const [showAdminManagementGate, setShowAdminManagementGate] = useState(false);

  const [authPanelMode, setAuthPanelMode] = useState<"login" | "signup" | null>(null);
  const [adminAccess, setAdminAccess] = useState<{
    currentUserRole: "user" | "admin";
    isAdmin: boolean;
    feedbackStats: {
      good: number;
      bad: number;
      total: number;
      recent: any[];
    };
    admins: AdminEntry[];
  }>({ currentUserRole: "user", isAdmin: false, feedbackStats: { good: 0, bad: 0, total: 0, recent: [] }, admins: [] });
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [adminManageStatus, setAdminManageStatus] = useState("");

  // 🔥 NEW AUTH INPUT FORM LOCAL STATES
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authSuccessMessage, setAuthSuccessMessage] = useState<string | null>(null);
  
  // ⚡ PASSWORD VISIBILITY CONTROLLER
  const [showPassword, setShowPassword] = useState(false);

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
  
  const signedInEmail = session?.user?.email?.toLowerCase() || "";
  const userIsAdmin = adminAccess.isAdmin;

  // 🔥 FUNCTION: AUTOMATIC STREAM SCROLL TO BOTTOM LOGIC
  const scrollToBottom = (behavior: "smooth" | "auto" = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Trigger scroll whenever new message array changes or stream tokens flush
  useEffect(() => {
    if (userIsAuthenticated) {
      scrollToBottom("smooth");
    }
  }, [currentSession.messages, loading, userIsAuthenticated]);

  // Trigger forced fast scroll to bottom when user switches chat session room
  useEffect(() => {
    if (userIsAuthenticated) {
      scrollToBottom("auto");
    }
  }, [activeSessionId, userIsAuthenticated]);

  // Catch dynamic redirect handshake errors safely from URL state strings
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const errorParam = params.get("error");
      if (errorParam) {
        setAuthError(enterpriseErrorRegistry[errorParam] || errorParam);
        setAuthPanelMode("login"); 
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

  useEffect(() => {
    const loadAdminAccess = async () => {
      if (!session?.user?.email) {
        setAdminAccess({ currentUserRole: "user", isAdmin: false, feedbackStats: { good: 0, bad: 0, total: 0, recent: [] }, admins: [] });
        return;
      }

      try {
        const res = await fetch("/api/admins");
        if (!res.ok) throw new Error("Unable to load admin access.");
        const data = await res.json();
        setAdminAccess({
          currentUserRole: data.currentUserRole || "user",
          isAdmin: !!data.isAdmin,
          feedbackStats: data.feedbackStats || { good: 0, bad: 0, total: 0, recent: [] },
          admins: Array.isArray(data.admins) ? data.admins : [],
        });
      } catch (err) {
        setAdminAccess({ currentUserRole: "user", isAdmin: false, feedbackStats: { good: 0, bad: 0, total: 0, recent: [] }, admins: [] });
      }
    };

    loadAdminAccess();
  }, [session]);

  // Reset eye icon visibility state whenever screen swaps tabs
  useEffect(() => {
    setShowPassword(false);
  }, [authPanelMode]);

  // 🔥 GLOBAL CLICK WRAPPER: CLOSES OVERLAYS AND DYNAMIC CURVED TELEMETRY ON OUTSIDE CLICK
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      setActiveExportMenuId(null);
      setActiveSessionMenuId(null);

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
    if (userIsAdmin) {
      fileInputRef.current?.click();
    } else {
      setShowAdminUploadGate(true);
    }
  };

  const refreshAdminAccess = async () => {
    const res = await fetch("/api/admins");
    if (!res.ok) throw new Error("Unable to refresh admin list.");
    const data = await res.json();
    setAdminAccess({
      currentUserRole: data.currentUserRole || "user",
      isAdmin: !!data.isAdmin,
      feedbackStats: data.feedbackStats || { good: 0, bad: 0, total: 0, recent: [] },
      admins: Array.isArray(data.admins) ? data.admins : [],
    });
    return data;
  };

  const handleSaveAdmin = async () => {
    if (!newAdminEmail.trim()) return;
    setAdminManageStatus("Saving admin access...");

    try {
      const res = await fetch("/api/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newAdminEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unable to save admin.");
      await refreshAdminAccess();
      setNewAdminEmail("");
      setAdminManageStatus("Admin access updated.");
    } catch (error: unknown) {
      setAdminManageStatus(error instanceof Error ? error.message : "Admin update failed.");
    } finally {
      setTimeout(() => setAdminManageStatus(""), 3500);
    }
  };

  const handleRemoveAdmin = async (email: string) => {
    setAdminManageStatus(`Removing ${email}...`);

    try {
      const res = await fetch(`/api/admins?email=${encodeURIComponent(email)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unable to remove admin.");
      await refreshAdminAccess();
      setAdminManageStatus("Admin access removed.");
    } catch (error: unknown) {
      setAdminManageStatus(error instanceof Error ? error.message : "Admin removal failed.");
    } finally {
      setTimeout(() => setAdminManageStatus(""), 3500);
    }
  };

  // 🔥 STATE HANDLING: Dynamic Inline Overwrite Sequence to bypass React batch latency
  const triggerStreamQuery = async (queryText: string, sessionId: string, targetMessageId?: string) => {
    setLoading(true);
    abortControllerRef.current = new AbortController();

    let updatedSessionsSnapshot = [];
    
    setSessions(prev => {
      const targetSession = prev.find(s => s.id === sessionId) || prev[0];
      let updatedMessages = targetSession ? [...targetSession.messages] : [];
      
      if (targetMessageId) {
        const idx = updatedMessages.findIndex(m => m.id === targetMessageId);
        if (idx !== -1) {
          updatedMessages = updatedMessages.slice(0, idx);
          updatedMessages.push({ id: targetMessageId, role: "user", content: queryText.trim() });
        }
      } else {
        updatedMessages.push({ id: `u-${Date.now()}`, role: "user", content: queryText });
      }

      const assistantMessageId = `a-${Date.now()}`;
      updatedMessages.push({ id: assistantMessageId, role: "assistant", content: "", citations: [], feedback: null });
      
      const result = prev.map(s => s.id === sessionId ? {
        ...s,
        title: s.messages.length === 0 ? (queryText.substring(0, 24)) : s.title,
        messages: updatedMessages
      } : s);
      
      updatedSessionsSnapshot = result as any;
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
      let realDatabaseMessageId: string | null = null;

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
              
              if (rawData.message_id || rawData.messageId) {
                realDatabaseMessageId = rawData.message_id || rawData.messageId;
              }

              if (rawData.token) {
                accumulatedAnswer += rawData.token;
                setSessions(prev => {
                  return prev.map(s => s.id === sessionId ? {
                    ...s,
                    messages: s.messages.map(m => {
                      if (m.role === "assistant" && (realDatabaseMessageId ? (m.id === realDatabaseMessageId || m.id.startsWith('a-')) : m.id.startsWith('a-'))) {
                        return {
                          ...m,
                          id: realDatabaseMessageId || m.id,
                          content: accumulatedAnswer,
                          citations: parsedCitations
                        };
                      }
                      return m;
                    })
                  } : s);
                });
              }
            } catch (e) {}
          }
        }
      }
      
      setSessions(prev => {
        updateLocalStorage(prev);
        return prev;
      });

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

  const handleFeedback = async (msgId: string, type: "good" | "bad") => {
    const messageIndex = currentSession.messages.findIndex(m => m.id === msgId);
    const message = currentSession.messages[messageIndex];
    if (!message) return;
    const newFeedback = message.feedback === type ? null : type;
    const promptMessage = currentSession.messages
      .slice(0, messageIndex)
      .reverse()
      .find(m => m.role === "user");

    setSessions(prev => {
      const updated = prev.map(s => s.id === activeSessionId ? {
        ...s,
        messages: s.messages.map(m => m.id === msgId ? { ...m, feedback: newFeedback } : m)
      } : s);
      updateLocalStorage(updated);
      return updated;
    });

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messageId: msgId, 
          feedback: newFeedback, 
          prompt: promptMessage?.content || "",
          content: message.content 
        }),
      });

      if (response.ok) {
        await refreshAdminAccess();
      }
    } catch (err) {
      console.error("Failed to log persistent feedback matrix:", err);
    }
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
    const nId = `session-${Date.now()}`;
    setSessions(prev => [...prev, { id: nId, title: "Fresh Chat Session", messages: [] }]);
    setActiveSessionId(nId);
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
    const callbackUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    signIn(provider, { callbackUrl });
  };

  const handleInlineEditSubmit = (msgId: string, originalContent: string) => {
    if (!editInput.trim() || loading) return;
    
    if (editInput.trim() === originalContent.trim()) {
      setIsEditing(null);
      return;
    }

    const targetQuery = editInput.trim();
    setIsEditing(null);
    
    triggerStreamQuery(targetQuery, activeSessionId, msgId);
  };

  const handleCustomAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccessMessage(null);

    if (!emailInput.trim() || !passwordInput) {
      setAuthError("Email and Password inputs cannot stand empty.");
      return;
    }

    setAuthLoading(true);

    try {
      if (authPanelMode === "signup") {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: nameInput.trim() || null,
            email: emailInput.trim(),
            password: passwordInput,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Registration handshake rejection.");

        setAuthSuccessMessage("Workspace created successfully! Shifting to login view...");
        setNameInput("");
        setTimeout(() => {
          setAuthPanelMode("login");
          setAuthSuccessMessage(null);
          setAuthLoading(false);
        }, 1500);

      } else {
        const res = await signIn("credentials", {
          email: emailInput.trim(),
          password: passwordInput,
          redirect: false,
        });

        if (res?.error) {
          throw new Error(enterpriseErrorRegistry[res.error] || "Invalid verification signature.");
        }
        
        setEmailInput("");
        setPasswordInput("");
        setAuthLoading(false);
      }
    } catch (err: any) {
      setAuthError(err.message || "Authentication layer unexpected exception.");
      setAuthLoading(false);
    }
  };

  // 🌐 CASE 1: USER IS NOT AUTHENTICATED
  if (!userIsAuthenticated) {
    return (
      <main className="min-h-screen bg-[#080b12] font-sans antialiased text-slate-100 flex flex-col relative overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[140px] pointer-events-none" />

        <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/5 bg-[#080b12]/80 backdrop-blur-lg">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
            <button onClick={() => { setAuthPanelMode(null); setAuthError(null); setAuthSuccessMessage(null); }} className="flex items-center gap-3 text-left focus:outline-none">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-400 text-sm font-black text-slate-950 shadow-md shadow-blue-500/10">N</div>
              <span>
                <span className="block text-sm font-bold text-white tracking-tight">Nexora Systems</span>
                <span className="block text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500 font-mono">Enterprise AI Ops</span>
              </span>
            </button>

            <nav className="hidden items-center gap-8 text-xs font-semibold text-slate-400 md:flex">
              <a href="#platform" className="hover:text-white transition">Platform Matrix</a>
              <a href="#solutions" className="hover:text-white transition">Industry Solutions</a>
              <a href="#security" className="hover:text-white transition">RBAC Security</a>
            </nav>

            <div className="flex items-center gap-3">
              <button onClick={() => { setAuthPanelMode("login"); setAuthError(null); setAuthSuccessMessage(null); }} className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-bold text-slate-300 transition hover:border-slate-600 hover:bg-white/5">Login</button>
              <button onClick={() => { setAuthPanelMode("signup"); setAuthError(null); setAuthSuccessMessage(null); }} className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-emerald-400 shadow-lg shadow-emerald-500/10">Sign up</button>
            </div>
          </div>
        </header>

        <section className="relative min-h-screen flex items-center pt-16">
          <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-12 px-6 py-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="max-w-2xl space-y-6 text-left">
              <div className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-emerald-400">
                🚀 AI Knowledge Infrastructure v2.6
              </div>
              <h1 className="text-4xl font-black leading-[1.15] tracking-tight text-white md:text-6xl">
                Turn unstructured company knowledge into <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400">governed answers.</span>
              </h1>
              <p className="text-sm md:text-base leading-relaxed text-slate-400 max-w-xl">
                Nexora Systems helps technical teams centralize scattered SOPs, engineering playbooks, product telemetry notes, and compliance rules into a single role-aware secure AI interface.
              </p>
              <div className="flex flex-col sm:flex-row gap-3.5 pt-2">
                <button onClick={() => { setAuthPanelMode("signup"); setAuthError(null); setAuthSuccessMessage(null); }} className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3.5 text-xs font-bold text-slate-950 transition hover:opacity-90 shadow-xl shadow-emerald-500/10">Create Corporate Workspace</button>
                <button onClick={() => { setAuthPanelMode("login"); setAuthError(null); setAuthSuccessMessage(null); }} className="rounded-xl border border-slate-800 bg-slate-900/40 px-6 py-3.5 text-xs font-bold text-slate-300 transition hover:border-slate-600 hover:text-white text-center">Access Secure Portal</button>
              </div>
              
              <div className="grid max-w-lg grid-cols-3 gap-4 pt-8 border-t border-slate-900/80">
                <div className="border-l-2 border-slate-800 pl-3">
                  <p className="text-lg font-black text-white font-mono">24/7</p>
                  <p className="mt-0.5 text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Stream Response</p>
                </div>
                <div className="border-l-2 border-slate-800 pl-3">
                  <p className="text-lg font-black text-white font-mono">RBAC</p>
                  <p className="mt-0.5 text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Tala Controls</p>
                </div>
                <div className="border-l-2 border-slate-800 pl-3">
                  <p className="text-lg font-black text-white font-mono">RAG</p>
                  <p className="mt-0.5 text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Verified Citation</p>
                </div>
              </div>
            </div>

            <div className="relative w-full flex justify-center lg:justify-end">
              {authPanelMode ? (
                <div className="w-full max-w-md rounded-[24px] border border-slate-800/80 bg-slate-950/60 p-6 shadow-2xl backdrop-blur-xl space-y-4 relative z-10 animate-fadeIn">
                  <div className="flex items-start justify-between gap-4 border-b border-slate-900 pb-3">
                    <div>
                      <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">{authPanelMode === "login" ? "LOGIN" : "Signup"}</p>
                      <h2 className="mt-1 text-lg font-bold text-white">{authPanelMode === "login" ? "Already a User...?" : "New User"}</h2>
                    </div>
                    <button onClick={() => { setAuthPanelMode(null); setAuthError(null); setAuthSuccessMessage(null); }} className="rounded-lg border border-slate-800 px-2.5 py-1 text-xs font-bold text-slate-500 hover:text-white transition">X</button>
                  </div>

                  {authError && (
                    <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-xs tracking-wide">
                      <div className="font-bold text-red-400 uppercase tracking-wider text-[10px] mb-1">
                        Security Intercept Warning
                      </div>
                      <p className="leading-relaxed font-medium text-red-200/90">{authError}</p>
                    </div>
                  )}

                  {authSuccessMessage && (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                      <p className="font-mono text-[11px] leading-normal text-emerald-300/90">{authSuccessMessage}</p>
                    </div>
                  )}

                  <form onSubmit={handleCustomAuthSubmit} className="space-y-3">
                    {authPanelMode === "signup" && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-slate-400 font-semibold uppercase tracking-wider pl-1">Full Name</label>
                        <input 
                          type="text" 
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          placeholder="Enter Your Name"
                          className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-slate-400 font-semibold uppercase tracking-wider pl-1">Email Address</label>
                      <input 
                        type="email" 
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="employee@company.com"
                        required
                        className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-slate-400 font-semibold uppercase tracking-wider pl-1">Password</label>
                      <div className="relative flex items-center">
                        <input 
                          type={showPassword ? "text" : "password"} 
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                          placeholder="••••••••"
                          required
                          className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-4 pr-10 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-600"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 text-slate-500 hover:text-slate-300 transition-colors focus:outline-none"
                        >
                          {showPassword ? (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 1-4.243-4.243m4.242 4.242L9.88 9.88" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      disabled={authLoading}
                      className="w-full rounded-xl bg-blue-600 text-xs font-bold py-3 hover:bg-blue-500 transition tracking-wide text-white"
                    >
                      {authLoading ? "Synchronizing Security Node..." : authPanelMode === "login" ? "Authenticate Portal Identity" : "Commit Secure Workspace Registration"}
                    </button>
                  </form>

                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-slate-900"></div>
                    <span className="flex-shrink mx-3 text-[10px] font-mono text-slate-600 uppercase tracking-widest">Or Trace Identity Via</span>
                    <div className="flex-grow border-t border-slate-900"></div>
                  </div>

                  <div className="space-y-2.5">
                    <button onClick={() => handleOriginalSignIn("google")} className="group flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-xs font-semibold text-slate-300 transition hover:border-slate-700 hover:bg-slate-900">
                      <span className="flex items-center gap-3">
                        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24">
                          <path fill="#EA4335" d="M12 5.04c1.64 0 3.12.56 4.28 1.67l3.2-3.2C17.52 1.58 14.96 1 12 1 7.35 1 3.37 3.67 1.39 7.56l3.86 3C6.18 7.37 8.87 5.04 12 5.04z" />
                          <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.27H12v4.51h6.44c-.28 1.47-1.08 2.71-2.33 3.55l3.62 2.81c2.12-1.95 3.36-4.83 3.36-8.6z" />
                          <path fill="#FBBC05" d="M5.25 14.44c-.24-.72-.38-1.5-.38-2.31s.14-1.59.38-2.31v-3.8H1.39C.5 7.74 0 9.81 0 12s.5 4.26 1.39 6.13l3.86-3.69z" />
                          <path fill="#34A853" d="M12 23c3.24 0 5.97-1.08 7.96-2.91l-3.62-2.81c-1.01.68-2.3 1.09-3.96 1.09-3.13 0-5.82-2.33-6.77-5.52l-3.86 3C3.37 20.33 7.35 23 12 23z" />
                        </svg>
                        Signup Using Google Account
                      </span>
                      <span className="text-slate-600 group-hover:text-slate-400 transition font-mono">→</span>
                    </button>

                    <button onClick={() => handleOriginalSignIn("azure-ad")} className="group flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-xs font-semibold text-slate-300 transition hover:border-slate-700 hover:bg-slate-900">
                      <span className="flex items-center gap-3">
                        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 23 23">
                          <path fill="#f35325" d="M0 0h11v11H0z" /><path fill="#80bb00" d="M12 0h11v11H12z" /><path fill="#00a1f1" d="M0 12h11v11H0z" /><path fill="#ffb900" d="M12 12h11v11H12z" />
                        </svg>
                        Signup using Microsoft Account
                      </span>
                      <span className="text-slate-600 group-hover:text-slate-400 transition font-mono">→</span>
                    </button>

                    <button onClick={() => handleOriginalSignIn("linkedin")} className="group flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-xs font-semibold text-slate-300 transition hover:border-slate-700 hover:bg-slate-900">
                      <span className="flex items-center gap-3">
                        <svg className="h-3.5 w-3.5 shrink-0 text-[#0A66C2]" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M22.23 0H1.77C.8 0 0 .77 0 1.72v20.56C0 23.23.8 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.72V1.72C24 .77 23.2 0 22.23 0zM7.12 20.45H3.56V9H7.12v11.45zM5.34 7.43c-1.14 0-2.06-.92-2.06-2.06 0-1.14.92-2.06 2.06-2.06 1.14 0 2.06.92 2.06 2.06 0 1.14-.92 2.06-2.06 2.06zm15.11 13.02h-3.56v-5.6c0-1.34-.03-3.05-1.86-3.05-1.86 0-2.14 1.45-2.14 2.95v5.7H9.33V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29z"/>
                        </svg>
                        Signup using LinkedIn Account
                      </span>
                      <span className="text-slate-600 group-hover:text-slate-400 transition font-mono">→</span>
                    </button>
                  </div>

                  <p className="text-center text-xs text-slate-500 pt-1">
                    {authPanelMode === "login" ? "New to Nexora? " : "Already initialized? "}
                    <button onClick={() => { setAuthPanelMode(authPanelMode === "login" ? "signup" : "login"); setAuthError(null); setAuthSuccessMessage(null); }} className="font-bold text-emerald-400 hover:text-emerald-300 focus:outline-none">
                      {authPanelMode === "login" ? "Request Workspace" : "Log In instead"}
                    </button>
                  </p>
                </div>
              ) : (
                <div className="w-full max-w-md grid gap-3.5 z-10">
                  <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-5 shadow-xl">
                    <div className="h-2 w-10 rounded bg-blue-500 mb-3" />
                    <p className="text-xs font-bold text-white tracking-wide uppercase font-mono">Knowledge Workspace Nodes</p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">Inject governed internal assets, search across verified citation fragments, and control deployment matrix endpoints.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/50 p-4">
                      <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600">Operations</p>
                      <p className="mt-1 text-sm font-bold text-slate-200">SOP Matrix Engine</p>
                    </div>
                    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/50 p-4">
                      <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600">Permissions</p>
                      <p className="mt-1 text-sm font-bold text-slate-200">Dynamic Tala RBAC</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="platform" className="border-t border-slate-900 bg-[#04060b] px-6 py-16 z-30 relative shrink-0">
          <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-3">
            {[
              ["Verified Token Retrieval", "Every answer generated stays explicitly tied to uploaded document matrices with trace indexes."],
              ["Super-Admin Access Gates", "Add or remove document upload permissions securely on-the-fly without changing config code."],
              ["Granular Context Telemetry", "Inspect activity session counts, response stacks, and active citation tokens directly from sideboards."]
            ].map(([title, text]) => (
              <div key={title} className="rounded-2xl border border-slate-900 bg-slate-950/40 p-5 hover:border-slate-800 transition">
                <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-white">{title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">{text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    );
  }

  // 🛡️ CASE 2: USER IS SECURELY LOGGED IN
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex font-sans select-none relative overflow-hidden">
      
      {/* 📁 GATES MODULE 1: EXCLUSIVE ADMIN FILE UPLOADER (STANDALONE) */}
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
                onClick={() => {
                  setShowAdminUploadGate(false);
                  setTimeout(() => fileInputRef.current?.click(), 100);
                }}
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

      {/* ⚡ GATES MODULE 2: SEPARATED FLOATING ADMIN ADD/REMOVE OVERLAY */}
      {showAdminManagementGate && userIsAdmin && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/75 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-400">Identity Cluster Gates</p>
                <h2 className="mt-1 text-lg font-bold text-white">Admin Access Management</h2>
              </div>
              <button onClick={() => setShowAdminManagementGate(false)} className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-xs font-bold text-slate-400 hover:text-white">X</button>
            </div>

            <div className="space-y-4 py-4 text-sm text-slate-300">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-blue-400">Privilege Node Distribution</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">Authorize or remove console operator identities safely on the loop.</p>
                  </div>
                  <span className="rounded-full border border-blue-900/60 bg-blue-950/20 px-2 py-1 text-[10px] font-bold text-blue-300">Super admin</span>
                </div>

                <div className="flex flex-col gap-2">
                  <input
                    type="email"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    placeholder="operator@company.com"
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-blue-600"
                  />
                  <div className="flex">
                    <button onClick={handleSaveAdmin} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-500">
                      Add Admin Node
                    </button>
                  </div>
                </div>

                <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                  {adminAccess.admins.map((admin) => (
                    <div key={admin.email} className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[11px] text-slate-200">{admin.email}</p>
                        <p className="text-[10px] font-semibold text-slate-500">Admin Clearance Node</p>
                      </div>
                      <button
                        onClick={() => handleRemoveAdmin(admin.email)}
                        disabled={admin.email === signedInEmail}
                        className={`rounded-md border px-2 py-1 text-[10px] font-bold transition ${
                          admin.email === signedInEmail
                            ? "cursor-not-allowed border-slate-800 text-slate-600"
                            : "border-red-900/70 text-red-300 hover:bg-red-950/40"
                        }`}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                {adminManageStatus && <p className="text-[11px] font-mono text-slate-400 animate-pulse">{adminManageStatus}</p>}
              </div>
            </div>

            <div className="flex items-center justify-end border-t border-slate-800 pt-4">
              <button onClick={() => setShowAdminManagementGate(false)} className="rounded-lg border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white">Close Panel</button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR CONTAINER */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col p-4 space-y-4 shrink-0 relative">
        <button onClick={handleNewChat} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition text-sm shadow">+ New Chat</button>
        
        {/* 📁 FILE UPLOADER DRAWER PANEL (AS IT WAS) */}
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
              <span className="textxl block">Upload Files 📁</span>
              <p className="text-[11px] text-slate-300 font-semibold">Admin document upload</p>
              <p className="text-[10px] text-slate-500">Click or drop files to update knowledge</p>
            </>
          ) : (
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

        {/* HISTORICAL ROOM LIST CHANNELS */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1 pt-2 mb-24 select-none">
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

        {/* ⚡ EXCLUSIVE ADMIN PRIVILEGES SECTION: PLACED SPECIFICALLY ABOVE PROFILE COMPONENT */}
        {userIsAuthenticated && userIsAdmin && (
          <div className="absolute bottom-[64px] left-0 right-0 p-2 border-t border-slate-800/40 bg-slate-900/90 backdrop-blur-sm z-50">
            <button 
              onClick={() => setShowAdminManagementGate(!showAdminManagementGate)}
              className="w-full bg-slate-950 hover:bg-slate-800 border border-blue-900/40 hover:border-blue-500/60 text-blue-400 text-[11px] font-bold font-mono py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-inner"
            >
              🛠️ Manage Admin Nodes
            </button>
          </div>
        )}

        {/* FIXED FOOTER USER REGISTRY PROFILE PANEL */}
        {session?.user && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800 flex items-center justify-between bg-slate-900 z-50 h-[64px]">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-blue-500 to-emerald-500 flex items-center justify-center font-bold text-xs text-slate-950 shrink-0">{ (session.user.name || "E").substring(0, 2).toUpperCase() }</div>
              <div className="flex flex-col overflow-hidden text-left">
                <span className="text-xs font-semibold text-slate-200 truncate">{session.user.name}</span>
                <span className="text-[10px] text-slate-500 truncate font-mono">{session.user.email}</span>
              </div>
            </div>
            <button onClick={() => signOut({ callbackUrl: "http://localhost:3000" })} className="text-[10px] text-slate-400 hover:text-red-400 font-bold px-2 py-1 rounded bg-slate-950 border border-slate-800 transition font-mono shrink-0">OUT</button>
          </div>
        )}
      </div>

      {/* CORE WORKSPACE PANEL */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-950 relative">
        <header className="border-b border-slate-800 p-4 flex justify-between items-center bg-slate-950/80 backdrop-blur-md shrink-0 z-30">
          <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">🤖 AI Intelligence Company Bot</h1>
          
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

          {/* ACTIVE CHAT MAIN CONTAINER */}
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
                        <div className="w-full min-w-[280px]">
                          <input 
                            type="text" 
                            value={editInput} 
                            onChange={(e) => setEditInput(e.target.value)} 
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleInlineEditSubmit(msg.id, msg.content);
                              if (e.key === "Escape") setIsEditing(null);
                            }}
                            className="w-full bg-slate-900/90 border border-blue-500/50 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            autoFocus
                          />
                          <p className="text-[10px] text-slate-500 mt-1 pl-1 font-mono">Press <span className="text-slate-400 font-bold">Enter</span> to save & reload, <span className="text-slate-400 font-bold">Esc</span> to cancel.</p>
                        </div>
                      ) : (
                        <p className="text-sm leading-relaxed whitespace-pre-line text-left">{msg.content}</p>
                      )}
                    </div>

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

            <div ref={messagesEndRef} />
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent pointer-events-none z-20" />

          {/* CURVED DIAGNOSTIC TELEMETRY SIDEBAR DISPLAY */}
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

              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80 space-y-2 shadow-inner">
                <span className="text-[10px] text-slate-500 block font-mono uppercase tracking-tight">Active Message Registry</span>
                <div className="flex justify-between items-end">
                  <span className="text-xl font-bold font-mono text-slate-200">{currentSession.messages.length}</span>
                  <span className="text-[10px] text-slate-400 font-mono bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800">stack arrays</span>
                </div>
              </div>

              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80 space-y-2 shadow-inner">
                <span className="text-[10px] text-slate-500 block font-mono uppercase tracking-tight">Knowledge Citations</span>
                <div className="flex justify-between items-end">
                  <span className="text-xl font-bold font-mono text-emerald-400">{currentSession.messages.reduce((total, msg) => total + (msg.citations?.length || 0), 0)}</span>
                  <span className="text-[10px] text-emerald-400 font-medium bg-emerald-950/30 border border-emerald-900/40 px-2 py-0.5 rounded-lg">Optimal Context</span>
                </div>
              </div>

              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80 space-y-2 shadow-inner">
                <span className="text-[10px] text-slate-500 block font-mono uppercase tracking-tight">Response Feedback Score</span>
                <div className="flex justify-between items-center">
                  <div className="w-full">
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="font-bold text-emerald-400">{adminAccess.feedbackStats.good} Good</span>
                      <span className="font-bold text-red-400">{adminAccess.feedbackStats.bad} Bad</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2.5">
                      <div 
                        className="bg-emerald-500 h-2.5 rounded-full" 
                        style={{ width: `${adminAccess.feedbackStats.total > 0 ? (adminAccess.feedbackStats.good / adminAccess.feedbackStats.total) * 100 : 0}%` }}
                      ></div>
                    </div>
                    <p className="text-[9px] text-slate-400 font-mono text-right mt-1">Total Ratings: {adminAccess.feedbackStats.total}</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80 space-y-2 shadow-inner">
                <span className="text-[10px] text-slate-500 block font-mono uppercase tracking-tight">Recent Feedback Log</span>
                {adminAccess.feedbackStats.recent.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {adminAccess.feedbackStats.recent.map((fb, index) => (
                      <div key={index} className="text-xs border-l-2 pl-2 space-y-1 border-emerald-500">
                        <div className="flex justify-between items-center">
                          <span className={`font-bold text-xs ${fb.feedback === 'good' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {fb.feedback === 'good' ? '👍 Good' : '👎 Bad'}
                          </span>
                          <span className="text-[9px] text-slate-500 font-mono">
                            {new Date(fb.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                          {fb.content}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 text-center py-2">No feedback recorded yet.</p>
                )}
              </div>

              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80 space-y-1.5 shadow-inner">
                <span className="text-[10px] text-slate-500 block font-mono uppercase tracking-tight">Handshake Node Access</span>
                <div className="flex justify-between items-center pt-0.5">
                  <span className={`text-[12px] font-bold font-mono ${userIsAdmin ? "text-emerald-400" : "text-amber-500"}`}>{userIsAdmin ? "System Administrator" : "Standard Corporate Client"}</span>
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