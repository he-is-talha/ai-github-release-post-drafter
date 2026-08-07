/**
 * Minimal Octokit typings for the IDE when node_modules is not indexed.
 */
declare module "@octokit/rest" {
  export type OctokitOptions = {
    auth?: string;
  };

  export class Octokit {
    constructor(options?: OctokitOptions);
    rest: {
      repos: {
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
      };
    };
  }
}
