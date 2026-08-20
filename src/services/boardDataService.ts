import { getMondayContext, monday } from "./mondayClient";

import type {
  GanttTask,
  GanttTaskColor,
  MondayColumnMapping,
  Phase,
  Sprint,
  SprintGanttData,
} from "../types/gantt";

import {
  milestones as mockMilestones,
  phases as mockPhases,
  sprints as mockSprints,
  tasks as mockTasks,
} from "../data/mockData";

type MondayColumnValue = {
  id: string;
  text: string;
  value: string | null;
  column: {
    title: string;
    type: string;
  };
};

type MondayItem = {
  id: string;
  name: string;
  group: {
    id: string;
    title: string;
  };
  column_values: MondayColumnValue[];
};

type MondayBoardColumn = {
  id: string;
  title: string;
  type: string;
  settings?: unknown;
  settings_str?: string;
};

type MondayBoardResponse = {
  boards: Array<{
    id: string;
    name: string;
    groups: Array<{
      id: string;
      title: string;
    }>;
    columns: MondayBoardColumn[];
    items_page: {
      items: MondayItem[];
    };
  }>;
};

const DEFAULT_PROJECT_UNITS = 8;

const defaultColumnMapping: MondayColumnMapping = {
  descriptionColumnTitle: "Description",
  startSprintColumnTitle: "Start Sprint",
  endSprintColumnTitle: "End Sprint",
  teamColumnTitle: "Team",
  colorColumnTitle: "Color",
  dependenciesColumnTitle: "Dependencies",

  sprintColumnTitle: "Sprint",
  statusColumnTitle: "Status",
  timelineColumnTitle: "Timeline",
};

export async function loadSprintGanttData(): Promise<SprintGanttData> {
  const context = await getMondayContext();

  console.log("Monday context:", context);

  if (!context?.boardId) {
    console.warn("No boardId found in Monday context. Using mock data.");
    return getMockSprintGanttData();
  }

  try {
    console.log("Fetching board items for boardId:", context.boardId);

    const boardData = await fetchBoardItems(context.boardId);

    console.log("Raw Monday board data:", boardData);

    const mappedData = mapMondayBoardToSprintGanttData(
      boardData,
      defaultColumnMapping
    );

    console.log("Mapped Sprint Gantt data:", mappedData);

    return mappedData;
  } catch (error) {
    console.error("Unable to load Monday board data. Using mock data.", error);
    return getMockSprintGanttData();
  }
}

function getMockSprintGanttData(): SprintGanttData {
  return {
    sprints: mockSprints,
    phases: mockPhases,
    tasks: mockTasks,
    milestones: mockMilestones,
    teamOptions: [],
  };
}

async function fetchBoardItems(
  boardId: number | string
): Promise<MondayBoardResponse> {
  const query = `
    query GetBoardItems($boardId: [ID!]) {
      boards(ids: $boardId) {
        id
        name
        groups {
          id
          title
        }
        columns {
          id
          title
          type
          settings
          settings_str
        }
        items_page(limit: 100) {
          items {
            id
            name
            group {
              id
              title
            }
            column_values {
              id
              text
              value
              column {
                title
                type
              }
            }
          }
        }
      }
    }
  `;

  const response = await monday.api(query, {
    variables: {
      boardId: [String(boardId)],
    },
  });

  console.log(
    "Update planner item response:",
    JSON.stringify(response, null, 2)
  );

  console.log("Monday API response:", response);

  return response.data as MondayBoardResponse;
}

