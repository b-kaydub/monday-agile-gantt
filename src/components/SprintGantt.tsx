import { useEffect, useState } from "react";

import { DependencyOverlay } from "./DependencyOverlay";

import type {
  GanttTask,
  Phase,
  PlannerProjectColumn,
  PlannerResource,
  Sprint,
  SprintGanttData,
  SprintPlanningSettings,
} from "../types/gantt";

type SprintGanttProps = {
  data: SprintGanttData;
  sourceLabel?: string;
  settings: SprintPlanningSettings;
  selectedTaskId?: string | null;
  onTaskClick?: (task: GanttTask) => void;
  onTaskOpen?: (task: GanttTask) => void;
  onTaskPositionChange?: (
    task: GanttTask,
    nextPosition: {
      startPosition: number;
      endPosition: number;
    }
  ) => void | Promise<void>;
  onTaskGroupChange?: (
    task: GanttTask,
    target: {
      phaseId: string;
      mondayGroupId?: string;
    }
  ) => void | Promise<void>;
  onTaskResourceDrop?: (
    task: GanttTask,
    resource: PlannerResource
  ) => void | Promise<void>;
};

type TaskContextMenuState = {
  task: GanttTask;
  x: number;
  y: number;
} | null;

type PackedTask = GanttTask & {
  packedRowIndex: number;
};

type DragMode = "move" | "resize-left" | "resize-right";

type DragState = {
  taskId: string;
  mode: DragMode;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  originalStartPosition: number;
  originalEndPosition: number;
  totalUnits: number;
  chartWidth: number;
  hasMoved: boolean;
};

type PreviewPosition = {
  startPosition: number;
  endPosition: number;
};

type PreviewPhaseTarget = {
  phaseId: string;
  mondayGroupId?: string;
};

const MIN_TASK_WIDTH_PERCENT = 1;
const ROW_HEIGHT = 50;
const SWIMLANE_PADDING_TOP = 12;
const SWIMLANE_PADDING_BOTTOM = 18;
const SNAP_INCREMENT = 0.25;
const MIN_TASK_DURATION = 0.25;
const CLICK_DRAG_THRESHOLD = 8;

