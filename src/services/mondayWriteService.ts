import { monday } from "./mondayClient";
import type { GanttTaskColor } from "../types/gantt";

type MondayBoardColumn = {
  id: string;
  title: string;
  type: string;
};

type MondayColumnsResponse = {
  boards: Array<{
    id: string;
    name: string;
    columns: MondayBoardColumn[];
  }>;
};

type MondayApiResponse<TData> = {
  data?: TData;
  errors?: Array<{
    message?: string;
    locations?: unknown;
    path?: unknown;
    extensions?: unknown;
  }>;
  account_id?: number;
};

export type CreatePlannerItemInput = {
  boardId: number | string;
  groupId: string;
  title: string;
  description?: string;
  startSprint?: number;
  endSprint?: number;
  team?: string;
  color?: GanttTaskColor | string;
  dependencies?: string;
};

export type UpdatePlannerItemInput = {
  boardId: number | string;
  itemId: string;
  groupId?: string;
  title: string;
  description?: string;
  startSprint?: number;
  endSprint?: number;
  team?: string;
  color?: GanttTaskColor | string;
  dependencies?: string;
};

export type UpdatePlannerItemPositionInput = {
  boardId: number | string;
  itemId: string;
  startSprint: number;
  endSprint: number;
};

export type UpdatePlannerItemResourcesInput = {
  boardId: number | string;
  itemId: string;
  resourceIds: string[];
};

export type PlannerColumnTitles = {
  descriptionColumnTitle: string;
  startSprintColumnTitle: string;
  endSprintColumnTitle: string;
  teamColumnTitle: string;
  colorColumnTitle: string;
  dependenciesColumnTitle: string;
  resourcesColumnTitle: string;
};

export const defaultPlannerColumnTitles: PlannerColumnTitles = {
  descriptionColumnTitle: "Description",
  startSprintColumnTitle: "Start Sprint",
  endSprintColumnTitle: "End Sprint",
  teamColumnTitle: "Team",
  colorColumnTitle: "Color",
  dependenciesColumnTitle: "Dependencies",
  resourcesColumnTitle: "Resources",
};

export async function deletePlannerItem(
  itemId: string
): Promise<void> {
  const mutation = `
    mutation DeletePlannerItem($itemId: ID!) {
      delete_item(item_id: $itemId) {
        id
      }
    }
  `;

  const response = await monday.api(mutation, {
    variables: {
      itemId: String(itemId),
    },
  });

  console.log("Delete item response:", response);

  throwIfMondayErrors(response, "delete planner item");
}

export async function createMondayGroup(
  boardId: number | string,
  groupName: string
): Promise<string> {
  const mutation = `
    mutation CreatePlannerGroup($boardId: ID!, $groupName: String!) {
      create_group(
        board_id: $boardId,
        group_name: $groupName
      ) {
        id
      }
    }
  `;

  const response = await monday.api(mutation, {
    variables: {
      boardId: String(boardId),
      groupName,
    },
  });

  console.log("Create group response:", response);
  throwIfMondayErrors(response, "create group");

  const typedResponse = response as MondayApiResponse<{
    create_group?: {
      id?: string;
    };
  }>;

  const groupId = typedResponse.data?.create_group?.id;

  if (!groupId) {
    throw new Error(
      `Monday did not return a group id. Raw response: ${JSON.stringify(
        response,
        null,
        2
      )}`
    );
  }

  return groupId;
}