function mapMondayBoardToSprintGanttData(
  boardData: MondayBoardResponse,
  mapping: MondayColumnMapping
): SprintGanttData {
  const board = boardData.boards[0];

  if (!board) {
    console.warn("No board found in Monday API response. Using mock data.");
    return getMockSprintGanttData();
  }

  const items = board.items_page.items;

  console.log("Monday board name:", board.name);
  console.log("Monday items found:", items.length);

  const phases = buildPhasesFromBoardGroups(board.groups);

  const teamOptions = extractTeamOptionsFromColumns(
    board.columns ?? [],
    mapping.teamColumnTitle
  );

  if (items.length === 0) {
    console.warn("Board has no items. Returning board groups with empty task list.");

    return {
      sprints: buildDefaultSprints(DEFAULT_PROJECT_UNITS),
      phases,
      tasks: [],
      milestones: [],
      teamOptions,
    };
  }

  console.log(
    "Available column titles:",
    items[0]?.column_values.map((columnValue) => columnValue.column.title)
  );

  const parsedTaskInputs = items.map((item) => {
    const startPosition = getNumericColumnValue(
      item,
      mapping.startSprintColumnTitle
    );

    const rawEndPosition = getNumericColumnValue(
      item,
      mapping.endSprintColumnTitle
    );

    const endPosition =
      rawEndPosition > startPosition ? rawEndPosition : startPosition + 1;

    return {
      item,
      startPosition,
      endPosition,
    };
  });

  const maxEndPosition = Math.max(
    DEFAULT_PROJECT_UNITS,
    ...parsedTaskInputs.map((taskInput) => taskInput.endPosition)
  );

  const totalProjectUnits = Math.ceil(maxEndPosition);
  const sprints = buildDefaultSprints(totalProjectUnits);

  const tasks: GanttTask[] = parsedTaskInputs.map(
    ({ item, startPosition, endPosition }) => {
      const groupTitle = item.group.title;

      const description = getColumnText(item, mapping.descriptionColumnTitle);
      const teamText = getColumnText(item, mapping.teamColumnTitle);
      const colorText = getColumnText(item, mapping.colorColumnTitle);
      const dependencies = getColumnText(
        item,
        mapping.dependenciesColumnTitle
      );

      console.log(
        "Dependency column lookup:",
        {
          itemId: item.id,
          dependencyColumnTitle:
            mapping.dependenciesColumnTitle,
          dependencyValue: dependencies,
          columns: item.column_values,
        }
      );

      const sprintId = getSprintIdForPosition(startPosition);
      const sprintSpan = Math.max(1, Math.ceil(endPosition - startPosition));

      const visualPosition = calculateVisualPositionFromDecimalSprintValues(
        startPosition,
        endPosition,
        totalProjectUnits
      );

      console.log(
        "Mapping planner item:",
        JSON.stringify(
          {
            itemName: item.name,
            groupTitle,
            description,
            teamText,
            colorText,
            dependencies,
            startPosition,
            endPosition,
            sprintId,
            sprintSpan,
            leftPercent: visualPosition.leftPercent,
            widthPercent: visualPosition.widthPercent,
          },
          null,
          2
        )
      );

      console.log("Mapped task dependencies:", {
        itemId: item.id,
        title: item.name,
        dependencies,
      });

      return {
        id: item.id,
        title: item.name,
        description,
        phaseId: createStableId(groupTitle),
        mondayGroupId: item.group.id,
        sprintId,
        sprintSpan,
        status: "not-started",
        color: mapPlannerColor(colorText, teamText),
        team: teamText,
        dependencies,
        startPosition,
        endPosition,
        leftPercent: visualPosition.leftPercent,
        widthPercent: visualPosition.widthPercent,
      };
    }
  );

  return {
    sprints,
    phases,
    tasks,
    milestones: [],
    teamOptions,
  };
}

function extractTeamOptionsFromColumns(
  columns: MondayBoardColumn[],
  teamColumnTitle: string
): string[] {
  const teamColumn = columns.find(
    (column) =>
      column.title.trim().toLowerCase() ===
      teamColumnTitle.trim().toLowerCase()
  );

  if (!teamColumn) {
    console.warn("Team column not found while extracting team options.", {
      teamColumnTitle,
      columns,
    });

    return [];
  }

  const labels = new Set<string>();

  function addLabel(value: unknown) {
    if (typeof value !== "string") {
      return;
    }

    const trimmedValue = value.trim();

    if (trimmedValue) {
      labels.add(trimmedValue);
    }
  }

  function parseSettingsValue(settingsValue: unknown): unknown {
    if (!settingsValue) {
      return null;
    }

    if (typeof settingsValue === "string") {
      try {
        return JSON.parse(settingsValue);
      } catch {
        return null;
      }
    }

    return settingsValue;
  }

  const parsedSettings =
    parseSettingsValue(teamColumn.settings) ??
    parseSettingsValue(teamColumn.settings_str);

  if (!parsedSettings || typeof parsedSettings !== "object") {
    console.warn("Team column settings were empty or unreadable.", {
      teamColumn,
    });

    return [];
  }

  if ("labels" in parsedSettings) {
    const labelsValue = (parsedSettings as { labels?: unknown }).labels;

    if (Array.isArray(labelsValue)) {
      labelsValue.forEach((labelItem) => {
        if (labelItem && typeof labelItem === "object") {
          const labelObject = labelItem as {
            name?: unknown;
            label?: unknown;
            text?: unknown;
          };

          addLabel(labelObject.name);
          addLabel(labelObject.label);
          addLabel(labelObject.text);
        }

        addLabel(labelItem);
      });
    }

    if (
      labelsValue &&
      typeof labelsValue === "object" &&
      !Array.isArray(labelsValue)
    ) {
      Object.values(labelsValue).forEach((labelValue) => {
        addLabel(labelValue);

        if (labelValue && typeof labelValue === "object") {
          const labelObject = labelValue as {
            name?: unknown;
            label?: unknown;
            text?: unknown;
          };

          addLabel(labelObject.name);
          addLabel(labelObject.label);
          addLabel(labelObject.text);
        }
      });
    }
  }

  console.log("Extracted Team options from board column settings:", {
    teamColumnTitle,
    teamColumnId: teamColumn.id,
    teamColumnType: teamColumn.type,
    teamOptions: Array.from(labels),
    rawSettings: parsedSettings,
  });

  return Array.from(labels).sort((a, b) => a.localeCompare(b));
}

