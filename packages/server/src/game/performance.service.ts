import { Injectable } from '@nestjs/common';

@Injectable()
export class PerformanceService {
  private lastCpuUsage = process.cpuUsage();
  private lastCpuTime = process.hrtime.bigint();
  private lastTickMs = 0;

  recordTick(elapsedMs: number) {
    this.lastTickMs = elapsedMs;
  }

  getSnapshot(): { cpuPercent: number; memoryMb: number; tickMs: number } {
    const now = process.hrtime.bigint();
    const cpuUsage = process.cpuUsage(this.lastCpuUsage);
    const elapsedMicros = Number(now - this.lastCpuTime) / 1000;
    const cpuMicros = cpuUsage.user + cpuUsage.system;

    this.lastCpuUsage = process.cpuUsage();
    this.lastCpuTime = now;

    const cpuPercent = elapsedMicros > 0
      ? Math.max(0, Math.min(100, (cpuMicros / elapsedMicros) * 100))
      : 0;
    const memoryMb = process.memoryUsage().rss / (1024 * 1024);

    return {
      cpuPercent: Number(cpuPercent.toFixed(1)),
      memoryMb: Number(memoryMb.toFixed(1)),
      tickMs: Number(this.lastTickMs.toFixed(1)),
    };
  }
}
