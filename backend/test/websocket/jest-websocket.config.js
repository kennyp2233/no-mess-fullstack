module.exports = {
    displayName: 'WebSocket Tests',
    testEnvironment: 'node',
    testMatch: [
        '**/test/websocket/**/*.spec.ts',
        '**/test/websocket/**/*.integration.spec.ts',
    ],
    transform: {
        '^.+\\.(t|j)s$': 'ts-jest',
    },
    collectCoverageFrom: [
        'src/shared/websockets/**/*.ts',
        '!src/shared/websockets/**/*.d.ts',
    ],
    coverageDirectory: 'coverage/websocket',
    coverageReporters: ['text', 'lcov', 'html'],
    setupFilesAfterEnv: ['<rootDir>/setup.ts'],
    testTimeout: 10000,
    verbose: true,
}; 