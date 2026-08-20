import { monday } from "./mondayClient";
import type { SprintPlanningSettings } from "../types/gantt";

const PLANNER_SETTINGS_STORAGE_KEY = "sprint-gantt-planner-settings-v1";
const LOCAL_STORAGE_KEY = "sprint-gantt-planner-settings-v1-local";

type MondayStorageResponse = {
  data?: {
    value?: unknown;
  };
};

type StorageClient = {
  getItem?: (key: string) => Promise<MondayStorageResponse>;
  setItem?: (key: string, value: unknown) => Promise<unknown>;
};

function getStorageClient(): StorageClient | null {
  const mondayAny = monday as unknown as {
    storage?: {
      instance?: StorageClient;
      getItem?: (key: string) => Promise<MondayStorageResponse>;
      setItem?: (key: string, value: unknown) => Promise<unknown>;
    };
  };

  if (
    mondayAny.storage?.instance?.getItem &&
    mondayAny.storage?.instance?.setItem
  ) {
    return mondayAny.storage.instance;
  }

  if (mondayAny.storage?.getItem && mondayAny.storage?.setItem) {
    return {
      getItem: mondayAny.storage.getItem,
      setItem: mondayAny.storage.setItem,
    };
  }

  return null;
}

export async function loadPlannerSettings(): Promise<SprintPlanningSettings | null> {
  const localSettings = loadPlannerSettingsFromLocalStorage();

  if (localSettings) {
    console.log("Loaded planner settings from localStorage:", localSettings);
    return localSettings;
  }

  const mondaySettings = await loadPlannerSettingsFromMondayStorage();

  if (mondaySettings) {
    console.log("Loaded planner settings from monday.storage:", mondaySettings);

    savePlannerSettingsToLocalStorage(mondaySettings);

    return mondaySettings;
  }

  console.log("No saved planner settings found.");
  return null;
}

export async function savePlannerSettings(
  settings: SprintPlanningSettings
): Promise<void> {
  savePlannerSettingsToLocalStorage(settings);
  await savePlannerSettingsToMondayStorage(settings);
}

function loadPlannerSettingsFromLocalStorage(): SprintPlanningSettings | null {
  try {
    const localValue = window.localStorage.getItem(LOCAL_STORAGE_KEY);

    if (!localValue) {
      return null;
    }

    return JSON.parse(localValue) as SprintPlanningSettings;
  } catch (error) {
    console.warn("Unable to load planner settings from localStorage.", error);
    return null;
  }
}

function savePlannerSettingsToLocalStorage(
  settings: SprintPlanningSettings
): void {
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
    console.log("Saved planner settings to localStorage.");
  } catch (error) {
    console.warn("Unable to save planner settings to localStorage.", error);
  }
}

async function loadPlannerSettingsFromMondayStorage(): Promise<SprintPlanningSettings | null> {
  try {
    const storageClient = getStorageClient();

    if (!storageClient?.getItem) {
      console.warn("monday.storage is not available. Skipping Monday storage load.");
      return null;
    }

    const response = await storageClient.getItem(PLANNER_SETTINGS_STORAGE_KEY);
    const storedValue = response?.data?.value;

    if (!storedValue) {
      return null;
    }

    if (typeof storedValue === "string") {
      return JSON.parse(storedValue) as SprintPlanningSettings;
    }

    return storedValue as SprintPlanningSettings;
  } catch (error) {
    console.warn("Unable to load planner settings from monday.storage.", error);
    return null;
  }
}

async function savePlannerSettingsToMondayStorage(
  settings: SprintPlanningSettings
): Promise<void> {
  try {
    const storageClient = getStorageClient();

    if (!storageClient?.setItem) {
      console.warn("monday.storage is not available. Skipping Monday storage save.");
      return;
    }

    await storageClient.setItem(
      PLANNER_SETTINGS_STORAGE_KEY,
      JSON.stringify(settings)
    );

    console.log("Saved planner settings to monday.storage.");
  } catch (error) {
    console.warn("Unable to save planner settings to monday.storage.", error);
  }
}