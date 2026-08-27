import { monday } from "./mondayClient";

export type PlannerColumnDefinition = {
  title: string;
  type: string;
};

export const requiredPlannerColumns: PlannerColumnDefinition[] = [
  {
    title: "Description",
    type: "long_text",
  },
  {
    title: "Start Sprint",
    type: "numbers",
  },
  {
    title: "End Sprint",
    type: "numbers",
  },
  {
    title: "Team",
    type: "dropdown",
  },
  {
    title: "Color",
    type: "text",
  },
  {
    title: "Dependencies",
    type: "text",
  },
  {
    title: "Resources",
    type: "people",
  },
];

type MondayColumn = {
  id: string;
  title: string;
  type: string;
};

export async function getBoardColumns(
  boardId: number | string
): Promise<MondayColumn[]> {
  const query = `
    query GetBoardColumns($boardId: [ID!]) {
      boards(ids: $boardId) {
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

  return response.data?.boards?.[0]?.columns ?? [];
}

export async function getMissingPlannerColumns(
  boardId: number | string
): Promise<PlannerColumnDefinition[]> {
  const existingColumns = await getBoardColumns(boardId);

  return requiredPlannerColumns.filter((requiredColumn) => {
    return !existingColumns.some(
      (existingColumn) =>
        existingColumn.title.trim().toLowerCase() ===
        requiredColumn.title.trim().toLowerCase()
    );
  });
}

export async function createPlannerColumn(
  boardId: number | string,
  column: PlannerColumnDefinition
): Promise<void> {
  const mutation = `
    mutation CreateColumn(
      $boardId: ID!,
      $title: String!,
      $columnType: ColumnType!
    ) {
      create_column(
        board_id: $boardId,
        title: $title,
        column_type: $columnType
      ) {
        id
      }
    }
  `;

  await monday.api(mutation, {
    variables: {
      boardId: String(boardId),
      title: column.title,
      columnType: column.type,
    },
  });
}

export async function setupPlannerBoard(
  boardId: number | string
): Promise<void> {
  const missingColumns = await getMissingPlannerColumns(boardId);

  for (const missingColumn of missingColumns) {
    console.log("Creating planner column:", missingColumn);

    await createPlannerColumn(boardId, missingColumn);
  }
}