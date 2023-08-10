import { getOctokit } from "@actions/github";
import { GitHub } from "@actions/github/lib/utils";
import { OctokitOptions } from "@octokit/core/dist-types/types";

export type Octokit = InstanceType<typeof GitHub>;

export { getOctokit, OctokitOptions };
