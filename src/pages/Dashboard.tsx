import { Calendar } from '../components/dashboard/Calendar';
import { TodoList } from '../components/dashboard/TodoList';

export const Dashboard = () => {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">
          Dashboard
        </h1>
        <p className="text-text-secondary">
          Your research calendar and tasks
        </p>
      </div>

      {/* Two-column layout: Calendar (60%) and TodoList (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-[60%_40%] gap-6">
        {/* Left: Calendar */}
        <div>
          <Calendar />
        </div>

        {/* Right: Todo List */}
        <div>
          <TodoList />
        </div>
      </div>
    </div>
  );
};
