import { useCallback, useEffect, useMemo, useState } from "react";

import { PlannerControlPanel } from "./components/PlannerControlPanel";
import { SprintGantt } from "./components/SprintGantt";

import { loadSprintGanttData } from "./services/boardDataService";
import { getMondayContext } from "./services/mondayClient";
import {
  createMondayGroup,
  createPlannerItem,
  defaultPlannerColumnTitles,
  deletePlannerItem,
  openMondayItemCard,
  updatePlannerItem,
  updatePlannerItemGroup,
  updatePlannerItemPosition,
  updatePlannerItemResources,
} from "./services/mondayWriteService";
``
import {
  loadPlannerSettings,
  savePlannerSettings,
} from "./services/plannerSettingsService";
import {
  getMissingPlannerColumns,
  setupPlannerBoard,
  type PlannerColumnDefinition,
} from "./services/boardSetupService";

import type {
  GanttTask,
  GanttTaskColor,
  PlannerResource,
  SprintGanttData,
  SprintPlanningSettings,
} from "./types/gantt";

import {
  milestones,
  phases,
  sprints,
  tasks,
} from "./data/mockData";

import "./styles/sprintGantt.css";

const fallbackData: SprintGanttData = {
  sprints,
  phases,
  tasks,
  milestones,
  teamOptions: [],
  resourceOptions: [],
};

const defaultSettings: SprintPlanningSettings = {
  projectTitle: "Sprint Gantt Planner",
  totalProjectUnits: 8,
  projectColumns: [],
  displayOptions: {
    showAppLabel: true,
    showTitle: true,
    showSource: true,
    showSprintLabels: true,
    showDateRanges: true,
    showLegend: true,
    showDependencies: true,
  },
  teamLegend: [
    {
      id: "analytics",
      label: "Analytics",
      color: "red",
    },
    {
      id: "pm",
      label: "PM",
      color: "orange",
    },
    {
      id: "dpe",
      label: "DPE",
      color: "blue",
    },
    {
      id: "ai-ml",
      label: "AI/ML",
      color: "green",
    },
  ],
};