export async function createPlannerItem(
  input: CreatePlannerItemInput,
  columnTitles: PlannerColumnTitles = defaultPlannerColumnTitles
): Promise<string> {
  console.log("Creating planner item with input:", input);

  const columns = await fetchBoardColumns(input.boardId);
  const columnIdByTitle = buildColumnIdByTitle(columns);

  const columnValues = buildPlannerColumnValues(
    columnIdByTitle,
    columnTitles,
    {
      description: input.description ?? "",
      startSprint: input.startSprint ?? 0,
      endSprint: input.endSprint ?? (input.startSprint ?? 0) + 1,
      team: input.team ?? "",
      color: input.color ?? "",
      dependencies: input.dependencies ?? "",
    }
  );

  const mutation = `
    mutation CreatePlannerItem(
      $boardId: ID!,
      $groupId: String!,
      $itemName: String!,
      $columnValues: JSON
    ) {
      create_item(
        board_id: $boardId,
        group_id: $groupId,
        item_name: $itemName,
        column_values: $columnValues,
        create_labels_if_missing: true
      ) {
        id
      }
    }
  `;

  const response = await monday.api(mutation, {
    variables: {
      boardId: String(input.boardId),
      groupId: input.groupId,
      itemName: input.title,
      columnValues: JSON.stringify(columnValues),
    },
  });

  console.log("Create item response:", response);
  throwIfMondayErrors(response, "create item");

  const typedResponse = response as MondayApiResponse<{
    create_item?: {
      id?: string;
    };
  }>;

  const itemId = typedResponse.data?.create_item?.id;

  if (!itemId) {
    throw new Error(
      `Monday did not return an item id. Raw response: ${JSON.stringify(
        response,
        null,
        2
      )}`
    );
  }

  if (input.dependencies) {
  await updatePlannerItemDependencies(
    {
      boardId: input.boardId,
      itemId,
      dependencies: input.dependencies,
    },
    columnTitles
  );
}

return itemId;
}

export async function updatePlannerItem(
  input: UpdatePlannerItemInput,
  columnTitles: PlannerColumnTitles = defaultPlannerColumnTitles
): Promise<void> {
  console.log("Updating planner item with input:", input);

  const columns = await fetchBoardColumns(input.boardId);
  const columnIdByTitle = buildColumnIdByTitle(columns);

  const columnValues = buildPlannerColumnValues(
    columnIdByTitle,
    columnTitles,
    {
      description: input.description ?? "",
      startSprint: input.startSprint ?? 0,
      endSprint: input.endSprint ?? (input.startSprint ?? 0) + 1,
      team: input.team ?? "",
      color: input.color ?? "",
      dependencies: input.dependencies ?? "",
    }
  );

  /*
    Monday supports updating the item name through the special "name" key
    inside change_multiple_column_values.
  */
  columnValues.name = input.title;

    await updatePlannerItemColumns({
    boardId: input.boardId,
    itemId: input.itemId,
    columnValues,
    actionName: "update planner item",
    });

    await updatePlannerItemDependencies(
    {
        boardId: input.boardId,
        itemId: input.itemId,
        dependencies: input.dependencies ?? "",
    },
    columnTitles
    );

    if (input.groupId) {
    await movePlannerItemToGroup({
        itemId: input.itemId,
        groupId: input.groupId,
    });
    }
}

export async function updatePlannerItemPosition(
  input: UpdatePlannerItemPositionInput,
  columnTitles: PlannerColumnTitles = defaultPlannerColumnTitles
): Promise<void> {
  console.log("Updating planner item position with input:", input);

  const columns = await fetchBoardColumns(input.boardId);
  const columnIdByTitle = buildColumnIdByTitle(columns);

  const columnValues: Record<string, string | number> = {};

  addColumnValueIfColumnExists(
    columnValues,
    columnIdByTitle,
    columnTitles.startSprintColumnTitle,
    String(input.startSprint)
  );

  addColumnValueIfColumnExists(
    columnValues,
    columnIdByTitle,
    columnTitles.endSprintColumnTitle,
    String(input.endSprint)
  );

  await updatePlannerItemColumns({
    boardId: input.boardId,
    itemId: input.itemId,
    columnValues,
    actionName: "update planner item position",
  });
}

