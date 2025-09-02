export default {
  // 使用原生ESM支持
  preset: 'ts-jest/presets/default-esm',
  
  // 测试环境
  testEnvironment: 'node',
  
  // 将.ts文件作为ESM处理
  extensionsToTreatAsEsm: ['.ts'],
  
  // 模块名映射，处理.js导入实际指向.ts文件的情况
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  
  // TypeScript转换配置
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true, // 启用ESM支持
    }],
  },
  
  // 测试文件匹配模式
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  
  // 测试根目录
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  
  // 覆盖率配置
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts'
  ],
  
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  
  // 测试超时
  testTimeout: 10000,
  
  // 模块文件扩展名
  moduleFileExtensions: ['ts', 'js', 'json'],
  
  // 清除模拟在每次测试之间
  clearMocks: true,
  
  // 详细输出
  verbose: true
};
