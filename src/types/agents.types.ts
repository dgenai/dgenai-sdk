/** Represents a plugin attached to an AI agent. */
export interface AgentPlugin {
    id: string;
    name: string;
    image: string;
    description: string;
  }
  
  /** Represents the completion examples grouped by intent keyword. */
  export interface AgentCompletions {
    [intent: string]: string[];
  }
  
  /** Represents the publication profile of an agent. */
  export interface PublishProfile {
    upFront: number;
    perCall: number;
    publicationState: number;
    publicationDate: string | null;
    publicationFeeTx: string;
  }
  
  /** Represents a single AI agent exposed through the public API. */
  export interface Agent {
    id: string;
    aiServiceName: string;
    owner: string;
    name: string;
    description: string;
    imageUrl: string;
    plugins: AgentPlugin[];
    publicationState: number;
    rating: number;
    ratingCount: number;
    isPublic: boolean;
    completions: AgentCompletions | null;
    attachment: boolean;
    isVerified: boolean;
    categories: string[];
    category: string;
    createdAt: string;
    publishProfile: PublishProfile;
    isRouted: boolean;
    banner: string | null;
  }
  
  /** Represents the list of agents returned by /api/Public/agents. */
  export type AgentListResponse = Agent[];
  