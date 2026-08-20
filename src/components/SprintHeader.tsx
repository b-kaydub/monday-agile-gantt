import type { Sprint } from "../types/gantt";

type SprintHeaderProps = {
  sprints: Sprint[];
  columnWidth: number;
};

export function SprintHeader({ sprints, columnWidth }: SprintHeaderProps) {
  return (
    <div
      className="sprint-header"
      style={{
        gridTemplateColumns: `repeat(${sprints.length}, minmax(${columnWidth}px, 1fr))`,
      }}
    >
      {sprints.map((sprint) => (
        <div className="sprint-header__cell" key={sprint.id}>
          <div className="sprint-header__name">{sprint.name.toUpperCase()}</div>
          <div className="sprint-header__date">{sprint.dateLabel}</div>
        </div>
      ))}
    </div>
  );
}