function App() {
  const [data, setData] = useState<SprintGanttData>(fallbackData);
  const [settings, setSettings] =
    useState<SprintPlanningSettings>(defaultSettings);

  const [sourceLabel, setSourceLabel] = useState("Mock Data");
  const [isLoading, setIsLoading] = useState(true);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [debugInfo, setDebugInfo] = useState("Loading...");
  const [boardId, setBoardId] = useState<number | string | null>(null);
  const [selectedTask, setSelectedTask] = useState<GanttTask | null>(null);
  

  const [missingColumns, setMissingColumns] = useState<
    PlannerColumnDefinition[]
  >([]);

  const displayData = useMemo(() => {
    return data;
  }, [data]);

  const refreshData = useCallback(async () => {
    setIsBusy(true);

    try {
      const context = await getMondayContext();

      if (context?.boardId) {
        setBoardId(context.boardId);

        const missingPlannerColumns = await getMissingPlannerColumns(
          context.boardId
        );

        setMissingColumns(missingPlannerColumns);

        if (missingPlannerColumns.length > 0) {
          setData(fallbackData);
          setSourceLabel("Monday Board");
          setDebugInfo(
            `Setup required. Missing columns: ${missingPlannerColumns
              .map((column) => column.title)
              .join(", ")}`
          );
          return;
        }
      } else {
        setMissingColumns([]);
      }

      const sprintGanttData = await loadSprintGanttData();

      setData(sprintGanttData);
      setSourceLabel(context?.boardId ? "Monday Board" : "Mock Data");
      setDebugInfo(
        `Phases: ${sprintGanttData.phases.length} | ` +
          `Sprints: ${sprintGanttData.sprints.length} | ` +
          `Tasks: ${sprintGanttData.tasks.length} | ` +
          `Milestones: ${sprintGanttData.milestones.length}`
      );
    } catch (error) {
      console.error("Failed to load Monday board data.", error);

      setMissingColumns([]);
      setData(fallbackData);
      setSourceLabel("Mock Data");
      setDebugInfo(
        "Using fallback mock data because Monday board data could not be loaded."
      );
    } finally {
      setIsLoading(false);
      setIsBusy(false);
    }
  }, []);

  useEffect(() => {
    async function initializeSettings() {
      const savedSettings = await loadPlannerSettings();

      if (savedSettings) {
        setSettings({
          ...defaultSettings,
          ...savedSettings,
          displayOptions: {
            ...defaultSettings.displayOptions,
            ...savedSettings.displayOptions,
          },
          teamLegend: savedSettings.teamLegend ?? defaultSettings.teamLegend,
          projectColumns: savedSettings.projectColumns ?? [],
        });
      }

      setIsSettingsLoaded(true);
    }

    initializeSettings();
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    if (!isSettingsLoaded) {
      return;
    }

    const saveTimeout = window.setTimeout(() => {
      savePlannerSettings(settings);
    }, 400);

    return () => {
      window.clearTimeout(saveTimeout);
    };
  }, [settings, isSettingsLoaded]);

  function handleSettingsChange(nextSettings: SprintPlanningSettings) {
    setSettings(nextSettings);
  }

  async function handleCreateSwimlane(swimlaneName: string) {
    if (!boardId) {
      alert("Board ID is not available. Open this app from a Monday board view.");
      return;
    }

    setIsBusy(true);

    try {
      await createMondayGroup(boardId, swimlaneName);
      await refreshData();
    } catch (error) {
      console.error("Failed to create swimlane.", error);

      const message =
        error instanceof Error
          ? error.message
          : "Unknown error while creating swimlane.";

      alert(`Failed to create swimlane:\n\n${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCreateTask(input: {
    title: string;
    description: string;
    groupId: string;
    startSprint: number;
    endSprint: number;
    team: string;
    color: GanttTaskColor;
    dependencies: string;
  }) {
    if (!boardId) {
      alert("Board ID is not available. Open this app from a Monday board view.");
      return;
    }

    setIsBusy(true);

    try {
      await createPlannerItem(
        {
          boardId,
          groupId: input.groupId,
          title: input.title,
          description: input.description,
          startSprint: input.startSprint,
          endSprint: input.endSprint,
          team: input.team,
          color: input.color,
          dependencies: input.dependencies,
        },
        defaultPlannerColumnTitles
      );

      await refreshData();
    } catch (error) {
      console.error("Failed to create planner bar.", error);

      const message =
        error instanceof Error
          ? error.message
          : "Unknown error while creating planner bar.";

      alert(`Failed to create planner bar:\n\n${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleUpdateTask(input: {
    itemId: string;
    title: string;
    description: string;
    groupId: string;
    startSprint: number;
    endSprint: number;
    team: string;
    color: GanttTaskColor;
    dependencies: string;
    resourceIds: string[];
  }): Promise<void> {
    if (!boardId) {
      alert("Board ID is not available. Open this app from a Monday board view.");
      return;
    }

    const previousTask =
      data.tasks.find(
        (existingTask) => existingTask.id === input.itemId
      ) ?? selectedTask;

    const targetPhase = data.phases.find(
      (phase) => (phase.mondayGroupId ?? phase.id) === input.groupId
    );

    const nextResources = input.resourceIds.map((resourceId) => {
      return (
        data.resourceOptions?.find(
          (resource) => resource.id === resourceId
        ) ?? {
          id: resourceId,
          name: `Resource ${resourceId}`,
        }
      );
    });

    const nextTaskPatch: Partial<GanttTask> = {
      title: input.title,
      description: input.description,
      phaseId: targetPhase?.id ?? previousTask?.phaseId,
      mondayGroupId: input.groupId,
      startPosition: input.startSprint,
      endPosition: input.endSprint,
      team: input.team,
      color: input.color,
      dependencies: input.dependencies,
      resources: nextResources,
      leftPercent: undefined,
      widthPercent: undefined,
    };

    setData((currentData) => ({
      ...currentData,
      tasks: currentData.tasks.map((existingTask) =>
        existingTask.id === input.itemId
          ? {
              ...existingTask,
              ...nextTaskPatch,
            }
          : existingTask
      ),
    }));

    setSelectedTask((currentSelectedTask) => {
      if (
        !currentSelectedTask ||
        currentSelectedTask.id !== input.itemId
      ) {
        return currentSelectedTask;
      }

      return {
        ...currentSelectedTask,
        ...nextTaskPatch,
      };
    });

    try {
      await updatePlannerItem(
        {
          boardId,
          itemId: input.itemId,
          groupId: input.groupId,
          title: input.title,
          description: input.description,
          startSprint: input.startSprint,
          endSprint: input.endSprint,
          team: input.team,
          color: input.color,
          dependencies: input.dependencies,
        },
        defaultPlannerColumnTitles
      );

      await updatePlannerItemResources(
        {
          boardId,
          itemId: input.itemId,
          resourceIds: input.resourceIds,
        },
        defaultPlannerColumnTitles
      );
    } catch (error) {
      console.error("Failed to update planner bar.", error);

      if (previousTask) {
        setData((currentData) => ({
          ...currentData,
          tasks: currentData.tasks.map((existingTask) =>
            existingTask.id === input.itemId
              ? {
                  ...previousTask,
                }
              : existingTask
          ),
        }));

        setSelectedTask((currentSelectedTask) => {
          if (
            !currentSelectedTask ||
            currentSelectedTask.id !== input.itemId
          ) {
            return currentSelectedTask;
          }

          return {
            ...previousTask,
          };
        });
      }

      const message =
        error instanceof Error
          ? error.message
          : "Unknown error while updating planner bar.";

      alert(`Failed to update planner bar:\n\n${message}`);

      await refreshData();
    }
  }

  async function handleDeleteTask(task: GanttTask) {
    const confirmed = window.confirm(
      `Delete "${task.title}"?\n\nThis cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setIsBusy(true);

    try {
      await deletePlannerItem(task.id);

      setSelectedTask(null);

      setData((currentData) => ({
        ...currentData,
        tasks: currentData.tasks.filter(
          (existingTask) => existingTask.id !== task.id
        ),
      }));
    } catch (error) {
      console.error("Failed to delete planner bar.", error);

      const message =
        error instanceof Error
          ? error.message
          : "Unknown error while deleting planner bar.";

      alert(`Failed to delete planner bar:\n\n${message}`);

      await refreshData();
    } finally {
      setIsBusy(false);
    }
  }

  async function handleTaskPositionChange(
    task: GanttTask,
    nextPosition: {
      startPosition: number;
      endPosition: number;
    }
  ) {
    if (!boardId) {
      alert("Board ID is not available. Open this app from a Monday board view.");
      return;
    }

    const previousStartPosition = task.startPosition ?? 0;
    const previousEndPosition = task.endPosition ?? previousStartPosition + 1;

    setData((currentData) => ({
      ...currentData,
      tasks: currentData.tasks.map((existingTask) =>
        existingTask.id === task.id
          ? {
              ...existingTask,
              startPosition: nextPosition.startPosition,
              endPosition: nextPosition.endPosition,
              leftPercent: undefined,
              widthPercent: undefined,
            }
          : existingTask
      ),
    }));

    setSelectedTask((currentSelectedTask) => {
      if (!currentSelectedTask || currentSelectedTask.id !== task.id) {
        return currentSelectedTask;
      }

      return {
        ...currentSelectedTask,
        startPosition: nextPosition.startPosition,
        endPosition: nextPosition.endPosition,
        leftPercent: undefined,
        widthPercent: undefined,
      };
    });

    try {
      await updatePlannerItemPosition(
        {
          boardId,
          itemId: task.id,
          startSprint: nextPosition.startPosition,
          endSprint: nextPosition.endPosition,
        },
        defaultPlannerColumnTitles
      );
    } catch (error) {
      console.error("Failed to update planner bar position.", error);

      setData((currentData) => ({
        ...currentData,
        tasks: currentData.tasks.map((existingTask) =>
          existingTask.id === task.id
            ? {
                ...existingTask,
                startPosition: previousStartPosition,
                endPosition: previousEndPosition,
                leftPercent: undefined,
                widthPercent: undefined,
              }
            : existingTask
        ),
      }));

      setSelectedTask((currentSelectedTask) => {
        if (!currentSelectedTask || currentSelectedTask.id !== task.id) {
          return currentSelectedTask;
        }

        return {
          ...currentSelectedTask,
          startPosition: previousStartPosition,
          endPosition: previousEndPosition,
          leftPercent: undefined,
          widthPercent: undefined,
        };
      });

      const message =
        error instanceof Error
          ? error.message
          : "Unknown error while updating planner bar position.";

      alert(`Failed to update planner bar position:\n\n${message}`);

      await refreshData();
    }
  }

  async function handleTaskGroupChange(
    task: GanttTask,
    target: {
      phaseId: string;
      mondayGroupId?: string;
    }
  ) {
    if (!boardId) {
      alert("Board ID is not available. Open this app from a Monday board view.");
      return;
    }

    const targetMondayGroupId = target.mondayGroupId;

    if (!targetMondayGroupId) {
      alert("The target swimlane does not have a Monday group ID.");
      return;
    }

    const previousPhaseId = task.phaseId;
    const previousMondayGroupId = task.mondayGroupId;

    setData((currentData) => ({
      ...currentData,
      tasks: currentData.tasks.map((existingTask) =>
        existingTask.id === task.id
          ? {
              ...existingTask,
              phaseId: target.phaseId,
              mondayGroupId: targetMondayGroupId,
            }
          : existingTask
      ),
    }));

    setSelectedTask((currentSelectedTask) => {
      if (!currentSelectedTask || currentSelectedTask.id !== task.id) {
        return currentSelectedTask;
      }

      return {
        ...currentSelectedTask,
        phaseId: target.phaseId,
        mondayGroupId: targetMondayGroupId,
      };
    });

    try {
      await updatePlannerItemGroup({
        itemId: task.id,
        groupId: targetMondayGroupId,
      });
    } catch (error) {
      console.error("Failed to move planner bar to swimlane.", error);

      setData((currentData) => ({
        ...currentData,
        tasks: currentData.tasks.map((existingTask) =>
          existingTask.id === task.id
            ? {
                ...existingTask,
                phaseId: previousPhaseId,
                mondayGroupId: previousMondayGroupId,
              }
            : existingTask
        ),
      }));

      setSelectedTask((currentSelectedTask) => {
        if (!currentSelectedTask || currentSelectedTask.id !== task.id) {
          return currentSelectedTask;
        }

        return {
          ...currentSelectedTask,
          phaseId: previousPhaseId,
          mondayGroupId: previousMondayGroupId,
        };
      });

      const message =
        error instanceof Error
          ? error.message
          : "Unknown error while moving planner bar to swimlane.";

      alert(`Failed to move planner bar to swimlane:\n\n${message}`);

      await refreshData();
    }
  }

  async function handleMoveTaskToSwimlane(
    task: GanttTask,
    phase: { id: string; mondayGroupId?: string }
  ) {
    if (!phase.mondayGroupId) {
      alert("Target swimlane does not have a Monday group ID.");
      return;
    }

    await handleTaskGroupChange(task, {
      phaseId: phase.id,
      mondayGroupId: phase.mondayGroupId,
    });
  }

  async function handleTaskResourceDrop(
    task: GanttTask,
    resource: PlannerResource
  ): Promise<void> {
    if (!boardId) {
      alert(
        "Board ID is not available. Open this app from a Monday board view."
      );
      return;
    }

    const previousResources = task.resources ?? [];

    const resourceAlreadyAssigned = previousResources.some(
      (assignedResource) =>
        assignedResource.id === resource.id
    );

    const nextResources = resourceAlreadyAssigned
      ? previousResources
      : [...previousResources, resource];

    setData((currentData) => ({
      ...currentData,
      tasks: currentData.tasks.map((existingTask) =>
        existingTask.id === task.id
          ? {
              ...existingTask,
              resources: nextResources,
            }
          : existingTask
      ),
    }));

    setSelectedTask((currentSelectedTask) => {
      if (
        !currentSelectedTask ||
        currentSelectedTask.id !== task.id
      ) {
        return {
          ...task,
          resources: nextResources,
        };
      }

      return {
        ...currentSelectedTask,
        resources: nextResources,
      };
    });

    if (resourceAlreadyAssigned) {
      return;
    }

    try {
      await updatePlannerItemResources(
        {
          boardId,
          itemId: task.id,
          resourceIds: nextResources.map(
            (assignedResource) => assignedResource.id
          ),
        },
        defaultPlannerColumnTitles
      );
    } catch (error) {
      console.error(
        "Failed to assign resource to planner bar.",
        error
      );

      setData((currentData) => ({
        ...currentData,
        tasks: currentData.tasks.map((existingTask) =>
          existingTask.id === task.id
            ? {
                ...existingTask,
                resources: previousResources,
              }
            : existingTask
        ),
      }));

      setSelectedTask((currentSelectedTask) => {
        if (
          !currentSelectedTask ||
          currentSelectedTask.id !== task.id
        ) {
          return currentSelectedTask;
        }

        return {
          ...currentSelectedTask,
          resources: previousResources,
        };
      });

      const message =
        error instanceof Error
          ? error.message
          : "Unknown error while assigning the resource.";

      alert(`Failed to assign resource:\n\n${message}`);
    }
  }

  function handleTaskClick(task: GanttTask) {
    setSelectedTask(task);
  }

  async function handleOpenTaskItem(task: GanttTask) {
    const numericItemId = Number(task.id);

    if (Number.isNaN(numericItemId)) {
      console.warn("Task does not have a numeric Monday item id:", task);
      alert("This bar does not appear to be linked to a Monday item.");
      return;
    }

    try {
      await openMondayItemCard(task.id);
    } catch (error) {
      console.error("Failed to open Monday item card.", error);

      const message =
        error instanceof Error
          ? error.message
          : "Unknown error while opening Monday item card.";

      alert(`Failed to open Monday item:\n\n${message}`);
    }
  }

  if (isLoading || !isSettingsLoaded) {
    return <div className="planner-loading">Loading sprint gantt...</div>;
  }

  if (missingColumns.length > 0) {
    return (
      <div className="planner-setup-screen">
        <h2>Planner Setup Required</h2>

        <p>
          This board is missing required planner columns. Click Set Up Table to
          create only the missing columns.
        </p>

        <div className="planner-setup-card">
          <h3>Missing Columns</h3>

          <ul>
            {missingColumns.map((column) => (
              <li key={column.title}>
                {column.title} <span>({column.type})</span>
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          className="panel-primary-button planner-setup-button"
          disabled={isBusy || !boardId}
          onClick={async () => {
            if (!boardId) {
              return;
            }

            setIsBusy(true);

            try {
              await setupPlannerBoard(boardId);
              await refreshData();
            } catch (error) {
              console.error("Failed to set up planner table.", error);

              const message =
                error instanceof Error
                  ? error.message
                  : "Unknown error while setting up planner table.";

              alert(`Failed to set up planner table:\n\n${message}`);
            } finally {
              setIsBusy(false);
            }
          }}
        >
          {isBusy ? "Setting Up Table..." : "Set Up Table"}
        </button>
      </div>
    );
  }

  return (
    <div className="planner-app-shell">
      <PlannerControlPanel
        boardId={boardId}
        phases={displayData.phases}
        tasks={displayData.tasks}
        teamOptions={displayData.teamOptions ?? []}
        resourceOptions={displayData.resourceOptions ?? []}
        settings={settings}
        isBusy={isBusy}
        selectedTask={selectedTask}
        onSettingsChange={handleSettingsChange}
        onCreateSwimlane={handleCreateSwimlane}
        onCreateTask={handleCreateTask}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
        onClearSelectedTask={() => setSelectedTask(null)}
        onMoveTaskToSwimlane={handleMoveTaskToSwimlane}
        onRefresh={refreshData}
      />

      <main className="planner-main">
        <div className="planner-debug-bar">
          Debug: {debugInfo}
        </div>

        <SprintGantt
          data={displayData}
          sourceLabel={sourceLabel}
          settings={settings}
          selectedTaskId={selectedTask?.id ?? null}
          onTaskClick={handleTaskClick}
          onTaskOpen={handleOpenTaskItem}
          onTaskPositionChange={handleTaskPositionChange}
          onTaskGroupChange={handleTaskGroupChange}
          onTaskResourceDrop={handleTaskResourceDrop}
        />
      </main>
    </div>
  );
}

export default App;