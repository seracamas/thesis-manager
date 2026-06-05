type AutosaveCallback = () => void | Promise<void>;

interface AutosaveOptions {
  delay?: number;
  maxWait?: number;
}

class AutosaveManager {
  private timers = new Map<string, NodeJS.Timeout>();
  private maxWaitTimers = new Map<string, NodeJS.Timeout>();
  private callbacks = new Map<string, AutosaveCallback>();
  private lastSave = new Map<string, number>();
  private options: Required<AutosaveOptions>;

  constructor(options: AutosaveOptions = {}) {
    this.options = {
      delay: options.delay ?? 1000, // Default 1 second debounce
      maxWait: options.maxWait ?? 5000, // Default 5 seconds max wait
    };
  }

  register(id: string, callback: AutosaveCallback) {
    this.callbacks.set(id, callback);
  }

  unregister(id: string) {
    this.cancel(id);
    this.callbacks.delete(id);
    this.lastSave.delete(id);
  }

  trigger(id: string) {
    const callback = this.callbacks.get(id);
    if (!callback) return;

    // Clear existing timer
    this.cancel(id);

    // If it's been a while since last save, set max wait timer
    if (!this.maxWaitTimers.has(id)) {
      this.maxWaitTimers.set(
        id,
        setTimeout(() => {
          this.execute(id);
        }, this.options.maxWait)
      );
    }

    // Set debounce timer
    this.timers.set(
      id,
      setTimeout(() => {
        this.execute(id);
      }, this.options.delay)
    );
  }

  private async execute(id: string) {
    const callback = this.callbacks.get(id);
    if (!callback) return;

    this.cancel(id);
    
    try {
      await callback();
      this.lastSave.set(id, Date.now());
    } catch (error) {
      console.error(`Autosave failed for ${id}:`, error);
    }
  }

  private cancel(id: string) {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }

    const maxWaitTimer = this.maxWaitTimers.get(id);
    if (maxWaitTimer) {
      clearTimeout(maxWaitTimer);
      this.maxWaitTimers.delete(id);
    }
  }

  async flush(id?: string) {
    if (id) {
      await this.execute(id);
    } else {
      // Flush all
      const ids = Array.from(this.callbacks.keys());
      await Promise.all(ids.map((id) => this.execute(id)));
    }
  }
}

export const autosaveManager = new AutosaveManager();