export async function updatePlannerItemResources(
  input: UpdatePlannerItemResourcesInput,
  columnTitles: PlannerColumnTitles = defaultPlannerColumnTitles
): Promise<void> {
  console.log("Updating planner item resources:", input);

  const columns = await fetchBoardColumns(input.boardId);

  const resourcesColumn = columns.find(
    (column) =>
      column.title.trim().toLowerCase() ===
      columnTitles.resourcesColumnTitle.trim().toLowerCase()
  );

  if (!resourcesColumn) {
    throw new Error(
      `Resources column not found: ${columnTitles.resourcesColumnTitle}`
    );
  }

  if (resourcesColumn.type !== "people") {
    throw new Error(
      `The ${resourcesColumn.title} column must be a People column. ` +
        `Current type: ${resourcesColumn.type}`
    );
  }

  const uniqueResourceIds = Array.from(
    new Set(
      input.resourceIds
        .map((resourceId) => String(resourceId).trim())
        .filter(Boolean)
    )
  );

  const columnValue = {
    personsAndTeams: uniqueResourceIds.map((resourceId) => ({
      id: Number(resourceId),
      kind: "person",
    })),
  };

  if (
    columnValue.personsAndTeams.some(
      (assignment) => !Number.isFinite(assignment.id)
    )
  ) {
    throw new Error(
      "One or more Resources contain an invalid Monday user ID."
    );
  }

  const mutation = `
    mutation UpdatePlannerItemResources(
      $boardId: ID!,
      $itemId: ID!,
      $columnId: String!,
      $value: JSON!
    ) {
      change_column_value(
        board_id: $boardId,
        item_id: $itemId,
        column_id: $columnId,
        value: $value
      ) {
        id
      }
    }
  `;

  const response = await monday.api(mutation, {
    variables: {
      boardId: String(input.boardId),
      itemId: String(input.itemId),
      columnId: resourcesColumn.id,
      value: JSON.stringify(columnValue),
    },
  });

  console.log("Update Resources response:", response);

  throwIfMondayErrors(response, "update planner item Resources");
}

export async function updatePlannerItemDependencies(
  input: {
    boardId: number | string;
    itemId: string;
    dependencies: string;
  },
  columnTitles: PlannerColumnTitles = defaultPlannerColumnTitles
): Promise<void> {
  const columns = await fetchBoardColumns(input.boardId);

  const dependencyColumn = columns.find(
    (column) =>
      column.title.trim().toLowerCase() ===
      columnTitles.dependenciesColumnTitle.trim().toLowerCase()
  );

  if (!dependencyColumn) {
    console.warn(
      `Dependencies column not found: ${columnTitles.dependenciesColumnTitle}`
    );
    return;
  }

  console.log("Updating Dependencies column directly:", {
    itemId: input.itemId,
    columnId: dependencyColumn.id,
    columnTitle: dependencyColumn.title,
    columnType: dependencyColumn.type,
    dependencies: input.dependencies,
  });

  if (dependencyColumn.type === "long_text") {
    const mutation = `
      mutation UpdateLongTextDependency(
        $boardId: ID!,
        $itemId: ID!,
        $columnId: String!,
        $value: JSON!
      ) {
        change_column_value(
          board_id: $boardId,
          item_id: $itemId,
          column_id: $columnId,
          value: $value
        ) {
          id
        }
      }
    `;

    const response = await monday.api(mutation, {
      variables: {
        boardId: String(input.boardId),
        itemId: String(input.itemId),
        columnId: dependencyColumn.id,
        value: JSON.stringify({
          text: input.dependencies,
        }),
      },
    });

    console.log("Update long text Dependencies response:", response);
    throwIfMondayErrors(response, "update long text Dependencies");
    return;
  }

  const mutation = `
    mutation UpdateSimpleDependency(
      $boardId: ID!,
      $itemId: ID!,
      $columnId: String!,
      $value: String!
    ) {
      change_simple_column_value(
        board_id: $boardId,
        item_id: $itemId,
        column_id: $columnId,
        value: $value
      ) {
        id
      }
    }
  `;

  const response = await monday.api(mutation, {
    variables: {
      boardId: String(input.boardId),
      itemId: String(input.itemId),
      columnId: dependencyColumn.id,
      value: input.dependencies,
    },
  });

  console.log("Update simple Dependencies response:", response);
  throwIfMondayErrors(response, "update Dependencies");
}

export async function openMondayItemCard(itemId: string): Promise<void> {
  await monday.execute("openItemCard", {
    itemId: Number(itemId),
  });
}

async function updatePlannerItemColumns(input: {
  boardId: number | string;
  itemId: string;
  columnValues: Record<string, string | number>;
  actionName: string;
}): Promise<void> {
  const mutation = `
    mutation UpdatePlannerItemColumns(
      $boardId: ID!,
      $itemId: ID!,
      $columnValues: JSON!
    ) {
      change_multiple_column_values(
        board_id: $boardId,
        item_id: $itemId,
        column_values: $columnValues,
        create_labels_if_missing: true
      ) {
        id
      }
    }
  `;

  const response = await monday.api(mutation, {
    variables: {
      boardId: String(input.boardId),
      itemId: String(input.itemId),
      columnValues: JSON.stringify(input.columnValues),
    },
  });

  console.log(`${input.actionName} response:`, response);
  throwIfMondayErrors(response, input.actionName);
}