function buildDefaultSprints(totalProjectUnits: number): Sprint[] {
  const safeTotal = Math.max(1, Math.ceil(totalProjectUnits));

  return Array.from({ length: safeTotal }, (_, index) => {
    return {
      id: getSprintIdForPosition(index),
      name: `Sprint ${index}`,
      dateLabel: "",
      sortOrder: index,
      startPosition: index,
      endPosition: index + 1,
    };
  });
}

function buildPhasesFromBoardGroups(
  groups: Array<{ id: string; title: string }>
): Phase[] {
  if (!groups || groups.length === 0) {
    console.warn("No Monday groups found. Using mock phases.");
    return mockPhases;
  }

  return groups.map((group, index) => ({
    id: createStableId(group.title),
    mondayGroupId: group.id,
    title: group.title,
    sortOrder: index + 1,
  }));
}

function getColumnValue(
  item: MondayItem,
  columnTitle: string
): MondayColumnValue | undefined {
  return item.column_values.find(
    (columnValue) =>
      columnValue.column.title.toLowerCase() === columnTitle.toLowerCase()
  );
}

function getColumnText(item: MondayItem, columnTitle: string): string {
  const column = getColumnValue(item, columnTitle);

  const textValue = column?.text?.trim();

  if (textValue) {
    return textValue;
  }

  if (!column?.value) {
    return "";
  }

  try {
    const parsedValue = JSON.parse(column.value);

    if (typeof parsedValue === "string") {
      return parsedValue.trim();
    }

    if (typeof parsedValue === "number") {
      return String(parsedValue);
    }

    if (
      parsedValue &&
      typeof parsedValue === "object" &&
      "text" in parsedValue &&
      typeof parsedValue.text === "string"
    ) {
      return parsedValue.text.trim();
    }

    if (
      parsedValue &&
      typeof parsedValue === "object" &&
      "value" in parsedValue &&
      typeof parsedValue.value === "string"
    ) {
      return parsedValue.value.trim();
    }

    return "";
  } catch {
    return column.value.trim();
  }
}

function getNumericColumnValue(item: MondayItem, columnTitle: string): number {
  const column = getColumnValue(item, columnTitle);
  const textValue = column?.text?.trim();

  if (textValue) {
    const parsedTextValue = Number(textValue);

    if (!Number.isNaN(parsedTextValue)) {
      return parsedTextValue;
    }
  }

  if (column?.value) {
    try {
      const parsedValue = JSON.parse(column.value);

      if (typeof parsedValue === "number") {
        return parsedValue;
      }

      if (typeof parsedValue === "string") {
        const parsedStringValue = Number(parsedValue);

        if (!Number.isNaN(parsedStringValue)) {
          return parsedStringValue;
        }
      }
    } catch {
      const parsedRawValue = Number(column.value);

      if (!Number.isNaN(parsedRawValue)) {
        return parsedRawValue;
      }
    }
  }

  return 0;
}

function calculateVisualPositionFromDecimalSprintValues(
  startPosition: number,
  endPosition: number,
  totalProjectUnits: number
): { leftPercent: number; widthPercent: number } {
  const safeTotalProjectUnits = Math.max(1, totalProjectUnits);
  const safeStartPosition = Math.max(0, startPosition);
  const safeEndPosition = Math.max(safeStartPosition + 0.1, endPosition);

  const leftPercent = (safeStartPosition / safeTotalProjectUnits) * 100;
  const widthPercent =
    ((safeEndPosition - safeStartPosition) / safeTotalProjectUnits) * 100;

  return {
    leftPercent: Math.max(0, leftPercent),
    widthPercent: Math.max(1, widthPercent),
  };
}

function getSprintIdForPosition(position: number): string {
  const wholePosition = Math.floor(Math.max(0, position));
  return `sprint-${wholePosition}`;
}

function createStableId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function mapPlannerColor(
  colorText: string,
  teamText: string
): GanttTaskColor {
  const normalizedColor = colorText.trim().toLowerCase();

  if (isValidTaskColor(normalizedColor)) {
    return normalizedColor;
  }

  return mapTeamToColor(teamText);
}

function isValidTaskColor(value: string): value is GanttTaskColor {
  return [
    "blue",
    "yellow",
    "coral",
    "green",
    "orange",
    "purple",
    "red",
    "gray",
  ].includes(value);
}

function mapTeamToColor(teamText: string): GanttTaskColor {
  const normalized = teamText.trim().toLowerCase();

  if (normalized.includes("analytics")) {
    return "red";
  }

  if (normalized.includes("pm")) {
    return "orange";
  }

  if (
    normalized.includes("ai") ||
    normalized.includes("ml") ||
    normalized.includes("ai/ml") ||
    normalized.includes("ai/mi")
  ) {
    return "green";
  }

  if (normalized.includes("dpe")) {
    return "blue";
  }

  return "gray";
}