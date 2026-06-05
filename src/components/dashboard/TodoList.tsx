import { useState, useEffect, useMemo } from 'react';
import { format, isToday, isTomorrow, differenceInDays, parseISO } from 'date-fns';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { PriorityPill } from '../ui/PriorityPill';
import { Icons } from '../../config/icons';
import { useTodosStore } from '../../stores/todosStore';
import { useToastStore } from '../../stores/toastStore';
import { liveQuery } from 'dexie';
import { db } from '../../utils/db';
import type { Todo } from '../../utils/db';
import clsx from 'clsx';

type Filter = 'all' | 'thesis' | 'interview' | 'research' | 'high' | 'due-today';

export const TodoList = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodoText, setNewTodoText] = useState('');
  const [newTodoPriority, setNewTodoPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [newTodoCategory, setNewTodoCategory] = useState<'thesis' | 'interview' | 'research' | 'other'>('thesis');
  const [newTodoDueDate, setNewTodoDueDate] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');

  const { createTodo, updateTodo, deleteTodo, toggleTodo } = useTodosStore();
  const { success } = useToastStore();

  // Use liveQuery for real-time updates
  useEffect(() => {
    const observable = liveQuery(() => 
      db.todos.orderBy('createdAt').reverse().toArray()
    );
    const subscription = observable.subscribe({
      next: (result) => {
        setTodos(result || []);
      },
      error: (error) => {
        console.error('Error in todos live query:', error);
        setTodos([]);
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleAddTodo = async () => {
    if (!newTodoText.trim()) return;

    try {
      await createTodo({
        text: newTodoText.trim(),
        completed: false,
        priority: newTodoPriority,
        category: newTodoCategory,
        dueDate: newTodoDueDate || undefined,
      });
      setNewTodoText('');
      setNewTodoDueDate('');
      success('Todo added!');
    } catch (err: any) {
      console.error('Failed to add todo:', err);
    }
  };

  const handleEdit = (todo: Todo) => {
    setEditingId(todo.id!);
    setEditingText(todo.text);
  };

  const handleSaveEdit = async (id: number) => {
    if (!editingText.trim()) return;
    try {
      await updateTodo(id, { text: editingText.trim() });
      setEditingId(null);
      setEditingText('');
    } catch (err: any) {
      console.error('Failed to update todo:', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete this todo?')) {
      try {
        await deleteTodo(id);
        success('Todo deleted');
      } catch (err: any) {
        console.error('Failed to delete todo:', err);
      }
    }
  };

  // Filter and group todos
  const filteredTodos = useMemo(() => {
    let filtered = todos;

    if (filter === 'high') {
      filtered = filtered.filter(t => t.priority === 'high' && !t.completed);
    } else if (filter === 'due-today') {
      const today = format(new Date(), 'yyyy-MM-dd');
      filtered = filtered.filter(t => t.dueDate === today && !t.completed);
    } else if (filter !== 'all') {
      filtered = filtered.filter(t => t.category === filter);
    }

    return filtered;
  }, [todos, filter]);

  // Group by category
  const groupedTodos = useMemo(() => {
    const groups: Record<string, Todo[]> = {};
    filteredTodos.forEach(todo => {
      if (!groups[todo.category]) {
        groups[todo.category] = [];
      }
      groups[todo.category].push(todo);
    });
    return groups;
  }, [filteredTodos]);

  // Stats
  const stats = useMemo(() => {
    const total = todos.length;
    const completed = todos.filter(t => t.completed).length;
    const dueSoon = todos.filter(t => {
      if (!t.dueDate || t.completed) return false;
      const days = differenceInDays(parseISO(t.dueDate), new Date());
      return days >= 0 && days <= 3;
    }).length;

    return { total, completed, dueSoon };
  }, [todos]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'thesis': return Icons.drafts;
      case 'interview': return Icons.interviews;
      case 'research': return Icons.search;
      default: return Icons.more;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'thesis': return 'Thesis';
      case 'interview': return 'Interviews';
      case 'research': return 'Research';
      default: return 'Other';
    }
  };

  const getDueDateLabel = (dueDate?: string) => {
    if (!dueDate) return null;
    const due = parseISO(dueDate);
    if (isToday(due)) return 'Due today';
    if (isTomorrow(due)) return 'Due tomorrow';
    const days = differenceInDays(due, new Date());
    if (days < 0) return `Overdue by ${Math.abs(days)} days`;
    if (days <= 7) return `Due in ${days} days`;
    return `Due ${format(due, 'MMM d')}`;
  };

  const categoryOrder: Array<'thesis' | 'interview' | 'research' | 'other'> = ['thesis', 'interview', 'research', 'other'];

  return (
    <Card className="p-6">
      <h2 className="text-xl font-serif font-semibold text-text-primary mb-4">
        To-Do List
      </h2>

      {/* Stats */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="px-4 py-2 bg-[#F7F5F0] border border-[#EEEBE4] rounded-xl">
          <span className="text-[10px] uppercase tracking-wider text-[#B5AFA8] block mb-1">Total</span>
          <span className="text-[20px] font-bold text-[#1A1714] font-playfair">{stats.total}</span>
        </div>
        <div className="px-4 py-2 bg-[#F7F5F0] border border-[#EEEBE4] rounded-xl">
          <span className="text-[10px] uppercase tracking-wider text-[#B5AFA8] block mb-1">Due Soon</span>
          <span className="text-[20px] font-bold text-[#1A1714] font-playfair">{stats.dueSoon}</span>
        </div>
        <div className="px-4 py-2 bg-[#F7F5F0] border border-[#EEEBE4] rounded-xl">
          <span className="text-[10px] uppercase tracking-wider text-[#B5AFA8] block mb-1">Completed</span>
          <span className="text-[20px] font-bold text-[#1A1714] font-playfair">{stats.completed}</span>
        </div>
      </div>

      {/* Add Todo Form */}
      <div className="mb-6 space-y-3">
        <div className="flex gap-2">
          <Input
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddTodo()}
            placeholder="Add a todo..."
            className="flex-1"
          />
          <Button onClick={handleAddTodo}>
            <Icons.add size={14} className="mr-1" />
            Add
          </Button>
        </div>
        <div className="flex gap-2">
          <select
            value={newTodoPriority}
            onChange={(e) => setNewTodoPriority(e.target.value as any)}
            className="px-3 py-2 rounded-xl border border-[#E2DDD6] bg-[#F7F5F0] text-[#1A1714] text-sm"
          >
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>
          <select
            value={newTodoCategory}
            onChange={(e) => setNewTodoCategory(e.target.value as any)}
            className="px-3 py-2 rounded-xl border border-[#E2DDD6] bg-[#F7F5F0] text-[#1A1714] text-sm"
          >
            <option value="thesis">Thesis</option>
            <option value="interview">Interviews</option>
            <option value="research">Research</option>
            <option value="other">Other</option>
          </select>
          <input
            type="date"
            value={newTodoDueDate}
            onChange={(e) => setNewTodoDueDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[#E2DDD6] bg-[#F7F5F0] text-[#1A1714] text-sm"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['all', 'thesis', 'interview', 'research', 'high', 'due-today'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx(
              'px-4 py-1.5 rounded-full text-sm transition-colors',
              filter === f
                ? 'bg-[#1A1714] text-white'
                : 'bg-white border border-[#E2DDD6] text-[#7C7469] hover:border-[#C5BFB8]'
            )}
          >
            {f === 'all' ? 'All' : f === 'high' ? 'High Priority' : f === 'due-today' ? 'Due Today' : getCategoryLabel(f)}
          </button>
        ))}
      </div>

      {/* Todo List */}
      <div className="space-y-4">
        {categoryOrder.map((category) => {
          const categoryTodos = groupedTodos[category] || [];
          if (categoryTodos.length === 0) return null;

          const CategoryIcon = getCategoryIcon(category);
          const completedTodos = categoryTodos.filter(t => t.completed);
          const activeTodos = categoryTodos.filter(t => !t.completed);

          return (
            <div key={category} className="space-y-2">
              <div className="flex items-center gap-2 text-[#7C7469] text-sm font-medium">
                <CategoryIcon size={16} className="text-[#B5AFA8]" />
                <span>{getCategoryLabel(category)}</span>
                <span className="text-[#B5AFA8]">({categoryTodos.length})</span>
              </div>

              {/* Active todos */}
              {activeTodos.map((todo) => {
                const dueLabel = getDueDateLabel(todo.dueDate);
                const isOverdue = dueLabel?.includes('Overdue');
                return (
                  <div
                    key={todo.id}
                    className="flex items-start gap-3 px-4 py-3 bg-white border border-[#EEEBE4] rounded-xl hover:border-[#E2DDD6] transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={() => toggleTodo(todo.id!)}
                      className="mt-1 rounded border-[#E2DDD6]"
                    />
                    <div className="flex-1 min-w-0">
                      {editingId === todo.id ? (
                        <div className="flex gap-2">
                          <Input
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(todo.id!);
                              if (e.key === 'Escape') {
                                setEditingId(null);
                                setEditingText('');
                              }
                            }}
                            className="flex-1"
                            autoFocus
                          />
                          <Button size="sm" onClick={() => handleSaveEdit(todo.id!)}>
                            <Icons.check size={14} />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => {
                            setEditingId(null);
                            setEditingText('');
                          }}>
                            <Icons.close size={14} />
                          </Button>
                        </div>
                      ) : (
                        <div
                          className="cursor-pointer"
                          onClick={() => handleEdit(todo)}
                        >
                          <p className="text-[#1A1714]">{todo.text}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <PriorityPill priority={todo.priority} />
                            {todo.dueDate && (
                              <span className={clsx(
                                "text-xs",
                                isOverdue ? "text-[#C05454]" : "text-[#B5AFA8]"
                              )}>
                                {dueLabel}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(todo.id!)}
                      className="text-[#B5AFA8] hover:text-[#C05454] transition-colors"
                    >
                      <Icons.delete size={16} />
                    </button>
                  </div>
                );
              })}

              {/* Completed todos */}
              {completedTodos.map((todo) => (
                <div
                  key={todo.id}
                  className="flex items-start gap-3 px-4 py-3 bg-white border border-[#EEEBE4] rounded-xl opacity-60"
                >
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => toggleTodo(todo.id!)}
                    className="mt-1 rounded border-[#E2DDD6]"
                  />
                  <div className="flex-1">
                    <p className="text-[#7C7469] line-through">{todo.text}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(todo.id!)}
                    className="text-[#B5AFA8] hover:text-[#C05454] transition-colors"
                  >
                    <Icons.delete size={16} />
                  </button>
                </div>
              ))}
            </div>
          );
        })}

        {filteredTodos.length === 0 && (
          <div className="empty-state py-12">
            <Icons.more size={48} className="empty-state-icon" />
            <p className="empty-state-message">No todos yet</p>
          </div>
        )}
      </div>
    </Card>
  );
};
