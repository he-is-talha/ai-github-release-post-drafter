/**
 * Minimal Octokit typings for the IDE when node_modules is not indexed.
 */
declare module "@octokit/rest" {
  export type OctokitOptions = {
    auth?: string;
    log?: {
      debug: (message: string) => unknown;
      info: (message: string) => unknown;
      warn: (message: string) => unknown;
      error: (message: string) => unknown;
    };
  };

  export class Octokit {
    constructor(options?: OctokitOptions);
    rest: {
      repos: {
        get: (params: { owner: string; repo: string }) => Promise<{
          data: { default_branch: string };
        }>;
        getRelease: (params: {
          owner: string;
          repo: string;
          release_id: number;
        }) => Promise<{
          data: {
            id: number;
            tag_name: string;
            name: string | null;
            body: string | null;
            draft: boolean;
            prerelease: boolean;
          };
        }>;
        compareCommits: (params: {
          owner: string;
          repo: string;
          base: string;
          head: string;
        }) => Promise<{
          data: {
            total_commits?: number;
            commits?: unknown[];
            files?: Array<{
              additions?: number;
              deletions?: number;
            }>;
          };
        }>;
        getContent: (params: {
          owner: string;
          repo: string;
          path: string;
          ref?: string;
        }) => Promise<{
          data: { sha: string } | Array<unknown>;
        }>;
        createOrUpdateFileContents: (params: {
          owner: string;
          repo: string;
          path: string;
          message: string;
          content: string;
          branch?: string;
          sha?: string;
        }) => Promise<unknown>;
      };
      git: {
        getRef: (params: {
          owner: string;
          repo: string;
          ref: string;
        }) => Promise<{ data: { object: { sha: string } } }>;
        createRef: (params: {
          owner: string;
          repo: string;
          ref: string;
          sha: string;
        }) => Promise<unknown>;
      };
      pulls: {
        create: (params: {
          owner: string;
          repo: string;
          title: string;
          head: string;
          base: string;
          body?: string;
        }) => Promise<{ data: { number: number; html_url: string } }>;
      };
    };
  }
}
