/**
 * Intelligent Issue Triage
 * Automatically categorizes, prioritizes, and routes new issues using AI analysis
 */

import {
  TriageResult,
  SimilarIssue,
  AssigneeSuggestion,
  DuplicateResult,
  TriageRecommendation,
  OperationMode,
  ConfidenceLevel,
  ConfidenceScore,
  Priority,
  IssueType,
  AuditEntry,
  JiraIssue,
  JiraUser,
  Logger,
} from './types.js';

// =============================================================================
// Configuration
// =============================================================================

export interface TriageConfig {
  mode: OperationMode;
  confidenceThreshold: number;
  maxSimilarIssues: number;
  similarityThreshold: number;
  enableDuplicateDetection: boolean;
  enableAutoAssignment: boolean;
  enableAutoLabeling: boolean;
  enableAutoPrioritization: boolean;
}

const DEFAULT_CONFIG: TriageConfig = {
  mode: OperationMode.SUGGEST,
  confidenceThreshold: 0.7,
  maxSimilarIssues: 10,
  similarityThreshold: 0.6,
  enableDuplicateDetection: true,
  enableAutoAssignment: true,
  enableAutoLabeling: true,
  enableAutoPrioritization: true,
};

// =============================================================================
// Interfaces for External Dependencies
// =============================================================================

export interface JiraClient {
  getIssue(issueKey: string): Promise<JiraIssue>;
  searchIssues(jql: string, maxResults?: number): Promise<JiraIssue[]>;
  updateIssue(issueKey: string, fields: Record<string, unknown>): Promise<void>;
  addComment(issueKey: string, comment: string): Promise<void>;
  getProjectUsers(projectKey: string): Promise<JiraUser[]>;
  getIssueHistory(issueKey: string): Promise<IssueHistory[]>;
}

export interface AIAnalyzer {
  analyzeText(text: string, context?: string): Promise<TextAnalysis>;
  computeSimilarity(text1: string, text2: string): Promise<number>;
  classifyIssue(issue: JiraIssue): Promise<IssueClassification>;
  extractKeywords(text: string): Promise<string[]>;
}

interface IssueHistory {
  assignee: string;
  component?: string;
  label?: string;
  completedAt?: Date;
  cycleTime?: number;
}

interface TextAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative';
  urgency: number;
  complexity: number;
  keywords: string[];
  entities: string[];
}

interface IssueClassification {
  suggestedType: IssueType;
  suggestedPriority: Priority;
  suggestedLabels: string[];
  suggestedComponents: string[];
  confidence: number;
}

// =============================================================================
// Issue Triage Class
// =============================================================================

export class IssueTriage {
  private readonly config: TriageConfig;
  private readonly jiraClient: JiraClient;
  private readonly aiAnalyzer: AIAnalyzer;
  private readonly logger: Logger;
  private readonly auditLog: AuditEntry[] = [];

