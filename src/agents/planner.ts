import path from "node:path";
import type { PipelineRun, TaskGraph, TaskNode } from "../types/pipeline.js";
import { readJsonIfExists, toPosixRelative, writeJson } from "../utils/file-utils.js";

/**
 * AgentMesh "Planner": decomposes the run into a task graph before any work starts.
 * Roles: planner → src/agents/planner.ts, coder → ui-generator, debugger → validator,
 * reviewer → packager; research/extraction agents are "specialists".
 */

export function planTaskGraph(run: PipelineRun): TaskGraph {
  const { ctx } = run;
  const rel = (p: string) => toPosixRelative(ctx.paths.root, p);
  const nodes: TaskNode[] = [];
  const node = (n: Omit<TaskNode, "status">) => nodes.push({ ...n, status: "pending" });

  node({ id: "plan", phase: "PLANNING", role: "planner", agent: "src/agents/planner.ts", title: "Plan the run", inputs: [rel(ctx.paths.urlsFile), "config/"], outputs: [rel(ctx.paths.taskGraphFile)], dependsOn: [] });
  for (const site of run.sites) {
    node({ id: `acquire:${site.slug}`, phase: "PHASE_1_ACQUISITION", role: "specialist", agent: "src/agents/site-acquirer.ts", title: `Acquire ${site.url}`, inputs: [site.url], outputs: [rel(path.join(ctx.paths.acquisitionDir, site.slug))], dependsOn: ["plan"] });
    node({ id: `extract:${site.slug}`, phase: "PHASE_2_DESIGN_EXTRACTION", role: "specialist", agent: "src/agents/design-extractor.ts", title: `Extract the design system of ${site.url} (chhapify)`, inputs: [site.url], outputs: [rel(path.join(ctx.paths.designTokensDir, site.slug, "tokens.json"))], dependsOn: [`acquire:${site.slug}`] });
    node({ id: `inventory:${site.slug}`, phase: "PHASE_3_FEATURE_INVENTORY", role: "specialist", agent: "src/agents/feature-inventory.ts", title: `Inventory the features of ${site.url} (Clooney-Agent + DOM analyzer)`, inputs: [rel(path.join(ctx.paths.acquisitionDir, site.slug, "dom-snapshot.json"))], outputs: [rel(path.join(ctx.paths.featureManifestsDir, `${site.slug}.json`))], dependsOn: [`acquire:${site.slug}`] });
  }
  node({ id: "union", phase: "PHASE_4_FEATURE_UNION", role: "specialist", agent: "src/agents/feature-inventory.ts", title: "Compute the feature union", inputs: run.sites.map((s) => rel(path.join(ctx.paths.featureManifestsDir, `${s.slug}.json`))), outputs: [rel(path.join(ctx.paths.featureManifestsDir, "UNION.json"))], dependsOn: run.sites.map((s) => `inventory:${s.slug}`) });
  node({ id: "content", phase: "PHASE_5_CONTENT_SYNTHESIS", role: "specialist", agent: "src/agents/content-synthesizer.ts", title: `Synthesize content about ${ctx.artist.searchName}`, inputs: ["config/artist.json"], outputs: [rel(path.join(ctx.paths.contentDir, "content.json"))], dependsOn: ["plan"] });
  for (const brief of ctx.briefs) {
    const projectDir = rel(path.join(ctx.paths.outputDir, brief.projectName));
    node({ id: `generate:${brief.id}`, phase: "PHASE_6_UI_GENERATION", role: "coder", agent: "src/agents/ui-generator.ts", title: `Generate ${brief.projectName} (${brief.name}, json-render)`, inputs: [brief.promptFile, `${brief.templateDir}/`], outputs: [projectDir], dependsOn: ["union", "content", ...run.sites.map((s) => `extract:${s.slug}`)] });
    node({ id: `validate:${brief.projectName}`, phase: "PHASE_7_VALIDATION", role: "debugger", agent: "src/agents/validator.ts", title: `Validate ${brief.projectName} (site-facelift)`, inputs: [projectDir], outputs: [rel(path.join(ctx.paths.validationReportsDir, `${brief.projectName}.md`))], dependsOn: [`generate:${brief.id}`] });
    node({ id: `package:${brief.projectName}`, phase: "PHASE_8_PACKAGING", role: "reviewer", agent: "src/agents/packager.ts", title: `Install, build and smoke-test ${brief.projectName}`, inputs: [projectDir], outputs: [`${projectDir}/node_modules`, `${projectDir}/RUN.md`], dependsOn: [`validate:${brief.projectName}`] });
  }
  node({ id: "report", phase: "PHASE_9_REPORT", role: "reporter", agent: "src/agents/reporter.ts", title: "Write the summary report", inputs: ["artifacts/"], outputs: [rel(ctx.paths.reportFile), rel(ctx.paths.reportJsonFile)], dependsOn: ctx.briefs.map((b) => `package:${b.projectName}`) });

  return {
    version: 1,
    runId: run.checkpoint.state.runId,
    createdAt: new Date().toISOString(),
    agentMesh: { planner: "src/agents/planner.ts", coder: "src/agents/ui-generator.ts", debugger: "src/agents/validator.ts", reviewer: "src/agents/packager.ts" },
    nodes,
    edges: nodes.flatMap((n) => n.dependsOn.map((d) => [d, n.id] as [string, string])),
  };
}

export async function writeTaskGraph(run: PipelineRun, graph: TaskGraph): Promise<void> {
  await writeJson(run.ctx.paths.taskGraphFile, graph);
}

/** Set the status of every node whose id equals or starts with `nodeIdPrefix`. */
export async function updateTaskStatus(run: PipelineRun, nodeIdPrefix: string, status: TaskNode["status"]): Promise<void> {
  const graph = await readJsonIfExists<TaskGraph | null>(run.ctx.paths.taskGraphFile, null);
  if (!graph) return;
  let changed = false;
  for (const n of graph.nodes) {
    if (n.id === nodeIdPrefix || n.id.startsWith(nodeIdPrefix)) {
      n.status = status;
      changed = true;
    }
  }
  if (changed) await writeJson(run.ctx.paths.taskGraphFile, graph);
}
