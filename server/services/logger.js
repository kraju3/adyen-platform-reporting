const isSilenced = process.env.NODE_ENV === 'test';

const logger = {
  info: (...args) => {
    if (!isSilenced) console.log(`[${new Date().toISOString()}] INFO`, ...args);
  },
  warn: (...args) => {
    if (!isSilenced) console.warn(`[${new Date().toISOString()}] WARN`, ...args);
  },
  error: (...args) => {
    if (!isSilenced) console.error(`[${new Date().toISOString()}] ERROR`, ...args);
  },
};

export default logger;
