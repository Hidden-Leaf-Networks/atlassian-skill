/**
 * Predictive Sprint Planning
 * AI-assisted velocity analysis, scope suggestions, and risk identification
 */

import {
  VelocityAnalysis,
  ScopeSuggestion,
  RiskAssessment,
  EstimationSuggestion,
  SprintMetrics,
  IssueSuggestion,
  RiskFactor,
  ConfidenceScore,
  ConfidenceLevel,
  RiskLevel,
  Priority,
  JiraIssue,
  JiraSprint,
  JiraBoard,
  AuditEntry,
  Logger,
} from './types.js';

// =============================================================================
// Configuration
// =============================================================================

export interface PlanningConfig {
  defaultSprintCount: number;
  velocityOutlierThreshold: number;
  riskScoreWeights: {
    blockedIssues: number;
    missingEstimates: number;
    scopeCreep: number;
    dependencyRisk: number;
    assignmentGaps: number;
  };
  capacityBuffer: number; // Recommended buffer (e.g., 0.2 = 20%)
}

const DEFAULT_CONFIG: PlanningConfig = {
  defaultSprintCount: 6,
  velocityOutlierThreshold: 2, // Standard deviations
  riskScoreWeights: {
    blockedIssues: 25,
    missingEstimates: 20,
    scopeCreep: 20,
    dependencyRisk: 20,
    assignmentGaps: 15,
  },
  capacityBuffer: 0.15,
};

// =============================================================================
// Interfaces for External Dependencies
// =============================================================================

export interface JiraAgileClient {
  getBoard(boardId: number): Promise<JiraBoard>;
  getBoardSprints(boardId: number, state?: string): Promise<JiraSprint[]>;
  getSprintIssues(sprintId: number): Promise<JiraIssue[]>;
  getBacklogIssues(boardId: number): Promise<JiraIssue[]>;
  getIssue(issueKey: string): Promise<JiraIssue>;
  searchIssues(jql: string, maxResults?: number): Promise<JiraIssue[]>;
  getIssueLinks(issueKey: string): Promise<IssueLink[]>;
}

export interface AIPlanner {
  generateSprintGoal(issues: JiraIssue[]): Promise<string>;
  analyzeIssueSimilarity(issue: JiraIssue, completedIssues: JiraIssue[]): Promise<SimilarityResult[]>;
  predictCompletionProbability(issue: JiraIssue, sprintDays: number, teamVelocity: number): Promise<number>;
}

interface IssueLink {
  type: string;
  inwardIssue?: { key: string; status: string };
  outwardIssue?: { key: string; status: string };
}

interface SimilarityResult {
  issueKey: string;
  summary: string;
  similarity: number;
  actualPoints: number;
  completionTime: number;
}

// =============================================================================
// Sprint Planner Class
// =============================================================================

export class SprintPlanner {
  private readonly config: PlanningConfig;
  private readonly jiraClient: JiraAgileClient;
  private readonly aiPlanner: AIPlanner;
  private readonly logger: Logger;
  private readonly auditLog: AuditEntry[] = [];

