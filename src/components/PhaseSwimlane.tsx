import type { GanttTask, Phase, Sprint } from "../types/gantt";
import { TaskCard } from "./TaskCard";

type PhaseSwimlaneProps = {
  phase: Phase;
  sprints: Sprint[];
  tasks: GanttTask[];
  columnWidth: number;
};

export function PhaseSwimlane({
  phase,
  sprints,
  tasks,
  columnWidth,
}: PhaseSwimlaneProps) {
  const phaseTasks = tasks.filter((task) => task.phaseId === phase.id);

  const laneHeight = Math.max(
    110,
    phaseTasks.length * 40 + 20
  );

  const getSprintIndex = (sprintId: string) => {
    return Math.max(
      0,
      sprints.findIndex((sprint) => sprint.id === sprintId)
    );
  };

  const dynamicSprintGrid = `repeat(${sprints.length}, minmax(${columnWidth}px, 1fr))`;

  return (
    <section className="phase-swimlane">
      <h2 className="phase-swimlane__title">{phase.title.toUpperCase()}</h2>

      <div
        className="phase-swimlane__grid"
        style={{
          gridTemplateColumns: dynamicSprintGrid,
          minHeight: `${laneHeight}px`,
        }}
      >
        {sprints.map((sprint) => (
          <div className="phase-swimlane__cell" key={sprint.id} />
        ))}

        <div
          className="phase-swimlane__tasks"
          style={{
            gridTemplateColumns: dynamicSprintGrid,
          }}
        >
          {phaseTasks.map((task, taskIndex) => (
            <TaskCard
              key={task.id}
              task={task}
              sprintIndex={getSprintIndex(task.sprintId)}
              taskIndex={taskIndex}
            />
          ))}
        </div>
      </div>
    </section>
  );
}