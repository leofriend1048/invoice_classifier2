import { supabaseServer } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
      error?: string;
    };
    openai: {
      status: 'healthy' | 'unhealthy';
      apiKeyPresent: boolean;
    };
    storage: {
      status: 'healthy' | 'unhealthy';
      error?: string;
    };
  };
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
}

export async function GET() {
  const startTime = Date.now();
  const healthCheck: HealthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: { status: 'unhealthy' },
      openai: { status: 'unhealthy', apiKeyPresent: false },
      storage: { status: 'unhealthy' }
    },
    uptime: process.uptime(),
    memory: {
      used: 0,
      total: 0,
      percentage: 0
    }
  };

  // Check memory usage
  const memUsage = process.memoryUsage();
  healthCheck.memory = {
    used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
    total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
    percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
  };

  // Check OpenAI API key
  healthCheck.services.openai.apiKeyPresent = !!process.env.OPENAI_API_KEY;
  if (healthCheck.services.openai.apiKeyPresent) {
    healthCheck.services.openai.status = 'healthy';
  }

  // Check database connection
  try {
    const dbStartTime = Date.now();
    const { error } = await supabaseServer
      .from('invoice_class_invoices')
      .select('id')
      .limit(1);
    
    healthCheck.services.database.responseTime = Date.now() - dbStartTime;
    
    if (error) {
      healthCheck.services.database.error = error.message;
      healthCheck.services.database.status = 'unhealthy';
    } else {
      healthCheck.services.database.status = 'healthy';
    }
  } catch (error) {
    healthCheck.services.database.error = error instanceof Error ? error.message : 'Unknown error';
    healthCheck.services.database.status = 'unhealthy';
  }

  // Check storage connection
  try {
    const { error } = await supabaseServer.storage
      .from('invoices-pdf')
      .list('', { limit: 1 });
    
    if (error) {
      healthCheck.services.storage.error = error.message;
      healthCheck.services.storage.status = 'unhealthy';
    } else {
      healthCheck.services.storage.status = 'healthy';
    }
  } catch (error) {
    healthCheck.services.storage.error = error instanceof Error ? error.message : 'Unknown error';
    healthCheck.services.storage.status = 'unhealthy';
  }

  // Determine overall status
  const unhealthyServices = Object.values(healthCheck.services).filter(
    service => service.status === 'unhealthy'
  ).length;

  if (unhealthyServices === 0) {
    healthCheck.status = 'healthy';
  } else if (unhealthyServices <= 1) {
    healthCheck.status = 'degraded';
  } else {
    healthCheck.status = 'unhealthy';
  }

  const responseTime = Date.now() - startTime;
  const statusCode = healthCheck.status === 'healthy' ? 200 : 
                    healthCheck.status === 'degraded' ? 200 : 503;

  return NextResponse.json({
    ...healthCheck,
    responseTime
  }, { status: statusCode });
}
