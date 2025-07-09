import { Logger } from '@nestjs/common';

// Configure test environment
beforeAll(() => {
    // Suppress console logs during tests unless explicitly needed
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
});

afterAll(() => {
    // Restore console logs
    jest.restoreAllMocks();
});

// Global test utilities
global.console = {
    ...console,
    // Suppress console output during tests
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
};

// Mock timers for consistent testing
beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
});

// Helper function to wait for async operations
export const waitFor = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

// Helper function to advance timers
export const advanceTimers = (ms: number): void => {
    jest.advanceTimersByTime(ms);
};

// Helper function to run pending timers
export const runPendingTimers = (): void => {
    jest.runOnlyPendingTimers();
};

// Helper function to run all timers
export const runAllTimers = (): void => {
    jest.runAllTimers();
}; 