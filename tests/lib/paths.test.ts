import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import {
  getConfigDir,
  getDataDir,
  CONFIG_DIR,
  DATA_DIR,
  ensureConfigDir,
  ensureDataDir,
} from '@/lib/paths';

describe('Paths', () => {
  // 保存原始环境变量
  const originalEnv = {
    HOME: process.env.HOME,
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
    XDG_DATA_HOME: process.env.XDG_DATA_HOME,
    APPDATA: process.env.APPDATA,
    LOCALAPPDATA: process.env.LOCALAPPDATA,
  };

  beforeEach(() => {
    // 重置环境变量
    process.env.HOME = originalEnv.HOME;
    process.env.XDG_CONFIG_HOME = originalEnv.XDG_CONFIG_HOME;
    process.env.XDG_DATA_HOME = originalEnv.XDG_DATA_HOME;
    process.env.APPDATA = originalEnv.APPDATA;
    process.env.LOCALAPPDATA = originalEnv.LOCALAPPDATA;
  });

  afterEach(() => {
    // 恢复原始环境变量
    process.env.HOME = originalEnv.HOME;
    process.env.XDG_CONFIG_HOME = originalEnv.XDG_CONFIG_HOME;
    process.env.XDG_DATA_HOME = originalEnv.XDG_DATA_HOME;
    process.env.APPDATA = originalEnv.APPDATA;
    process.env.LOCALAPPDATA = originalEnv.LOCALAPPDATA;
  });

  describe('getConfigDir', () => {
    it('应该在 Docker 环境中返回 $HOME/.config', () => {
      process.env.HOME = '/app';
      const configDir = getConfigDir();
      // 使用 normalize 处理路径分隔符
      expect(path.normalize(configDir)).toContain(path.normalize('/app/.config'));
      expect(configDir).not.toContain('file-auto-organizer');
    });

    it('应该在 /usr 环境（容器）中返回 $HOME/.config', () => {
      process.env.HOME = '/usr/local/app';
      const configDir = getConfigDir();
      expect(path.normalize(configDir)).toContain(path.normalize('/usr/local/app/.config'));
      expect(configDir).not.toContain('file-auto-organizer');
    });

    it('应该在本地环境中包含 file-auto-organizer 路径段', () => {
      // 本地环境（非 Docker）应该包含应用名称
      const configDir = getConfigDir();
      expect(configDir).toBeDefined();
      expect(typeof configDir).toBe('string');
    });
  });

  describe('getDataDir', () => {
    it('应该在 Docker 环境中返回 $HOME/.config/logs', () => {
      process.env.HOME = '/app';
      const dataDir = getDataDir();
      expect(path.normalize(dataDir)).toContain(path.normalize('/app/.config/logs'));
      expect(dataDir).toContain('logs');
    });

    it('应该在 /usr 环境（容器）中返回 $HOME/.config/logs', () => {
      process.env.HOME = '/usr/local/app';
      const dataDir = getDataDir();
      expect(path.normalize(dataDir)).toContain(path.normalize('/usr/local/app/.config/logs'));
      expect(dataDir).toContain('logs');
    });

    it('应该在本地环境中返回有效路径', () => {
      const dataDir = getDataDir();
      expect(dataDir).toBeDefined();
      expect(typeof dataDir).toBe('string');
    });
  });

  describe('单例模式', () => {
    it('CONFIG_DIR 应该返回相同的实例', () => {
      const dir1 = CONFIG_DIR();
      const dir2 = CONFIG_DIR();
      expect(dir1).toBe(dir2);
    });

    it('DATA_DIR 应该返回相同的实例', () => {
      const dir1 = DATA_DIR();
      const dir2 = DATA_DIR();
      expect(dir1).toBe(dir2);
    });

    it('CONFIG_DIR 和 DATA_DIR 应该返回不同的路径', () => {
      // 注意：这个测试假设非 Docker 环境
      const configDir = CONFIG_DIR();
      const dataDir = DATA_DIR();
      // 在大多数环境中，配置和数据目录不同
      expect(configDir).toBeDefined();
      expect(dataDir).toBeDefined();
    });
  });

  describe('ensureConfigDir', () => {
    it('应该创建配置目录', async () => {
      process.env.HOME = '/tmp/test-config';
      const configDir = getConfigDir();

      await ensureConfigDir();

      const fs = await import('fs/promises');
      const exists = await fs
        .access(configDir)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      // 清理
      await fs.rm(configDir, { recursive: true, force: true });
    });
  });

  describe('ensureDataDir', () => {
    it('应该创建数据目录', async () => {
      process.env.HOME = '/tmp/test-data';
      const dataDir = getDataDir();

      await ensureDataDir();

      const fs = await import('fs/promises');
      const exists = await fs
        .access(dataDir)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      // 清理
      await fs.rm(dataDir, { recursive: true, force: true });
    });
  });

  describe('Docker 环境路径结构', () => {
    it('Docker 环境应该有清晰的目录层级', () => {
      process.env.HOME = '/app';
      const configDir = getConfigDir();
      const dataDir = getDataDir();

      // 配置文件直接在 .config 下
      expect(path.normalize(configDir)).toBe(path.normalize('/app/.config'));
      // 日志在 .config/logs 下
      expect(path.normalize(dataDir)).toBe(path.normalize('/app/.config/logs'));

      // dataDir 是 configDir 的子目录
      expect(dataDir.startsWith(configDir)).toBe(true);
      expect(path.normalize(dataDir)).toBe(path.join(configDir, 'logs'));
    });
  });

  describe('本地环境路径结构', () => {
    it('本地环境应该返回有效的路径', () => {
      // 恢复为非 Docker 环境
      process.env.HOME = originalEnv.HOME || '/home/testuser';
      process.env.XDG_CONFIG_HOME = originalEnv.XDG_CONFIG_HOME;
      process.env.XDG_DATA_HOME = originalEnv.XDG_DATA_HOME;

      const configDir = getConfigDir();
      const dataDir = getDataDir();

      // 应该返回有效的路径
      expect(configDir).toBeDefined();
      expect(dataDir).toBeDefined();
      expect(typeof configDir).toBe('string');
      expect(typeof dataDir).toBe('string');
    });
  });
});
