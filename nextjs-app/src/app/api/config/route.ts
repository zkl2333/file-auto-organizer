import { NextRequest, NextResponse } from 'next/server';
import { loadConfig, updateConfig, getTaskConfig } from '@/lib/config';
import { z } from 'zod';

// Import the config to get current values
let currentConfig: any;
loadConfig()
  .then((config) => {
    currentConfig = config;
  })
  .catch(() => {
    // If loading fails, use a default config structure
    currentConfig = {
      openai: { api_key: '', model: 'gpt-4', base_url: '' },
      directories: { root_dir: './分类库', incoming_dir: './待分类' },
      scan: { similarity_threshold: 0.8, max_depth: 10 },
      logging: { level: 'info', dir: './logs' },
      cron: { enabled: false, schedule: '0 */6 * * *' },
    };
  });

// Configuration validation schema
const configSchema = z.object({
  openai: z
    .object({
      api_key: z.string().optional(),
      model: z.string().optional(),
      base_url: z.string().optional(),
    })
    .optional(),
  directories: z
    .object({
      root_dir: z.string().optional(),
      incoming_dir: z.string().optional(),
    })
    .optional(),
  scan: z
    .object({
      similarity_threshold: z.number().min(0).max(1).optional(),
      max_depth: z.number().min(1).optional(),
    })
    .optional(),
  logging: z
    .object({
      level: z.enum(['debug', 'info', 'warn', 'error']).optional(),
    })
    .optional(),
  cron: z
    .object({
      enabled: z.boolean().optional(),
      schedule: z.string().optional(),
    })
    .optional(),
});

/**
 * Get configuration API
 * GET /api/config
 */
export async function GET(request: NextRequest) {
  try {
    const config = await loadConfig();
    const taskConfig = getTaskConfig();

    return NextResponse.json({
      success: true,
      data: {
        fullConfig: config,
        taskConfig,
      },
    });
  } catch (error) {
    console.error('Failed to get config:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get config',
      },
      { status: 500 }
    );
  }
}

/**
 * Update configuration API
 * PUT /api/config
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate configuration format
    const validatedConfig = configSchema.parse(body);

    // Update configuration with type assertion
    const configUpdate = validatedConfig as any;

    // Update configuration
    updateConfig(configUpdate);

    const updatedConfig = await loadConfig();

    return NextResponse.json({
      success: true,
      message: 'Configuration updated successfully',
      data: {
        config: updatedConfig,
      },
    });
  } catch (error) {
    console.error('Failed to update config:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Configuration format error',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update config',
      },
      { status: 500 }
    );
  }
}
