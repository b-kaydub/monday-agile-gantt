import mondaySdk from "monday-sdk-js";

export type MondayContext = {
  boardId?: number | string;
  itemId?: number | string;
  userId?: number | string;
  accountId?: number | string;
  instanceId?: number | string;
  theme?: string;
};

export const monday = mondaySdk();

export async function getMondayContext(): Promise<MondayContext | null> {
  try {
    const response = await monday.get("context");
    return response.data as MondayContext;
  } catch (error) {
    console.warn(
      "Unable to read monday context. Falling back to mock data.",
      error
    );
    return null;
  }
}