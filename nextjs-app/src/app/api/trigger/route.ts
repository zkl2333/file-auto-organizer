import { NextRequest, NextResponse } from 'next/server';
import { loadConfig } from '@/lib/config';
import { TaskStatus } from '@/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Trigger task execution API
 * POST /api/trigger?dryRun=true/false
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dryRun') === 'true';

    const config = await loadConfig();

    // Check if there is already a task running
    // This should have a more complete locking mechanism

    // Create new task
    const taskId = uuidv4();
    const task: TaskStatus = {
      id: taskId,
      name: 'File Organization Task - ' + (dryRun ? 'Dry Run' : 'Production'),
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

    // Here the actual task processing process should be started
    // For now, return success response
    const result = {
      success: true,
      message: dryRun
        ? 'Dry run task started, files will not be moved'
        : 'File organization task started',
      taskId: taskId,
      dryRun: dryRun,
      estimatedDuration: 'Estimated 2-5 minutes',
    };

    console.log('Task ' + taskId + ' started (dryRun: ' + dryRun + ')');

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to trigger task:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to start task',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
