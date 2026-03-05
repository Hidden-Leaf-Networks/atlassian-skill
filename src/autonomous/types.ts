/**
 * Autonomous Engineering Types
 * Phase 5: AI-driven operations and multi-agent integration
 */

// =============================================================================
// Core Enums and Constants
// =============================================================================

export enum OperationMode {
  /** Suggest actions for human approval */
  SUGGEST = 'suggest',
  /** Automatically execute actions */
  AUTO = 'auto',
}

export enum ConfidenceLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high',
}

export enum Priority {
  LOWEST = 'lowest',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  HIGHEST = 'highest',
}

export enum IssueType {
  BUG = 'Bug',
  TASK = 'Task',
  STORY = 'Story',
  EPIC = 'Epic',
  SUBTASK = 'Sub-task',
  IMPROVEMENT = 'Improvement',
  FEATURE = 'Feature',
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum AnomalyType {
  VELOCITY_DROP = 'velocity_drop',
  BLOCKED_SPIKE = 'blocked_spike',
  SCOPE_CREEP = 'scope_creep',
  STALE_INCREASE = 'stale_increase',
  WORKLOAD_IMBALANCE = 'workload_imbalance',
  CYCLE_TIME_INCREASE = 'cycle_time_increase',
  DEFECT_RATE_SPIKE = 'defect_rate_spike',
}

export enum TriggerType {
  ISSUE_CREATED = 'issue_created',
  ISSUE_UPDATED = 'issue_updated',
  ISSUE_TRANSITIONED = 'issue_transitioned',
  PR_CREATED = 'pr_created',
  PR_MERGED = 'pr_merged',
  SPRINT_STARTED = 'sprint_started',
  SPRINT_ENDED = 'sprint_ended',
  SCHEDULED = 'scheduled',
  MANUAL = 'manual',
}

export enum ActionType {
  UPDATE_FIELD = 'update_field',
  ADD_LABEL = 'add_label',
  ADD_COMMENT = 'add_comment',
  ASSIGN_USER = 'assign_user',
  TRANSITION_ISSUE = 'transition_issue',
  LINK_ISSUES = 'link_issues',
  SEND_NOTIFICATION = 'send_notification',
  CREATE_ISSUE = 'create_issue',
  INVOKE_WEBHOOK = 'invoke_webhook',
}

// =============================================================================
// Base Types
// =============================================================================

export interface AuditEntry {
  timestamp: Date;
  action: string;
  actor: string;
  details: Record<string, unknown>;
  outcome: 'success' | 'failure' | 'skipped';
  reason?: string;
}

export interface BaseResult {
  success: boolean;
  timestamp: Date;
  auditLog: AuditEntry[];
  errors?: string[];
}

export interface ConfidenceScore {
  value: number; // 0-1
  level: ConfidenceLevel;
  factors: string[];
}

// =============================================================================
// Issue Triage Types
// =============================================================================

export interface SimilarIssue {
  issueKey: string;
  summary: string;
  status: string;
  similarity: number; // 0-1
  matchedFields: string[];
  resolution?: string;
}

export interface DuplicateResult {
  hasDuplicates: boolean;
  candidates: SimilarIssue[];
  confidence: ConfidenceScore;
  recommendation: 'link' | 'close' | 'review' | 'none';
}

export interface AssigneeSuggestion {
  accountId: string;
  displayName: string;
  email?: string;
  confidence: ConfidenceScore;
  reasons: string[];
  workload: {
    assignedIssues: number;
    inProgressIssues: number;
    recentCompletions: number;
  };
  expertise: {
    components: string[];
    labels: string[];
    issueTypes: string[];
  };
}

export interface TriageRecommendation {
  field: string;
  currentValue: unknown;
  suggestedValue: unknown;
  confidence: ConfidenceScore;
  reasoning: string;
}

export interface TriageResult extends BaseResult {
  issueKey: string;
  recommendations: {
    type?: TriageRecommendation;
    priority?: TriageRecommendation;
    labels?: TriageRecommendation;
    components?: TriageRecommendation;
    assignee?: AssigneeSuggestion;
  };
  similarIssues: SimilarIssue[];
  duplicateCheck: DuplicateResult;
  appliedActions: string[];
  mode: OperationMode;
}

// =============================================================================
// Sprint Planning Types
// =============================================================================

export interface SprintMetrics {
  sprintId: number;
  sprintName: string;
  startDate: Date;
  endDate: Date;
  committedPoints: number;
  completedPoints: number;
  addedPoints: number;
  removedPoints: number;
  completionRate: number;
  issues: {
    committed: number;
    completed: number;
    added: number;
    removed: number;
  };
}

export interface VelocityAnalysis {
  averageVelocity: number;
  medianVelocity: number;
  standardDeviation: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  trendPercentage: number;
  sprintHistory: SprintMetrics[];
  predictedVelocity: number;
  confidence: ConfidenceScore;
  factors: string[];
}

export interface IssueSuggestion {
  issueKey: string;
  summary: string;
  storyPoints: number;
  priority: Priority;
  score: number;
  reasons: string[];
  dependencies: string[];
  risks: string[];
}

export interface ScopeSuggestion {
  recommendedIssues: IssueSuggestion[];
  totalPoints: number;
  capacityUtilization: number;
  balanceScore: number;
  warnings: string[];
  alternatives: IssueSuggestion[];
  confidence: ConfidenceScore;
}

export interface RiskFactor {
  type: string;
  description: string;
  severity: RiskLevel;
  affectedIssues: string[];
  mitigation?: string;
}

export interface RiskAssessment {
  sprintId: number;
  overallRisk: RiskLevel;
  riskScore: number; // 0-100
  factors: RiskFactor[];
  recommendations: string[];
  confidence: ConfidenceScore;
}

export interface EstimationSuggestion {
  issueKey: string;
  suggestedPoints: number;
  confidence: ConfidenceScore;
  similarIssues: Array<{
    issueKey: string;
    summary: string;
    actualPoints: number;
    completionTime: number; // in hours
  }>;
  reasoning: string;
  range: {
    min: number;
    max: number;
  };
}

// =============================================================================
// Monitoring Types
// =============================================================================

export interface StaleIssue {
  issueKey: string;
  summary: string;
  status: string;
  assignee?: string;
  lastUpdated: Date;
  staleDays: number;
  recommendation: string;
}

export interface BlockedIssue {
  issueKey: string;
  summary: string;
  blockedBy: Array<{
    issueKey: string;
    summary: string;
    status: string;
  }>;
  blockedSince: Date;
  blockedDays: number;
  impact: RiskLevel;
}

export interface AtRiskItem {
  issueKey: string;
  summary: string;
  riskLevel: RiskLevel;
  reasons: string[];
  daysRemaining: number;
  estimatedCompletion?: Date;
  recommendations: string[];
}

export interface HealthMetrics {
  velocity: {
    current: number;
    average: number;
    trend: string;
  };
  cycleTime: {
    average: number;
    p50: number;
    p90: number;
  };
  throughput: {
    daily: number;
    weekly: number;
  };
  workInProgress: {
    count: number;
    avgAge: number;
  };
  defectRate: number;
  scopeChange: number;
}

export interface HealthReport {
  projectKey: string;
  generatedAt: Date;
  overallHealth: 'healthy' | 'warning' | 'critical';
  healthScore: number; // 0-100
  metrics: HealthMetrics;
  staleIssues: StaleIssue[];
  blockedIssues: BlockedIssue[];
  atRiskItems: AtRiskItem[];
  recommendations: string[];
  trends: Array<{
    metric: string;
    direction: 'up' | 'down' | 'stable';
    percentage: number;
  }>;
}

export interface Anomaly {
  type: AnomalyType;
  severity: RiskLevel;
  detectedAt: Date;
  description: string;
  affectedEntities: string[];
  baseline: number;
  actual: number;
  deviation: number; // percentage
  recommendation: string;
}

// =============================================================================
// Agent Integration Types
// =============================================================================

export interface AgentCapability {
  name: string;
  description: string;
  category: 'jira' | 'bitbucket' | 'confluence' | 'sdlc' | 'autonomous';
  operations: string[];
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  invoke: (params: unknown) => Promise<unknown>;
}

export interface AgentRequest {
  requestId: string;
  sourceAgent: string;
  targetCapability: string;
  operation: string;
  params: Record<string, unknown>;
  context?: WorkflowContext;
  priority: Priority;
  timeout?: number;
  metadata?: Record<string, unknown>;
}

export interface AgentResponse {
  requestId: string;
  success: boolean;
  result?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  executionTime: number;
  auditLog: AuditEntry[];
}

export interface WorkflowContext {
  workflowId: string;
  initiator: string;
  startedAt: Date;
  currentPhase: string;
  entities: {
    issues?: string[];
    pullRequests?: string[];
    pages?: string[];
    sprints?: number[];
  };
  state: Record<string, unknown>;
  history: Array<{
    phase: string;
    completedAt: Date;
    result: unknown;
  }>;
}

// =============================================================================
// Automation Rule Types
// =============================================================================

export interface TriggerConfig {
  type: TriggerType;
  conditions?: Record<string, unknown>;
  schedule?: string; // cron expression for scheduled triggers
  projectKeys?: string[];
  issueTypes?: string[];
}

export interface Condition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'in' | 'not_in' | 'matches' | 'greater_than' | 'less_than';
  value: unknown;
  caseSensitive?: boolean;
}

