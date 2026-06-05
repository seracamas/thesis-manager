import { create } from 'zustand';
import { db } from '../utils/db';
import type { Todo } from '../utils/db';

interface TodosState {
  todos: Todo[];
  isLoading: boolean;
  fetchTodos: () => Promise<void>;
  createTodo: (todo: Omit<Todo, 'id' | 'createdAt'>) => Promise<number>;
  updateTodo: (id: number, updates: Partial<Todo>) => Promise<void>;
  deleteTodo: (id: number) => Promise<void>;
  toggleTodo: (id: number) => Promise<void>;
}

export const useTodosStore = create<TodosState>((set, get) => ({
  todos: [],
  isLoading: false,

  fetchTodos: async () => {
    set({ isLoading: true });
    try {
      const todos = await db.todos.orderBy('createdAt').reverse().toArray();
      set({ todos, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch todos:', error);
      set({ isLoading: false });
    }
  },

  createTodo: async (todoData) => {
    const now = new Date().toISOString();
    const todo: Todo = {
      ...todoData,
      createdAt: now,
    };

    const id = await db.todos.add(todo);
    await get().fetchTodos();
    return id;
  },

  updateTodo: async (id, updates) => {
    await db.todos.update(id, updates);
    await get().fetchTodos();
  },

  deleteTodo: async (id) => {
    await db.todos.delete(id);
    await get().fetchTodos();
  },

  toggleTodo: async (id) => {
    const todo = await db.todos.get(id);
    if (todo) {
      await db.todos.update(id, { completed: !todo.completed });
      await get().fetchTodos();
    }
  },
}));
