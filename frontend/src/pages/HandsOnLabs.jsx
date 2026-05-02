import { useState, useEffect } from 'react';
import client from '../api/client';
import { Plus, FlaskConical, Clock, Loader2, Trash2, CheckCircle2, Play, ChevronDown, ChevronUp, Globe, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const PAGE_SIZE = 12;

export default function HandsOnLabs() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTopic, setNewTopic] = useState('');
  const [language, setLanguage] = useState('it');
  const [customLanguage, setCustomLanguage] = useState('');
  const [useWebResearch, setUseWebResearch] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');
  const [showCustomInstructions, setShowCustomInstructions] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [tavilyCredits, setTavilyCredits] = useState(null);
  
  // Pagination state
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchCourses();
    fetchTavilyCredits();
  }, [page]);

  const fetchCourses = async () => {
    try {
      const res = await client.get('/hands-on/', {
        params: { skip: page * PAGE_SIZE, limit: PAGE_SIZE }
      });
      setCourses(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    if (!newTopic) return;
    setCreating(true);
    try {
      const selectedLanguage = language === 'custom' ? customLanguage : language;
      const res = await client.post('/hands-on/', { 
        topic: newTopic, 
        language: selectedLanguage,
        use_web_research: useWebResearch,
        custom_instructions: customInstructions || undefined
      });
      setNewTopic('');
      setCustomInstructions('');
      setShowCustomInstructions(false);
      setUseWebResearch(false);
      // Navigate to the first page and reload list
      setPage(0);
      await fetchCourses();
      // Navigate to the newly created lab course
      navigate(`/labs/${res.data.id}`);
    } catch (err) {
      alert('Failed to create hands-on course: ' + (err.response?.data?.detail || err.message));
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCourse = async (e, courseId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this hands-on course and all its labs? This cannot be undone.')) return;
    setDeleting(courseId);
    try {
      await client.delete(`/hands-on/${courseId}`);
      setCourses(courses.filter(c => c.id !== courseId));
    } catch (err) {
      alert('Failed to delete course.');
    } finally {
      setDeleting(null);
    }
  };

  const handleNavigate = (courseId) => {
    navigate(`/labs/${courseId}`);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-2">
          <FlaskConical className="w-8 h-8 text-orange-500" />
          <h2 className="text-4xl font-extrabold text-gray-900 dark:text-gray-100">Hands-on Labs</h2>
        </div>
        <p className="text-gray-600 dark:text-gray-400 ml-11">
          Create interactive lab courses — 30% theory, 70% hands-on practice.
        </p>
      </header>

      {/* Creation Area */}
      <section className="mb-12">
        <form onSubmit={handleCreateCourse} className="space-y-4">
          <div className="flex gap-4 items-center">
            <input 
              type="text" 
              placeholder="e.g., Docker, Kubernetes, AWS Deployment..."
              value={newTopic}
              onChange={e => setNewTopic(e.target.value)}
              disabled={creating}
              className="flex-1 px-6 py-4 text-lg border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition outline-none shadow-sm"
            />
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-2xl border-2 border-gray-200 dark:border-gray-700">
              <select
                value={language}
                onChange={e => setLanguage(e.target.value)}
                disabled={creating}
                className="bg-transparent outline-none font-medium text-gray-700 dark:text-gray-300"
              >
                <option value="it">🇮🇹 Italiano</option>
                <option value="en">🇬🇧 English</option>
                <option value="custom">✏️ Custom</option>
              </select>
            </div>
            {language === 'custom' && (
              <input 
                type="text" 
                placeholder="e.g., es, fr, de..."
                value={customLanguage}
                onChange={e => setCustomLanguage(e.target.value)}
                disabled={creating}
                className="px-4 py-4 text-sm border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition outline-none shadow-sm w-32"
              />
            )}
            <button 
              type="submit"
              disabled={creating || !newTopic || (language === 'custom' && !customLanguage)}
              className="px-8 py-4 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold rounded-2xl hover:scale-105 active:scale-95 transition flex items-center gap-2 disabled:opacity-50 disabled:hover:scale-100 shadow-lg shadow-orange-500/25"
            >
              {creating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-6 h-6" />}
              {creating ? 'Creating Lab...' : 'Create Lab Course'}
            </button>
          </div>
          
          {/* Custom Instructions */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowCustomInstructions(!showCustomInstructions)}
              disabled={creating}
              className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-orange-500 dark:hover:text-orange-400 transition disabled:opacity-50"
            >
              {showCustomInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showCustomInstructions ? 'Hide' : 'Add'} custom instructions
            </button>
            
            {showCustomInstructions && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  disabled={creating}
                  placeholder="e.g., Focus on cloud deployment scenarios, include CI/CD pipeline exercises..."
                  rows={3}
                  className="w-full px-4 py-3 text-sm border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition outline-none shadow-sm resize-none"
                />
              </motion.div>
            )}
          </div>
          
          {/* Web Research Toggle */}
          <div className="flex items-center gap-3 px-4 py-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl border-2 border-orange-100 dark:border-orange-800">
            <label className="flex items-center gap-3 cursor-pointer flex-1">
              <input
                type="checkbox"
                checked={useWebResearch}
                onChange={(e) => setUseWebResearch(e.target.checked)}
                disabled={creating}
                className="w-5 h-5 rounded border-2 border-orange-300 dark:border-orange-600 text-orange-600 focus:ring-2 focus:ring-orange-500 focus:ring-offset-0 cursor-pointer disabled:opacity-50"
              />
              <Globe className={`w-5 h-5 ${useWebResearch ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400'} transition`} />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enrich with web research
                {tavilyCredits && tavilyCredits.enabled && tavilyCredits.remaining !== undefined && (
                  <span className="ml-2 text-xs text-gray-500">
                    ({tavilyCredits.remaining} credits remaining)
                  </span>
                )}
              </span>
            </label>
          </div>
        </form>
      </section>

      {/* Course List */}
      <section>
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2 dark:text-gray-100">
          <Play className="w-6 h-6 text-orange-500" />
          My Lab Courses
        </h3>
        
        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="animate-spin w-12 h-12 text-gray-300" /></div>
        ) : courses.length === 0 ? (
          <div className="text-center p-12 bg-gray-100 dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400">
            <FlaskConical className="w-16 h-16 mx-auto mb-4 opacity-30" />
            You haven't created any lab courses yet. Type a topic above to get started.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course, idx) => (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="relative group"
                >
                  <div 
                    onClick={() => handleNavigate(course.id)}
                    className={`block p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-xl hover:shadow-orange-500/5 transition border-2 cursor-pointer ${
                      course.all_labs_completed 
                        ? 'border-green-500 shadow-green-100' 
                        : 'border-gray-100 dark:border-gray-700'
                    }`}
                  >
                    <h4 className="text-2xl font-bold mb-4 group-hover:text-orange-500 transition pr-8 dark:text-gray-100">{course.title}</h4>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-3">
                      <Clock className="w-4 h-4" />
                      <span>Created {new Date(course.created_at).toLocaleDateString()}</span>
                    </div>
                    {course.total_labs > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-orange-500 font-medium">{course.completed_labs}/{course.total_labs}</span>
                        <span className="text-gray-400">labs completed</span>
                      </div>
                    )}
                    {course.all_labs_completed && (
                      <div className="mt-2 flex items-center gap-1 text-green-600 text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>All labs completed!</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Delete Button */}
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 z-10">
                    <button
                      onClick={(e) => handleDeleteCourse(e, course.id)}
                      disabled={deleting === course.id}
                      className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition disabled:opacity-50"
                      title="Delete lab course"
                    >
                      {deleting === course.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-10">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-750 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-750 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}