export interface Action {
  type: ActionType;
  params: Record<string, unknown>;
  onError?: 'stop' | 'continue' | 'retry';
  retryCount?: number;
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: TriggerConfig;
  conditions: Condition[];
  actions: Action[];
  enabled: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  stats: {
    executionCount: number;
    lastExecuted?: Date;
    successCount: number;
    failureCount: number;
  };
}

export interface WorkflowEvent {
  eventId: string;
  type: TriggerType;
  timestamp: Date;
  source: {
    projectKey: string;
    issueKey?: string;
    prId?: string;
    sprintId?: number;
  };
  actor: string;
  changes?: Array<{
    field: string;
    from: unknown;
    to: unknown;
  }>;
  payload: Record<string, unknown>;
}

export interface ActionResult {
  ruleId: string;
  ruleName: string;
  actionType: ActionType;
  success: boolean;
  result?: unknown;
  error?: string;
  executionTime: number;
  skipped?: boolean;
  skipReason?: string;
}

// =============================================================================
// Insights Types
// =============================================================================

export interface WeeklyDigest {
  projectKey: string;
  weekStarting: Date;
  weekEnding: Date;
  summary: string;
  highlights: string[];
  concerns: string[];
  metrics: {
    issuesCreated: number;
    issuesClosed: number;
    prsOpened: number;
    prsMerged: number;
    velocity: number;
    avgCycleTime: number;
  };
  topContributors: Array<{
    name: string;
    contributions: number;
    areas: string[];
  }>;
  upcomingDeadlines: Array<{
    issueKey: string;
    summary: string;
    dueDate: Date;
    status: string;
  }>;
  actionItems: string[];
}

