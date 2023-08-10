import {
  ActionLogger,
  input,
  required,
  output,
  decoder,
  encoder,
  StringDecoder,
  JSONEncoder,
  InputSource,
  getOctokit,
  Octokit,
} from "@local/github-actions";
import { context } from "@actions/github";
import { components } from "@octokit/openapi-types";
import { ReleasePleaseManifestConfigSchema } from "./types/config";
import { Buffer } from "buffer";

type File = components["schemas"]["content-file"];

/**
 * Github Action
 */
export class Action {
  public static readonly logger = new ActionLogger();
  public static readonly CONFIG = "release-please-config.json";
  public static readonly MANIFEST = ".release-please-manifest.json";

  /**
   * GitHub token for accessing the release-please configuration and manifest file. Defaults to using GITHUB_API_TOKEN
   */
  @required
  @input("GITHUB_TOKEN", InputSource.Environment)
  @input()
  @decoder(StringDecoder)
  public readonly token!: string;

  /**
   * Where can the config file be found in the project?
   */
  @input("config-file")
  @decoder(StringDecoder)
  public readonly config: string = Action.CONFIG;

  /**
   * Where can the manifest file be found in the project?
   */
  @input("manifest-file")
  @decoder(StringDecoder)
  public readonly manifest: string = Action.MANIFEST;

  /**
   * Packages defined in the release-please configuration file
   */
  @output()
  @encoder(JSONEncoder)
  public packages: string[] = [];

  /**
   * Authenticated Octokit object
   */
  private octokit: Octokit;

  /**
   *
   */
  constructor() {
    this.octokit = getOctokit(this.token);
  }

  /**
   *
   */
  async run() {
    await this.getConfigurationFile().then((config) => {
      this.packages = Object.keys(config.packages).reduce(
        (packages, pkg) => {
          packages.push(pkg);
          return packages;
        },
        <string[]>[],
      );
    });
  }

  private async getConfigurationFile(): Promise<ReleasePleaseManifestConfigSchema> {
    const octokit = this.octokit;

    return octokit.rest.repos
      .getContent({
        owner: context.repo.owner,
        repo: context.repo.repo,
        path: this.config,
        ref: context.ref,
      })
      .then(async (response) => {
        let configurationFile: File;

        while (Array.isArray(response.data)) {
          const config = response.data.find(
            (data) => data.name == Action.CONFIG,
          );
          if (config === undefined) {
            throw new Error(
              `${Action.CONFIG} not found in ${this.config} for ref ${context.ref}`,
            );
          }
          await octokit.rest.repos
            .getContent({
              owner: context.repo.owner,
              repo: context.repo.repo,
              path: config.path,
              ref: context.ref,
            })
            .then((result) => (response = result));
        }

        switch (response.data.type) {
          case "file":
            configurationFile = response.data as File;
            break;
          default:
            throw new Error(
              `${response.data.name} is not a normal file, but appears to be a ${response.data.type}`,
            );
        }

        switch (configurationFile.encoding) {
          case "base64":
            return JSON.parse(
              Buffer.from(
                configurationFile.content,
                configurationFile.encoding,
              ).toString(),
            ) as ReleasePleaseManifestConfigSchema;
          default:
            throw new Error(
              `Content with base64 encoding expected, received encoding: ${configurationFile.encoding}`,
            );
        }
      })
      .catch((reason) => {
        Action.logger.error(
          typeof reason === "string"
            ? reason
            : reason instanceof Error
            ? reason.message
            : String(reason),
        );
        throw reason;
      });
  }
}
