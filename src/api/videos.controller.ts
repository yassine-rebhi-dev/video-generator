import { BadRequestException, Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { z } from "zod";
import { JobsService, type Job } from "../jobs/jobs.service.js";

export const generateBodySchema = z.object({
  topic: z.string().trim().min(3).max(300),
  style: z.string().trim().min(2).max(120).default("dark-mystery"),
  durationSec: z.number().int().min(15).max(60).default(40),
  voice: z.string().trim().min(2).max(40).optional(),
});

function view(job: Job) {
  return {
    id: job.id,
    status: job.status,
    stage: job.stage,
    createdAt: job.createdAt,
    error: job.error,
    result: job.result && {
      duration: job.result.duration,
      qaPass: job.result.qa.pass,
      checks: job.result.qa.checks,
      timings: job.result.timings,
      fallbackClips: job.result.fallbackClips,
      file: `/videos/${job.id}/file`,
    },
  };
}

@Controller("videos")
export class VideosController {
  constructor(private readonly jobs: JobsService) {}

  @Post()
  @HttpCode(202)
  create(@Body() body: unknown) {
    const parsed = generateBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
    }
    return view(this.jobs.submit(parsed.data));
  }

  @Get(":id")
  status(@Param("id") id: string) {
    const job = this.jobs.get(id);
    if (!job) throw new NotFoundException(`No job ${id}`);
    return view(job);
  }

  @Get(":id/file")
  file(@Param("id") id: string, @Res() res: Response) {
    const job = this.jobs.get(id);
    if (!job) throw new NotFoundException(`No job ${id}`);
    if (!job.result) throw new NotFoundException(`Job ${id} has no video yet (status: ${job.status})`);
    res.type("video/mp4").sendFile(job.result.file);
  }
}
