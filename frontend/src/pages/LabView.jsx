import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronRight, ChevronDown, CheckCircle2, Loader2, Send, BookOpen, FlaskConical, Star, Lightbulb, Terminal, ArrowLeft, Save, RefreshCcw, Maximize2, ChevronLeft, Download, FileText, Zap, MessageCircle, Trash2, Globe, DownloadCloud, RotateCcw, FileText as FileTextIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function LabView() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [index, setIndex] = useState([]);
  const [generatedLabs, setGeneratedLabs] = useState({});
  const [favoriteLabs, setFavoriteLabs] = useState({});
  const [currentLab, setCurrentLab] = useState(null);
  const [labSteps, setLabSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [labLoading, setLabLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showTheory, setShowTheory] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [useWebResearch, setUseWebResearch] = useState(true);
  const [tavilyCredits, setTavilyCredits] = useState(null);
  
  // Immersive Mode & Sidebar
  const [isImmersiveMode, setIsImmersiveMode] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  
  // Generate All Labs
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generationStatus, setGenerationStatus] = useState(null);
  
  // Download loading states
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingEpub, setDownloadingEpub] = useState(false);
  const [viewingLabPdf, setViewingLabPdf] = useState(false);
  const [downloadingLabPdf, setDownloadingLabPdf] = useState(false);
  
  // Regenerate Lab State
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [regenerateFeedback, setRegenerateFeedback] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  
  // Q&A State
  const [questions, setQuestions] = useState([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [askingQuestion, setAskingQuestion] = useState(false);
  const [deletingQuestion, setDeletingQuestion] = useState(null);

  useEffect(() => {
    fetchCourse();
    fetchGeneratedLabs();
    fetchTavilyCredits();
  }, [courseId]);

  const fetchCourse = async () => {
    try {
      const res = await client.get(`/hands-on/${courseId}`);
      setCourse(res.data);
      setIndex(JSON.parse(res.data.index_json));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGeneratedLabs = async () => {
    try {
      const res = await client.get(`/hands-on/${courseId}/labs`);
      const labsMap = {};
      const favoritesMap = {};
      res.data.forEach(lab => {
        labsMap[lab.path_in_index] = lab.is_completed ? 'completed' : 'generated';
        if (lab.is_favorite) {
          favoritesMap[lab.path_in_index] = true;
        }
      });
      setGeneratedLabs(labsMap);
      setFavoriteLabs(favoritesMap);
    } catch (err) {
      console.error('Failed to fetch generated labs:', err);
    }
  };

  const fetchTavilyCredits = async () => {
    try {
      const res = await client.get('/tavily/credits');
      setTavilyCredits(res.data);
    } catch (err) {
      console.error('Failed to fetch Tavily credits:', err);
    }
  };

  const selectLab = async (lab) => {
    setLabLoading(true);
    setSuccessMsg('');
    setQuestions([]);
    try {
      const res = await client.post(`/hands-on/${course.id}/labs/generate`, {
        title: lab.title,
        path_in_index: lab.path,
        use_web_research: useWebResearch
      });
      setCurrentLab(res.data);
      setNotes(res.data.user_notes || '');
      setShowTheory(false); // Start with practice view

      // Parse steps
      try {
        const steps = JSON.parse(res.data.steps_json);
        setLabSteps(Array.isArray(steps) ? steps : []);
      } catch (e) {
        setLabSteps([]);
      }

      // Update generated labs map
      setGeneratedLabs(prev => ({
        ...prev,
        [lab.path]: res.data.is_completed ? 'completed' : 'generated'
      }));
      
      setFavoriteLabs(prev => ({
        ...prev,
        [lab.path]: res.data.is_favorite || false
      }));
      
      // Fetch questions for this lab
      fetchQuestions(res.data.id);
    } catch (err) {
      alert('Failed to load lab content.');
    } finally {
      setLabLoading(false);
    }
  };

  const fetchQuestions = async (labId) => {
    try {
      const res = await client.get(`/hands-on/${courseId}/labs/${labId}/questions`);
      setQuestions(res.data);
    } catch (err) {
      console.error('Failed to fetch questions:', err);
      setQuestions([]);
    }
  };

  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!newQuestion.trim() || !currentLab) return;
    
    setAskingQuestion(true);
    try {
      const res = await client.post(`/hands-on/${courseId}/labs/${currentLab.id}/ask`, {
        question: newQuestion
      });
      setQuestions([res.data, ...questions]);
      setNewQuestion('');
    } catch (err) {
      alert('Failed to ask question. Please try again.');
    } finally {
      setAskingQuestion(false);
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    if (!window.confirm('Sei sicuro di voler eliminare questa domanda?')) return;
    
    setDeletingQuestion(questionId);
    try {
      await client.delete(`/hands-on/${courseId}/labs/${currentLab.id}/questions/${questionId}`);
      setQuestions(questions.filter(q => q.id !== questionId));
    } catch (err) {
      alert('Failed to delete question. Please try again.');
    } finally {
      setDeletingQuestion(null);
    }
  };

  const handleToggleStep = async (stepNumber) => {
    if (!currentLab) return;

    // Optimistic update
    const updatedSteps = labSteps.map(step => 
      step.step_number === stepNumber ? { ...step, is_completed: !step.is_completed } : step
    );
    setLabSteps(updatedSteps);

    try {
      await client.put(`/hands-on/${course.id}/labs/${currentLab.id}`, {
        step_completed: stepNumber
      });
    } catch (err) {
      // Revert on failure
      setLabSteps(labSteps);
      console.error('Failed to update step:', err);
    }
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await client.put(`/hands-on/${course.id}/labs/${currentLab.id}`, {
        user_notes: notes
      });
      setSuccessMsg('Notes saved!');
      setCurrentLab(prev => ({ ...prev, user_notes: notes }));
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert('Failed to save notes.');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleToggleCompletion = async () => {
    if (!currentLab) return;
    const newCompletedState = !currentLab.is_completed;
    try {
      await client.put(`/hands-on/${course.id}/labs/${currentLab.id}`, {
        is_completed: newCompletedState
      });
      setSuccessMsg(newCompletedState ? 'Lab marked as completed!' : 'Lab marked as incomplete!');
      setCurrentLab(prev => ({ ...prev, is_completed: newCompletedState }));
      setGeneratedLabs(prev => ({
        ...prev,
        [currentLab.path_in_index]: newCompletedState ? 'completed' : 'generated'
      }));
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert('Failed to update progress.');
    }
  };

  const toggleFavorite = async (e, labPath) => {
    e.stopPropagation();
    if (currentLab && currentLab.path_in_index === labPath) {
      const newVal = !favoriteLabs[labPath];
      try {
        await client.put(`/hands-on/${course.id}/labs/${currentLab.id}`, { is_favorite: newVal });
        setFavoriteLabs(prev => ({ ...prev, [labPath]: newVal }));
        setCurrentLab(prev => ({ ...prev, is_favorite: newVal }));
      } catch (err) {
        console.error('Failed to toggle favorite:', err);
      }
    } else {
      try {
        const res = await client.get(`/hands-on/${courseId}/labs`);
        const lab = res.data.find(l => l.path_in_index === labPath);
        if (lab) {
          const newVal = !favoriteLabs[labPath];
          await client.put(`/hands-on/${course.id}/labs/${lab.id}`, { is_favorite: newVal });
          setFavoriteLabs(prev => ({ ...prev, [labPath]: newVal }));
        }
      } catch (err) {
        console.error('Failed to toggle favorite:', err);
      }
    }
  };

  const getLabStatus = (path) => {
    return generatedLabs[path] || 'not-generated';
  };

  const getTotalLabs = () => {
    return index.reduce((acc, module) => acc + (module.labs || module.lessons || []).length, 0);
  };

  const getGeneratedCount = () => {
    return Object.keys(generatedLabs).length;
  };

  const areAllLabsGenerated = () => {
    const total = getTotalLabs();
    const generated = getGeneratedCount();
    return total > 0 && total === generated;
  };

  const handleGenerateAll = async () => {
    if (!window.confirm('Vuoi generare tutti i lab mancanti? Questa operazione potrebbe richiedere alcuni minuti.')) {
      return;
    }
    
    setGeneratingAll(true);
    setGenerationStatus({ total: 0, completed: 0, failed: 0, in_progress: true });
    
    try {
      const res = await client.post(`/hands-on/${courseId}/generate-all-labs`, {
        use_web_research: useWebResearch
      });
      
      if (res.data.to_generate === 0) {
        alert('Tutti i lab sono già stati generati!');
        setGeneratingAll(false);
        setGenerationStatus(null);
        return;
      }
      
      pollGenerationStatus();
    } catch (err) {
      console.error('Failed to start generation:', err);
      alert('Errore nell\'avvio della generazione');
      setGeneratingAll(false);
      setGenerationStatus(null);
    }
  };

  const pollGenerationStatus = async () => {
    const interval = setInterval(async () => {
      try {
        const res = await client.get(`/hands-on/${courseId}/generation-status`);
        setGenerationStatus(res.data);
        
        await fetchGeneratedLabs();
        
        if (!res.data.in_progress) {
          clearInterval(interval);
          setGeneratingAll(false);
          
          if (res.data.failed > 0) {
            alert(`Generazione completata con ${res.data.failed} errori. Controlla la console per i dettagli.`);
            console.error('Generation errors:', res.data.errors);
          } else {
            setSuccessMsg('Tutti i lab sono stati generati con successo!');
          }
        }
      } catch (err) {
        console.error('Failed to fetch status:', err);
        clearInterval(interval);
        setGeneratingAll(false);
      }
    }, 2000);
  };

  const handleRegenerateLab = async () => {
    if (!regenerateFeedback.trim()) {
      alert('Please provide feedback on what to improve.');
      return;
    }
    setRegenerating(true);
    try {
      const res = await client.post(`/hands-on/${course.id}/labs/${currentLab.id}/regenerate`, {
        feedback: regenerateFeedback
      });
      setCurrentLab(res.data);
      setSuccessMsg('Lab regenerated successfully!');
      setShowRegenerateModal(false);
      setRegenerateFeedback('');
      
      // Parse steps
      try {
        const steps = JSON.parse(res.data.steps_json);
        setLabSteps(Array.isArray(steps) ? steps : []);
      } catch (e) {
        setLabSteps([]);
      }
    } catch (err) {
      alert('Failed to regenerate lab.');
    } finally {
      setRegenerating(false);
    }
  };

  const completedSteps = labSteps.filter(s => s.is_completed).length;
  const totalSteps = labSteps.length;

  if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin inline mr-2" />Loading lab course...</div>;

  return (
    <div className="flex bg-white dark:bg-gray-900 shadow-2xl rounded-l-3xl overflow-hidden h-full">
      {/* Content Area */}
      <div className={`flex-1 overflow-y-auto bg-white dark:bg-gray-900 dark:text-gray-100 transition-all duration-300 ${
        isImmersiveMode ? 'py-8' : 'p-12'
      }`} style={isImmersiveMode ? { paddingLeft: '5%', paddingRight: '10%' } : {}}>
        {/* Back button */}
        <button
          onClick={() => navigate('/labs')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-orange-500 transition mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Labs
        </button>

        {labLoading ? (
          <div className="h-full flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-16 h-16 text-orange-500 animate-spin" />
            <p className="text-xl font-medium text-gray-500 dark:text-gray-300">Generating your lab session...</p>
          </div>
        ) : currentLab ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`${
            isImmersiveMode ? 'w-full' : 'max-w-4xl mx-auto'
          }`}>
            {/* Action Buttons: Favorite + Immersive Reader + Regenerate */}
            <div className="flex justify-end mb-4 gap-3">
              <button
                onClick={(e) => toggleFavorite(e, currentLab.path_in_index)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition ${
                  favoriteLabs[currentLab.path_in_index]
                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
                title={favoriteLabs[currentLab.path_in_index] ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Star className={`w-4 h-4 ${favoriteLabs[currentLab.path_in_index] ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                {favoriteLabs[currentLab.path_in_index] ? 'Favorited' : 'Favorite'}
              </button>
              <button
                onClick={() => {
                  const newImmersiveMode = !isImmersiveMode;
                  setIsImmersiveMode(newImmersiveMode);
                  setShowRightSidebar(!newImmersiveMode);
                  localStorage.setItem('immersiveMode', newImmersiveMode.toString());
                  window.dispatchEvent(new Event('immersiveModeChange'));
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition ${
                  isImmersiveMode 
                    ? 'bg-orange-500 text-white hover:bg-orange-600' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title="Toggle Immersive Reading Mode"
              >
                <Maximize2 className="w-4 h-4" />
                {isImmersiveMode ? 'Exit Immersive' : 'Immersive Reader'}
              </button>
              <button
                onClick={() => setShowRegenerateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              >
                <RefreshCcw className="w-4 h-4" />
                Regenerate Lab
              </button>
            </div>

            {/* Lab Header */}
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">{currentLab.title}</h2>
              <button
                onClick={handleToggleCompletion}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition ${
                  currentLab.is_completed 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-orange-500 text-white hover:bg-orange-600'
                }`}
              >
                <CheckCircle2 className="w-5 h-5" />
                {currentLab.is_completed ? 'Completed' : 'Mark Complete'}
              </button>
            </div>

            {/* Progress Bar */}
            {totalSteps > 0 && (
              <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium text-gray-700 dark:text-gray-300">Lab Progress</span>
                  <span className="font-bold text-orange-500">{completedSteps}/{totalSteps} steps</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-orange-400 to-red-500 h-full transition-all duration-500 rounded-full"
                    style={{ width: `${totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}

            {/* Theory Section (Collapsible) */}
            <div className="mb-8 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
              <button
                onClick={() => setShowTheory(!showTheory)}
                className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition"
              >
                <div className="flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-blue-500" />
                  <span className="font-bold text-gray-900 dark:text-gray-100">
                    Theory Background {showTheory ? '(hide)' : '(show)'}
                  </span>
                </div>
                {showTheory ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
              </button>
              {showTheory && (
                <div className={`p-6 prose prose-orange max-w-none ${isImmersiveMode ? 'prose-lg' : ''}`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentLab.theory_content}</ReactMarkdown>
                </div>
              )}
            </div>

            {/* Practical Steps */}
            <div className="space-y-4 mb-8">
              <h3 className={`text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100 ${isImmersiveMode ? 'text-2xl' : ''}`}>
                <Terminal className="w-6 h-6 text-orange-500" />
                Practical Steps
              </h3>
              
              {labSteps.length === 0 ? (
                <div className="text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-xl text-gray-500">
                  No practical steps available for this lab.
                </div>
              ) : (
                labSteps.map((step, idx) => (
                  <motion.div
                    key={step.step_number}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`p-5 rounded-xl border-2 transition ${
                      step.is_completed
                        ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-orange-300 dark:hover:border-orange-700'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Step Checkbox */}
                      <button
                        onClick={() => handleToggleStep(step.step_number)}
                        className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition mt-0.5 ${
                          step.is_completed
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-gray-300 dark:border-gray-600 hover:border-orange-500'
                        }`}
                      >
                        {step.is_completed && <CheckCircle2 className="w-4 h-4" />}
                      </button>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                            Step {step.step_number}
                          </span>
                          <h4 className="font-bold text-gray-900 dark:text-gray-100">{step.title}</h4>
                        </div>
                        
                        <p className="text-gray-600 dark:text-gray-300 mb-3">{step.description}</p>
                        
                        {/* Command block */}
                        {step.command && (
                          <div className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-3 rounded-lg mb-3 font-mono text-sm overflow-x-auto">
                            <div className="flex items-center gap-2 mb-1 text-xs text-gray-500">
                              <Terminal className="w-3 h-3" />
                              <span>$ {step.command}</span>
                            </div>
                            {step.expected_output && (
                              <div className="mt-2 pt-2 border-t border-gray-700">
                                <span className="text-xs text-gray-500 block mb-1">Expected output:</span>
                                <span className="text-green-400">{step.expected_output}</span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Hints */}
                        {step.hints && step.hints.length > 0 && (
                          <div className="flex items-start gap-2 mt-2">
                            <Lightbulb className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {step.hints.map((hint, i) => (
                                <span key={i} className="block">{i+1}. {hint}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Notes Section */}
            <hr className="my-8 border-gray-200 dark:border-gray-700" />
            <section className="bg-gray-50 dark:bg-gray-800 p-8 rounded-2xl">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <Send className="w-5 h-5 text-orange-500" />
                Lab Notes & Observations
              </h3>
              <textarea 
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Record your observations, command outputs, errors, or reflections here..."
                className="w-full h-36 p-4 border dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition"
              />
              {notes !== (currentLab.user_notes || '') && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                  <Loader2 className="w-3 h-3" />
                  You have unsaved changes
                </p>
              )}
              <div className="mt-4 flex items-center gap-4 flex-wrap">
                <button 
                  onClick={handleSaveNotes}
                  disabled={savingNotes || notes === (currentLab.user_notes || '')}
                  className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition disabled:opacity-50"
                >
                  {savingNotes ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Save Notes
                </button>
                {currentLab.id && (
                  <>
                    <button
                      onClick={async () => {
                        setViewingLabPdf(true);
                        try {
                          const response = await client.get(`/hands-on/${courseId}/labs/${currentLab.id}/pdf`, {
                            responseType: 'blob'
                          });
                          const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
                          window.open(url, '_blank');
                          setTimeout(() => window.URL.revokeObjectURL(url), 60000);
                        } catch (err) {
                          alert('Failed to load PDF. Please try again.');
                        } finally {
                          setViewingLabPdf(false);
                        }
                      }}
                      disabled={viewingLabPdf}
                      className="flex items-center gap-2 px-6 py-3 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-xl font-bold hover:bg-indigo-200 dark:hover:bg-indigo-800 transition disabled:opacity-50"
                    >
                      {viewingLabPdf ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileTextIcon className="w-5 h-5" />}
                      {viewingLabPdf ? 'Generating PDF...' : 'View PDF'}
                    </button>
                    <button
                      onClick={async () => {
                        setDownloadingLabPdf(true);
                        try {
                          const response = await client.get(`/hands-on/${courseId}/labs/${currentLab.id}/pdf`, {
                            responseType: 'blob'
                          });
                          const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
                          const link = document.createElement('a');
                          link.href = url;
                          link.setAttribute('download', `${currentLab.title}.pdf`);
                          document.body.appendChild(link);
                          link.click();
                          link.parentNode.removeChild(link);
                          window.URL.revokeObjectURL(url);
                        } catch (err) {
                          alert('Failed to download PDF. Please try again.');
                        } finally {
                          setDownloadingLabPdf(false);
                        }
                      }}
                      disabled={downloadingLabPdf}
                      className="flex items-center gap-2 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition disabled:opacity-50"
                    >
                      {downloadingLabPdf ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                      {downloadingLabPdf ? 'Generating PDF...' : 'Download PDF'}
                    </button>
                  </>
                )}
                {successMsg && <span className="text-green-600 font-medium">{successMsg}</span>}
              </div>
            </section>

            {/* Q&A Section */}
            <section className="mt-12 border-t dark:border-gray-700 pt-12">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <MessageCircle className="w-6 h-6 text-orange-500" />
                Ask the AI Assistant
              </h3>
              
              <form onSubmit={handleAskQuestion} className="mb-8">
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Ask a question about this lab..."
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    disabled={askingQuestion}
                    className="flex-1 px-4 py-3 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition"
                  />
                  <button
                    type="submit"
                    disabled={askingQuestion || !newQuestion.trim()}
                    className="px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition"
                  >
                    {askingQuestion ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Asking...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Ask
                      </>
                    )}
                  </button>
                </div>
              </form>
              
              {/* Questions List */}
              <div className="space-y-6">
                {questions.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                    <MessageCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400 font-medium">No questions yet</p>
                    <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Be the first to ask something about this lab!</p>
                  </div>
                ) : (
                  questions.map((qa) => (
                    <motion.div
                      key={qa.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="relative group bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm"
                    >
                      <button
                        onClick={() => handleDeleteQuestion(qa.id)}
                        disabled={deletingQuestion === qa.id}
                        className="absolute top-4 right-4 p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition disabled:opacity-50 opacity-0 group-hover:opacity-100"
                        title="Elimina domanda"
                      >
                        {deletingQuestion === qa.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                      
                      <div className="mb-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                            <span className="text-orange-600 font-bold text-sm">Q</span>
                          </div>
                          <div className="flex-1 pr-8">
                            <p className="text-gray-800 dark:text-gray-200 font-medium">{qa.question}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              {new Date(qa.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 ml-0 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                          <span className="text-green-600 font-bold text-sm">A</span>
                        </div>
                        <div className="flex-1 prose prose-sm max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{qa.answer}</ReactMarkdown>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </section>
          </motion.div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <FlaskConical className="w-24 h-24 mb-4 opacity-10" />
            <p className="text-xl font-medium text-gray-500 dark:text-gray-300">
              Select a lab from the index to start practicing.
            </p>
          </div>
        )}
      </div>

      {/* Index Sidebar */}
      <div className="relative h-full">
        <button
          onClick={() => {
            setShowRightSidebar(!showRightSidebar);
            if (isImmersiveMode) setIsImmersiveMode(false);
          }}
          className={`fixed right-0 top-1/2 -translate-y-1/2 z-30 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 p-2 rounded-l-lg border border-gray-200 dark:border-gray-700 transition shadow-md`}
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
              <div className="flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-orange-500" />
                <h2 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Lab Index</h2>
              </div>
              <button
                onClick={handleGenerateAll}
                disabled={generatingAll}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  generatingAll 
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-orange-500 to-red-600 text-white hover:from-orange-600 hover:to-red-700 shadow-md hover:shadow-lg'
                }`}
                title="Genera tutti i lab mancanti in parallelo"
              >
                {generatingAll ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Generate All</span>
                  </>
                )}
              </button>
            </div>
            <h3 className="text-lg font-extrabold mt-1 dark:text-gray-100">{course?.title || course?.topic}</h3>
            
            {/* Web Research Toggle */}
            <div className="mt-3 flex items-center gap-3 px-3 py-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg border-2 border-orange-100 dark:border-orange-800">
              <label className="flex items-center gap-2 cursor-pointer flex-1">
                <input
                  type="checkbox"
                  checked={useWebResearch}
                  onChange={(e) => setUseWebResearch(e.target.checked)}
                  disabled={generatingAll}
                  className="w-4 h-4 rounded border-2 border-orange-300 dark:border-orange-600 text-orange-600 focus:ring-2 focus:ring-orange-500 focus:ring-offset-0 cursor-pointer disabled:opacity-50"
                />
                <Globe className={`w-4 h-4 ${useWebResearch ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400'} transition`} />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Use web research
                  {tavilyCredits && tavilyCredits.enabled && tavilyCredits.remaining !== undefined && (
                    <span className="block text-[10px] text-gray-500 mt-0.5">
                      {tavilyCredits.remaining} credits remaining
                    </span>
                  )}
                </span>
              </label>
              {useWebResearch && (
                <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-800 text-orange-700 dark:text-orange-300 rounded-full font-medium">
                  Active
                </span>
              )}
            </div>
            
            {/* Generation Status */}
            {generationStatus && generationStatus.in_progress && (
              <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-orange-900 dark:text-orange-300">Generazione in corso...</span>
                  <span className="text-orange-700 dark:text-orange-400 font-bold">
                    {generationStatus.completed} / {generationStatus.total}
                  </span>
                </div>
                <div className="w-full bg-orange-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-orange-500 to-red-600 h-full transition-all duration-500 rounded-full"
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
                <span>Progress</span>
                <span className="font-semibold">
                  <span className="text-green-600 dark:text-green-400">{Object.values(generatedLabs).filter(s => s === 'completed').length}</span>
                  <span className="text-gray-400 mx-1">/</span>
                  <span className="text-blue-600 dark:text-blue-400">{getGeneratedCount()}</span>
                  <span className="text-gray-400 mx-1">/</span>
                  <span>{getTotalLabs()}</span>
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 relative overflow-hidden">
                <div 
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500"
                  style={{ width: `${getTotalLabs() > 0 ? (getGeneratedCount() / getTotalLabs()) * 100 : 0}%` }}
                />
                <div 
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-400 to-green-600 transition-all duration-500"
                  style={{ width: `${getTotalLabs() > 0 ? (Object.values(generatedLabs).filter(s => s === 'completed').length / getTotalLabs()) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
          
          <div className="p-2">
            {index.map((module, mIdx) => (
              <div key={mIdx} className="mb-4">
                <div className="px-4 py-2 font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  {module.title}
                </div>
                <div className="space-y-1">
                  {(module.labs || module.lessons || []).map((lab, lIdx) => {
                    const status = getLabStatus(lab.path);
                    const isFav = favoriteLabs[lab.path];
                    const isTheory = lab.type === 'theory';
                    return (
                      <button
                        key={lIdx}
                        onClick={() => selectLab(lab)}
                        className={`w-full text-left px-4 py-2 pl-10 text-sm transition flex items-center gap-2 group ${
                          currentLab?.path_in_index === lab.path 
                            ? 'bg-orange-500/10 text-orange-600 font-semibold' 
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        {/* Status Badge */}
                        <div className="flex-shrink-0">
                          {status === 'completed' ? (
                            <div className="w-2 h-2 rounded-full bg-green-500" title="Completed" />
                          ) : status === 'generated' ? (
                            <div className="w-2 h-2 rounded-full bg-blue-500" title="Generated" />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" title="Not generated" />
                          )}
                        </div>

                        {/* Favorite Star */}
                        {status !== 'not-generated' && (
                          <span
                            className="flex-shrink-0 cursor-pointer"
                            onClick={(e) => toggleFavorite(e, lab.path)}
                            title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            <Star className={`w-3.5 h-3.5 transition ${isFav ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 dark:text-gray-600 hover:text-yellow-400'}`} />
                          </span>
                        )}

                        {/* Type icon */}
                        {!status || status === 'not-generated' ? (
                          isTheory ? (
                            <BookOpen className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                          ) : (
                            <Terminal className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                          )
                        ) : null}
                        
                        <span className="flex-1 truncate">{lab.title}</span>
                        
                        <span className="flex-shrink-0">
                          {currentLab?.path_in_index === lab.path ? (
                            <ChevronRight className="w-4 h-4" />
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          
          {/* Download PDF/EPUB Buttons */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 mt-4 space-y-3">
            <button
              onClick={async () => {
                if (!areAllLabsGenerated() || downloadingPdf) return;
                setDownloadingPdf(true);
                try {
                  const response = await client.get(`/hands-on/${courseId}/download-full-pdf`, {
                    responseType: 'blob'
                  });
                  const url = window.URL.createObjectURL(new Blob([response.data]));
                  const link = document.createElement('a');
                  link.href = url;
                  link.setAttribute('download', `${course?.title || 'lab-course'}.pdf`);
                  document.body.appendChild(link);
                  link.click();
                  link.parentNode.removeChild(link);
                  window.URL.revokeObjectURL(url);
                } catch (err) {
                  console.error('Download failed:', err);
                  alert('Failed to download full course PDF. Make sure all labs are generated.');
                } finally {
                  setDownloadingPdf(false);
                }
              }}
              disabled={!areAllLabsGenerated() || downloadingPdf}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition shadow-lg ${
                areAllLabsGenerated() && !downloadingPdf
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 hover:shadow-xl cursor-pointer' 
                  : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
              }`}
              title={areAllLabsGenerated() ? 'Download complete course as single PDF' : `${getTotalLabs() - getGeneratedCount()} lab(s) still need to be generated`}
            >
              {downloadingPdf ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  {areAllLabsGenerated() ? 'Download PDF' : `Waiting for ${getTotalLabs() - getGeneratedCount()} lab(s)...`}
                </>
              )}
            </button>
            
            <button
              onClick={async () => {
                if (!areAllLabsGenerated() || downloadingEpub) return;
                setDownloadingEpub(true);
                try {
                  const response = await client.get(`/hands-on/${courseId}/download-full-epub`, {
                    responseType: 'blob'
                  });
                  const url = window.URL.createObjectURL(new Blob([response.data]));
                  const link = document.createElement('a');
                  link.href = url;
                  link.setAttribute('download', `${course?.title || 'lab-course'}.epub`);
                  document.body.appendChild(link);
                  link.click();
                  link.parentNode.removeChild(link);
                  window.URL.revokeObjectURL(url);
                } catch (err) {
                  console.error('Download failed:', err);
                  alert('Failed to download full course EPUB. Make sure all labs are generated.');
                } finally {
                  setDownloadingEpub(false);
                }
              }}
              disabled={!areAllLabsGenerated() || downloadingEpub}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition shadow-lg ${
                areAllLabsGenerated() && !downloadingEpub
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 hover:shadow-xl cursor-pointer' 
                  : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
              }`}
              title={areAllLabsGenerated() ? 'Download complete course as single EPUB' : `${getTotalLabs() - getGeneratedCount()} lab(s) still need to be generated`}
            >
              {downloadingEpub ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating EPUB...
                </>
              ) : (
                <>
                  <BookOpen className="w-5 h-5" />
                  {areAllLabsGenerated() ? 'Download EPUB' : `Waiting for ${getTotalLabs() - getGeneratedCount()} lab(s)...`}
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
            <h3 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Regenerate Lab</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Please describe what you'd like to improve or change in this lab. The AI will regenerate the content based on your feedback.
            </p>
            <textarea
              value={regenerateFeedback}
              onChange={e => setRegenerateFeedback(e.target.value)}
              placeholder="e.g., Add more practical examples, simplify the theory, include more command-line exercises..."
              className="w-full h-40 p-4 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-xl focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition resize-none"
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
                onClick={handleRegenerateLab}
                disabled={regenerating || !regenerateFeedback.trim()}
                className="px-6 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition disabled:opacity-50 flex items-center gap-2"
              >
                {regenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Regenerating...
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
