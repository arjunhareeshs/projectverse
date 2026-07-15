export const logger = {
  info: (message: string, meta?: unknown) => {
    if (meta) {
      console.warn(`[INFO] ${message}`, meta);
      return;
    }

    console.warn(`[INFO] ${message}`);
  },
  warn: (message: string, meta?: unknown) => {
    if (meta) {
      console.warn(`[WARN] ${message}`, meta);
      return;
    }

    console.warn(`[WARN] ${message}`);
  },
  error: (message: string, meta?: unknown) => {
    if (meta) {
      console.error(`[ERROR] ${message}`, meta);
      return;
    }

    console.error(`[ERROR] ${message}`);
  },
};
