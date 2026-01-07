import { useState, useEffect } from 'react';
import client from '../api/client';
import { Plus, BookOpen, Clock, Loader2, Languages } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTopic, setNewTopic] = useState('');
  const [language, setLanguage] = useState('it');
  const [customLanguage, setCustomLanguage] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const res = await client.get('/courses/');
      setCourses(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    if (!newTopic) return;
    setCreating(true);
    try {
      const selectedLanguage = language === 'custom' ? customLanguage : language;
      await client.post('/courses/', { topic: newTopic, language: selectedLanguage });
      setNewTopic('');
      fetchCourses();
    } catch (err) {
      alert('Generation failed. Check your API key/Backend.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-12">
        <h2 className="text-4xl font-extrabold text-gray-900 mb-2">Welcome back!</h2>
        <p className="text-gray-600">What do you want to learn today?</p>
      </header>

      {/* Creation Area */}
      <section className="mb-12">
        <form onSubmit={handleCreateCourse} className="space-y-4">
          <div className="flex gap-4 items-center">
            <input 
              type="text" 
              placeholder="e.g., Quantum Physics, Terraform, Italian Cooking..."
              value={newTopic}
              onChange={e => setNewTopic(e.target.value)}
              disabled={creating}
              className="flex-1 px-6 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/10 transition outline-none shadow-sm"
            />
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-2xl border-2 border-gray-200">
              <Languages className="w-5 h-5 text-gray-600" />
              <select
                value={language}
                onChange={e => setLanguage(e.target.value)}
                disabled={creating}
                className="bg-transparent outline-none font-medium text-gray-700"
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
                className="px-4 py-4 text-sm border-2 border-gray-200 rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/10 transition outline-none shadow-sm w-32"
              />
            )}
            <button 
              type="submit"
              disabled={creating || !newTopic || (language === 'custom' && !customLanguage)}
              className="px-8 py-4 bg-primary text-white font-bold rounded-2xl hover:scale-105 active:scale-95 transition flex items-center gap-2 disabled:opacity-50 disabled:hover:scale-100 shadow-lg shadow-primary/25"
            >
              {creating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-6 h-6" />}
              {creating ? 'Generating Index...' : 'Learn Now'}
            </button>
          </div>
        </form>
      </section>

      {/* Course List */}
      <section>
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-primary" />
          My Learning Paths
        </h3>
        
        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="animate-spin w-12 h-12 text-gray-300" /></div>
        ) : courses.length === 0 ? (
          <div className="text-center p-12 bg-gray-100 rounded-2xl border-2 border-dashed border-gray-300 text-gray-500">
            You haven't started any courses yet. Type a topic above to begin.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course, idx) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                key={course.id}
              >
                <Link 
                  to={`/course/${course.id}`}
                  className="block p-6 bg-white rounded-2xl shadow-sm hover:shadow-xl hover:shadow-primary/5 transition group border border-gray-100"
                >
                  <h4 className="text-2xl font-bold mb-4 group-hover:text-primary transition">{course.title}</h4>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock className="w-4 h-4" />
                    <span>Started {new Date(course.created_at).toLocaleDateString()}</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
