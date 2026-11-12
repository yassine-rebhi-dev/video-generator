import { Module } from "@nestjs/common";
import { VideosController } from "./api/videos.controller.js";
import { loadConfig } from "./config/env.js";
import { JobsService, PIPELINE } from "./jobs/jobs.service.js";
import { createPipeline } from "./pipeline/factory.js";

export const CONFIG = Symbol("AppConfig");

@Module({
  controllers: [VideosController],
  providers: [
    { provide: CONFIG, useFactory: () => loadConfig() },
    { provide: PIPELINE, useFactory: (config: ReturnType<typeof loadConfig>) => createPipeline(config), inject: [CONFIG] },
    JobsService,
  ],
})
export class AppModule {}
