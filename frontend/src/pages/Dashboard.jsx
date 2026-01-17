import { useState, useEffect } from 'react';
import client from '../api/client';
import { Plus, BookOpen, Clock, Loader2, Languages, Trash2, Pencil, CheckCircle2, GripVertical } from 'lucide-react';
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
        className={`block p-6 bg-white rounded-2xl shadow-sm hover:shadow-xl hover:shadow-primary/5 transition border-2 ${
          course.all_lessons_completed 
            ? 'border-green-500 shadow-green-100' 
            : 'border-gray-100'
        } ${isDragging ? 'ring-4 ring-primary/30 border-primary' : ''}`}
      >
        <h4 className="text-2xl font-bold mb-4 group-hover:text-primary transition pr-8">{course.title}</h4>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock className="w-4 h-4" />
          <span>Started {new Date(course.created_at).toLocaleDateString()}</span>
        </div>
        {course.all_lessons_completed && (
          <div className="mt-3 flex items-center gap-1 text-green-600 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            <span>Completed</span>
          </div>
        )}
      </div>
      
      {/* Action Buttons */}
      <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 z-10">
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRename(e, course.id);
          }}
          disabled={renaming === course.id}
          className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition disabled:opacity-50"
          title="Rename course"
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
          title="Delete course"
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
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [newCourseName, setNewCourseName] = useState('');
  const [activeDragId, setActiveDragId] = useState(null);

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

  const handleDeleteCourse = async (e, courseId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this course? This action cannot be undone.')) {
      return;
    }
    setDeleting(courseId);
    try {
      await client.delete(`/courses/${courseId}`);
      setCourses(courses.filter(c => c.id !== courseId));
    } catch (err) {
      alert('Failed to delete course.');
    } finally {
      setDeleting(null);
    }
  };

  const handleRenameCourse = async (e, courseId) => {
    e.preventDefault();
    e.stopPropagation();
    const currentCourse = courses.find(c => c.id === courseId);
    const name = prompt('Enter new course name:', currentCourse?.title);
    if (!name || name === currentCourse?.title) return;
    
    setRenaming(courseId);
    try {
      const res = await client.put(`/courses/${courseId}`, { title: name });
      setCourses(courses.map(c => c.id === courseId ? { ...c, title: res.data.title } : c));
    } catch (err) {
      alert('Failed to rename course.');
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
    
    console.log('Drag ended:', { activeId: active?.id, overId: over?.id });
    
    setActiveDragId(null);
    
    // Prevent any default behavior that might cause page refresh
    if (event.nativeEvent) {
      event.nativeEvent.preventDefault?.();
      event.nativeEvent.stopPropagation?.();
    }
    
    // CRITICAL: Exit early for any non-move scenario
    if (!active || !over) {
      console.log('No active or over element, aborting');
      return;
    }
    
    if (active.id === over.id) {
      console.log('Same position, no reorder needed');
      return;
    }
    
    const oldIndex = courses.findIndex(c => c.id === active.id);
    const newIndex = courses.findIndex(c => c.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) {
      console.log('Invalid indices, aborting');
      return;
    }
    
    if (oldIndex === newIndex) {
      console.log('Same index, no reorder needed');
      return;
    }
    
    const newOrder = arrayMove(courses, oldIndex, newIndex);
    const oldOrder = [...courses]; // Save for rollback
    
    // Optimistic update
    setCourses(newOrder);
    
    // Save order to backend - send just array of IDs
    try {
      console.log('Sending reorder:', newOrder.map(c => c.id));
      const response = await client.put('/courses/reorder', { 
        course_order: newOrder.map(c => c.id) 
      });
      console.log('Reorder response:', response.data);
    } catch (err) {
      console.error('Failed to save order:', err);
      alert('Failed to save new order. Reverting...');
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
                  className={`p-6 bg-white rounded-2xl shadow-2xl border-2 border-primary ring-4 ring-primary/30 ${
                    activeCourse.all_lessons_completed 
                      ? 'border-green-500' 
                      : ''
                  }`}
                  style={{ width: '300px', cursor: 'grabbing' }}
                >
                  <h4 className="text-2xl font-bold mb-4 text-primary">{activeCourse.title}</h4>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock className="w-4 h-4" />
                    <span>Started {new Date(activeCourse.created_at).toLocaleDateString()}</span>
                  </div>
                  {activeCourse.all_lessons_completed && (
                    <div className="mt-3 flex items-center gap-1 text-green-600 text-sm font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Completed</span>
                    </div>
                  )}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </section>
    </div>
  );
}
