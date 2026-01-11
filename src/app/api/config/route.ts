import { NextRequest, NextResponse } from 'next/server';
import { loadConfig, updateConfig, getTaskConfig } from '@/lib/config';
import { z } from 'zod';
import { verifyAuth } from '@/lib/auth';

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
  const auth = await verifyAuth(request);
  if (auth instanceof NextResponse) return auth;

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
  const auth = await verifyAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();

    // Validate configuration format
    const validatedConfig = configSchema.parse(body);

    // Update configuration (type assertion needed due to zod schema partial types)
    updateConfig(validatedConfig as Parameters<typeof updateConfig>[0]);

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