export interface PerformanceAnalysis {
  projectKey: string;
  period: {
    start: Date;
    end: Date;
  };
  teamMetrics: {
    velocity: VelocityAnalysis;
    cycleTime: {
      average: number;
      trend: string;
      byType: Record<string, number>;
    };
    throughput: {
      weekly: number[];
      trend: string;
    };
    qualityMetrics: {
      defectRate: number;
      reworkRate: number;
      firstTimePassRate: number;
    };
  };
  individualMetrics: Array<{
    accountId: string;
    displayName: string;
    issuesClosed: number;
    avgCycleTime: number;
    storyPointsCompleted: number;
    reviewsCompleted: number;
  }>;
  bottlenecks: Array<{
    stage: string;
    avgTime: number;
    issueCount: number;
    recommendation: string;
  }>;
  comparison: {
    previousPeriod: {
      velocityChange: number;
      cycleTimeChange: number;
      throughputChange: number;
    };
  };
}

export interface Improvement {
  id: string;
  category: 'process' | 'tooling' | 'communication' | 'quality' | 'planning';
  title: string;
  description: string;
  impact: RiskLevel;
  effort: 'low' | 'medium' | 'high';
  evidence: string[];
  suggestedActions: string[];
  expectedOutcome: string;
  priority: number;
}

export interface DeliveryPrediction {
  epicKey: string;
  summary: string;
  predictedDate: Date;
  confidence: ConfidenceScore;
  rangeOptimistic: Date;
  rangePessimistic: Date;
  assumptions: string[];
  risks: RiskFactor[];
  completionPercentage: number;
  remainingWork: {
    issues: number;
    storyPoints: number;
    estimatedDays: number;
  };
  factors: Array<{
    name: string;
    impact: number; // days
    direction: 'accelerating' | 'delaying';
  }>;
}

// =============================================================================
// Configuration Types
// =============================================================================

export interface AutonomousConfig {
  mode: OperationMode;
  confidenceThreshold: number;
  enabledFeatures: {
    triage: boolean;
    planning: boolean;
    monitoring: boolean;
    automation: boolean;
    insights: boolean;
  };
  notifications: {
    enabled: boolean;
    channels: string[];
    minSeverity: RiskLevel;
  };
  limits: {
    maxAutoActionsPerHour: number;
    maxSimilarIssuesSearch: number;
    staleDaysThreshold: number;
  };
}

// =============================================================================
// Logger Interface (for dependency injection)
// =============================================================================

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

// =============================================================================
// API Client Interfaces (expected from other phases)
// =============================================================================

export interface JiraIssue {
  key: string;
  id: string;
  fields: {
    summary: string;
    description?: string;
    issuetype: { name: string };
    priority: { name: string };
    status: { name: string };
    assignee?: { accountId: string; displayName: string; emailAddress?: string };
    reporter?: { accountId: string; displayName: string };
    labels: string[];
    components: Array<{ name: string }>;
    created: string;
    updated: string;
    resolutiondate?: string;
    duedate?: string;
    [key: string]: unknown;
  };
}

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  active: boolean;
}

export interface JiraSprint {
  id: number;
  name: string;
  state: 'active' | 'closed' | 'future';
  startDate?: string;
  endDate?: string;
  completeDate?: string;
  goal?: string;
}

export interface JiraBoard {
  id: number;
  name: string;
  type: string;
  location: {
    projectKey: string;
  };
}
