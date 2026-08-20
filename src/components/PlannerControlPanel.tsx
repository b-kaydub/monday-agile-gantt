import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import type {
  GanttTask,
  GanttTaskColor,
  Phase,
  PlannerProjectColumn,
  SprintPlanningSettings,
} from "../types/gantt";

type PlannerUpdateTaskInput = {
  itemId: string;
  title: string;
  description: string;
  groupId: string;
  startSprint: number;
  endSprint: number;
  team: string;
  color: GanttTaskColor;
  dependencies: string;
};

type PlannerCreateTaskInput = {
  title: string;
  description: string;
  groupId: string;
  startSprint: number;
  endSprint: number;
  team: string;
  color: GanttTaskColor;
  dependencies: string;
};

type PlannerControlPanelProps = {
  boardId: number | string | null;
  phases: Phase[];
  tasks: GanttTask[];
  teamOptions: string[];
  settings: SprintPlanningSettings;
  isBusy: boolean;
  selectedTask: GanttTask | null;

  onSettingsChange: (settings: SprintPlanningSettings) => void;
  onCreateSwimlane: (swimlaneName: string) => void | Promise<void>;
  onCreateTask: (input: PlannerCreateTaskInput) => void | Promise<void>;
  onUpdateTask: (input: PlannerUpdateTaskInput) => void | Promise<void>;
  onDeleteTask: (task: GanttTask) => void | Promise<void>;
  onMoveTaskToSwimlane?: (
    task: GanttTask,
    phase: Phase
  ) => void | Promise<void>;
  onClearSelectedTask: () => void;
  onRefresh: () => void | Promise<void>;
};

type SectionKey =
  | "boardSetup"
  | "createSwimlane"
  | "selectedBar"
  | "createBar"
  | "display";

