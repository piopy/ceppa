import { useState, useEffect } from 'react';
import client from '../api/client';
import { toast } from 'sonner';
import { CardSkeleton, Empty, confirmDialog, promptDialog } from '../components/ui';
import { Plus, BookOpen, Clock, Loader2, Languages, Trash2, Pencil, CheckCircle2, GripVertical, Globe, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable Course Card Component
function SortableCourseCard({ course, onDelete, onRename, deleting, renaming, idx, onNavigate }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: course.id 
  });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms ease',
    opacity: isDragging ? 0.6 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    scale: isDragging ? '1.05' : '1',
    zIndex: isDragging ? 1000 : 'auto',
    boxShadow: isDragging ? '0 20px 40px rgba(0,0,0,0.3)' : 'none',
  };
  
  const handleClick = (e) => {
    // Prevent navigation if clicking on buttons or during drag
    if (isDragging) return;
    if (e.target.closest('button')) return;
    
    e.preventDefault();
    e.stopPropagation();
    onNavigate(course.id);
  };
  
  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.1 }}
      className="relative group"
    >
      <div 
        onClick={handleClick}
        className={`block p-6 bg-white dark:bg-gray-800 rounded-2xl transition border cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gray-900/5 dark:hover:shadow-black/30 ${
          course.all_lessons_completed 
            ? 'border-green-500/60' 
            : 'border-gray-200 dark:border-gray-700'
        } ${isDragging ? 'ring-4 ring-primary/30 border-primary' : ''}`}
      >
        <div className="flex items-start justify-between gap-3">
          <h4 className="text-xl font-bold leading-snug tracking-tight dark:text-gray-100">{course.title}</h4>
          {course.all_lessons_completed && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-300">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Fatto
            </span>
          )}
        </div>
        {(course.total_lessons > 0) && (
          <div className="tabular mt-3 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span><strong className="text-gray-800 dark:text-gray-200">{course.total_lessons}</strong> lezioni</span>
            <span aria-hidden className="h-3 w-px bg-gray-200 dark:bg-gray-700" />
            <span>≈ <strong className="text-gray-800 dark:text-gray-200">{course.total_lessons >= 8 ? `${Math.round(course.total_lessons * 8 / 60 * 10) / 10}h` : `${course.total_lessons * 8}min`}</strong></span>
          </div>
        )}
        {(course.total_lessons > 0) && (
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-xs">
              <span className="font-medium text-gray-500 dark:text-gray-400">Progresso</span>
              <span className="tabular font-semibold text-gray-700 dark:text-gray-300">{course.completed_lessons}/{course.total_lessons}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
              <div
                className={`h-full rounded-full transition-all ${course.all_lessons_completed ? 'bg-green-500' : 'bg-primary'}`}
                style={{ width: `${course.total_lessons ? (course.completed_lessons / course.total_lessons) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
        <div className="mt-4 flex items-center gap-1.5 text-[13px] text-gray-400 dark:text-gray-500">
          <Clock className="w-3.5 h-3.5" />
          <span>{new Date(course.created_at).toLocaleDateString()}</span>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 z-10">
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRename(e, course.id);
          }}
          disabled={renaming === course.id}
          className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition disabled:opacity-50"
          title="Rinomina corso"
        >
          {renaming === course.id ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Pencil className="w-4 h-4" />
          )}
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(e, course.id);
          }}
          disabled={deleting === course.id}
          className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition disabled:opacity-50"
          title="Elimina corso"
        >
          {deleting === course.id ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </button>
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTopic, setNewTopic] = useState('');
  const [language, setLanguage] = useState('it');
  const [customLanguage, setCustomLanguage] = useState('');
  const [useWebResearch, setUseWebResearch] = useState(true);
  const [customInstructions, setCustomInstructions] = useState('');
  const [showCustomInstructions, setShowCustomInstructions] = useState(false);
  const [tavilyCredits, setTavilyCredits] = useState(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [newCourseName, setNewCourseName] = useState('');
  const [activeDragId, setActiveDragId] = useState(null);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [totalCourses, setTotalCourses] = useState(0);
  const PAGE_SIZE = 9; // 3x3 grid

  useEffect(() => {
    fetchCourses();
    fetchTavilyCredits();
  }, [page]); // Re-fetch when page changes

  const fetchCourses = async () => {
    try {
      const res = await client.get('/courses/', {
        params: {
          skip: (page - 1) * PAGE_SIZE,
          limit: PAGE_SIZE
        }
      });
      setCourses(res.data.items);
      setTotalCourses(res.data.total);
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
      setTavilyCredits(null);
    }
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    if (!newTopic) return;
    setCreating(true);
    try {
      const selectedLanguage = language === 'custom' ? customLanguage : language;
      await client.post('/courses/', { 
        topic: newTopic, 
        language: selectedLanguage,
        use_web_research: useWebResearch,
        custom_instructions: customInstructions || undefined
      });
      setNewTopic('');
      setCustomInstructions('');
      setShowCustomInstructions(false);
      setUseWebResearch(false); // Reset toggle after creation
      fetchCourses();
      // Refresh Tavily credits if web research was used
      if (useWebResearch) {
        fetchTavilyCredits();
      }
    } catch (err) {
      toast.error('Generazione non riuscita. Controlla API key e backend.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCourse = async (e, courseId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!await confirmDialog({ title: 'Eliminare corso?', message: 'Corso e lezioni verranno eliminati. Non si può annullare.', confirmLabel: 'Elimina', danger: true })) {
      return;
    }
    setDeleting(courseId);
    try {
      await client.delete(`/courses/${courseId}`);
      setCourses(courses.filter(c => c.id !== courseId));
      toast.success('Corso eliminato.');
    } catch (err) {
      toast.error('Eliminazione non riuscita.');
    } finally {
      setDeleting(null);
    }
  };

  const handleRenameCourse = async (e, courseId) => {
    e.preventDefault();
    e.stopPropagation();
    const currentCourse = courses.find(c => c.id === courseId);
    const name = await promptDialog({ title: 'Rinomina corso', initial: currentCourse?.title ?? '', placeholder: 'Nome corso' });
    if (!name || name === currentCourse?.title) return;
    
    setRenaming(courseId);
    try {
      const res = await client.put(`/courses/${courseId}`, { title: name });
      setCourses(courses.map(c => c.id === courseId ? { ...c, title: res.data.title } : c));
    } catch (err) {
      toast.error('Rinomina non riuscita.');
    } finally {
      setRenaming(null);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts (prevents accidental drags)
      },
    })
  );

  const handleDragStart = (event) => {
    setActiveDragId(event.active.id);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    setActiveDragId(null);
    
    // Prevent any default behavior that might cause page refresh
    if (event.nativeEvent) {
      event.nativeEvent.preventDefault?.();
      event.nativeEvent.stopPropagation?.();
    }
    
    // CRITICAL: Exit early for any non-move scenario
    if (!active || !over) {
      return;
    }
    
    if (active.id === over.id) {
      return;
    }
    
    const oldIndex = courses.findIndex(c => c.id === active.id);
    const newIndex = courses.findIndex(c => c.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) {
      return;
    }
    
    if (oldIndex === newIndex) {
      return;
    }
    
    const newOrder = arrayMove(courses, oldIndex, newIndex);
    const oldOrder = [...courses]; // Save for rollback
    
    // Optimistic update
    setCourses(newOrder);
    
    // Save order to backend - send just array of IDs
    try {
      await client.put('/courses/reorder', { 
        course_order: newOrder.map(c => c.id) 
      });
    } catch (err) {
      toast.error('Ordine non salvato. Ripristino...');
      // Rollback on error
      setCourses(oldOrder);
    }
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
  };
  
  const handleNavigateToCourse = (courseId) => {
    navigate(`/course/${courseId}`);
  };
  
  const activeCourse = activeDragId ? courses.find(c => c.id === activeDragId) : null;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-10">
        <h2 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">Cosa impari oggi?</h2>
        <p className="mt-2 text-gray-500 dark:text-gray-400">Descrivi un argomento, la AI costruisce il corso.</p>
      </header>

      {/* Creation Area */}
      <section className="mb-12">
        <form onSubmit={handleCreateCourse} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="text"
              placeholder="es. Fisica quantistica, Terraform, cucina italiana..."
              aria-label="Argomento del corso"
              value={newTopic}
              onChange={e => setNewTopic(e.target.value)}
              disabled={creating}
              className="flex-1 px-4 py-3 text-[15px] bg-transparent outline-none placeholder:text-gray-400 dark:text-gray-100"
            />
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 dark:bg-gray-700">
                <Languages className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <select
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                  disabled={creating}
                  aria-label="Lingua del corso"
                  className="bg-transparent text-sm font-medium outline-none text-gray-700 dark:text-gray-300"
                >
                  <option value="it">🇮🇹 Italiano</option>
                  <option value="en">🇬🇧 English</option>
                  <option value="custom">✏️ Custom</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={creating || !newTopic || (language === 'custom' && !customLanguage)}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 active:scale-[0.98] transition disabled:opacity-50"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {creating ? 'Genero...' : 'Crea corso'}
              </button>
            </div>
          </div>
          {language === 'custom' && (
            <input
              type="text"
              placeholder="es. es, fr, de..."
              value={customLanguage}
              onChange={e => setCustomLanguage(e.target.value)}
              disabled={creating}
              className="mt-3 w-40 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg outline-none focus:border-primary"
            />
          )}

          {/* Custom Instructions Section */}
          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={() => setShowCustomInstructions(!showCustomInstructions)}
              disabled={creating}
              className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition disabled:opacity-50"
            >
              {showCustomInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showCustomInstructions ? 'Nascondi' : 'Aggiungi'} istruzioni custom
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
                  placeholder="es. esempi pratici, linguaggio semplice, livello avanzato..."
                  rows={3}
                  className="w-full px-4 py-3 text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl focus:border-primary outline-none transition resize-none"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Guidano la AI nella generazione dei contenuti.
                </p>
              </motion.div>
            )}
          </div>
          
          {/* Web Research Toggle */}
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700">
            <label className="flex items-center gap-3 cursor-pointer flex-1">
              <input
                type="checkbox"
                checked={useWebResearch}
                onChange={(e) => setUseWebResearch(e.target.checked)}
                disabled={creating}
                className="w-4 h-4 rounded text-primary focus:ring-2 focus:ring-primary/40 cursor-pointer disabled:opacity-50"
              />
              <Globe className={`w-4 h-4 ${useWebResearch ? 'text-primary' : 'text-gray-400'} transition`} />
              <span className="text-sm text-gray-600 dark:text-gray-300">
                Arricchisci con ricerca web
                <span className="tabular ml-2 text-xs text-gray-400">
                  (1 credito Tavily
                  {tavilyCredits && tavilyCredits.enabled && tavilyCredits.remaining !== undefined && (
                    <> · <span className={`font-semibold ${tavilyCredits.remaining < 100 ? 'text-orange-600 dark:text-orange-400' : ''}`}>
                      {tavilyCredits.remaining} rimasti
                    </span></>
                  )}
                  )
                </span>
              </span>
            </label>
            {useWebResearch && (
              <span className="text-xs px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-primary dark:text-indigo-300 rounded-full font-semibold">
                Attiva
              </span>
            )}
          </div>
        </form>
      </section>

      {/* Course List */}
      <section>
        <h3 className="text-lg font-bold mb-5 tracking-tight dark:text-gray-100">
          I tuoi percorsi
        </h3>
        
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : courses.length === 0 ? (
          <Empty
            icon={<BookOpen className="h-10 w-10" />}
            title="Nessun corso ancora"
            hint="Scrivi un argomento sopra e premi Crea corso."
          />
        ) : (
          <>
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <SortableContext 
                items={courses.map(c => c.id)} 
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {courses.map((course, idx) => (
                    <SortableCourseCard
                      key={course.id}
                      course={course}
                      idx={idx}
                      onDelete={handleDeleteCourse}
                      onRename={handleRenameCourse}
                      onNavigate={handleNavigateToCourse}
                      deleting={deleting}
                      renaming={renaming}
                    />
                  ))}
                </div>
              </SortableContext>
              
              {/* DragOverlay - Card that follows mouse */}
              <DragOverlay>
                {activeCourse ? (
                  <div 
                    className={`p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border-2 border-primary ring-4 ring-primary/30 ${
                      activeCourse.all_lessons_completed 
                        ? 'border-green-500' 
                        : ''
                    }`}
                    style={{ width: '300px', cursor: 'grabbing' }}
                  >
                    <h4 className="text-2xl font-bold mb-4 text-primary dark:text-gray-100">{activeCourse.title}</h4>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <Clock className="w-4 h-4" />
                      <span>Iniziato il {new Date(activeCourse.created_at).toLocaleDateString()}</span>
                    </div>
                    {activeCourse.all_lessons_completed && (
                      <div className="mt-3 flex items-center gap-1 text-green-600 text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Fatto</span>
                      </div>
                    )}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
            
            {/* Pagination Controls */}
            {totalCourses > PAGE_SIZE && (
              <div className="mt-8 flex items-center justify-center gap-4">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition disabled:opacity-50 disabled:cursor-not-allowed bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Indietro
                </button>
                
                <div className="flex items-center gap-2">
                  {Array.from({ length: Math.ceil(totalCourses / PAGE_SIZE) }, (_, i) => i + 1).map(pageNum => (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-10 h-10 rounded-xl font-semibold transition ${
                        pageNum === page
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}
                </div>
                
                <button
                  onClick={() => setPage(p => Math.min(Math.ceil(totalCourses / PAGE_SIZE), p + 1))}
                  disabled={page >= Math.ceil(totalCourses / PAGE_SIZE)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition disabled:opacity-50 disabled:cursor-not-allowed bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  Avanti
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