export async function updatePlannerItemGroup(input: {
  itemId: string;
  groupId: string;
}): Promise<void> {
  await movePlannerItemToGroup({
    itemId: input.itemId,
    groupId: input.groupId,
  });
}

async function movePlannerItemToGroup(input: {
  itemId: string;
  groupId: string;
}): Promise<void> {
  const mutation = `
    mutation MovePlannerItemToGroup(
      $itemId: ID!,
      $groupId: String!
    ) {
      move_item_to_group(
        item_id: $itemId,
        group_id: $groupId
      ) {
        id
      }
    }
  `;

  const response = await monday.api(mutation, {
    variables: {
      itemId: String(input.itemId),
      groupId: input.groupId,
    },
  });

  console.log("Move item to group response:", response);
  throwIfMondayErrors(response, "move item to group");
}

async function fetchBoardColumns(
  boardId: number | string
): Promise<MondayBoardColumn[]> {
  const query = `
    query GetPlannerBoardColumns($boardId: [ID!]) {
      boards(ids: $boardId) {
        id
        name
        columns {
          id
          title
          type
        }
      }
    }
  `;

  const response = await monday.api(query, {
    variables: {
      boardId: [String(boardId)],
    },
  });

  console.log("Fetch board columns response:", response);
  throwIfMondayErrors(response, "fetch board columns");

  const typedResponse = response as MondayApiResponse<MondayColumnsResponse>;

  return typedResponse.data?.boards?.[0]?.columns ?? [];
}

function buildColumnIdByTitle(
  columns: MondayBoardColumn[]
): Record<string, string> {
  const result: Record<string, string> = {};

  columns.forEach((column) => {
    result[column.title.trim().toLowerCase()] = column.id;
  });

  return result;
}

function buildPlannerColumnValues(
  columnIdByTitle: Record<string, string>,
  columnTitles: PlannerColumnTitles,
  values: {
    description: string;
    startSprint: number;
    endSprint: number;
    team: string;
    color: GanttTaskColor | string;
    dependencies: string;
  }
): Record<string, string | number> {
  const columnValues: Record<string, string | number> = {};

  addColumnValueIfColumnExists(
    columnValues,
    columnIdByTitle,
    columnTitles.descriptionColumnTitle,
    values.description
  );

  addColumnValueIfColumnExists(
    columnValues,
    columnIdByTitle,
    columnTitles.startSprintColumnTitle,
    String(values.startSprint)
  );

  addColumnValueIfColumnExists(
    columnValues,
    columnIdByTitle,
    columnTitles.endSprintColumnTitle,
    String(values.endSprint)
  );

  addColumnValueIfColumnExists(
    columnValues,
    columnIdByTitle,
    columnTitles.teamColumnTitle,
    values.team
  );

  addColumnValueIfColumnExists(
    columnValues,
    columnIdByTitle,
    columnTitles.colorColumnTitle,
    values.color
  );

  addColumnValueIfColumnExists(
    columnValues,
    columnIdByTitle,
    columnTitles.dependenciesColumnTitle,
    values.dependencies
  );

  return columnValues;
}

function addColumnValueIfColumnExists(
  columnValues: Record<string, string | number>,
  columnIdByTitle: Record<string, string>,
  columnTitle: string,
  value: string | number
): void {
  const columnId = columnIdByTitle[columnTitle.trim().toLowerCase()];

  if (!columnId) {
    console.warn(`Column not found on Monday board: ${columnTitle}`);
    return;
  }

  columnValues[columnId] = value;
}

function throwIfMondayErrors(response: unknown, actionName: string): void {
  const typedResponse = response as MondayApiResponse<unknown>;

  if (!typedResponse.errors || typedResponse.errors.length === 0) {
    return;
  }

  const errorMessage = typedResponse.errors
    .map((error) => error.message ?? JSON.stringify(error))
    .join(" | ");

  console.error(`Monday API error during ${actionName}:`, typedResponse.errors);

  throw new Error(`Monday API error during ${actionName}: ${errorMessage}`);
}