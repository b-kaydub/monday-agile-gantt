import type { Milestone, Sprint } from "../types/gantt";

type MilestoneMarkerProps = {
  milestone: Milestone;
  sprints: Sprint[];
};

export function MilestoneMarker({ milestone, sprints }: MilestoneMarkerProps) {
  const sprintIndex = sprints.findIndex(
    (sprint) => sprint.id === milestone.sprintId
  );

  if (sprintIndex < 0) {
    return null;
  }

  const leftPercent = ((sprintIndex + 0.72) / sprints.length) * 100;

  return (
    <div className="milestone-layer" aria-hidden="true">
      <div className="milestone-marker" style={{ left: `${leftPercent}%` }}>
        <div className="milestone-marker__dot" />
        <div className="milestone-marker__line" />
        <div className="milestone-callout">
          <div>{milestone.label.toUpperCase()}</div>
          <div>{milestone.dateLabel}</div>
        </div>
      </div>
    </div>
  );
}