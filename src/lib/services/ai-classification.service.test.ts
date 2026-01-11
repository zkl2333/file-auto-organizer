import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getConfig } from '@/lib/config';

// Mock dependencies
vi.mock('@/lib/config', () => ({
  getConfig: vi.fn(),
}));

vi.mock('openai', () => {
  class MockOpenAI {
    chat = {
      completions: {
        create: vi.fn(),
      },
    };
  }

  return {
    default: MockOpenAI,
  };
});

describe('AIClassificationService', () => {
  let service: any;
  let mockOpenAIChat: any;
  let mockConfig: ReturnType<typeof getConfig>;

  beforeEach(async () => {
    // 重置所有 mock
    vi.clearAllMocks();

    mockConfig = {
      openai: {
        api_key: 'test-api-key',
        model: 'gpt-4o-mini',
        base_url: 'https://api.openai.com/v1',
      },
      directories: {
        root_dir: '/test/root',
        incoming_dir: '/test/incoming',
      },
      cron: {
        enabled: false,
        schedule: '0 0 * * *',
      },
      logging: {
        level: 'info',
        dir: '/test/logs',
      },
      scan: {
        max_depth: 5,
        similarity_threshold: 0.8,
      },
      ai: {
        batch_size: 10,
      },
      file_operations: {
        max_retries: 3,
        retry_delay_base: 1000,
      },
      timezone: 'Asia/Shanghai',
    };

    vi.mocked(getConfig).mockReturnValue(mockConfig as any);

    // 创建服务实例
    const { AIClassificationService: ServiceClass } =
      await import('@/lib/services/ai-classification.service');
    service = new ServiceClass();

    // 获取 OpenAI 实例的 chat.completions.create mock
    mockOpenAIChat = (service as any).openai.chat;
  });

  describe('classifyBatch', () => {
    it('应该成功批量分类文件', async () => {
      const files = [
        { fileName: 'document.pdf', description: '技术文档' },
        { fileName: 'image.png', description: '图片文件' },
      ];

      const mockResponse = {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  type: 'function',
                  function: {
                    name: 'classify_files_batch',
                    arguments: JSON.stringify({
                      classifications: [
                        {
                          file_name: 'document.pdf',
                          directory_path: '技术文档',
                          reasoning: '这是一个PDF技术文档',
                        },
                        {
                          file_name: 'image.png',
                          directory_path: '图片',
                          reasoning: '这是一个图片文件',
                        },
                      ],
                    }),
                  },
                },
              ],
            },
          },
        ],
        usage: {
          total_tokens: 100,
          prompt_tokens: 50,
          completion_tokens: 50,
        },
      };

      mockOpenAIChat.completions.create.mockResolvedValue(mockResponse as any);

      const result = await service.classifyBatch(files, ['技术文档', '图片']);

      expect(result.classifications).toHaveLength(2);
      expect(result.classifications[0].fileName).toBe('document.pdf');
      expect(result.classifications[0].path).toBe('技术文档');
      expect(result.classifications[0].reasoning).toBe('这是一个PDF技术文档');
      expect(result.tokensUsed).toBe(100);

      expect(mockOpenAIChat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          messages: expect.any(Array),
          tools: expect.any(Array),
        })
      );
    });

    it('应该处理空文件列表', async () => {
      const result = await service.classifyBatch([], []);

      expect(result.classifications).toHaveLength(0);
      expect(result.tokensUsed).toBe(0);

      // 空数组时不应调用 API
      expect(mockOpenAIChat.completions.create).not.toHaveBeenCalled();
    });

    it('应该正确处理包含描述的文件', async () => {
      const files = [{ fileName: 'setup.exe', description: '开发工具安装包' }];

      const mockResponse = {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  type: 'function',
                  function: {
                    name: 'classify_files_batch',
                    arguments: JSON.stringify({
                      classifications: [
                        {
                          file_name: 'setup.exe',
                          directory_path: '开发工具',
                          reasoning: '这是一个开发工具安装包',
                        },
                      ],
                    }),
                  },
                },
              ],
            },
          },
        ],
        usage: { total_tokens: 80 },
      };

      mockOpenAIChat.completions.create.mockResolvedValue(mockResponse as any);

      const result = await service.classifyBatch(files, []);

      expect(result.classifications[0].fileName).toBe('setup.exe');
      expect(result.classifications[0].path).toBe('开发工具');
      expect(result.classifications[0].reasoning).toBe('这是一个开发工具安装包');
    });

    it('应该处理没有描述的文件', async () => {
      const files = [{ fileName: 'unknown.txt', description: '' }];

      const mockResponse = {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  type: 'function',
                  function: {
                    name: 'classify_files_batch',
                    arguments: JSON.stringify({
                      classifications: [
                        {
                          file_name: 'unknown.txt',
                          directory_path: '其他',
                          reasoning: '无法确定具体类型的文件',
                        },
                      ],
                    }),
                  },
                },
              ],
            },
          },
        ],
        usage: { total_tokens: 60 },
      };

      mockOpenAIChat.completions.create.mockResolvedValue(mockResponse as any);

      const result = await service.classifyBatch(files, []);

      expect(result.classifications[0].fileName).toBe('unknown.txt');
      expect(result.classifications[0].path).toBe('其他');
    });

    it('应该返回正确的 token 使用统计', async () => {
      const files = [{ fileName: 'test.pdf', description: '' }];

      const mockResponse = {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  type: 'function',
                  function: {
                    name: 'classify_files_batch',
                    arguments: JSON.stringify({
                      classifications: [
                        {
                          file_name: 'test.pdf',
                          directory_path: '文档',
                          reasoning: '测试',
                        },
                      ],
                    }),
                  },
                },
              ],
            },
          },
        ],
        usage: {
          total_tokens: 150,
          prompt_tokens: 100,
          completion_tokens: 50,
        },
      };

      mockOpenAIChat.completions.create.mockResolvedValue(mockResponse as any);

      const result = await service.classifyBatch(files, []);

      expect(result.tokensUsed).toBe(150);
    });

    it('应该处理 AI API 错误', async () => {
      const files = [{ fileName: 'test.pdf', description: '' }];

      mockOpenAIChat.completions.create.mockRejectedValue(new Error('API rate limit exceeded'));

      await expect(service.classifyBatch(files, [])).rejects.toThrow('API rate limit exceeded');
    });

    it('应该处理无效的 API 响应', async () => {
      const files = [{ fileName: 'test.pdf', description: '' }];

      const mockResponse = {
        choices: [
          {
            message: {},
          },
        ],
      };

      mockOpenAIChat.completions.create.mockResolvedValue(mockResponse as any);

      await expect(service.classifyBatch(files, [])).rejects.toThrow(
        'AI批量分类失败：未返回有效结果'
      );
    });

    it('应该处理分类结果解析错误', async () => {
      const files = [{ fileName: 'test.pdf', description: '' }];

      const mockResponse = {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  type: 'function',
                  function: {
                    name: 'classify_files_batch',
                    arguments: 'invalid json{{{',
                  },
                },
              ],
            },
          },
        ],
      };

      mockOpenAIChat.completions.create.mockResolvedValue(mockResponse as any);

      await expect(service.classifyBatch(files, [])).rejects.toThrow('批量分类解析失败');
    });

    it('应该正确传递已知目录信息', async () => {
      const files = [{ fileName: 'test.pdf', description: '' }];
      const knownDirs = ['文档', '图片', '音乐'];

      const mockResponse = {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  type: 'function',
                  function: {
                    name: 'classify_files_batch',
                    arguments: JSON.stringify({
                      classifications: [
                        {
                          file_name: 'test.pdf',
                          directory_path: '文档',
                          reasoning: '匹配到已知目录',
                        },
                      ],
                    }),
                  },
                },
              ],
            },
          },
        ],
        usage: { total_tokens: 60 },
      };

      mockOpenAIChat.completions.create.mockResolvedValue(mockResponse as any);

      await service.classifyBatch(files, knownDirs);

      expect(mockOpenAIChat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('文档\n  图片\n  音乐'),
            }),
          ]),
        })
      );
    });

    it('应该处理空目录列表', async () => {
      const files = [{ fileName: 'new.pdf', description: '' }];

      const mockResponse = {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  type: 'function',
                  function: {
                    name: 'classify_files_batch',
                    arguments: JSON.stringify({
                      classifications: [
                        {
                          file_name: 'new.pdf',
                          directory_path: '新建分类',
                          reasoning: '创建新分类目录',
                        },
                      ],
                    }),
                  },
                },
              ],
            },
          },
        ],
        usage: { total_tokens: 60 },
      };

      mockOpenAIChat.completions.create.mockResolvedValue(mockResponse as any);

      await service.classifyBatch(files, []);

      expect(mockOpenAIChat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('暂无，需要创建新目录'),
            }),
          ]),
        })
      );
    });

    it('应该处理大量文件的批量分类', async () => {
      const files = Array.from({ length: 50 }, (_, i) => ({
        fileName: `file${i}.pdf`,
        description: `文档${i}`,
      }));

      const mockResponse = {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  type: 'function',
                  function: {
                    name: 'classify_files_batch',
                    arguments: JSON.stringify({
                      classifications: files.map((f: { fileName: string }) => ({
                        file_name: f.fileName,
                        directory_path: '文档',
                        reasoning: '文档文件',
                      })),
                    }),
                  },
                },
              ],
            },
          },
        ],
        usage: { total_tokens: 500 },
      };

      mockOpenAIChat.completions.create.mockResolvedValue(mockResponse as any);

      const result = await service.classifyBatch(files, []);

      expect(result.classifications).toHaveLength(50);
      expect(result.tokensUsed).toBe(500);
      expect(result.classifications.every((c: { path: string }) => c.path === '文档')).toBe(true);
    });

    it('应该正确映射分类结果字段', async () => {
      const files = [{ fileName: 'test.jpg', description: '' }];

      const mockResponse = {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  type: 'function',
                  function: {
                    name: 'classify_files_batch',
                    arguments: JSON.stringify({
                      classifications: [
                        {
                          file_name: 'test.jpg',
                          directory_path: '照片',
                          reasoning: '照片文件',
                        },
                      ],
                    }),
                  },
                },
              ],
            },
          },
        ],
        usage: { total_tokens: 70 },
      };

      mockOpenAIChat.completions.create.mockResolvedValue(mockResponse as any);

      const result = await service.classifyBatch(files, []);

      expect(result.classifications[0]).toEqual({
        fileName: 'test.jpg',
        path: '照片',
        reasoning: '照片文件',
      });
    });
  });
});
