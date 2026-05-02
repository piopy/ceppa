import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronRight, ChevronDown, CheckCircle2, Loader2, Send, BookOpen, FlaskConical, Star, Lightbulb, Terminal, ArrowLeft, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function LabView() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [index, setIndex] = useState([]);
  const [generatedLabs, setGeneratedLabs] = useState({});
  const [currentLab, setCurrentLab] = useState(null);
  const [labSteps, setLabSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [labLoading, setLabLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showTheory, setShowTheory] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [useWebResearch, setUseWebResearch] = useState(true);

  useEffect(() => {
    fetchCourse();
    fetchGeneratedLabs();
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
      res.data.forEach(lab => {
        labsMap[lab.path_in_index] = lab.is_completed ? 'completed' : 'generated';
      });
      setGeneratedLabs(labsMap);
    } catch (err) {
      console.error('Failed to fetch generated labs:', err);
    }
  };

  const selectLab = async (lab) => {
    setLabLoading(true);
    setSuccessMsg('');
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
    } catch (err) {
      alert('Failed to load lab content.');
    } finally {
      setLabLoading(false);
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

  const getLabStatus = (path) => {
    return generatedLabs[path] || 'not-generated';
  };

  const completedSteps = labSteps.filter(s => s.is_completed).length;
  const totalSteps = labSteps.length;

  if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin inline mr-2" />Loading lab course...</div>;

  return (
    <div className="flex bg-white dark:bg-gray-900 shadow-2xl rounded-l-3xl overflow-hidden h-full">
      {/* Content Area */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900 dark:text-gray-100 p-12">
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
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto">
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
                <div className="p-6 prose prose-indigo max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentLab.theory_content}</ReactMarkdown>
                </div>
              )}
            </div>

            {/* Practical Steps */}
            <div className="space-y-4 mb-8">
              <h3 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
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
              <div className="mt-4 flex items-center gap-4">
                <button 
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition disabled:opacity-50"
                >
                  {savingNotes ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Save Notes
                </button>
                {successMsg && <span className="text-green-600 font-medium">{successMsg}</span>}
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
        <div className="border-l border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 h-full overflow-y-auto w-80">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 sticky top-0 bg-gray-50 dark:bg-gray-900 z-10">
            <div className="flex items-center gap-2 mb-2">
              <FlaskConical className="w-5 h-5 text-orange-500" />
              <h2 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Lab Index</h2>
            </div>
            <h3 className="text-lg font-extrabold mt-1 dark:text-gray-100">{course?.title || course?.topic}</h3>
            
            {/* Progress Bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                <span>Progress</span>
                <span className="font-semibold">
                  {Object.values(generatedLabs).filter(s => s === 'completed').length}
                  <span className="text-gray-400 mx-1">/</span>
                  {Object.keys(generatedLabs).length}
                  <span className="text-gray-400 mx-1">/</span>
                  {index.reduce((acc, m) => acc + (m.labs?.length || 0), 0)}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 relative overflow-hidden">
                <div 
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-orange-400 to-red-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, (Object.keys(generatedLabs).length / Math.max(1, index.reduce((acc, m) => acc + (m.labs?.length || 0), 0))) * 100)}%` }}
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
                    const isTheory = lab.type === 'theory';
                    return (
                      <button
                        key={lIdx}
                        onClick={() => selectLab(lab)}
                        className={`w-full text-left px-4 py-2 pl-10 text-sm transition flex items-center gap-2 ${
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

                        {/* Type icon */}
                        {isTheory ? (
                          <BookOpen className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                        ) : (
                          <Terminal className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                        )}
                        
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
        </div>
      </div>
    </div>
  );
}