export function PlannerControlPanel({
  boardId,
  phases,
  tasks,
  teamOptions,
  settings,
  isBusy,
  selectedTask,
  onSettingsChange,
  onCreateSwimlane,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onMoveTaskToSwimlane,
  onClearSelectedTask,
  onRefresh,
}: PlannerControlPanelProps) {
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    boardSetup: false,
    createSwimlane: false,
    selectedBar: true,
    createBar: false,
    display: false,
  });

  const [newSwimlaneName, setNewSwimlaneName] = useState("");

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [startSprint, setStartSprint] = useState("0");
  const [endSprint, setEndSprint] = useState("1");
  const [team, setTeam] = useState("");
  const [dependencies, setDependencies] = useState("");
  const [newCreateTeamName, setNewCreateTeamName] = useState("");

  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editGroupId, setEditGroupId] = useState("");
  const [editStartSprint, setEditStartSprint] = useState("0");
  const [editEndSprint, setEditEndSprint] = useState("1");
  const [editTeam, setEditTeam] = useState("");
  const [editDependencies, setEditDependencies] = useState("");
  const [newEditTeamName, setNewEditTeamName] = useState("");

  const selectedPhaseOptions = useMemo(() => {
    return phases.map((phase) => ({
      id: phase.mondayGroupId ?? phase.id,
      title: phase.title,
    }));
  }, [phases]);

  const visibleProjectColumns = useMemo(() => {
    return resizeProjectColumns(
      settings.projectColumns,
      settings.totalProjectUnits
    );
  }, [settings.projectColumns, settings.totalProjectUnits]);

  const createDependencyOptions = useMemo(() => {
    return [...tasks].sort((a, b) => a.title.localeCompare(b.title));
  }, [tasks]);

  const editDependencyOptions = useMemo(() => {
    return tasks
      .filter((task) => task.id !== selectedTask?.id)
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [tasks, selectedTask]);

const availableTeamOptions = useMemo(() => {
  const teamNames = new Set<string>();

  teamOptions.forEach((teamOption) => {
    const trimmedTeamOption = teamOption.trim();

    if (trimmedTeamOption) {
      teamNames.add(trimmedTeamOption);
    }
  });

  tasks.forEach((task) => {
    const taskTeam = task.team?.trim();

    if (taskTeam) {
      teamNames.add(taskTeam);
    }
  });

  if (team.trim()) {
    teamNames.add(team.trim());
  }

  if (editTeam.trim()) {
    teamNames.add(editTeam.trim());
  }

  return Array.from(teamNames).sort((a, b) => a.localeCompare(b));
}, [teamOptions, tasks, team, editTeam]);

    function getColorForTeam(teamName: string): GanttTaskColor {
    const normalizedTeamName = teamName.trim().toLowerCase();

    if (!normalizedTeamName) {
        return "gray";
    }

    const matchingLegendItem = settings.teamLegend.find(
        (legendItem) => legendItem.label.trim().toLowerCase() === normalizedTeamName
    );

    return matchingLegendItem?.color ?? "gray";
    }

    function getNextTeamColor(): GanttTaskColor {
    const availableColors: GanttTaskColor[] = [
        "blue",
        "green",
        "orange",
        "purple",
        "coral",
        "yellow",
        "red",
        "gray",
    ];

    return availableColors[settings.teamLegend.length % availableColors.length];
    }

    function ensureTeamExists(teamName: string): GanttTaskColor {
    const trimmedTeamName = teamName.trim();

    if (!trimmedTeamName) {
        return "gray";
    }

    const existingLegendItem = settings.teamLegend.find(
        (legendItem) =>
        legendItem.label.trim().toLowerCase() === trimmedTeamName.toLowerCase()
    );

    if (existingLegendItem) {
        return existingLegendItem.color;
    }

    const assignedColor = getNextTeamColor();

    onSettingsChange({
        ...settings,
        teamLegend: [
        ...settings.teamLegend,
        {
            id: createStableId(trimmedTeamName),
            label: trimmedTeamName,
            color: assignedColor,
        },
        ],
    });

    return assignedColor;
    }

    function handleAddCreateTeam() {
    const trimmedTeamName = newCreateTeamName.trim();

    if (!trimmedTeamName) {
        return;
    }

    ensureTeamExists(trimmedTeamName);
    setTeam(trimmedTeamName);
    setNewCreateTeamName("");
    }

    function handleAddEditTeam() {
    const trimmedTeamName = newEditTeamName.trim();

    if (!trimmedTeamName) {
        return;
    }

    ensureTeamExists(trimmedTeamName);
    setEditTeam(trimmedTeamName);
    setNewEditTeamName("");
    }


  useEffect(() => {
    if (!selectedTask) {
      return;
    }

    const fallbackGroupId =
      phases.find((phase) => phase.id === selectedTask.phaseId)?.mondayGroupId ??
      selectedTask.phaseId;

    setEditTitle(selectedTask.title ?? "");
    setEditDescription(selectedTask.description ?? "");
    setEditGroupId(selectedTask.mondayGroupId ?? fallbackGroupId);
    setEditStartSprint(String(selectedTask.startPosition ?? 0));
    setEditEndSprint(String(selectedTask.endPosition ?? 1));
    setEditTeam(selectedTask.team ?? "");
    setEditDependencies(selectedTask.dependencies ?? "");

    setOpenSections((currentSections) => ({
      ...currentSections,
      selectedBar: true,
    }));
  }, [selectedTask, phases]);

  function toggleSection(sectionKey: SectionKey) {
    setOpenSections((currentSections) => ({
      ...currentSections,
      [sectionKey]: !currentSections[sectionKey],
    }));
  }

  async function handleCreateSwimlane() {
    const trimmedName = newSwimlaneName.trim();

    if (!trimmedName) {
      alert("Enter a swimlane name first.");
      return;
    }

    await onCreateSwimlane(trimmedName);
    setNewSwimlaneName("");
  }

  async function handleCreateTask() {
    const trimmedTitle = taskTitle.trim();

    if (!trimmedTitle) {
      alert("Enter a task title first.");
      return;
    }

    if (!selectedGroupId) {
      alert("Select a swimlane first.");
      return;
    }

    const parsedStartSprint = Number(startSprint);
    const parsedEndSprint = Number(endSprint);

    if (Number.isNaN(parsedStartSprint)) {
      alert("Start Sprint must be a number. Decimals are allowed.");
      return;
    }

    if (Number.isNaN(parsedEndSprint)) {
      alert("End Sprint must be a number. Decimals are allowed.");
      return;
    }

    if (parsedEndSprint <= parsedStartSprint) {
      alert("End Sprint must be greater than Start Sprint.");
      return;
    }

    const assignedColor = ensureTeamExists(team);

    await onCreateTask({
    title: trimmedTitle,
    description: taskDescription,
    groupId: selectedGroupId,
    startSprint: parsedStartSprint,
    endSprint: parsedEndSprint,
    team,
    color: assignedColor,
    dependencies,
    });


    setTaskTitle("");
    setTaskDescription("");
    setSelectedGroupId("");
    setStartSprint("0");
    setEndSprint("1");
    setTeam("");
    setDependencies("");
  }

  async function handleUpdateSelectedTask() {
    if (!selectedTask) {
      alert("Select a bar first.");
      return;
    }

    const trimmedTitle = editTitle.trim();

    if (!trimmedTitle) {
      alert("Title cannot be blank.");
      return;
    }

    if (!editGroupId) {
      alert("Select a swimlane.");
      return;
    }

    const parsedStartSprint = Number(editStartSprint);
    const parsedEndSprint = Number(editEndSprint);

    if (Number.isNaN(parsedStartSprint)) {
      alert("Start Sprint must be a number. Decimals are allowed.");
      return;
    }

    if (Number.isNaN(parsedEndSprint)) {
      alert("End Sprint must be a number. Decimals are allowed.");
      return;
    }

    if (parsedEndSprint <= parsedStartSprint) {
      alert("End Sprint must be greater than Start Sprint.");
      return;
    }

    const assignedColor = ensureTeamExists(editTeam);

    await onUpdateTask({
      itemId: selectedTask.id,
      title: trimmedTitle,
      description: editDescription,
      groupId: editGroupId,
      startSprint: parsedStartSprint,
      endSprint: parsedEndSprint,
      team: editTeam,
      color: assignedColor,
      dependencies: editDependencies,
    });
  }

  async function handleMoveToSelectedSwimlane() {
    if (!selectedTask || !onMoveTaskToSwimlane) {
      return;
    }

    const selectedPhase = phases.find(
      (phase) => (phase.mondayGroupId ?? phase.id) === editGroupId
    );

    if (!selectedPhase) {
      alert("Select a valid swimlane.");
      return;
    }

    await onMoveTaskToSwimlane(selectedTask, selectedPhase);
  }

  function updateDisplayOption(
    key: keyof SprintPlanningSettings["displayOptions"],
    checked: boolean
  ) {
    onSettingsChange({
      ...settings,
      displayOptions: {
        ...settings.displayOptions,
        [key]: checked,
      },
    });
  }

  function updateTotalProjectUnits(value: string) {
    const parsedValue = Number(value);

    if (Number.isNaN(parsedValue) || parsedValue <= 0) {
      return;
    }

    const nextTotalProjectUnits = Math.ceil(parsedValue);

    onSettingsChange({
      ...settings,
      totalProjectUnits: nextTotalProjectUnits,
      projectColumns: resizeProjectColumns(
        settings.projectColumns,
        nextTotalProjectUnits
      ),
    });
  }

  function updateProjectTitle(value: string) {
    onSettingsChange({
      ...settings,
      projectTitle: value,
    });
  }

  function updateProjectColumnLabel(index: number, value: string) {
    const nextProjectColumns = resizeProjectColumns(
      settings.projectColumns,
      settings.totalProjectUnits
    );

    nextProjectColumns[index] = {
      ...nextProjectColumns[index],
      label: value,
    };

    onSettingsChange({
      ...settings,
      projectColumns: nextProjectColumns,
    });
  }

  function updateProjectColumnDateLabel(index: number, value: string) {
    const nextProjectColumns = resizeProjectColumns(
      settings.projectColumns,
      settings.totalProjectUnits
    );

    nextProjectColumns[index] = {
      ...nextProjectColumns[index],
      dateLabel: value,
    };

    onSettingsChange({
      ...settings,
      projectColumns: nextProjectColumns,
    });
  }

  function resetProjectColumnLabels() {
    onSettingsChange({
      ...settings,
      projectColumns: resizeProjectColumns([], settings.totalProjectUnits),
    });
  }

  return (
    <div
      className={
        isPanelCollapsed
          ? "planner-controls-wrapper planner-controls-wrapper-collapsed"
          : "planner-controls-wrapper"
      }
    >
      <aside className="planner-control-panel" aria-hidden={isPanelCollapsed}>
        <div className="panel-header">
          <div>
            <div className="panel-eyebrow">Board</div>
            <h2>Planner Controls</h2>
          </div>

          <button
            type="button"
            className="panel-collapse-button"
            onClick={() => setIsPanelCollapsed(true)}
            title="Hide planner controls"
          >
            ‹
          </button>
        </div>

        <div className="panel-help-text">
          Board ID: {boardId ? boardId : "Not available outside Monday"}
        </div>

        <button
          type="button"
          className="panel-secondary-button"
          onClick={onRefresh}
          disabled={isBusy}
        >
          Refresh Board Data
        </button>

        <CollapsibleSection
          title="Board Setup"
          isOpen={openSections.boardSetup}
          onToggle={() => toggleSection("boardSetup")}
        >
          <label className="panel-label">
            Project Title
            <input
              className="panel-input"
              value={settings.projectTitle}
              onChange={(event) => updateProjectTitle(event.target.value)}
            />
          </label>

          <label className="panel-label">
            Total Project Units
            <input
              className="panel-input"
              type="number"
              min="1"
              step="1"
              value={settings.totalProjectUnits}
              onChange={(event) => updateTotalProjectUnits(event.target.value)}
            />
          </label>

          <div className="panel-help-text">
            Bars can use decimals. Example: Start 1.25 and End 3.5. The labels
            below only control the visible headers.
          </div>

          <div className="project-column-editor">
            <div className="project-column-editor-header">
              <span>Project Columns</span>

              <button
                type="button"
                className="panel-mini-button"
                onClick={resetProjectColumnLabels}
              >
                Reset
              </button>
            </div>

            {visibleProjectColumns.map((projectColumn, index) => (
              <div key={projectColumn.id} className="project-column-row">
                <div className="project-column-index">{index}</div>

                <div className="project-column-fields">
                  <input
                    className="panel-input project-column-input"
                    value={projectColumn.label}
                    onChange={(event) =>
                      updateProjectColumnLabel(index, event.target.value)
                    }
                    placeholder={`Sprint ${index}`}
                  />

                  <input
                    className="panel-input project-column-input"
                    value={projectColumn.dateLabel ?? ""}
                    onChange={(event) =>
                      updateProjectColumnDateLabel(index, event.target.value)
                    }
                    placeholder="Optional date range"
                  />
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Create Swimlane"
          isOpen={openSections.createSwimlane}
          onToggle={() => toggleSection("createSwimlane")}
        >
          <label className="panel-label">
            Swimlane Name
            <input
              className="panel-input"
              value={newSwimlaneName}
              onChange={(event) => setNewSwimlaneName(event.target.value)}
              placeholder="MARKET RESEARCH AND ANALYSIS"
            />
          </label>

          <button
            type="button"
            className="panel-primary-button"
            onClick={handleCreateSwimlane}
            disabled={isBusy || !boardId}
          >
            Create Swimlane
          </button>
        </CollapsibleSection>

        <CollapsibleSection
          title="Selected Bar Settings"
          isOpen={openSections.selectedBar}
          onToggle={() => toggleSection("selectedBar")}
        >
          {!selectedTask ? (
            <div className="panel-help-text">
              Click a bar in the planner to edit its settings here.
            </div>
          ) : (
            <>
              <div className="selected-task-pill">
                Editing: {selectedTask.title}
              </div>

              <label className="panel-label">
                Title
                <input
                  className="panel-input"
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                />
              </label>

              <label className="panel-label">
                Description
                <textarea
                  className="panel-textarea"
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                />
              </label>

              <label className="panel-label">
                Swimlane
                <select
                  className="panel-input"
                  value={editGroupId}
                  onChange={(event) => setEditGroupId(event.target.value)}
                >
                  <option value="">Select swimlane</option>
                  {selectedPhaseOptions.map((phase) => (
                    <option key={phase.id} value={phase.id}>
                      {phase.title}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="panel-secondary-button panel-spaced-button"
                onClick={handleMoveToSelectedSwimlane}
                disabled={!selectedTask || isBusy || !onMoveTaskToSwimlane}
              >
                Move To Swimlane
              </button>

              <div className="panel-two-column">
                <label className="panel-label">
                  Start Sprint
                  <input
                    className="panel-input"
                    type="number"
                    step="0.25"
                    value={editStartSprint}
                    onChange={(event) => setEditStartSprint(event.target.value)}
                  />
                </label>

                <label className="panel-label">
                  End Sprint
                  <input
                    className="panel-input"
                    type="number"
                    step="0.25"
                    value={editEndSprint}
                    onChange={(event) => setEditEndSprint(event.target.value)}
                  />
                </label>
              </div>

              <TeamSelectWithAdd
                label="Team"
                value={editTeam}
                teamOptions={availableTeamOptions}
                newTeamName={newEditTeamName}
                assignedColor={getColorForTeam(editTeam)}
                onChange={setEditTeam}
                onNewTeamNameChange={setNewEditTeamName}
                onAddTeam={handleAddEditTeam}
              />

              <DependencyPicker
                label="Dependencies"
                tasks={editDependencyOptions}
                selectedDependencyIds={parseDependencyIds(editDependencies)}
                onChange={(nextDependencyIds) =>
                  setEditDependencies(nextDependencyIds.join(","))
                }
                emptyText="No other bars are available yet."
              />

              <button
                type="button"
                className="panel-primary-button"
                onClick={handleUpdateSelectedTask}
                disabled={isBusy || !boardId}
              >
                Update Selected Bar
              </button>

              <button
                type="button"
                className="panel-danger-button panel-spaced-button"
                onClick={() => onDeleteTask(selectedTask)}
                disabled={isBusy}
              >
                Delete Selected Bar
              </button>

              <button
                type="button"
                className="panel-secondary-button panel-spaced-button"
                onClick={onClearSelectedTask}
                disabled={isBusy}
              >
                Clear Selection
              </button>
            </>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title="Create Bar"
          isOpen={openSections.createBar}
          onToggle={() => toggleSection("createBar")}
        >
          <label className="panel-label">
            Title
            <input
              className="panel-input"
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
              placeholder="Conduct competitor analysis"
            />
          </label>

          <label className="panel-label">
            Description
            <textarea
              className="panel-textarea"
              value={taskDescription}
              onChange={(event) => setTaskDescription(event.target.value)}
              placeholder="Optional description"
            />
          </label>

          <label className="panel-label">
            Swimlane
            <select
              className="panel-input"
              value={selectedGroupId}
              onChange={(event) => setSelectedGroupId(event.target.value)}
            >
              <option value="">Select swimlane</option>
              {selectedPhaseOptions.map((phase) => (
                <option key={phase.id} value={phase.id}>
                  {phase.title}
                </option>
              ))}
            </select>
          </label>

          <div className="panel-two-column">
            <label className="panel-label">
              Start Sprint
              <input
                className="panel-input"
                type="number"
                step="0.25"
                value={startSprint}
                onChange={(event) => setStartSprint(event.target.value)}
              />
            </label>

            <label className="panel-label">
              End Sprint
              <input
                className="panel-input"
                type="number"
                step="0.25"
                value={endSprint}
                onChange={(event) => setEndSprint(event.target.value)}
              />
            </label>
          </div>

          <TeamSelectWithAdd
            label="Team"
            value={team}
            teamOptions={availableTeamOptions}
            newTeamName={newCreateTeamName}
            assignedColor={getColorForTeam(team)}
            onChange={setTeam}
            onNewTeamNameChange={setNewCreateTeamName}
            onAddTeam={handleAddCreateTeam}
          />

          <DependencyPicker
            label="Dependencies"
            tasks={createDependencyOptions}
            selectedDependencyIds={parseDependencyIds(dependencies)}
            onChange={(nextDependencyIds) =>
              setDependencies(nextDependencyIds.join(","))
            }
            emptyText="Create at least one other bar before adding dependencies."
          />

          <button
            type="button"
            className="panel-primary-button"
            onClick={handleCreateTask}
            disabled={isBusy || !boardId}
          >
            Create Bar
          </button>
        </CollapsibleSection>

        <CollapsibleSection
          title="Display"
          isOpen={openSections.display}
          onToggle={() => toggleSection("display")}
        >
          <label className="panel-checkbox-label">
            <input
              type="checkbox"
              checked={settings.displayOptions.showAppLabel}
              onChange={(event) =>
                updateDisplayOption("showAppLabel", event.target.checked)
              }
            />
            Show App Label
          </label>

          <label className="panel-checkbox-label">
            <input
              type="checkbox"
              checked={settings.displayOptions.showTitle}
              onChange={(event) =>
                updateDisplayOption("showTitle", event.target.checked)
              }
            />
            Show Title
          </label>

          <label className="panel-checkbox-label">
            <input
              type="checkbox"
              checked={settings.displayOptions.showSource}
              onChange={(event) =>
                updateDisplayOption("showSource", event.target.checked)
              }
            />
            Show Source
          </label>

          <label className="panel-checkbox-label">
            <input
              type="checkbox"
              checked={settings.displayOptions.showSprintLabels}
              onChange={(event) =>
                updateDisplayOption("showSprintLabels", event.target.checked)
              }
            />
            Show Sprint Labels
          </label>

          <label className="panel-checkbox-label">
            <input
              type="checkbox"
              checked={settings.displayOptions.showDateRanges}
              onChange={(event) =>
                updateDisplayOption("showDateRanges", event.target.checked)
              }
            />
            Show Date Ranges
          </label>

          <label className="panel-checkbox-label">
            <input
              type="checkbox"
              checked={settings.displayOptions.showLegend}
              onChange={(event) =>
                updateDisplayOption("showLegend", event.target.checked)
              }
            />
            Show Legend
          </label>

          <label className="panel-checkbox-label">
            <input
              type="checkbox"
              checked={settings.displayOptions.showDependencies}
              onChange={(event) =>
                updateDisplayOption("showDependencies", event.target.checked)
              }
            />
            Show Dependencies
          </label>
        </CollapsibleSection>
      </aside>

      <button
        type="button"
        className="planner-control-toggle"
        onClick={() => setIsPanelCollapsed((currentValue) => !currentValue)}
        title={isPanelCollapsed ? "Show planner controls" : "Hide planner controls"}
      >
        {isPanelCollapsed ? "›" : "‹"}
      </button>
    </div>
  );
}

function CollapsibleSection({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="panel-section">
      <button
        type="button"
        className="panel-section-header"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className="panel-section-caret">{isOpen ? "▾" : "▸"}</span>
        <h3>{title}</h3>
      </button>

      {isOpen && <div className="panel-section-body">{children}</div>}
    </section>
  );
}

function TeamSelectWithAdd({
  label,
  value,
  teamOptions,
  newTeamName,
  assignedColor,
  onChange,
  onNewTeamNameChange,
  onAddTeam,
}: {
  label: string;
  value: string;
  teamOptions: string[];
  newTeamName: string;
  assignedColor: GanttTaskColor;
  onChange: (nextValue: string) => void;
  onNewTeamNameChange: (nextValue: string) => void;
  onAddTeam: () => void;
}) {
  return (
    <div className="team-select-with-add">
      <label className="panel-label">
        {label}
        <select
          className="panel-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Select team</option>

          {teamOptions.map((teamOption) => (
            <option key={teamOption} value={teamOption}>
              {teamOption}
            </option>
          ))}
        </select>
      </label>

      <div className="team-add-row">
        <input
          className="panel-input"
          value={newTeamName}
          onChange={(event) => onNewTeamNameChange(event.target.value)}
          placeholder="Type new team"
        />

        <button
          type="button"
          className="panel-mini-button"
          onClick={onAddTeam}
          disabled={!newTeamName.trim()}
        >
          Add
        </button>
      </div>

      <div className="team-color-preview">
        <span
          className={`team-color-preview-swatch task-color-${assignedColor}`}
        />
        <span>
          Auto color: <strong>{assignedColor}</strong>
        </span>
      </div>
    </div>
  );
}

function DependencyPicker({
  label,
  tasks,
  selectedDependencyIds,
  onChange,
  emptyText,
}: {
  label: string;
  tasks: GanttTask[];
  selectedDependencyIds: string[];
  onChange: (nextDependencyIds: string[]) => void;
  emptyText: string;
}) {
  function toggleDependency(taskId: string) {
    const isSelected = selectedDependencyIds.includes(taskId);

    if (isSelected) {
      onChange(selectedDependencyIds.filter((id) => id !== taskId));
      return;
    }

    onChange([...selectedDependencyIds, taskId]);
  }

  return (
    <div className="dependency-picker">
      <div className="dependency-picker-label">{label}</div>

      {tasks.length === 0 ? (
        <div className="dependency-picker-empty">{emptyText}</div>
      ) : (
        <div className="dependency-picker-list">
          {tasks.map((task) => (
            <label key={task.id} className="dependency-picker-option">
              <input
                type="checkbox"
                checked={selectedDependencyIds.includes(task.id)}
                onChange={() => toggleDependency(task.id)}
              />
              <span className="dependency-picker-title">{task.title}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function parseDependencyIds(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/[,\n;]/)
    .map((dependencyId) => dependencyId.trim())
    .filter(Boolean);
}

function createStableId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function resizeProjectColumns(
  currentProjectColumns: PlannerProjectColumn[],
  totalProjectUnits: number
): PlannerProjectColumn[] {
  const safeTotalProjectUnits = Math.max(1, Math.ceil(totalProjectUnits));

  return Array.from({ length: safeTotalProjectUnits }, (_, index) => {
    const existingColumn =
      currentProjectColumns.find((column) => column.sortOrder === index) ??
      currentProjectColumns[index];

    return {
      id: existingColumn?.id ?? `project-column-${index}`,
      label: existingColumn?.label ?? `Sprint ${index}`,
      dateLabel: existingColumn?.dateLabel ?? "",
      startPosition: index,
      endPosition: index + 1,
      sortOrder: index,
    };
  });
}