  constructor(
    jiraClient: JiraClient,
    aiAnalyzer: AIAnalyzer,
    logger: Logger,
    config: Partial<TriageConfig> = {}
  ) {
    this.jiraClient = jiraClient;
    this.aiAnalyzer = aiAnalyzer;
    this.logger = logger;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Main triage entry point - analyzes and categorizes an issue
   */
  async triageIssue(issueKey: string): Promise<TriageResult> {
    const startTime = Date.now();
    this.logger.info(`Starting triage for issue ${issueKey}`, { issueKey });

    try {
      // 1. Fetch the issue
      const issue = await this.jiraClient.getIssue(issueKey);
      this.addAuditEntry('fetch_issue', 'system', { issueKey }, 'success');

      // 2. Analyze with AI
      const classification = await this.analyzeIssue(issue);

      // 3. Find similar issues
      const similarIssues = await this.findSimilarIssues(issueKey);

      // 4. Check for duplicates
      const duplicateCheck = await this.detectDuplicates(issueKey);

      // 5. Suggest assignee
      const assigneeSuggestion = await this.suggestAssignee(issueKey);

      // 6. Build recommendations
      const recommendations = this.buildRecommendations(
        issue,
        classification,
        assigneeSuggestion
      );

      // 7. Apply or suggest based on mode
      const appliedActions = await this.applyRecommendations(
        issueKey,
        recommendations,
        duplicateCheck
      );

      const result: TriageResult = {
        success: true,
        timestamp: new Date(),
        issueKey,
        recommendations,
        similarIssues,
        duplicateCheck,
        appliedActions,
        mode: this.config.mode,
        auditLog: [...this.auditLog],
      };

      this.logger.info(`Triage completed for ${issueKey}`, {
        issueKey,
        duration: Date.now() - startTime,
        appliedActions: appliedActions.length,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.addAuditEntry('triage_issue', 'system', { issueKey, error: errorMessage }, 'failure', errorMessage);

      return {
        success: false,
        timestamp: new Date(),
        issueKey,
        recommendations: {},
        similarIssues: [],
        duplicateCheck: {
          hasDuplicates: false,
          candidates: [],
          confidence: this.createConfidenceScore(0, []),
          recommendation: 'none',
        },
        appliedActions: [],
        mode: this.config.mode,
        auditLog: [...this.auditLog],
        errors: [errorMessage],
      };
    }
  }

  /**
   * Find issues similar to the given issue
   */
  async findSimilarIssues(issueKey: string): Promise<SimilarIssue[]> {
    this.logger.debug(`Finding similar issues for ${issueKey}`);

    const issue = await this.jiraClient.getIssue(issueKey);
    const projectKey = issueKey.split('-')[0];

    // Build search query for potentially similar issues
    const keywords = await this.aiAnalyzer.extractKeywords(
      `${issue.fields.summary} ${issue.fields.description || ''}`
    );

    // Search for issues with similar keywords in the same project
    const searchTerms = keywords.slice(0, 5).map(k => `"${k}"`).join(' OR ');
    const jql = `project = ${projectKey} AND key != ${issueKey} AND text ~ (${searchTerms}) ORDER BY created DESC`;

    const candidates = await this.jiraClient.searchIssues(jql, this.config.maxSimilarIssues * 2);

    // Compute similarity scores
    const issueText = `${issue.fields.summary} ${issue.fields.description || ''}`;
    const similarIssues: SimilarIssue[] = [];

    for (const candidate of candidates) {
      const candidateText = `${candidate.fields.summary} ${candidate.fields.description || ''}`;
      const similarity = await this.aiAnalyzer.computeSimilarity(issueText, candidateText);

      if (similarity >= this.config.similarityThreshold) {
        const matchedFields = this.findMatchedFields(issue, candidate);

        similarIssues.push({
          issueKey: candidate.key,
          summary: candidate.fields.summary,
          status: candidate.fields.status.name,
          similarity,
          matchedFields,
          resolution: candidate.fields.resolutiondate ? 'Resolved' : undefined,
        });
      }
    }

    // Sort by similarity and limit results
    similarIssues.sort((a, b) => b.similarity - a.similarity);
    const result = similarIssues.slice(0, this.config.maxSimilarIssues);

    this.addAuditEntry('find_similar_issues', 'system', {
      issueKey,
      candidatesFound: candidates.length,
      similarFound: result.length,
    }, 'success');

    return result;
  }

  /**
   * Suggest the best assignee for an issue
   */
  async suggestAssignee(issueKey: string): Promise<AssigneeSuggestion> {
    this.logger.debug(`Suggesting assignee for ${issueKey}`);

    const issue = await this.jiraClient.getIssue(issueKey);
    const projectKey = issueKey.split('-')[0];

    // Get project users
    const users = await this.jiraClient.getProjectUsers(projectKey);

    // Get issue components and labels for matching
    const issueComponents = issue.fields.components.map(c => c.name);
    const issueLabels = issue.fields.labels;

    // Score each user based on expertise and workload
    const userScores: Array<{
      user: JiraUser;
      score: number;
      reasons: string[];
      workload: { assignedIssues: number; inProgressIssues: number; recentCompletions: number };
      expertise: { components: string[]; labels: string[]; issueTypes: string[] };
    }> = [];

    for (const user of users) {
      if (!user.active) continue;

      const { score, reasons, workload, expertise } = await this.calculateUserScore(
        user,
        projectKey,
        issueComponents,
        issueLabels,
        issue.fields.issuetype.name
      );

      userScores.push({ user, score, reasons, workload, expertise });
    }

    // Sort by score (descending)
    userScores.sort((a, b) => b.score - a.score);

    const topCandidate = userScores[0];

    if (!topCandidate) {
      return {
        accountId: '',
        displayName: 'Unassigned',
        confidence: this.createConfidenceScore(0, ['No suitable assignee found']),
        reasons: ['No active users found in project'],
        workload: { assignedIssues: 0, inProgressIssues: 0, recentCompletions: 0 },
        expertise: { components: [], labels: [], issueTypes: [] },
      };
    }

    const confidence = this.createConfidenceScore(
      Math.min(topCandidate.score / 100, 1),
      topCandidate.reasons
    );

    this.addAuditEntry('suggest_assignee', 'system', {
      issueKey,
      suggestedUser: topCandidate.user.displayName,
      confidence: confidence.value,
    }, 'success');

    return {
      accountId: topCandidate.user.accountId,
      displayName: topCandidate.user.displayName,
      email: topCandidate.user.emailAddress,
      confidence,
      reasons: topCandidate.reasons,
      workload: topCandidate.workload,
      expertise: topCandidate.expertise,
    };
  }

  /**
   * Detect potential duplicate issues
   */
  async detectDuplicates(issueKey: string): Promise<DuplicateResult> {
    if (!this.config.enableDuplicateDetection) {
      return {
        hasDuplicates: false,
        candidates: [],
        confidence: this.createConfidenceScore(0, ['Duplicate detection disabled']),
        recommendation: 'none',
      };
    }

    this.logger.debug(`Detecting duplicates for ${issueKey}`);

    const similarIssues = await this.findSimilarIssues(issueKey);

    // Filter for high-similarity matches that could be duplicates
    const duplicateCandidates = similarIssues.filter(i => i.similarity >= 0.85);

    let recommendation: 'link' | 'close' | 'review' | 'none' = 'none';
    let confidenceValue = 0;
    const factors: string[] = [];

    if (duplicateCandidates.length > 0) {
      const topMatch = duplicateCandidates[0];
      confidenceValue = topMatch.similarity;
      factors.push(`High similarity (${(topMatch.similarity * 100).toFixed(1)}%) with ${topMatch.issueKey}`);

      if (topMatch.status === 'Done' || topMatch.status === 'Closed') {
        recommendation = 'close';
        factors.push('Similar issue is already resolved');
      } else if (topMatch.similarity >= 0.95) {
        recommendation = 'link';
        factors.push('Very high similarity suggests duplicate');
      } else {
        recommendation = 'review';
        factors.push('Manual review recommended');
      }
    }

    const result: DuplicateResult = {
      hasDuplicates: duplicateCandidates.length > 0,
      candidates: duplicateCandidates,
      confidence: this.createConfidenceScore(confidenceValue, factors),
      recommendation,
    };

    this.addAuditEntry('detect_duplicates', 'system', {
      issueKey,
      duplicatesFound: duplicateCandidates.length,
      recommendation,
    }, 'success');

    return result;
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  private async analyzeIssue(issue: JiraIssue): Promise<IssueClassification> {
    const classification = await this.aiAnalyzer.classifyIssue(issue);

    this.addAuditEntry('analyze_issue', 'ai', {
      issueKey: issue.key,
      suggestedType: classification.suggestedType,
      suggestedPriority: classification.suggestedPriority,
      confidence: classification.confidence,
    }, 'success');

    return classification;
  }

  private buildRecommendations(
    issue: JiraIssue,
    classification: IssueClassification,
    assigneeSuggestion: AssigneeSuggestion
  ): TriageResult['recommendations'] {
    const recommendations: TriageResult['recommendations'] = {};

    // Type recommendation
    if (
      this.config.enableAutoLabeling &&
      classification.suggestedType !== issue.fields.issuetype.name &&
      classification.confidence >= this.config.confidenceThreshold
    ) {
      recommendations.type = this.createRecommendation(
        'issuetype',
        issue.fields.issuetype.name,
        classification.suggestedType,
        classification.confidence,
        `AI analysis suggests this issue is better categorized as ${classification.suggestedType}`
      );
    }

    // Priority recommendation
    if (
      this.config.enableAutoPrioritization &&
      classification.suggestedPriority !== issue.fields.priority.name &&
      classification.confidence >= this.config.confidenceThreshold
    ) {
      recommendations.priority = this.createRecommendation(
        'priority',
        issue.fields.priority.name,
        classification.suggestedPriority,
        classification.confidence,
        `Based on content analysis, priority should be ${classification.suggestedPriority}`
      );
    }

    // Labels recommendation
    if (
      this.config.enableAutoLabeling &&
      classification.suggestedLabels.length > 0
    ) {
      const newLabels = classification.suggestedLabels.filter(
        l => !issue.fields.labels.includes(l)
      );
      if (newLabels.length > 0) {
        recommendations.labels = this.createRecommendation(
          'labels',
          issue.fields.labels,
          [...issue.fields.labels, ...newLabels],
          classification.confidence,
          `Suggested labels based on content: ${newLabels.join(', ')}`
        );
      }
    }

    // Components recommendation
    if (classification.suggestedComponents.length > 0) {
      const currentComponents = issue.fields.components.map(c => c.name);
      const newComponents = classification.suggestedComponents.filter(
        c => !currentComponents.includes(c)
      );
      if (newComponents.length > 0) {
        recommendations.components = this.createRecommendation(
          'components',
          currentComponents,
          [...currentComponents, ...newComponents],
          classification.confidence,
          `Suggested components: ${newComponents.join(', ')}`
        );
      }
    }

    // Assignee recommendation
    if (
      this.config.enableAutoAssignment &&
      !issue.fields.assignee &&
      assigneeSuggestion.accountId &&
      assigneeSuggestion.confidence.value >= this.config.confidenceThreshold
    ) {
      recommendations.assignee = assigneeSuggestion;
    }

    return recommendations;
  }

  private async applyRecommendations(
    issueKey: string,
    recommendations: TriageResult['recommendations'],
    duplicateCheck: DuplicateResult
  ): Promise<string[]> {
    const appliedActions: string[] = [];

    if (this.config.mode === OperationMode.SUGGEST) {
      // In suggest mode, just add a comment with recommendations
      const comment = this.buildRecommendationComment(recommendations, duplicateCheck);
      if (comment) {
        await this.jiraClient.addComment(issueKey, comment);
        appliedActions.push('Added triage recommendations comment');
        this.addAuditEntry('add_comment', 'system', { issueKey, type: 'recommendations' }, 'success');
      }
      return appliedActions;
    }

    // In auto mode, apply recommendations above threshold
    const updates: Record<string, unknown> = {};

    if (recommendations.type && recommendations.type.confidence.value >= this.config.confidenceThreshold) {
      updates.issuetype = { name: recommendations.type.suggestedValue };
      appliedActions.push(`Updated type to ${recommendations.type.suggestedValue}`);
    }

    if (recommendations.priority && recommendations.priority.confidence.value >= this.config.confidenceThreshold) {
      updates.priority = { name: recommendations.priority.suggestedValue };
      appliedActions.push(`Updated priority to ${recommendations.priority.suggestedValue}`);
    }

    if (recommendations.labels && recommendations.labels.confidence.value >= this.config.confidenceThreshold) {
      updates.labels = recommendations.labels.suggestedValue;
      appliedActions.push(`Updated labels`);
    }

    if (recommendations.components && recommendations.components.confidence.value >= this.config.confidenceThreshold) {
      updates.components = (recommendations.components.suggestedValue as string[]).map(name => ({ name }));
      appliedActions.push(`Updated components`);
    }

    if (recommendations.assignee && recommendations.assignee.confidence.value >= this.config.confidenceThreshold) {
      updates.assignee = { accountId: recommendations.assignee.accountId };
      appliedActions.push(`Assigned to ${recommendations.assignee.displayName}`);
    }

    if (Object.keys(updates).length > 0) {
      await this.jiraClient.updateIssue(issueKey, updates);
      this.addAuditEntry('update_issue', 'system', { issueKey, updates: Object.keys(updates) }, 'success');
    }

    // Handle duplicate linking in auto mode
    if (duplicateCheck.hasDuplicates && duplicateCheck.recommendation === 'link') {
      const topDuplicate = duplicateCheck.candidates[0];
      const comment = `Potential duplicate of ${topDuplicate.issueKey} (${(topDuplicate.similarity * 100).toFixed(1)}% similarity)`;
      await this.jiraClient.addComment(issueKey, comment);
      appliedActions.push(`Flagged as potential duplicate of ${topDuplicate.issueKey}`);
    }

    return appliedActions;
  }

  private async calculateUserScore(
    user: JiraUser,
    projectKey: string,
    issueComponents: string[],
    issueLabels: string[],
    issueType: string
  ): Promise<{
    score: number;
    reasons: string[];
    workload: { assignedIssues: number; inProgressIssues: number; recentCompletions: number };
    expertise: { components: string[]; labels: string[]; issueTypes: string[] };
  }> {
    const reasons: string[] = [];
    let score = 50; // Base score

    // Get user's current workload
    const assignedJql = `project = ${projectKey} AND assignee = "${user.accountId}" AND status != Done`;
    const assignedIssues = await this.jiraClient.searchIssues(assignedJql);

    const inProgressJql = `project = ${projectKey} AND assignee = "${user.accountId}" AND status = "In Progress"`;
    const inProgressIssues = await this.jiraClient.searchIssues(inProgressJql);

    // Get recent completions (last 30 days)
    const completedJql = `project = ${projectKey} AND assignee = "${user.accountId}" AND status = Done AND resolved >= -30d`;
    const recentCompletions = await this.jiraClient.searchIssues(completedJql);

    const workload = {
      assignedIssues: assignedIssues.length,
      inProgressIssues: inProgressIssues.length,
      recentCompletions: recentCompletions.length,
    };

    // Workload scoring (prefer users with moderate workload)
    if (workload.assignedIssues < 3) {
      score += 15;
      reasons.push('Low current workload');
    } else if (workload.assignedIssues > 10) {
      score -= 20;
      reasons.push('High current workload');
    }

    // Get user's history for expertise
    const history = await this.jiraClient.getIssueHistory(user.accountId);

    const expertiseComponents = new Set<string>();
    const expertiseLabels = new Set<string>();
    const expertiseTypes = new Set<string>();

    for (const entry of history) {
      if (entry.component) expertiseComponents.add(entry.component);
      if (entry.label) expertiseLabels.add(entry.label);
    }

    const expertise = {
      components: Array.from(expertiseComponents),
      labels: Array.from(expertiseLabels),
      issueTypes: Array.from(expertiseTypes),
    };

    // Component matching
    const matchingComponents = issueComponents.filter(c => expertise.components.includes(c));
    if (matchingComponents.length > 0) {
      score += matchingComponents.length * 10;
      reasons.push(`Experience with components: ${matchingComponents.join(', ')}`);
    }

    // Label matching
    const matchingLabels = issueLabels.filter(l => expertise.labels.includes(l));
    if (matchingLabels.length > 0) {
      score += matchingLabels.length * 5;
      reasons.push(`Experience with labels: ${matchingLabels.join(', ')}`);
    }

    // Recent completions indicate active contributor
    if (workload.recentCompletions > 5) {
      score += 10;
      reasons.push('Active contributor recently');
    }

    return { score, reasons, workload, expertise };
  }

  private findMatchedFields(issue1: JiraIssue, issue2: JiraIssue): string[] {
    const matched: string[] = [];

    if (issue1.fields.issuetype.name === issue2.fields.issuetype.name) {
      matched.push('type');
    }

    const components1 = issue1.fields.components.map(c => c.name);
    const components2 = issue2.fields.components.map(c => c.name);
    if (components1.some(c => components2.includes(c))) {
      matched.push('components');
    }

    const labels1 = issue1.fields.labels;
    const labels2 = issue2.fields.labels;
    if (labels1.some(l => labels2.includes(l))) {
      matched.push('labels');
    }

    return matched;
  }

  private createRecommendation(
    field: string,
    currentValue: unknown,
    suggestedValue: unknown,
    confidence: number,
    reasoning: string
  ): TriageRecommendation {
    return {
      field,
      currentValue,
      suggestedValue,
      confidence: this.createConfidenceScore(confidence, [reasoning]),
      reasoning,
    };
  }

  private createConfidenceScore(value: number, factors: string[]): ConfidenceScore {
    let level: ConfidenceLevel;
    if (value >= 0.9) level = ConfidenceLevel.VERY_HIGH;
    else if (value >= 0.7) level = ConfidenceLevel.HIGH;
    else if (value >= 0.5) level = ConfidenceLevel.MEDIUM;
    else level = ConfidenceLevel.LOW;

    return { value, level, factors };
  }

  private buildRecommendationComment(
    recommendations: TriageResult['recommendations'],
    duplicateCheck: DuplicateResult
  ): string | null {
    const lines: string[] = ['*Triage Recommendations*', ''];

    let hasRecommendations = false;

    if (recommendations.type) {
      lines.push(`*Type:* Consider changing to ${recommendations.type.suggestedValue} (${(recommendations.type.confidence.value * 100).toFixed(0)}% confidence)`);
      lines.push(`  _Reason:_ ${recommendations.type.reasoning}`);
      hasRecommendations = true;
    }

    if (recommendations.priority) {
      lines.push(`*Priority:* Consider ${recommendations.priority.suggestedValue} (${(recommendations.priority.confidence.value * 100).toFixed(0)}% confidence)`);
      lines.push(`  _Reason:_ ${recommendations.priority.reasoning}`);
      hasRecommendations = true;
    }

    if (recommendations.labels) {
      lines.push(`*Labels:* Suggested additions - ${(recommendations.labels.suggestedValue as string[]).join(', ')}`);
      hasRecommendations = true;
    }

    if (recommendations.components) {
      lines.push(`*Components:* Suggested - ${(recommendations.components.suggestedValue as string[]).join(', ')}`);
      hasRecommendations = true;
    }

    if (recommendations.assignee) {
      lines.push(`*Assignee:* Suggested - ${recommendations.assignee.displayName} (${(recommendations.assignee.confidence.value * 100).toFixed(0)}% confidence)`);
      lines.push(`  _Reasons:_ ${recommendations.assignee.reasons.join('; ')}`);
      hasRecommendations = true;
    }

    if (duplicateCheck.hasDuplicates) {
      lines.push('');
      lines.push('*Potential Duplicates:*');
      for (const dup of duplicateCheck.candidates.slice(0, 3)) {
        lines.push(`  - ${dup.issueKey}: ${dup.summary} (${(dup.similarity * 100).toFixed(0)}% similar)`);
      }
      hasRecommendations = true;
    }

    if (!hasRecommendations) {
      return null;
    }

    lines.push('');
    lines.push('_Generated by Autonomous Triage_');

    return lines.join('\n');
  }

  private addAuditEntry(
    action: string,
    actor: string,
    details: Record<string, unknown>,
    outcome: 'success' | 'failure' | 'skipped',
    reason?: string
  ): void {
    this.auditLog.push({
      timestamp: new Date(),
      action,
      actor,
      details,
      outcome,
      reason,
    });
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createIssueTriage(
  jiraClient: JiraClient,
  aiAnalyzer: AIAnalyzer,
  logger: Logger,
  config?: Partial<TriageConfig>
): IssueTriage {
  return new IssueTriage(jiraClient, aiAnalyzer, logger, config);
}
