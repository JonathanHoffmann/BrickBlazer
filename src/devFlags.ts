const env = (import.meta as ImportMeta & {
  env?: {
    DEV?: boolean;
    VITE_ENABLE_DEV_LEVELS?: string;
  };
}).env;

export const DEV_TOOLS_ENABLED = env?.DEV === true && env.VITE_ENABLE_DEV_LEVELS === 'true';