export function SprintGantt({
  data,
  sourceLabel = "Mock Data",
  settings,
  selectedTaskId = null,
  onTaskClick,
  onTaskOpen,
  onTaskPositionChange,
  onTaskGroupChange,
  onTaskResourceDrop,
}: SprintGanttProps) {
  const [taskContextMenu, setTaskContextMenu] =
    useState<TaskContextMenuState>(null);

  const [dragState, setDragState] = useState<DragState | null>(null);

  const [previewPositions, setPreviewPositions] = useState<
    Record<string, PreviewPosition>
  >({});

  const [previewPhaseTargets, setPreviewPhaseTargets] = useState<
    Record<string, PreviewPhaseTarget>
  >({});

  const { phases, sprints, tasks } = data;
  const resourceOptions = data.resourceOptions ?? [];
  const { displayOptions } = settings;

  useEffect(() => {
    function closeMenu() {
      setTaskContextMenu(null);
    }

    window.addEventListener("click", closeMenu);
    window.addEventListener("scroll", closeMenu, true);

    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, []);

  const sortedSprints = [...sprints].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  const visibleSprints = buildVisibleSprints(
    sortedSprints,
    settings.totalProjectUnits,
    settings.projectColumns
  );

  const sortedPhases = [...phases].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  const totalUnits = Math.max(
    1,
    settings.totalProjectUnits,
    ...visibleSprints.map(
      (sprint) => sprint.endPosition ?? sprint.sortOrder + 1
    ),
    ...tasks.map((task) => task.endPosition ?? 1)
  );

  const shouldShowSprintHeader =
    displayOptions.showSprintLabels || displayOptions.showDateRanges;

  function clearPreviewForTask(taskId: string) {
    setPreviewPositions((currentPreviewPositions) => {
      const nextPreviewPositions = { ...currentPreviewPositions };
      delete nextPreviewPositions[taskId];
      return nextPreviewPositions;
    });

    setPreviewPhaseTargets((currentPreviewPhaseTargets) => {
      const nextPreviewPhaseTargets = { ...currentPreviewPhaseTargets };
      delete nextPreviewPhaseTargets[taskId];
      return nextPreviewPhaseTargets;
    });
  }

  function findPhaseTargetAtClientY(clientY: number): PreviewPhaseTarget | null {
  const swimlaneElements = Array.from(
    document.querySelectorAll<HTMLElement>(".packed-swimlane[data-phase-id]")
  );

  if (swimlaneElements.length === 0) {
    return null;
  }

  let closestIndex = -1;
  let closestDistance = Number.POSITIVE_INFINITY;

  swimlaneElements.forEach((swimlaneElement, index) => {
    const rect = swimlaneElement.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;
    const distance = Math.abs(clientY - centerY);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  if (closestIndex < 0) {
    return null;
  }

  const closestElement = swimlaneElements[closestIndex];

  if (!closestElement) {
    return null;
  }

  const phaseId = closestElement.getAttribute("data-phase-id");

  if (!phaseId) {
    return null;
  }

  const mondayGroupId =
    closestElement.getAttribute("data-monday-group-id") || undefined;

  return {
    phaseId,
    mondayGroupId,
  };
}

  function handleTaskDragStart(input: {
    event: React.PointerEvent<HTMLButtonElement | HTMLSpanElement>;
    task: GanttTask;
    mode: DragMode;
  }) {
    const swimlaneBody = input.event.currentTarget.closest(
      ".packed-swimlane-body"
    );

    if (!(swimlaneBody instanceof HTMLElement)) {
      return;
    }

    input.event.preventDefault();
    input.event.stopPropagation();

    const chartWidth = swimlaneBody.getBoundingClientRect().width;

    if (chartWidth <= 0) {
      return;
    }

    const startPosition = getTaskStartPosition(input.task);
    const endPosition = getTaskEndPosition(input.task);

    input.event.currentTarget.setPointerCapture(input.event.pointerId);

    setTaskContextMenu(null);

    setDragState({
      taskId: input.task.id,
      mode: input.mode,
      pointerId: input.event.pointerId,
      startClientX: input.event.clientX,
      startClientY: input.event.clientY,
      originalStartPosition: startPosition,
      originalEndPosition: endPosition,
      totalUnits,
      chartWidth,
      hasMoved: false,
    });
  }

  function handleTaskDragMove(
    event: React.PointerEvent<HTMLButtonElement | HTMLSpanElement>,
    task: GanttTask
  ) {
    if (!dragState || dragState.taskId !== task.id) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const deltaPixelsX = event.clientX - dragState.startClientX;
    const deltaPixelsY = event.clientY - dragState.startClientY;

    const hasMoved =
      dragState.hasMoved ||
      Math.max(Math.abs(deltaPixelsX), Math.abs(deltaPixelsY)) >=
        CLICK_DRAG_THRESHOLD;

    const deltaUnits =
      (deltaPixelsX / dragState.chartWidth) * dragState.totalUnits;

    const nextPosition = calculateNextDragPosition({
      mode: dragState.mode,
      originalStartPosition: dragState.originalStartPosition,
      originalEndPosition: dragState.originalEndPosition,
      deltaUnits,
      totalUnits: dragState.totalUnits,
    });

    const phaseTarget =
      dragState.mode === "move"
        ? findPhaseTargetAtClientY(event.clientY)
        : null;

    if (hasMoved !== dragState.hasMoved) {
      setDragState({
        ...dragState,
        hasMoved,
      });
    }

    setPreviewPositions((currentPreviewPositions) => ({
      ...currentPreviewPositions,
      [task.id]: nextPosition,
    }));

    if (
      phaseTarget &&
      phaseTarget.phaseId &&
      phaseTarget.phaseId !== task.phaseId
    ) {
      setPreviewPhaseTargets((currentPreviewPhaseTargets) => ({
        ...currentPreviewPhaseTargets,
        [task.id]: phaseTarget,
      }));
    } else {
      setPreviewPhaseTargets((currentPreviewPhaseTargets) => {
        const nextPreviewPhaseTargets = { ...currentPreviewPhaseTargets };
        delete nextPreviewPhaseTargets[task.id];
        return nextPreviewPhaseTargets;
      });
    }
  }

  async function handleTaskDragEnd(
    event: React.PointerEvent<HTMLButtonElement | HTMLSpanElement>,
    task: GanttTask
  ) {
    if (!dragState || dragState.taskId !== task.id) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const previewPosition = previewPositions[task.id];
    const previewPhaseTarget = previewPhaseTargets[task.id];

    try {
      event.currentTarget.releasePointerCapture(dragState.pointerId);
    } catch {
      // Pointer capture may already be released.
    }

    const shouldSelectOnly = !dragState.hasMoved;

    setDragState(null);

    if (shouldSelectOnly) {
      clearPreviewForTask(task.id);
      onTaskClick?.(task);
      return;
    }

    const originalStart = getTaskStartPosition(task);
    const originalEnd = getTaskEndPosition(task);

    const hasPositionChanged =
      !!previewPosition &&
      (previewPosition.startPosition !== originalStart ||
        previewPosition.endPosition !== originalEnd);

    const hasPhaseChanged =
      !!previewPhaseTarget && previewPhaseTarget.phaseId !== task.phaseId;

    clearPreviewForTask(task.id);

    if (hasPositionChanged && previewPosition) {
      await onTaskPositionChange?.(task, previewPosition);
    }

    if (hasPhaseChanged && previewPhaseTarget) {
      await onTaskGroupChange?.(task, previewPhaseTarget);
    }
  }

    return (
    <section className="sprint-gantt-planner">
      {(displayOptions.showAppLabel ||
        displayOptions.showTitle ||
        displayOptions.showSource ||
        displayOptions.showLegend) && (
        <div className="sprint-gantt-title-block">
          {displayOptions.showAppLabel && (
            <div className="sprint-gantt-eyebrow">
              Monday Custom Board View
            </div>
          )}

          {displayOptions.showTitle && <h1>{settings.projectTitle}</h1>}

          {displayOptions.showSource && (
            <div className="sprint-gantt-source">Source: {sourceLabel}</div>
          )}

          {displayOptions.showLegend && settings.teamLegend.length > 0 && (
            <Legend settings={settings} />
          )}

          {resourceOptions.length > 0 && (
            <ResourceStrip resources={resourceOptions} />
          )}
        </div>
      )}

      <div className="sprint-gantt-chart">
        {shouldShowSprintHeader && (
          <SprintHeader
            sprints={visibleSprints}
            showSprintLabels={displayOptions.showSprintLabels}
            showDateRanges={displayOptions.showDateRanges}
          />
        )}

        {sortedPhases.map((phase, phaseIndex) => {
          const phaseTasks = tasks.filter((task) => {
            const previewTarget = previewPhaseTargets[task.id];
            const effectivePhaseId = previewTarget?.phaseId ?? task.phaseId;
            return effectivePhaseId === phase.id;
          });

          const isDragTarget = Object.values(previewPhaseTargets).some(
            (target) => target.phaseId === phase.id
          );

          return (
            <PackedSwimlane
              key={phase.id}
              phase={phase}
              phaseIndex={phaseIndex}
              tasks={phaseTasks}
              sprints={visibleSprints}
              totalUnits={totalUnits}
              previewPositions={previewPositions}
              isDragTarget={isDragTarget}
              selectedTaskId={selectedTaskId}
              onTaskContextMenu={setTaskContextMenu}
              onTaskDragStart={handleTaskDragStart}
              onTaskDragMove={handleTaskDragMove}
              onTaskDragEnd={handleTaskDragEnd}
              onTaskResourceDrop={onTaskResourceDrop}
            />

          );
        })}
        <DependencyOverlay
          tasks={tasks}
          enabled={displayOptions.showDependencies}
        />
      </div>

      {taskContextMenu && (
        <div
          className="task-context-menu"
          style={{
            left: taskContextMenu.x,
            top: taskContextMenu.y,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="task-context-menu-button"
            onClick={() => {
              onTaskOpen?.(taskContextMenu.task);
              setTaskContextMenu(null);
            }}
          >
            Open Monday item
          </button>
        </div>
      )}
    </section>
  );
}

function Legend({ settings }: { settings: SprintPlanningSettings }) {
  return (
    <div className="planner-legend">
      {settings.teamLegend.map((legendItem) => (
        <div key={legendItem.id} className="planner-legend-item">
          <span
            className={`planner-legend-swatch task-color-${legendItem.color}`}
          />
          <span className="planner-legend-label">{legendItem.label}</span>
        </div>
      ))}
    </div>
  );
}

function ResourceStrip({
  resources,
}: {
  resources: PlannerResource[];
}) {
  function handleResourceDragStart(
    event: React.DragEvent<HTMLButtonElement>,
    resource: PlannerResource
  ) {
    event.dataTransfer.effectAllowed = "copy";

    event.dataTransfer.setData(
      "application/x-planner-resource",
      JSON.stringify(resource)
    );

    event.dataTransfer.setData(
      "text/plain",
      resource.id
    );
  }

  return (
    <div className="planner-resource-strip">
      <div className="planner-resource-strip-label">
        Resources
      </div>

      <div className="planner-resource-strip-list">
        {resources.map((resource) => (
          <button
            key={resource.id}
            type="button"
            className="planner-resource-chip"
            draggable
            onDragStart={(event) =>
              handleResourceDragStart(event, resource)
            }
            title={`Drag ${resource.name} onto a planner bar`}
          >
            <span className="planner-resource-chip-avatar">
              {getResourceInitials(resource.name)}
            </span>

            <span className="planner-resource-chip-name">
              {resource.name}
            </span>
          </button>
        ))}
      </div>

      <div className="planner-resource-strip-help">
        Drag a resource onto a bar to assign the resource.
      </div>
    </div>
  );
}

function getResourceInitials(name: string): string {
  const nameParts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (nameParts.length === 0) {
    return "?";
  }

  return nameParts
    .slice(0, 2)
    .map((namePart) =>
      namePart.charAt(0).toUpperCase()
    )
    .join("");
}

function SprintHeader({
  sprints,
  showSprintLabels,
  showDateRanges,
}: {
  sprints: Sprint[];
  showSprintLabels: boolean;
  showDateRanges: boolean;
}) {
  return (
    <div className="packed-sprint-header">
      {sprints.map((sprint) => (
        <div key={sprint.id} className="packed-sprint-header-cell">
          {showSprintLabels && (
            <div className="packed-sprint-name">{sprint.name}</div>
          )}

          {showDateRanges && sprint.dateLabel ? (
            <div className="packed-sprint-date">{sprint.dateLabel}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function PackedSwimlane({
  phase,
  phaseIndex,
  tasks,
  sprints,
  totalUnits,
  previewPositions,
  isDragTarget,
  selectedTaskId,
  onTaskContextMenu,
  onTaskDragStart,
  onTaskDragMove,
  onTaskDragEnd,
  onTaskResourceDrop,
}: {
  phase: Phase;
  phaseIndex: number;
  tasks: GanttTask[];
  sprints: Sprint[];
  totalUnits: number;
  previewPositions: Record<string, PreviewPosition>;
  isDragTarget: boolean;
  selectedTaskId: string | null;
  onTaskContextMenu: (state: TaskContextMenuState) => void;
  onTaskDragStart: (input: {
    event: React.PointerEvent<HTMLButtonElement | HTMLSpanElement>;
    task: GanttTask;
    mode: DragMode;
  }) => void;
  onTaskDragMove: (
    event: React.PointerEvent<HTMLButtonElement | HTMLSpanElement>,
    task: GanttTask
  ) => void;
  onTaskDragEnd: (
    event: React.PointerEvent<HTMLButtonElement | HTMLSpanElement>,
    task: GanttTask
  ) => void | Promise<void>;
  onTaskResourceDrop?: (
    task: GanttTask,
    resource: PlannerResource
  ) => void | Promise<void>;
}) {

  const packedTasks = packTasksIntoRows(tasks);

  const rowCount = Math.max(
    1,
    ...packedTasks.map((task) => task.packedRowIndex + 1)
  );

  const swimlaneBodyHeight =
    SWIMLANE_PADDING_TOP +
    SWIMLANE_PADDING_BOTTOM +
    rowCount * ROW_HEIGHT;

  return (
    <div
      className="packed-swimlane"
      data-phase-id={phase.id}
      data-monday-group-id={phase.mondayGroupId ?? ""}
    >
      <div className="packed-swimlane-title">
        {phaseIndex + 1}. {phase.title}
      </div>

      <div
        className={
          isDragTarget
            ? "packed-swimlane-body packed-swimlane-body-drag-target"
            : "packed-swimlane-body"
        }
        style={{
          height: swimlaneBodyHeight,
        }}
      >
        <SprintGrid sprints={sprints} />

        {packedTasks.map((task) => {
          const previewPosition = previewPositions[task.id];

          const renderTask = previewPosition
            ? {
                ...task,
                startPosition: previewPosition.startPosition,
                endPosition: previewPosition.endPosition,
              }
            : task;

          const leftPercent = getTaskLeftPercent(renderTask, totalUnits);
          const widthPercent = getTaskWidthPercent(renderTask, totalUnits);
          const top = SWIMLANE_PADDING_TOP + task.packedRowIndex * ROW_HEIGHT;

          return (
            <TaskBox
              key={task.id}
              task={task}
              renderTask={renderTask}
              leftPercent={leftPercent}
              widthPercent={widthPercent}
              top={top}
              isSelected={selectedTaskId === task.id}
              onTaskContextMenu={onTaskContextMenu}
              onTaskDragStart={onTaskDragStart}
              onTaskDragMove={onTaskDragMove}
              onTaskDragEnd={onTaskDragEnd}
              onTaskResourceDrop={onTaskResourceDrop}
            />
          );
        })}
      </div>
    </div>
  );
}

function SprintGrid({ sprints }: { sprints: Sprint[] }) {
  return (
    <div className="packed-sprint-grid">
      {sprints.map((sprint) => (
        <div key={sprint.id} className="packed-sprint-grid-cell" />
      ))}
    </div>
  );
}

function TaskBox({
  task,
  renderTask,
  leftPercent,
  widthPercent,
  top,
  isSelected,
  onTaskContextMenu,
  onTaskDragStart,
  onTaskDragMove,
  onTaskDragEnd,
  onTaskResourceDrop,
}: {
  task: GanttTask;
  renderTask: GanttTask;
  leftPercent: number;
  widthPercent: number;
  top: number;
  isSelected: boolean;
  onTaskContextMenu: (state: TaskContextMenuState) => void;
  onTaskDragStart: (input: {
    event: React.PointerEvent<HTMLButtonElement | HTMLSpanElement>;
    task: GanttTask;
    mode: DragMode;
  }) => void;
  onTaskDragMove: (
    event: React.PointerEvent<HTMLButtonElement | HTMLSpanElement>,
    task: GanttTask
  ) => void;
  onTaskDragEnd: (
    event: React.PointerEvent<HTMLButtonElement | HTMLSpanElement>,
    task: GanttTask
  ) => void | Promise<void>;
  onTaskResourceDrop?: (
    task: GanttTask,
    resource: PlannerResource
  ) => void | Promise<void>;
}) {
  const [isResourceDragOver, setIsResourceDragOver] = useState(false);

  function handleContextMenu(
    event: React.MouseEvent<HTMLButtonElement>
  ) {
    event.preventDefault();
    event.stopPropagation();

    onTaskContextMenu({
      task,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function handleResourceDragOver(
    event: React.DragEvent<HTMLButtonElement>
  ) {
    if (!onTaskResourceDrop) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";

    setIsResourceDragOver(true);
  }

  function handleResourceDragLeave(
    event: React.DragEvent<HTMLButtonElement>
  ) {
    event.preventDefault();
    event.stopPropagation();

    const nextTarget = event.relatedTarget;

    if (
      nextTarget instanceof Node &&
      event.currentTarget.contains(nextTarget)
    ) {
      return;
    }

    setIsResourceDragOver(false);
  }

  async function handleResourceDrop(
    event: React.DragEvent<HTMLButtonElement>
  ) {
    event.preventDefault();
    event.stopPropagation();

    setIsResourceDragOver(false);

    if (!onTaskResourceDrop) {
      return;
    }

    const serializedResource = event.dataTransfer.getData(
      "application/x-planner-resource"
    );

    if (!serializedResource) {
      return;
    }

    try {
      const parsedResource = JSON.parse(
        serializedResource
      ) as PlannerResource;

      if (!parsedResource.id || !parsedResource.name) {
        return;
      }

      await onTaskResourceDrop(task, {
        id: String(parsedResource.id),
        name: String(parsedResource.name),
        photoUrl: parsedResource.photoUrl,
      });
    } catch (error) {
      console.error(
        "Unable to read dropped planner resource.",
        error
      );
    }
  }

  const taskClassNames = [
    "packed-task-box",
    `task-color-${renderTask.color}`,
  ];

  if (isSelected) {
    taskClassNames.push("packed-task-box-selected");
  }

  if (isResourceDragOver) {
    taskClassNames.push("packed-task-box-resource-target");
  }

  return (
    <button
      type="button"
      data-task-id={task.id}
      className={taskClassNames.join(" ")}
      style={{
        left: `${leftPercent}%`,
        width: `${widthPercent}%`,
        top,
      }}
      title={
        renderTask.description
          ? `${renderTask.title}\n\n${renderTask.description}`
          : renderTask.title
      }
      onPointerDown={(event) =>
        onTaskDragStart({
          event,
          task,
          mode: "move",
        })
      }
      onPointerMove={(event) =>
        onTaskDragMove(event, task)
      }
      onPointerUp={(event) =>
        onTaskDragEnd(event, task)
      }
      onPointerCancel={(event) =>
        onTaskDragEnd(event, task)
      }
      onContextMenu={handleContextMenu}
      onDragOver={handleResourceDragOver}
      onDragEnter={handleResourceDragOver}
      onDragLeave={handleResourceDragLeave}
      onDrop={handleResourceDrop}
    >
      <span
        className="packed-task-resize-handle packed-task-resize-handle-left"
        onPointerDown={(event) =>
          onTaskDragStart({
            event,
            task,
            mode: "resize-left",
          })
        }
        onPointerMove={(event) =>
          onTaskDragMove(event, task)
        }
        onPointerUp={(event) =>
          onTaskDragEnd(event, task)
        }
        onPointerCancel={(event) =>
          onTaskDragEnd(event, task)
        }
      />

      <span className="packed-task-title">
        {renderTask.title}
      </span>

      <span
        className="packed-task-resize-handle packed-task-resize-handle-right"
        onPointerDown={(event) =>
          onTaskDragStart({
            event,
            task,
            mode: "resize-right",
          })
        }
        onPointerMove={(event) =>
          onTaskDragMove(event, task)
        }
        onPointerUp={(event) =>
          onTaskDragEnd(event, task)
        }
        onPointerCancel={(event) =>
          onTaskDragEnd(event, task)
        }
      />
    </button>
  );
}

function buildVisibleSprints(
  sprints: Sprint[],
  totalProjectUnits: number,
  projectColumns: PlannerProjectColumn[]
): Sprint[] {
  const safeTotalProjectUnits = Math.max(1, Math.ceil(totalProjectUnits));

  const existingSprintsBySortOrder = new Map<number, Sprint>();
  const projectColumnsBySortOrder = new Map<number, PlannerProjectColumn>();

  sprints.forEach((sprint) => {
    existingSprintsBySortOrder.set(sprint.sortOrder, sprint);
  });

  projectColumns.forEach((projectColumn) => {
    projectColumnsBySortOrder.set(projectColumn.sortOrder, projectColumn);
  });

  return Array.from({ length: safeTotalProjectUnits }, (_, index) => {
    const projectColumn = projectColumnsBySortOrder.get(index);

    if (projectColumn) {
      return {
        id: projectColumn.id,
        name: projectColumn.label || `Sprint ${index}`,
        dateLabel: projectColumn.dateLabel ?? "",
        sortOrder: index,
        startPosition: projectColumn.startPosition,
        endPosition: projectColumn.endPosition,
      };
    }

    const existingSprint = existingSprintsBySortOrder.get(index);

    if (existingSprint) {
      return {
        ...existingSprint,
        startPosition: existingSprint.startPosition ?? index,
        endPosition: existingSprint.endPosition ?? index + 1,
      };
    }

    return {
      id: `sprint-${index}`,
      name: `Sprint ${index}`,
      dateLabel: "",
      sortOrder: index,
      startPosition: index,
      endPosition: index + 1,
    };
  });
}

function packTasksIntoRows(tasks: GanttTask[]): PackedTask[] {
  /*
   * Each team receives its own set of rows.
   *
   * Tasks from the same team may share a row when they do not overlap.
   * Tasks from different teams are never placed on the same row.
   */

  const tasksByTeam = new Map<string, GanttTask[]>();

  tasks.forEach((task) => {
    const teamName =
      typeof task.team === "string" && task.team.trim()
        ? task.team.trim()
        : "Unassigned";

    const existingTeamTasks = tasksByTeam.get(teamName) ?? [];

    existingTeamTasks.push(task);

    tasksByTeam.set(teamName, existingTeamTasks);
  });

  const packedTasks: PackedTask[] = [];
  let nextAvailableGlobalRowIndex = 0;

  tasksByTeam.forEach((teamTasks) => {
    const sortedTeamTasks = [...teamTasks].sort((a, b) => {
      const aStart = getTaskStartPosition(a);
      const bStart = getTaskStartPosition(b);

      if (aStart !== bStart) {
        return aStart - bStart;
      }

      const aEnd = getTaskEndPosition(a);
      const bEnd = getTaskEndPosition(b);

      return aEnd - bEnd;
    });

    /*
     * rowEndPositions contains only rows belonging to the current team.
     * Therefore, another team can never reuse one of these rows.
     */
    const rowEndPositions: number[] = [];

    sortedTeamTasks.forEach((task) => {
      const startPosition = getTaskStartPosition(task);
      const endPosition = getTaskEndPosition(task);

      let teamRowIndex = rowEndPositions.findIndex(
        (rowEndPosition) => startPosition >= rowEndPosition
      );

      if (teamRowIndex === -1) {
        teamRowIndex = rowEndPositions.length;
        rowEndPositions.push(endPosition);
      } else {
        rowEndPositions[teamRowIndex] = endPosition;
      }

      packedTasks.push({
        ...task,
        packedRowIndex: nextAvailableGlobalRowIndex + teamRowIndex,
      });
    });

    /*
     * Move the next team below every row used by the current team.
     */
    nextAvailableGlobalRowIndex += Math.max(1, rowEndPositions.length);
  });

  return packedTasks;
}

function calculateNextDragPosition(input: {
  mode: DragMode;
  originalStartPosition: number;
  originalEndPosition: number;
  deltaUnits: number;
  totalUnits: number;
}): PreviewPosition {
  const duration = input.originalEndPosition - input.originalStartPosition;

  let nextStartPosition = input.originalStartPosition;
  let nextEndPosition = input.originalEndPosition;

  if (input.mode === "move") {
    nextStartPosition = input.originalStartPosition + input.deltaUnits;
    nextEndPosition = input.originalEndPosition + input.deltaUnits;

    if (nextStartPosition < 0) {
      nextStartPosition = 0;
      nextEndPosition = duration;
    }

    if (nextEndPosition > input.totalUnits) {
      nextEndPosition = input.totalUnits;
      nextStartPosition = input.totalUnits - duration;
    }
  }

  if (input.mode === "resize-left") {
    nextStartPosition = input.originalStartPosition + input.deltaUnits;

    nextStartPosition = Math.max(0, nextStartPosition);
    nextStartPosition = Math.min(
      nextStartPosition,
      input.originalEndPosition - MIN_TASK_DURATION
    );
  }

  if (input.mode === "resize-right") {
    nextEndPosition = input.originalEndPosition + input.deltaUnits;

    nextEndPosition = Math.min(input.totalUnits, nextEndPosition);
    nextEndPosition = Math.max(
      nextEndPosition,
      input.originalStartPosition + MIN_TASK_DURATION
    );
  }

  const snappedStartPosition = snapToIncrement(nextStartPosition);
  const snappedEndPosition = snapToIncrement(nextEndPosition);

  return {
    startPosition: Math.max(0, snappedStartPosition),
    endPosition: Math.max(
      snappedStartPosition + MIN_TASK_DURATION,
      snappedEndPosition
    ),
  };
}

function snapToIncrement(value: number): number {
  return Number((Math.round(value / SNAP_INCREMENT) * SNAP_INCREMENT).toFixed(2));
}

function getTaskStartPosition(task: GanttTask): number {
  if (typeof task.startPosition === "number") {
    return Math.max(0, task.startPosition);
  }

  if (typeof task.leftPercent === "number") {
    return Math.max(0, task.leftPercent);
  }

  return 0;
}

function getTaskEndPosition(task: GanttTask): number {
  const startPosition = getTaskStartPosition(task);

  if (
    typeof task.endPosition === "number" &&
    task.endPosition > startPosition
  ) {
    return task.endPosition;
  }

  if (typeof task.sprintSpan === "number") {
    return startPosition + Math.max(1, task.sprintSpan);
  }

  return startPosition + 1;
}

function getTaskLeftPercent(task: GanttTask, totalUnits: number): number {
  if (typeof task.leftPercent === "number") {
    return clampPercent(task.leftPercent);
  }

  const startPosition = getTaskStartPosition(task);
  return clampPercent((startPosition / totalUnits) * 100);
}

function getTaskWidthPercent(task: GanttTask, totalUnits: number): number {
  if (typeof task.widthPercent === "number") {
    return Math.max(MIN_TASK_WIDTH_PERCENT, task.widthPercent);
  }

  const startPosition = getTaskStartPosition(task);
  const endPosition = getTaskEndPosition(task);
  const widthPercent = ((endPosition - startPosition) / totalUnits) * 100;

  return Math.max(MIN_TASK_WIDTH_PERCENT, widthPercent);
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}