  constructor(
    jiraClient: JiraAgileClient,
    aiPlanner: AIPlanner,
    logger: Logger,
    config: Partial<PlanningConfig> = {}
  ) {
    this.jiraClient = jiraClient;
    this.aiPlanner = aiPlanner;
    this.logger = logger;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Analyze team velocity over recent sprints
   */
  async analyzeVelocity(boardId: number, sprintCount?: number): Promise<VelocityAnalysis> {
    const count = sprintCount ?? this.config.defaultSprintCount;
    this.logger.info(`Analyzing velocity for board ${boardId} over ${count} sprints`);

    try {
      // Get closed sprints
      const sprints = await this.jiraClient.getBoardSprints(boardId, 'closed');
      const recentSprints = sprints.slice(-count);

      if (recentSprints.length === 0) {
        throw new Error('No closed sprints found for velocity analysis');
      }

      // Calculate metrics for each sprint
      const sprintHistory: SprintMetrics[] = [];

      for (const sprint of recentSprints) {
        const metrics = await this.calculateSprintMetrics(sprint);
        sprintHistory.push(metrics);
      }

      // Calculate velocity statistics
      const velocities = sprintHistory.map(s => s.completedPoints);
      const averageVelocity = this.calculateAverage(velocities);
      const medianVelocity = this.calculateMedian(velocities);
      const standardDeviation = this.calculateStdDev(velocities, averageVelocity);

      // Determine trend
      const { trend, trendPercentage } = this.analyzeTrend(velocities);

      // Predict next sprint velocity
      const predictedVelocity = this.predictNextVelocity(velocities, trend, trendPercentage);

      // Calculate confidence
      const factors: string[] = [];
      let confidenceValue = 0.8;

      if (recentSprints.length < 3) {
        confidenceValue -= 0.2;
        factors.push('Limited sprint history');
      }

      if (standardDeviation / averageVelocity > 0.3) {
        confidenceValue -= 0.15;
        factors.push('High velocity variance');
      }

      if (trend === 'stable') {
        confidenceValue += 0.1;
        factors.push('Consistent velocity pattern');
      }

      factors.push(`Based on ${recentSprints.length} sprints`);
      factors.push(`Standard deviation: ${standardDeviation.toFixed(1)} points`);

      const result: VelocityAnalysis = {
        averageVelocity: Math.round(averageVelocity * 10) / 10,
        medianVelocity,
        standardDeviation: Math.round(standardDeviation * 10) / 10,
        trend,
        trendPercentage: Math.round(trendPercentage * 10) / 10,
        sprintHistory,
        predictedVelocity: Math.round(predictedVelocity),
        confidence: this.createConfidenceScore(Math.max(0, Math.min(1, confidenceValue)), factors),
        factors,
      };

      this.addAuditEntry('analyze_velocity', 'system', {
        boardId,
        sprintCount: recentSprints.length,
        averageVelocity: result.averageVelocity,
        predictedVelocity: result.predictedVelocity,
      }, 'success');

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.addAuditEntry('analyze_velocity', 'system', { boardId, error: errorMessage }, 'failure', errorMessage);
      throw error;
    }
  }

  /**
   * Suggest optimal sprint scope based on capacity
   */
  async suggestSprintScope(boardId: number, capacity: number): Promise<ScopeSuggestion> {
    this.logger.info(`Suggesting sprint scope for board ${boardId} with capacity ${capacity}`);

    try {
      // Get velocity data for context
      const velocityAnalysis = await this.analyzeVelocity(boardId);

      // Apply capacity buffer
      const targetCapacity = capacity * (1 - this.config.capacityBuffer);

      // Get backlog issues
      const backlogIssues = await this.jiraClient.getBacklogIssues(boardId);

      // Score and rank issues
      const scoredIssues = await this.scoreIssuesForSprint(backlogIssues, velocityAnalysis);

      // Select optimal set within capacity
      const { selected, alternatives } = this.selectOptimalScope(scoredIssues, targetCapacity);

      // Calculate balance score (mix of priorities, types, etc.)
      const balanceScore = this.calculateBalanceScore(selected);

      // Generate warnings
      const warnings = this.generateScopeWarnings(selected, capacity, velocityAnalysis);

      const totalPoints = selected.reduce((sum, i) => sum + i.storyPoints, 0);

      const result: ScopeSuggestion = {
        recommendedIssues: selected,
        totalPoints,
        capacityUtilization: totalPoints / capacity,
        balanceScore,
        warnings,
        alternatives,
        confidence: this.createConfidenceScore(
          velocityAnalysis.confidence.value * 0.9,
          ['Based on velocity analysis', `${selected.length} issues selected`, ...warnings.slice(0, 2)]
        ),
      };

      this.addAuditEntry('suggest_sprint_scope', 'system', {
        boardId,
        capacity,
        recommendedIssues: selected.length,
        totalPoints,
      }, 'success');

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.addAuditEntry('suggest_sprint_scope', 'system', { boardId, error: errorMessage }, 'failure', errorMessage);
      throw error;
    }
  }

  /**
   * Identify risks in a sprint
   */
  async identifyRisks(sprintId: number): Promise<RiskAssessment> {
    this.logger.info(`Identifying risks for sprint ${sprintId}`);

    try {
      const issues = await this.jiraClient.getSprintIssues(sprintId);
      const riskFactors: RiskFactor[] = [];
      let totalRiskScore = 0;

      // Check for blocked issues
      const blockedIssues = issues.filter(i =>
        i.fields.status.name.toLowerCase().includes('blocked') ||
        i.fields.labels.includes('blocked')
      );

      if (blockedIssues.length > 0) {
        const score = this.config.riskScoreWeights.blockedIssues * (blockedIssues.length / issues.length);
        totalRiskScore += score;
        riskFactors.push({
          type: 'blocked_issues',
          description: `${blockedIssues.length} issues are currently blocked`,
          severity: blockedIssues.length > 2 ? RiskLevel.HIGH : RiskLevel.MEDIUM,
          affectedIssues: blockedIssues.map(i => i.key),
          mitigation: 'Prioritize unblocking these issues or remove from sprint',
        });
      }

      // Check for missing estimates
      const unestimatedIssues = issues.filter(i => {
        const storyPoints = i.fields['customfield_10016'] as number | undefined;
        return !storyPoints && storyPoints !== 0;
      });

      if (unestimatedIssues.length > 0) {
        const ratio = unestimatedIssues.length / issues.length;
        const score = this.config.riskScoreWeights.missingEstimates * ratio;
        totalRiskScore += score;
        riskFactors.push({
          type: 'missing_estimates',
          description: `${unestimatedIssues.length} issues lack story point estimates`,
          severity: ratio > 0.3 ? RiskLevel.HIGH : RiskLevel.MEDIUM,
          affectedIssues: unestimatedIssues.map(i => i.key),
          mitigation: 'Add estimates to improve planning accuracy',
        });
      }

      // Check for unassigned issues
      const unassignedIssues = issues.filter(i => !i.fields.assignee);

      if (unassignedIssues.length > 0) {
        const ratio = unassignedIssues.length / issues.length;
        const score = this.config.riskScoreWeights.assignmentGaps * ratio;
        totalRiskScore += score;
        riskFactors.push({
          type: 'assignment_gaps',
          description: `${unassignedIssues.length} issues are not assigned`,
          severity: ratio > 0.4 ? RiskLevel.HIGH : RiskLevel.LOW,
          affectedIssues: unassignedIssues.map(i => i.key),
          mitigation: 'Assign owners to ensure accountability',
        });
      }

      // Check for dependency risks
      const dependencyRisks = await this.checkDependencyRisks(issues);
      if (dependencyRisks.length > 0) {
        const score = this.config.riskScoreWeights.dependencyRisk * (dependencyRisks.length / issues.length);
        totalRiskScore += score;
        riskFactors.push({
          type: 'dependency_risk',
          description: `${dependencyRisks.length} issues have external dependencies`,
          severity: dependencyRisks.length > 3 ? RiskLevel.HIGH : RiskLevel.MEDIUM,
          affectedIssues: dependencyRisks,
          mitigation: 'Review and prioritize dependency resolution',
        });
      }

      // Check for high-priority items not started
      const notStartedHighPriority = issues.filter(i =>
        (i.fields.priority.name === 'Highest' || i.fields.priority.name === 'High') &&
        (i.fields.status.name === 'To Do' || i.fields.status.name === 'Open')
      );

      if (notStartedHighPriority.length > 0) {
        riskFactors.push({
          type: 'delayed_high_priority',
          description: `${notStartedHighPriority.length} high-priority issues not yet started`,
          severity: RiskLevel.MEDIUM,
          affectedIssues: notStartedHighPriority.map(i => i.key),
          mitigation: 'Prioritize starting these issues immediately',
        });
      }

      // Determine overall risk level
      const overallRisk = this.determineOverallRisk(totalRiskScore, riskFactors);

      // Generate recommendations
      const recommendations = this.generateRiskRecommendations(riskFactors);

      const result: RiskAssessment = {
        sprintId,
        overallRisk,
        riskScore: Math.min(100, Math.round(totalRiskScore)),
        factors: riskFactors,
        recommendations,
        confidence: this.createConfidenceScore(0.85, [
          `Analyzed ${issues.length} issues`,
          `Found ${riskFactors.length} risk factors`,
        ]),
      };

      this.addAuditEntry('identify_risks', 'system', {
        sprintId,
        issueCount: issues.length,
        riskFactorCount: riskFactors.length,
        overallRisk,
      }, 'success');

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.addAuditEntry('identify_risks', 'system', { sprintId, error: errorMessage }, 'failure', errorMessage);
      throw error;
    }
  }

  /**
   * Generate a sprint goal based on planned issues
   */
  async generateSprintGoal(issues: JiraIssue[]): Promise<string> {
    this.logger.info(`Generating sprint goal for ${issues.length} issues`);

    try {
      const goal = await this.aiPlanner.generateSprintGoal(issues);

      this.addAuditEntry('generate_sprint_goal', 'ai', {
        issueCount: issues.length,
        goalLength: goal.length,
      }, 'success');

      return goal;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.addAuditEntry('generate_sprint_goal', 'ai', { error: errorMessage }, 'failure', errorMessage);

      // Fallback to a simple generated goal
      const types = new Set(issues.map(i => i.fields.issuetype.name));
      const components = new Set(issues.flatMap(i => i.fields.components.map(c => c.name)));

      return `Complete ${issues.length} ${Array.from(types).join('/')} items focusing on ${Array.from(components).slice(0, 3).join(', ') || 'project delivery'}`;
    }
  }

  /**
   * Estimate story points for an issue based on similar completed issues
   */
  async estimateIssue(issueKey: string): Promise<EstimationSuggestion> {
    this.logger.info(`Estimating issue ${issueKey}`);

    try {
      const issue = await this.jiraClient.getIssue(issueKey);
      const projectKey = issueKey.split('-')[0];

      // Find similar completed issues with estimates
      const jql = `project = ${projectKey} AND status = Done AND "Story Points" is not EMPTY ORDER BY resolved DESC`;
      const completedIssues = await this.jiraClient.searchIssues(jql, 100);

      if (completedIssues.length === 0) {
        return {
          issueKey,
          suggestedPoints: 3, // Default medium estimate
          confidence: this.createConfidenceScore(0.3, ['No similar completed issues found', 'Using default estimate']),
          similarIssues: [],
          reasoning: 'No similar completed issues found. Using default medium estimate.',
          range: { min: 1, max: 8 },
        };
      }

      // Use AI to find similar issues
      const similarityResults = await this.aiPlanner.analyzeIssueSimilarity(issue, completedIssues);

      // Filter for high similarity matches
      const relevantMatches = similarityResults
        .filter(r => r.similarity >= 0.5)
        .slice(0, 5);

      if (relevantMatches.length === 0) {
        // Fall back to type-based estimation
        const sameTypeIssues = completedIssues.filter(
          i => i.fields.issuetype.name === issue.fields.issuetype.name
        );
        const avgPoints = this.calculateAverage(
          sameTypeIssues.map(i => (i.fields['customfield_10016'] as number) || 0)
        );

        return {
          issueKey,
          suggestedPoints: Math.round(avgPoints) || 3,
          confidence: this.createConfidenceScore(0.5, ['Based on same issue type average', `${sameTypeIssues.length} similar type issues`]),
          similarIssues: [],
          reasoning: `Based on average of ${sameTypeIssues.length} similar ${issue.fields.issuetype.name} issues.`,
          range: { min: Math.max(1, Math.round(avgPoints * 0.5)), max: Math.round(avgPoints * 1.5) },
        };
      }

      // Calculate weighted average based on similarity
      let weightedSum = 0;
      let weightSum = 0;

      for (const match of relevantMatches) {
        weightedSum += match.actualPoints * match.similarity;
        weightSum += match.similarity;
      }

      const suggestedPoints = Math.round(weightedSum / weightSum);

      // Calculate range
      const allPoints = relevantMatches.map(m => m.actualPoints);
      const minPoints = Math.min(...allPoints);
      const maxPoints = Math.max(...allPoints);

      // Calculate confidence
      const avgSimilarity = relevantMatches.reduce((sum, m) => sum + m.similarity, 0) / relevantMatches.length;
      const confidenceValue = Math.min(0.95, avgSimilarity + (relevantMatches.length >= 3 ? 0.1 : 0));

      const result: EstimationSuggestion = {
        issueKey,
        suggestedPoints,
        confidence: this.createConfidenceScore(confidenceValue, [
          `Based on ${relevantMatches.length} similar issues`,
          `Average similarity: ${(avgSimilarity * 100).toFixed(0)}%`,
        ]),
        similarIssues: relevantMatches.map(m => ({
          issueKey: m.issueKey,
          summary: m.summary,
          actualPoints: m.actualPoints,
          completionTime: m.completionTime,
        })),
        reasoning: `Estimated based on ${relevantMatches.length} similar completed issues with ${(avgSimilarity * 100).toFixed(0)}% average similarity.`,
        range: { min: minPoints, max: maxPoints },
      };

      this.addAuditEntry('estimate_issue', 'system', {
        issueKey,
        suggestedPoints,
        similarIssuesUsed: relevantMatches.length,
        confidence: confidenceValue,
      }, 'success');

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.addAuditEntry('estimate_issue', 'system', { issueKey, error: errorMessage }, 'failure', errorMessage);
      throw error;
    }
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  private async calculateSprintMetrics(sprint: JiraSprint): Promise<SprintMetrics> {
    const issues = await this.jiraClient.getSprintIssues(sprint.id);

    let committedPoints = 0;
    let completedPoints = 0;
    let addedPoints = 0;
    let removedPoints = 0;

    const committedIssues = issues.filter(i => {
      // Issues that were in the sprint at the start
      // This is a simplification - real implementation would check sprint history
      return true;
    });

    for (const issue of issues) {
      const points = (issue.fields['customfield_10016'] as number) || 0;

      if (issue.fields.status.name === 'Done') {
        completedPoints += points;
      }
      committedPoints += points;
    }

    const completionRate = committedPoints > 0 ? completedPoints / committedPoints : 0;

    return {
      sprintId: sprint.id,
      sprintName: sprint.name,
      startDate: sprint.startDate ? new Date(sprint.startDate) : new Date(),
      endDate: sprint.endDate ? new Date(sprint.endDate) : new Date(),
      committedPoints,
      completedPoints,
      addedPoints,
      removedPoints,
      completionRate,
      issues: {
        committed: committedIssues.length,
        completed: issues.filter(i => i.fields.status.name === 'Done').length,
        added: 0, // Would require sprint history
        removed: 0,
      },
    };
  }

  private async scoreIssuesForSprint(
    issues: JiraIssue[],
    velocityAnalysis: VelocityAnalysis
  ): Promise<IssueSuggestion[]> {
    const scoredIssues: IssueSuggestion[] = [];

    for (const issue of issues) {
      const storyPoints = (issue.fields['customfield_10016'] as number) || 0;
      let score = 50; // Base score
      const reasons: string[] = [];
      const risks: string[] = [];

      // Priority scoring
      const priorityScores: Record<string, number> = {
        'Highest': 30,
        'High': 20,
        'Medium': 10,
        'Low': 5,
        'Lowest': 0,
      };
      score += priorityScores[issue.fields.priority.name] || 10;
      if (issue.fields.priority.name === 'Highest' || issue.fields.priority.name === 'High') {
        reasons.push('High priority');
      }

      // Due date scoring
      if (issue.fields.duedate) {
        const dueDate = new Date(issue.fields.duedate);
        const today = new Date();
        const daysUntilDue = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntilDue < 14) {
          score += 20;
          reasons.push('Due soon');
        }
        if (daysUntilDue < 0) {
          score += 30;
          reasons.push('Overdue');
          risks.push('Past due date');
        }
      }

      // Estimate scoring (prefer estimated issues)
      if (storyPoints > 0) {
        score += 10;
        reasons.push('Has estimate');
      } else {
        score -= 10;
        risks.push('Missing estimate');
      }

      // Check for dependencies
      const links = await this.jiraClient.getIssueLinks(issue.key);
      const blockedBy = links.filter(l =>
        l.type === 'Blocks' && l.inwardIssue && l.inwardIssue.status !== 'Done'
      );
      const dependencies = blockedBy.map(l => l.inwardIssue?.key).filter((k): k is string => !!k);

      if (blockedBy.length > 0) {
        score -= 15;
        risks.push(`Blocked by ${blockedBy.length} issues`);
      }

      scoredIssues.push({
        issueKey: issue.key,
        summary: issue.fields.summary,
        storyPoints,
        priority: issue.fields.priority.name as Priority,
        score,
        reasons,
        dependencies,
        risks,
      });
    }

    // Sort by score descending
    scoredIssues.sort((a, b) => b.score - a.score);

    return scoredIssues;
  }

  private selectOptimalScope(
    scoredIssues: IssueSuggestion[],
    targetCapacity: number
  ): { selected: IssueSuggestion[]; alternatives: IssueSuggestion[] } {
    const selected: IssueSuggestion[] = [];
    let currentPoints = 0;

    // Greedy selection by score
    for (const issue of scoredIssues) {
      if (currentPoints + issue.storyPoints <= targetCapacity) {
        selected.push(issue);
        currentPoints += issue.storyPoints;
      }
    }

    // Find alternatives (next best issues that didn't fit)
    const alternatives = scoredIssues
      .filter(i => !selected.includes(i))
      .slice(0, 5);

    return { selected, alternatives };
  }

  private calculateBalanceScore(issues: IssueSuggestion[]): number {
    if (issues.length === 0) return 0;

    let score = 100;

    // Check priority distribution
    const priorities = issues.map(i => i.priority);
    const highPriorityRatio = priorities.filter(p => p === 'High' || p === 'Highest').length / priorities.length;

    if (highPriorityRatio > 0.8) {
      score -= 10; // Too many high priority items
    } else if (highPriorityRatio < 0.2) {
      score -= 5; // Maybe not enough focus on priorities
    }

    // Check for issues with risks
    const riskyIssues = issues.filter(i => i.risks.length > 0);
    const riskyRatio = riskyIssues.length / issues.length;

    if (riskyRatio > 0.5) {
      score -= 15;
    }

    // Check for unestimated issues
    const unestimated = issues.filter(i => i.storyPoints === 0);
    if (unestimated.length > 0) {
      score -= unestimated.length * 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  private generateScopeWarnings(
    issues: IssueSuggestion[],
    capacity: number,
    velocityAnalysis: VelocityAnalysis
  ): string[] {
    const warnings: string[] = [];

    const totalPoints = issues.reduce((sum, i) => sum + i.storyPoints, 0);

    // Check against historical velocity
    if (totalPoints > velocityAnalysis.averageVelocity * 1.2) {
      warnings.push(`Total ${totalPoints} points exceeds historical average velocity of ${velocityAnalysis.averageVelocity.toFixed(0)}`);
    }

    // Check for unestimated issues
    const unestimated = issues.filter(i => i.storyPoints === 0);
    if (unestimated.length > 0) {
      warnings.push(`${unestimated.length} issues lack estimates`);
    }

    // Check for blocked issues
    const blocked = issues.filter(i => i.risks.some(r => r.includes('Blocked')));
    if (blocked.length > 0) {
      warnings.push(`${blocked.length} issues have dependencies that may not be resolved`);
    }

    // Check capacity utilization
    const utilization = totalPoints / capacity;
    if (utilization > 0.95) {
      warnings.push('Very high capacity utilization leaves no buffer for unexpected work');
    } else if (utilization < 0.6) {
      warnings.push('Low capacity utilization - consider adding more items');
    }

    return warnings;
  }

  private async checkDependencyRisks(issues: JiraIssue[]): Promise<string[]> {
    const riskyIssues: string[] = [];

    for (const issue of issues) {
      const links = await this.jiraClient.getIssueLinks(issue.key);

      const blockedBy = links.filter(l =>
        l.type === 'Blocks' && l.inwardIssue && l.inwardIssue.status !== 'Done'
      );

      if (blockedBy.length > 0) {
        riskyIssues.push(issue.key);
      }
    }

    return riskyIssues;
  }

  private determineOverallRisk(score: number, factors: RiskFactor[]): RiskLevel {
    if (score >= 60 || factors.some(f => f.severity === RiskLevel.CRITICAL)) {
      return RiskLevel.CRITICAL;
    }
    if (score >= 40 || factors.filter(f => f.severity === RiskLevel.HIGH).length >= 2) {
      return RiskLevel.HIGH;
    }
    if (score >= 20 || factors.some(f => f.severity === RiskLevel.HIGH)) {
      return RiskLevel.MEDIUM;
    }
    return RiskLevel.LOW;
  }

  private generateRiskRecommendations(factors: RiskFactor[]): string[] {
    const recommendations: string[] = [];

    // Add mitigations as recommendations
    for (const factor of factors) {
      if (factor.mitigation && factor.severity !== RiskLevel.LOW) {
        recommendations.push(factor.mitigation);
      }
    }

    // Add general recommendations based on risk patterns
    if (factors.some(f => f.type === 'blocked_issues')) {
      recommendations.push('Schedule a blockers review meeting');
    }

    if (factors.some(f => f.type === 'missing_estimates')) {
      recommendations.push('Hold a quick estimation session for unestimated items');
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  private analyzeTrend(values: number[]): { trend: 'increasing' | 'stable' | 'decreasing'; trendPercentage: number } {
    if (values.length < 2) {
      return { trend: 'stable', trendPercentage: 0 };
    }

    // Simple linear regression
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgY = sumY / n;
    const trendPercentage = (slope / avgY) * 100;

    let trend: 'increasing' | 'stable' | 'decreasing';
    if (trendPercentage > 5) {
      trend = 'increasing';
    } else if (trendPercentage < -5) {
      trend = 'decreasing';
    } else {
      trend = 'stable';
    }

    return { trend, trendPercentage };
  }

  private predictNextVelocity(
    velocities: number[],
    trend: 'increasing' | 'stable' | 'decreasing',
    trendPercentage: number
  ): number {
    const avg = this.calculateAverage(velocities);

    // Apply trend adjustment with dampening
    const adjustment = (trendPercentage / 100) * 0.5; // Dampen the trend effect
    const predicted = avg * (1 + adjustment);

    return Math.max(0, predicted);
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private calculateStdDev(values: number[], mean: number): number {
    if (values.length < 2) return 0;
    const squareDiffs = values.map(v => Math.pow(v - mean, 2));
    const avgSquareDiff = this.calculateAverage(squareDiffs);
    return Math.sqrt(avgSquareDiff);
  }

  private createConfidenceScore(value: number, factors: string[]): ConfidenceScore {
    let level: ConfidenceLevel;
    if (value >= 0.9) level = ConfidenceLevel.VERY_HIGH;
    else if (value >= 0.7) level = ConfidenceLevel.HIGH;
    else if (value >= 0.5) level = ConfidenceLevel.MEDIUM;
    else level = ConfidenceLevel.LOW;

    return { value, level, factors };
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

  /**
   * Get audit log for inspection
   */
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createSprintPlanner(
  jiraClient: JiraAgileClient,
  aiPlanner: AIPlanner,
  logger: Logger,
  config?: Partial<PlanningConfig>
): SprintPlanner {
  return new SprintPlanner(jiraClient, aiPlanner, logger, config);
}
