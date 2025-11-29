import { NextRequest, NextResponse } from 'next/server';
import { loadConfig } from '@/lib/config';
import { TaskStatus } from '@/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * æÑû¡gL API
 * POST /api/trigger?dryRun=true/false
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dryRun') === 'true';

    const config = await loadConfig();

    // Àå/&	û¡c(ÐL
    // ÙÌ”å	ôŒ„„:6

    // ú°û¡
    const taskId = uuidv4();
    const task: TaskStatus = {
      id: taskId,
      name: `‡ötû¡ - ${dryRun ? 'ÕÐL' : 'cÐL'}`,
      status: 'pending',
      progress: 0,
      totalFiles: 0,
      processedFiles: 0,
      errors: 0,
      startTime: new Date(),
      dryRun,
      config: {
        rootDir: config.directories.root_dir,
        incomingDir: config.directories.incoming_dir,
        similarityThreshold: config.scan.similarity_threshold,
        aiProvider: 'openai',
        aiModel: config.openai.model,
        enableMove: !dryRun,
        enableAI: true,
        enableSimilarityCheck: config.scan.similarity_threshold > 0,
      },
    };

    // ÙÌ”å/¨žE„û¡A
    // ‚öÔÞŸÍ”
    const result = {
      success: true,
      message: dryRun
        ? 'ÕÐLû¡ò/¨žEû¨‡ö'
        : '‡ötû¡ò/¨',
      taskId: taskId,
      dryRun: dryRun,
      estimatedDuration: '„¡ 2-5 Ÿ',
    };

    console.log(`Task ${taskId} started (dryRun: ${dryRun})`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to trigger task:', error);
    return NextResponse.json(
      {
        success: false,
        message: '/¨û¡1%',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}