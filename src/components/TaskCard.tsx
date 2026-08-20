import { monday } from "../services/mondayClient";
import type { GanttTask } from "../types/gantt";

type TaskCardProps = {
  task: GanttTask;
  sprintIndex: number;
  taskIndex: number;
};

export function TaskCard({ task, sprintIndex, taskIndex }: TaskCardProps) {
  const span = task.sprintSpan ?? 1;

  const hasPreciseTimeline =
    typeof task.leftPercent === "number" &&
    typeof task.widthPercent === "number";

  const style = hasPreciseTimeline
    ? {
        left: `${task.leftPercent}%`,
        width: `${task.widthPercent}%`,
        top: `${taskIndex * 40}px`,
      }
    : {
        gridColumn: `${sprintIndex + 1} / span ${span}`,
      };

  const handleClick = async () => {
    const itemId = Number(task.id);

    if (Number.isNaN(itemId)) {
      console.warn("Unable to open item card because task.id is not numeric:", task);
      return;
    }

    try {
      await monday.execute("openItemCard", {
        itemId,
        kind: "columns",
      });
    } catch (error) {
      console.error("Unable to open Monday item card.", error);
    }
  };

  return (
    <button
      type="button"
      className={`task-card task-card--${task.color} ${
        hasPreciseTimeline ? "task-card--precise" : ""
      }`}
      style={style}
      title={`Open ${task.title}`}
      onClick={handleClick}
    >
      {task.title}
    </button>
  );
}