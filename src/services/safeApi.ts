// Safe API wrapper to standardize frontend error handling.
export const safeApi = async <T>(request: () => Promise<T>, fallbackMessage = "Request failed"): Promise<T> => {
  try {
    return await request();
  } catch (error) {
    const message = error instanceof Error ? error.message : fallbackMessage;
    throw new Error(message);
  }
};
