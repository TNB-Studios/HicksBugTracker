import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Column from './Column';

export default function SortableColumn({ column, tasks, onTaskClick, allTasks, onToggleSort, sortAscending }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: column._id,
    data: {
      type: 'column',
      column
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Column
        column={column}
        tasks={tasks}
        onTaskClick={onTaskClick}
        allTasks={allTasks}
        onToggleSort={onToggleSort}
        sortAscending={sortAscending}
        dragHandleListeners={listeners}
      />
    </div>
  );
}
