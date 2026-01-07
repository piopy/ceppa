import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import ReactMarkdown from 'react-markdown';
import { ChevronRight, ChevronDown, CheckCircle2, Download, RefreshCcw, Loader2, Send, BookOpen, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CourseView() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [index, setIndex] = useState([]);
  const [generatedLessons, setGeneratedLessons] = useState({});
  const [currentLesson, setCurrentLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Get the base URL for media files
  const API_BASE_URL = client.defaults.baseURL.replace('/api/v1', '');
  const MEDIA_URL = `${API_BASE_URL}/media`;

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
      res.data.forEach(lesson => {
        lessonsMap[lesson.path_in_index] = lesson.is_completed ? 'completed' : 'generated';
      });
      setGeneratedLessons(lessonsMap);
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
        path_in_index: lesson.path
      });
      setCurrentLesson(res.data);
      setNotes(res.data.user_notes || '');
      // Update generated lessons map
      setGeneratedLessons(prev => ({
        ...prev,
        [lesson.path]: res.data.is_completed ? 'completed' : 'generated'
      }));
      
      // If PDF not ready yet, poll for it
      if (!res.data.pdf_path) {
        pollForPdf(res.data.id);
      }
    } catch (err) {
      alert('Failed to load lesson content.');
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

  const handleUpdate = async () => {
    try {
      await client.put(`/lessons/${currentLesson.id}`, {
        user_notes: notes,
        is_completed: true
      });
      setSuccessMsg('Lesson marked as completed!');
      setCurrentLesson(prev => ({ ...prev, is_completed: true }));
      // Update generated lessons map
      setGeneratedLessons(prev => ({
        ...prev,
        [currentLesson.path_in_index]: 'completed'
      }));
    } catch (err) {
      alert('Failed to update progress.');
    }
  };

  const getLessonStatus = (path) => {
    return generatedLessons[path] || 'not-generated';
  };

  const getTotalLessons = () => {
    return index.reduce((acc, module) => acc + module.lessons.length, 0);
  };

  const getGeneratedCount = () => {
    return Object.keys(generatedLessons).length;
  };

  const getCompletedCount = () => {
    return Object.values(generatedLessons).filter(status => status === 'completed').length;
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin inline mr-2" />Loading course...</div>;

  return (
    <div className="flex bg-white shadow-2xl rounded-l-3xl overflow-hidden h-full">
      {/* Content Area - Left (Central) */}
      <div className="flex-1 overflow-y-auto p-12 bg-white">
        {lessonLoading ? (
          <div className="h-full flex flex-col items-center justify-center space-y-4">
             <Loader2 className="w-16 h-16 text-primary animate-spin" />
             <p className="text-xl font-medium text-gray-500">LLM is generating your deep lesson...</p>
          </div>
        ) : currentLesson ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto">
            <div className="prose prose-indigo max-w-none">
              <ReactMarkdown>{currentLesson.content_markdown}</ReactMarkdown>
            </div>
            
            <hr className="my-12" />
            
            <section className="bg-gray-50 p-8 rounded-2xl">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Send className="w-5 h-5 text-primary" />
                Exercise Results & Notes
              </h3>
              <textarea 
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Paste your code, output, or reflection here..."
                className="w-full h-48 p-4 border rounded-xl focus:ring-2 focus:ring-primary outline-none transition"
              />
              <div className="mt-6 flex items-center justify-between">
                <div className="flex gap-4">
                  <button 
                    onClick={handleUpdate}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition ${currentLesson.is_completed ? 'bg-green-100 text-green-700' : 'bg-primary text-white hover:bg-indigo-700'}`}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    {currentLesson.is_completed ? 'Completed' : 'Mark as Completed'}
                  </button>
                  {currentLesson.pdf_path && (
                    <>
                      <button
                        onClick={() => window.open(`${MEDIA_URL}/${currentLesson.pdf_path}`, '_blank')}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-100 text-indigo-700 rounded-xl font-bold hover:bg-indigo-200 transition"
                      >
                        <FileText className="w-5 h-5" />
                        View PDF
                      </button>
                      <a 
                        href={`${MEDIA_URL}/${currentLesson.pdf_path}`} 
                        download
                        className="flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition"
                      >
                        <Download className="w-5 h-5" />
                        Download PDF
                      </a>
                    </>
                  )}
                </div>
                {successMsg && <span className="text-green-600 font-medium">{successMsg}</span>}
              </div>
            </section>
          </motion.div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <BookOpen className="w-24 h-24 mb-4 opacity-10" />
            <p className="text-xl font-medium">Select a lesson from the index to start learning.</p>
          </div>
        )}
      </div>

      {/* Index Sidebar - Right */}
      <div className="w-80 border-l border-gray-100 bg-gray-50 overflow-y-auto">
        <div className="p-6 border-b border-gray-100 sticky top-0 bg-gray-50 z-10">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Course Curriculum</h2>
          <h3 className="text-lg font-extrabold mt-1">{course.title}</h3>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Progress</span>
              <span className="font-semibold">
                <span className="text-green-600">{getCompletedCount()}</span>
                <span className="text-gray-400 mx-1">/</span>
                <span className="text-blue-600">{getGeneratedCount()}</span>
                <span className="text-gray-400 mx-1">/</span>
                <span>{getTotalLessons()}</span>
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 relative overflow-hidden">
              {/* Blue bar for generated lessons */}
              <div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500"
                style={{ width: `${getTotalLessons() > 0 ? (getGeneratedCount() / getTotalLessons()) * 100 : 0}%` }}
              />
              {/* Green bar for completed lessons (on top) */}
              <div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-400 to-green-600 transition-all duration-500"
                style={{ width: `${getTotalLessons() > 0 ? (getCompletedCount() / getTotalLessons()) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
        
        <div className="p-2">
          {index.map((module, mIdx) => (
            <div key={mIdx} className="mb-4">
              <div className="px-4 py-2 font-bold text-gray-800 flex items-center gap-2">
                <ChevronDown className="w-4 h-4 text-gray-400" />
                {module.title}
              </div>
              <div className="space-y-1">
                {module.lessons.map((lesson, lIdx) => {
                  const status = getLessonStatus(lesson.path);
                  return (
                    <button
                      key={lIdx}
                      onClick={() => selectLesson(lesson)}
                      className={`w-full text-left px-4 py-2 pl-10 text-sm transition flex items-center gap-2 group overflow-hidden ${currentLesson?.path_in_index === lesson.path ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-gray-100 text-gray-600'}`}
                    >
                      {/* Status Badge */}
                      <div className="flex-shrink-0">
                        {status === 'completed' ? (
                          <div className="w-2 h-2 rounded-full bg-green-500" title="Completed" />
                        ) : status === 'generated' ? (
                          <div className="w-2 h-2 rounded-full bg-blue-500" title="Generated" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-gray-300" title="Not generated" />
                        )}
                      </div>
                      
                      <span className="whitespace-nowrap transition-transform duration-[3000ms] ease-linear group-hover:-translate-x-full flex-1">
                        {lesson.title}
                      </span>
                      
                      <span className="flex-shrink-0 ml-2">
                        {currentLesson?.path_in_index === lesson.path ? (
                          <ChevronRight className="w-4 h-4" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-200 group-hover:bg-primary transition" />
                        )}
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
  );
}
