import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { GenerateRequest } from "../core/types.js";
import { Pipeline, type JobResult, type Stage } from "../pipeline/pipeline.js";

export interface Job {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  stage?: Stage;
  request: GenerateRequest;
  createdAt: string;
  result?: JobResult;
  error?: string;
}

export const PIPELINE = Symbol("Pipeline");

/** Runs jobs one at a time, in order. State lives in memory and is lost on restart. */
@Injectable()
export class JobsService {
  private readonly jobs = new Map<string, Job>();
  private chain: Promise<void> = Promise.resolve();

  constructor(@Inject(PIPELINE) private readonly pipeline: Pipeline) {}

  submit(request: GenerateRequest): Job {
    const job: Job = { id: randomUUID(), status: "queued", request, createdAt: new Date().toISOString() };
    this.jobs.set(job.id, job);
    this.chain = this.chain.then(() => this.execute(job));
    return job;
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  private async execute(job: Job): Promise<void> {
    job.status = "running";
    try {
      job.result = await this.pipeline.run(job.id, job.request, (stage) => (job.stage = stage));
      job.status = "done";
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : String(error);
    }
  }
}
