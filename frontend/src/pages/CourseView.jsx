import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { toast } from 'sonner';
import { confirmDialog } from '../components/ui';
import { Thread, ChatPanel, chainFor } from '../components/qa';
import IndexPath from '../components/IndexPath';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronRight, ChevronDown, CheckCircle2, Download, RefreshCcw, Loader2, Send, BookOpen, FileText, Zap, MessageCircle, Maximize2, ChevronLeft, DownloadCloud, Trash2, Globe, Save, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CourseView() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [index, setIndex] = useState([]);
  const [generatedLessons, setGeneratedLessons] = useState({});
  const [favoriteLessons, setFavoriteLessons] = useState({});
  const [currentLesson, setCurrentLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [regenerateFeedback, setRegenerateFeedback] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generationStatus, setGenerationStatus] = useState(null);
  
  // Q&A State (thread + chat)
  const [questions, setQuestions] = useState([]);
  const [askingQuestion, setAskingQuestion] = useState(false);
  const [deletingQuestion, setDeletingQuestion] = useState(null);
  const [chat, setChat] = useState(null); // {cid, messages}
  const [chatSending, setChatSending] = useState(false);
  
  // Immersive Mode & Sidebar Visibility
  const [isImmersiveMode, setIsImmersiveMode] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  
  // Web Research Toggle for lesson generation
  const [useWebResearch, setUseWebResearch] = useState(true);
  
  // Download loading states
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingEpub, setDownloadingEpub] = useState(false);
  const [viewingPdf, setViewingPdf] = useState(false);
  const [downloadingSinglePdf, setDownloadingSinglePdf] = useState(false);
  
  // Notes saving state
  const [savingNotes, setSavingNotes] = useState(false);
  
  // Get the base URL for API calls (used as fallback)
  const API_BASE_URL = client.defaults.baseURL.replace('/api/v1', '');
  const MEDIA_URL = `${API_BASE_URL}/media`;
  const pdfDownloadUrl = (lessonId) => `${API_BASE_URL}/api/v1/lessons/${lessonId}/pdf`;

  useEffect(() => {
    fetchCourse();
    fetchGeneratedLessons();
  }, [courseId]);

  const fetchCourse = async () => {
    try {
      const res = await client.get(`/courses/${courseId}`);
      setCourse(res.data);
      setIndex(JSON.parse(res.data.index_json));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGeneratedLessons = async () => {
    try {
      const res = await client.get(`/courses/${courseId}/lessons`);
      const lessonsMap = {};
      const favoritesMap = {};
      res.data.forEach(lesson => {
        lessonsMap[lesson.path_in_index] = lesson.is_completed ? 'completed' : 'generated';
        if (lesson.is_favorite) {
          favoritesMap[lesson.path_in_index] = true;
        }
      });
      setGeneratedLessons(lessonsMap);
      setFavoriteLessons(favoritesMap);
    } catch (err) {
      console.error('Failed to fetch generated lessons:', err);
    }
  };

  const selectLesson = async (lesson) => {
    setLessonLoading(true);
    setSuccessMsg('');
    try {
      const res = await client.post('/lessons/generate', {
        course_id: course.id,
        title: lesson.title,
        path_in_index: lesson.path,
        use_web_research: useWebResearch
      });
      setCurrentLesson(res.data);
      setNotes(res.data.user_notes || '');
      // Update generated lessons map
      setGeneratedLessons(prev => ({
        ...prev,
        [lesson.path]: res.data.is_completed ? 'completed' : 'generated'
      }));
      // Update favorite status
      setFavoriteLessons(prev => ({
        ...prev,
        [lesson.path]: res.data.is_favorite || false
      }));
      
      // Fetch questions for this lesson
      fetchQuestions(res.data.id);
      
      // If PDF not ready yet, poll for it
      if (!res.data.pdf_path) {
        pollForPdf(res.data.id);
      }
    } catch (err) {
      toast.error('Lezione non caricata. Riprova.');
    } finally {
      setLessonLoading(false);
    }
  };

  const pollForPdf = async (lessonId) => {
    let attempts = 0;
    const maxAttempts = 20; // 10 seconds max
    const interval = setInterval(async () => {
      try {
        const res = await client.get(`/lessons/${lessonId}`);
        if (res.data.pdf_path) {
          setCurrentLesson(prev => ({ ...prev, pdf_path: res.data.pdf_path }));
          clearInterval(interval);
        }
        attempts++;
        if (attempts >= maxAttempts) {
          clearInterval(interval);
        }
      } catch (err) {
        clearInterval(interval);
      }
    }, 500);
  };

  const fetchQuestions = async (lessonId) => {
    try {
      const res = await client.get(`/lessons/${lessonId}/questions`);
      setQuestions(res.data);
    } catch (err) {
      console.error('Failed to fetch questions:', err);
      setQuestions([]);
    }
  };

  const handleAskQuestion = async (text, parentId) => {
    if (!currentLesson) return;

    setAskingQuestion(true);
    try {
      await client.post(`/lessons/${currentLesson.id}/ask`, {
        question: text, parent_id: parentId || undefined
      });
      const res = await client.get(`/lessons/${currentLesson.id}/questions`);
      setQuestions(res.data);
    } catch (err) {
      toast.error('Domanda non inviata. Riprova.');
    } finally {
      setAskingQuestion(false);
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    if (!await confirmDialog({ title: 'Eliminare domanda?', message: 'Verranno eliminate anche le risposte annidate.', confirmLabel: 'Elimina', danger: true })) return;

    setDeletingQuestion(questionId);
    try {
      await client.delete(`/lessons/${currentLesson.id}/questions/${questionId}`);
      const res = await client.get(`/lessons/${currentLesson.id}/questions`);
      setQuestions(res.data);
    } catch (err) {
      toast.error('Eliminazione non riuscita. Riprova.');
    } finally {
      setDeletingQuestion(null);
    }
  };

  const handleStartChat = async (node) => {
    try {
      const res = await client.post(`/lessons/${currentLesson.id}/questions/${node.id}/chat`);
      // Pannello con thread intero, non solo seed singolo
      setChat({ cid: res.data.conversation_id, messages: chainFor(questions, node), parent: res.data.parent_id });
    } catch (err) {
      toast.error('Chat non avviata.');
    }
  };

  const handleChatSend = async (text) => {
    if (!chat) return;
    setChatSending(true);
    const parent = chat.parent || undefined;
    setChat((c) => ({ ...c, parent: null, messages: [...c.messages, { role: 'user', content: text }] }));
    try {
      const res = await client.post(`/lessons/${currentLesson.id}/chat/${chat.cid}/messages`, { content: text, parent_id: parent });
      setChat((c) => ({ ...c, messages: [...c.messages, { role: 'assistant', content: res.data.answer }] }));
      const qres = await client.get(`/lessons/${currentLesson.id}/questions`);
      setQuestions(qres.data);
    } catch (err) {
      toast.error('Messaggio non inviato.');
    } finally {
      setChatSending(false);
    }
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await client.put(`/lessons/${currentLesson.id}`, {
        user_notes: notes
      });
      setSuccessMsg('Note salvate.');
      // Update current lesson to reflect saved state
      setCurrentLesson(prev => ({ ...prev, user_notes: notes }));
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      toast.error('Note non salvate. Riprova.');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleToggleCompletion = async () => {
    try {
      const newCompletedState = !currentLesson.is_completed;
      await client.put(`/lessons/${currentLesson.id}`, {
        is_completed: newCompletedState
      });
      setCurrentLesson(prev => ({ ...prev, is_completed: newCompletedState }));
      // Update generated lessons map
      setGeneratedLessons(prev => ({
        ...prev,
        [currentLesson.path_in_index]: newCompletedState ? 'completed' : 'generated'
      }));
    } catch (err) {
      toast.error('Progresso non aggiornato.');
    }
  };

  const handleRegenerate = async () => {
    if (!regenerateFeedback.trim()) {
      toast.warning('Scrivi cosa migliorare.');
      return;
    }
    setRegenerating(true);
    try {
      const res = await client.post(`/lessons/${currentLesson.id}/regenerate`, {
        feedback: regenerateFeedback
      });
      setCurrentLesson(res.data);
      setSuccessMsg('Lezione rigenerata.');
      setShowRegenerateModal(false);
      setRegenerateFeedback('');
      
      // Poll for new PDF
      if (!res.data.pdf_path) {
        pollForPdf(res.data.id);
      }
    } catch (err) {
      toast.error('Rigenerazione non riuscita.');
    } finally {
      setRegenerating(false);
    }
  };

  const getLessonStatus = (path) => {
    return generatedLessons[path] || 'not-generated';
  };

  const firstMissingLesson = () => {
    for (const m of index) {
      for (const l of (m.lessons || [])) {
        if (getLessonStatus(l.path) === 'not-generated') return l;
      }
    }
    return index[0]?.lessons?.[0] || null;
  };

  const toggleFavorite = async (e, lessonPath) => {
    e.stopPropagation();
    // We need the lesson ID. Find it from the current lesson or fetch it.
    // If the lesson is the currently selected one, use its id
    if (currentLesson && currentLesson.path_in_index === lessonPath) {
      const newVal = !favoriteLessons[lessonPath];
      try {
        await client.put(`/lessons/${currentLesson.id}`, { is_favorite: newVal });
        setFavoriteLessons(prev => ({ ...prev, [lessonPath]: newVal }));
        setCurrentLesson(prev => ({ ...prev, is_favorite: newVal }));
      } catch (err) {
        console.error('Failed to toggle favorite:', err);
      }
    } else {
      // Need to get lesson id - fetch lessons list
      try {
        const res = await client.get(`/courses/${courseId}/lessons`);
        const lesson = res.data.find(l => l.path_in_index === lessonPath);
        if (lesson) {
          const newVal = !favoriteLessons[lessonPath];
          await client.put(`/lessons/${lesson.id}`, { is_favorite: newVal });
          setFavoriteLessons(prev => ({ ...prev, [lessonPath]: newVal }));
        }
      } catch (err) {
        console.error('Failed to toggle favorite:', err);
      }
    }
  };

  const getTotalLessons = () => {
    return index.reduce((acc, module) => acc + module.lessons.length, 0);
  };
  
  const areAllLessonsGenerated = () => {
    const total = getTotalLessons();
    const generated = getGeneratedCount();
    return total > 0 && total === generated;
  };
  
  const areAllLessonsCompleted = () => {
    const total = getTotalLessons();
    const completed = getCompletedCount();
    return total > 0 && total === completed;
  };

  const getGeneratedCount = () => {
    return Object.keys(generatedLessons).length;
  };

  const getCompletedCount = () => {
    return Object.values(generatedLessons).filter(status => status === 'completed').length;
  };

  const handleGenerateAll = async () => {
    if (!await confirmDialog({ title: 'Generare tutte le lezioni?', message: 'Operazione lunga, alcuni minuti.', confirmLabel: 'Genera' })) {
      return;
    }
    
    setGeneratingAll(true);
    setGenerationStatus({ total: 0, completed: 0, failed: 0, in_progress: true });
    
    try {
      const res = await client.post(`/courses/${courseId}/generate-all-lessons`, {
        use_web_research: useWebResearch
      });
      
      if (res.data.to_generate === 0) {
        toast.info('Tutte le lezioni sono già state generate!');
        setGeneratingAll(false);
        setGenerationStatus(null);
        return;
      }
      
      // Start polling for status
      pollGenerationStatus();
    } catch (err) {
      console.error('Failed to start generation:', err);
      toast.error('Errore nell\'avvio della generazione');
      setGeneratingAll(false);
      setGenerationStatus(null);
    }
  };

  const pollGenerationStatus = async () => {
    const interval = setInterval(async () => {
      try {
        const res = await client.get(`/courses/${courseId}/generation-status`);
        setGenerationStatus(res.data);
        
        // Update generated lessons map
        await fetchGeneratedLessons();
        
        if (!res.data.in_progress) {
          clearInterval(interval);
          setGeneratingAll(false);
          
          if (res.data.failed > 0) {
            toast.warning(`Generazione completata con ${res.data.failed} errori.`);
            console.error('Generation errors:', res.data.errors);
          } else {
            setSuccessMsg('Tutte le lezioni generate.');
          }
        }
      } catch (err) {
        console.error('Failed to fetch status:', err);
        clearInterval(interval);
        setGeneratingAll(false);
      }
    }, 2000); // Poll every 2 seconds
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin inline mr-2" />Carico corso...</div>;

  return (
    <div className="flex bg-white dark:bg-gray-900 shadow-2xl rounded-l-3xl overflow-hidden h-full">
      {/* Content Area - Left (Central) */}
      <div className={`flex-1 overflow-y-auto bg-white dark:bg-gray-900 dark:text-gray-100 transition-all duration-300 ${
        isImmersiveMode ? 'py-8' : 'p-12'
      }`} style={isImmersiveMode ? { paddingLeft: '5%', paddingRight: '10%' } : {}}>
        {lessonLoading ? (
          <div className="h-full flex flex-col items-center justify-center space-y-4">
             <Loader2 className="w-16 h-16 text-primary animate-spin" />
             <p className="text-xl font-medium text-gray-500 dark:text-gray-300">La AI sta generando la lezione...</p>
          </div>
        ) : currentLesson ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`${
            isImmersiveMode ? 'w-full' : 'max-w-4xl mx-auto'
          }`}>
            {/* Regenerate Button + Immersive Reader + Favorite */}
            <div className="flex justify-end mb-4 gap-3">
              <button
                onClick={(e) => toggleFavorite(e, currentLesson.path_in_index)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition ${
                  favoriteLessons[currentLesson.path_in_index]
                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
                title={favoriteLessons[currentLesson.path_in_index] ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Star className={`w-4 h-4 ${favoriteLessons[currentLesson.path_in_index] ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                {favoriteLessons[currentLesson.path_in_index] ? 'Nei preferiti' : 'Preferiti'}
              </button>
              <button
                onClick={() => {
                  const newImmersiveMode = !isImmersiveMode;
                  setIsImmersiveMode(newImmersiveMode);
                  setShowRightSidebar(!newImmersiveMode); // Toggle: hide if entering immersive, show if exiting
                  
                  // Notify Layout component via localStorage and custom event
                  localStorage.setItem('immersiveMode', newImmersiveMode.toString());
                  window.dispatchEvent(new Event('immersiveModeChange'));
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition ${
                  isImmersiveMode 
                    ? 'bg-primary text-white hover:bg-indigo-700' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title="Lettura immersiva"
              >
                <Maximize2 className="w-4 h-4" />
                {isImmersiveMode ? 'Esci' : 'Immersiva'}
              </button>
              <button
                onClick={() => setShowRegenerateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              >
                <RefreshCcw className="w-4 h-4" />
                Rigenera
              </button>
            </div>
            
            <div 
              className={`prose dark:prose-invert text-left transition-all duration-300 ${
                isImmersiveMode ? 'prose-lg max-w-[68ch] mx-auto w-full' : ''
              }`}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentLesson.content_markdown}</ReactMarkdown>
            </div>
            
            <hr className="my-12 border-gray-200 dark:border-gray-700" />
            
            <section className="bg-gray-50 dark:bg-gray-800 p-8 rounded-2xl">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <Send className="w-5 h-5 text-primary" />
                Esercizi e note
              </h3>
              <textarea 
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Incolla codice, output o riflessioni..."
                className="w-full h-48 p-4 border dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-primary outline-none transition"
              />
              {notes !== (currentLesson.user_notes || '') && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                  <Loader2 className="w-3 h-3" />
                  Modifiche non salvate
                </p>
              )}
              <div className="mt-6 flex items-center justify-between">
                <div className="flex gap-4">
                  <button 
                    onClick={handleSaveNotes}
                    disabled={savingNotes || notes === (currentLesson.user_notes || '')}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingNotes ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {savingNotes ? 'Salvo...' : 'Salva note'}
                  </button>
                  <button 
                    onClick={handleToggleCompletion}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition ${currentLesson.is_completed ? 'bg-green-100 text-green-700' : 'bg-primary text-white hover:bg-indigo-700'}`}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    {currentLesson.is_completed ? 'Fatto' : 'Segna fatto'}
                  </button>
                   {currentLesson.id && (
                    <>
                      <button
                        onClick={async () => {
                          setViewingPdf(true);
                          try {
                            const response = await client.get(`/lessons/${currentLesson.id}/pdf`, {
                              responseType: 'blob'
                            });
                            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
                            window.open(url, '_blank');
                            setTimeout(() => window.URL.revokeObjectURL(url), 60000);
                          } catch (err) {
                            toast.error('PDF non caricato. Riprova.');
                          } finally {
                            setViewingPdf(false);
                          }
                        }}
                        disabled={viewingPdf}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-xl font-bold hover:bg-indigo-200 dark:hover:bg-indigo-800 transition disabled:opacity-50"
                      >
                        {viewingPdf ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                        {viewingPdf ? 'Genero PDF...' : 'Vedi PDF'}
                      </button>
                      <button
                        onClick={async () => {
                          setDownloadingSinglePdf(true);
                          try {
                            const response = await client.get(`/lessons/${currentLesson.id}/pdf`, {
                              responseType: 'blob'
                            });
                            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
                            const link = document.createElement('a');
                            link.href = url;
                            link.setAttribute('download', `${currentLesson.title}.pdf`);
                            document.body.appendChild(link);
                            link.click();
                            link.parentNode.removeChild(link);
                            window.URL.revokeObjectURL(url);
                          } catch (err) {
                            toast.error('PDF non scaricato. Riprova.');
                          } finally {
                            setDownloadingSinglePdf(false);
                          }
                        }}
                        disabled={downloadingSinglePdf}
                        className="flex items-center gap-2 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition disabled:opacity-50"
                      >
                        {downloadingSinglePdf ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                        {downloadingSinglePdf ? 'Genero PDF...' : 'Scarica PDF'}
                      </button>
                    </>
                  )}
                </div>
                {successMsg && <span className="text-green-600 font-medium">{successMsg}</span>}
              </div>
            </section>
            
            {/* Q&A Section */}
            <section className="mt-12 border-t dark:border-gray-700 pt-12">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <MessageCircle className="w-6 h-6 text-primary" />
                Chiedi alla AI
              </h3>

              <Thread
                items={questions}
                onAsk={handleAskQuestion}
                onDelete={handleDeleteQuestion}
                onChat={handleStartChat}
                asking={askingQuestion}
                deletingId={deletingQuestion}
              />
            </section>
            <ChatPanel chat={chat} onSend={handleChatSend} sending={chatSending} onClose={() => setChat(null)} />
          </motion.div>
        ) : (
          <div className="mx-auto max-w-2xl px-6 py-12">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Panoramica corso</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight dark:text-gray-100">{course?.title}</h2>
            {course?.description && <p className="mt-2 text-gray-500 dark:text-gray-400">{course.description}</p>}
            <div className="tabular mt-4 flex gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span><strong className="text-gray-900 dark:text-gray-100">{getTotalLessons()}</strong> lezioni</span>
              <span>≈ <strong className="text-gray-900 dark:text-gray-100">{Math.max(1, Math.round(getTotalLessons() * 8 / 60))}h</strong> di studio</span>
              <span><strong className="text-gray-900 dark:text-gray-100">{getGeneratedCount()}</strong> pronte</span>
            </div>
            <h3 className="mb-3 mt-8 font-bold dark:text-gray-100">Cosa imparerai</h3>
            <ol className="space-y-2.5">
              {(index || []).map((m, i) => (
                <li key={i} className="flex items-start gap-3 rounded-xl border border-gray-200 p-3.5 dark:border-gray-700">
                  <span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                  <div>
                    <p className="text-sm font-semibold dark:text-gray-100">{m.title}</p>
                    <p className="text-xs text-gray-500">{(m.lessons || []).length} lezioni</p>
                  </div>
                </li>
              ))}
            </ol>
            <button
              onClick={() => { const first = firstMissingLesson(); if (first) selectLesson(first); }}
              className="mt-8 flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 active:scale-[0.98] transition"
            >
              <Zap className="h-4 w-4" /> Genera la prima lezione
            </button>
          </div>
        )}
      </div>

      {/* Index Sidebar - Right */}
      <div className="relative h-full">
        {/* Toggle Button - Always visible, positioned relative to viewport */}
        <button
          onClick={() => {
            setShowRightSidebar(!showRightSidebar);
            if (isImmersiveMode) setIsImmersiveMode(false);
          }}
          className={`fixed right-0 top-1/2 -translate-y-1/2 z-30 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 p-2 rounded-l-lg border border-gray-200 dark:border-gray-700 transition shadow-md ${
            showRightSidebar ? '' : 'translate-x-0'
          }`}
          style={{ right: showRightSidebar ? '320px' : '0' }}
          title={showRightSidebar ? 'Hide Index' : 'Show Index'}
        >
          {showRightSidebar ? (
            <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          )}
        </button>
        
        <div className={`border-l border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 h-full overflow-y-auto transition-all duration-300 ${
          showRightSidebar ? 'w-80 opacity-100' : 'w-0 opacity-0'
        }`}>
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 sticky top-0 bg-gray-50 dark:bg-gray-900 z-10">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Indice del corso</h2>
            <button
              onClick={handleGenerateAll}
              disabled={generatingAll}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                generatingAll 
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                  : 'bg-primary text-white hover:bg-indigo-700 active:scale-[0.98]'
              }`}
              title="Genera tutte le lezioni mancanti in parallelo"
            >
              {generatingAll ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Genero...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>Genera tutto</span>
                </>
              )}
            </button>
          </div>
          <h3 className="text-lg font-extrabold mt-1 dark:text-gray-100">{course.title}</h3>
          
          {/* Web Research Toggle */}
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
            <label className="flex items-center gap-2 cursor-pointer flex-1">
              <input
                type="checkbox"
                checked={useWebResearch}
                onChange={(e) => setUseWebResearch(e.target.checked)}
                disabled={generatingAll}
                className="w-4 h-4 rounded text-primary focus:ring-2 focus:ring-primary/40 cursor-pointer disabled:opacity-50"
              />
              <Globe className={`w-4 h-4 ${useWebResearch ? 'text-primary' : 'text-gray-400'} transition`} />
              <span className="text-xs text-gray-600 dark:text-gray-300">
                Ricerca web
              </span>
            </label>
            {useWebResearch && (
              <span className="text-xs px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-primary dark:text-indigo-300 rounded-full font-semibold">
                Attiva
              </span>
            )}
          </div>
          
          {/* Generation Status */}
          {generationStatus && generationStatus.in_progress && (
            <div className="mt-3 p-3 bg-indigo-50 dark:bg-indigo-950 rounded-lg border border-indigo-200 dark:border-indigo-800">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-indigo-900 dark:text-indigo-300">Generazione in corso...</span>
                <span className="text-indigo-700 dark:text-indigo-400 font-bold">
                  {generationStatus.completed} / {generationStatus.total}
                </span>
              </div>
              <div className="w-full bg-indigo-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${generationStatus.total > 0 ? (generationStatus.completed / generationStatus.total) * 100 : 0}%` }}
                />
              </div>
              {generationStatus.failed > 0 && (
                <p className="text-xs text-red-600 mt-2 font-medium">
                  {generationStatus.failed} errori
                </p>
              )}
            </div>
          )}
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
              <span>Progresso</span>
              <span className="font-semibold">
                <span className="text-green-600 dark:text-green-400">{getCompletedCount()}</span>
                <span className="text-gray-400 dark:text-gray-500 mx-1">/</span>
                <span className="text-blue-600 dark:text-blue-400">{getGeneratedCount()}</span>
                <span className="text-gray-400 dark:text-gray-500 mx-1">/</span>
                <span>{getTotalLessons()}</span>
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 relative overflow-hidden">
              {/* Blue bar for generated lessons */}
              <div 
                className="absolute inset-y-0 left-0 bg-primary/60 transition-all duration-500"
                style={{ width: `${getTotalLessons() > 0 ? (getGeneratedCount() / getTotalLessons()) * 100 : 0}%` }}
              />
              {/* Green bar for completed lessons (on top) */}
              <div 
                className="absolute inset-y-0 left-0 bg-green-500 transition-all duration-500"
                style={{ width: `${getTotalLessons() > 0 ? (getCompletedCount() / getTotalLessons()) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
        
        <div className="p-2">
          <IndexPath
            modules={index.map((m) => ({ title: m.title, items: (m.lessons || []).map((l) => ({ key: l.path, title: l.title, raw: l })) }))}
            getStatus={(key) => getLessonStatus(key)}
            isFav={(key) => favoriteLessons[key]}
            isCurrent={(key) => currentLesson?.path_in_index === key}
            onSelect={(item) => selectLesson(item.raw)}
            onToggleFav={(e, key) => toggleFavorite(e, key)}
          />
        </div>
        
        {/* Download Full PDF Button - Always visible */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 mt-4 space-y-3">
          {/* PDF Download Button */}
          <button
            onClick={async () => {
              if (!areAllLessonsGenerated() || downloadingPdf) return;
              
              setDownloadingPdf(true);
              try {
                const response = await client.get(`/courses/${courseId}/download-full-pdf`, {
                  responseType: 'blob'
                });
                
                // Create download link
                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `${course.title}.pdf`);
                document.body.appendChild(link);
                link.click();
                link.parentNode.removeChild(link);
                window.URL.revokeObjectURL(url);
              } catch (err) {
                console.error('Download failed:', err);
                toast.error('PDF non scaricato. Genera prima tutte le lezioni.');
              } finally {
                setDownloadingPdf(false);
              }
            }}
            disabled={!areAllLessonsGenerated() || downloadingPdf}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition ${
              areAllLessonsGenerated() && !downloadingPdf
                ? 'bg-green-600 text-white hover:bg-green-700 active:scale-[0.98] cursor-pointer' 
                : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
            }`}
            title={areAllLessonsGenerated() ? 'Download complete course as single PDF' : `${getTotalLessons() - getGeneratedCount()} lesson(s) still need to be generated`}
          >
            {downloadingPdf ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                {areAllLessonsGenerated() ? 'Download Complete Course PDF' : `Waiting for ${getTotalLessons() - getGeneratedCount()} lesson(s)...`}
              </>
            )}
          </button>
          
          {/* EPUB Download Button */}
          <button
            onClick={async () => {
              if (!areAllLessonsGenerated() || downloadingEpub) return;
              
              setDownloadingEpub(true);
              try {
                const response = await client.get(`/courses/${courseId}/download-full-epub`, {
                  responseType: 'blob'
                });
                
                // Create download link
                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `${course.title}.epub`);
                document.body.appendChild(link);
                link.click();
                link.parentNode.removeChild(link);
                window.URL.revokeObjectURL(url);
              } catch (err) {
                console.error('Download failed:', err);
                toast.error('EPUB non scaricato. Genera prima tutte le lezioni.');
              } finally {
                setDownloadingEpub(false);
              }
            }}
            disabled={!areAllLessonsGenerated() || downloadingEpub}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition shadow-lg ${
              areAllLessonsGenerated() && !downloadingEpub
                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 hover:shadow-xl cursor-pointer' 
                : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
            }`}
            title={areAllLessonsGenerated() ? 'Download complete course as single EPUB' : `${getTotalLessons() - getGeneratedCount()} lesson(s) still need to be generated`}
          >
            {downloadingEpub ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating EPUB...
              </>
            ) : (
              <>
                <BookOpen className="w-5 h-5" />
                {areAllLessonsGenerated() ? 'Download Complete Course EPUB' : `Waiting for ${getTotalLessons() - getGeneratedCount()} lesson(s)...`}
              </>
            )}
          </button>
        </div>
        </div>
      </div>
      
      {/* Regenerate Modal */}
      {showRegenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full p-8"
          >
            <h3 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Rigenera lezione</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Please describe what you'd like to improve or change in this lesson. The AI will regenerate the content based on your feedback.
            </p>
            <textarea
              value={regenerateFeedback}
              onChange={e => setRegenerateFeedback(e.target.value)}
              placeholder="es. più esempi pratici, spiegazioni semplici, più codice..."
              className="w-full h-40 p-4 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition resize-none"
              disabled={regenerating}
            />
            <div className="flex gap-4 mt-6 justify-end">
              <button
                onClick={() => {
                  setShowRegenerateModal(false);
                  setRegenerateFeedback('');
                }}
                disabled={regenerating}
                className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                onClick={handleRegenerate}
                disabled={regenerating || !regenerateFeedback.trim()}
                className="px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                {regenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Rigenero...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="w-5 h-5" />
                    Rigenera
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
