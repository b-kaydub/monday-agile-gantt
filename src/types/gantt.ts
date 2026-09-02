export type Sprint = {
  id: string;
  name: string;
  dateLabel: string;
  sortOrder: number;

  /*
    startPosition and endPosition define the numeric project coordinate
    represented by this visible project column.

    Example:
      Sprint 00 could display from position 0 to 1.
      October could display from position 3 to 4.
      A custom phase could display from position 4 to 5.

    The label can be anything, but placement math uses numeric positions.
  */
  startPosition?: number;
  endPosition?: number;

  /*
    These are optional for future timeline/date-based support.
  */
  startDate?: string;
  endDate?: string;
};

export type Phase = {
  id: string;

  /*
    Actual Monday group ID.

    This is required when creating new Monday items inside a swimlane/group.
  */
  mondayGroupId?: string;

  title: string;
  sortOrder: number;
};

export type GanttTaskStatus =
  | "not-started"
  | "in-progress"
  | "blocked"
  | "complete"
  | "milestone";

export type GanttTaskColor =
  | "blue"
  | "yellow"
  | "coral"
  | "green"
  | "orange"
  | "purple"
  | "red"
  | "gray";

/*
  Represents an assignable Monday user.

  id:
    The Monday user ID used when writing assignments to a People column.

  name:
    The display name shown in the resource list and Planner Controls.

  photoUrl:
    Optional profile image returned by Monday.
*/
export type PlannerResource = {
  id: string;
  name: string;
  photoUrl?: string;
};

export type ResourceConflictSummary = {
  resourceId: string;
  resourceName: string;

  capacity: number;

  assignedTaskIds: string[];

  conflictingTaskIds: string[];

  maxConcurrentAssignments: number;

  hasConflict: boolean;
};

export type GanttTask = {
  id: string;
  title: string;

  /*
    phaseId connects the task to the swimlane.

    In this planner model, phaseId maps to a Monday group.
  */
  phaseId: string;

  /*
    sprintId is retained for compatibility with the existing rendering
    components.

    The planner primarily uses startPosition and endPosition.
  */
  sprintId: string;

  /*
    sprintSpan is retained for compatibility with existing rendering
    components.

    The planner primarily uses leftPercent and widthPercent.
  */
  mondayGroupId?: string;
  sprintSpan?: number;

  status: GanttTaskStatus;
  color: GanttTaskColor;

  owner?: string;
  team?: string;

  /*
    Monday users assigned through the Resources People column.

    Multiple people may be assigned to one planner bar.
  */
  resources?: PlannerResource[];

  /*
    Controls the vertical order of a team within a swimlane.

    All tasks belonging to the same team and Monday group should receive
    the same teamRowOrder value.

    Lower values appear higher in the swimlane.
  */
  teamRowOrder?: number;

  isMilestone?: boolean;

  /*
    Optional descriptive metadata.
  */
  description?: string;
  dependencies?: string;

  /*
    Decimal project placement.

    Example:
      startPosition: 1.25
      endPosition: 3.5

    This means the bar begins 25% into project column 1 and ends halfway
    through project column 3.
  */
  startPosition?: number;
  endPosition?: number;

  /*
    Optional date fields for future timeline support.
  */
  startDate?: string;
  endDate?: string;

  /*
    Visual rendering fields calculated from startPosition and endPosition.
  */
  leftPercent?: number;
  widthPercent?: number;
};

export type Milestone = {
  id: string;
  sprintId: string;
  label: string;
  dateLabel: string;
};

export type MondayColumnMapping = {
  descriptionColumnTitle: string;
  startSprintColumnTitle: string;
  endSprintColumnTitle: string;
  teamColumnTitle: string;
  colorColumnTitle: string;
  dependenciesColumnTitle: string;
  resourcesColumnTitle: string;

  /*
    Retained for backwards compatibility.

    The planner does not rely on these columns for the current model.
  */
  sprintColumnTitle?: string;
  statusColumnTitle?: string;
  timelineColumnTitle?: string;
};

export type PlannerProjectColumn = {
  id: string;
  label: string;
  dateLabel?: string;
  startPosition: number;
  endPosition: number;
  sortOrder: number;
};

export type PlannerDisplayOptions = {
  showAppLabel: boolean;
  showTitle: boolean;
  showSource: boolean;
  showSprintLabels: boolean;
  showDateRanges: boolean;
  showLegend: boolean;
  showDependencies: boolean;
};

export type TeamLegendItem = {
  id: string;
  label: string;
  color: GanttTaskColor;
};

export type GanttDependency = {
  id: string;
  fromTaskId: string;
  toTaskId: string;
  lineStyle: "straight" | "bent";
};

export type SprintPlanningSettings = {
  projectTitle: string;
  totalProjectUnits: number;
  projectColumns: PlannerProjectColumn[];
  displayOptions: PlannerDisplayOptions;
  teamLegend: TeamLegendItem[];
  resourceCapacities: Record<string, number>;
  resourceDirectory: PlannerResource[];
};

export type SprintGanttData = {
  sprints: Sprint[];
  phases: Phase[];
  tasks: GanttTask[];
  milestones: Milestone[];
  teamOptions?: string[];

  /*
    Monday users who may be assigned to planner bars.

    This list will be displayed above the planner and in Planner Controls.
  */
  resourceOptions?: PlannerResource[];
};