/**
 * JQL Query Builder
 * Provides a fluent API for constructing Jira Query Language queries
 */

// ============================================================================
// Types
// ============================================================================

export type JqlOperator =
  | '='
  | '!='
  | '>'
  | '>='
  | '<'
  | '<='
  | '~'
  | '!~'
  | 'in'
  | 'not in'
  | 'is'
  | 'is not'
  | 'was'
  | 'was in'
  | 'was not'
  | 'was not in'
  | 'changed';

export type JqlField =
  | 'project'
  | 'issuetype'
  | 'status'
  | 'priority'
  | 'assignee'
  | 'reporter'
  | 'creator'
  | 'labels'
  | 'component'
  | 'fixVersion'
  | 'affectedVersion'
  | 'resolution'
  | 'sprint'
  | 'created'
  | 'updated'
  | 'resolved'
  | 'due'
  | 'duedate'
  | 'summary'
  | 'description'
  | 'text'
  | 'parent'
  | 'key'
  | 'id'
  | 'issuekey'
  | 'worklogAuthor'
  | 'worklogDate'
  | string; // Allow custom fields

export type JqlOrderDirection = 'ASC' | 'DESC';

export interface JqlCondition {
  field: JqlField;
  operator: JqlOperator;
  value: JqlValue;
}

export type JqlValue = string | number | boolean | string[] | JqlFunction | null;

export interface JqlFunction {
  name: string;
  args?: (string | number)[];
}

// ============================================================================
// JQL Functions
// ============================================================================

/**
 * JQL function helpers
 */
export const JqlFunctions = {
  currentUser: (): JqlFunction => ({ name: 'currentUser' }),
  currentLogin: (): JqlFunction => ({ name: 'currentLogin' }),
  now: (): JqlFunction => ({ name: 'now' }),
  startOfDay: (offset?: string): JqlFunction => ({
    name: 'startOfDay',
    args: offset ? [offset] : undefined,
  }),
  endOfDay: (offset?: string): JqlFunction => ({
    name: 'endOfDay',
    args: offset ? [offset] : undefined,
  }),
  startOfWeek: (offset?: string): JqlFunction => ({
    name: 'startOfWeek',
    args: offset ? [offset] : undefined,
  }),
  endOfWeek: (offset?: string): JqlFunction => ({
    name: 'endOfWeek',
    args: offset ? [offset] : undefined,
  }),
  startOfMonth: (offset?: string): JqlFunction => ({
    name: 'startOfMonth',
    args: offset ? [offset] : undefined,
  }),
  endOfMonth: (offset?: string): JqlFunction => ({
    name: 'endOfMonth',
    args: offset ? [offset] : undefined,
  }),
  startOfYear: (offset?: string): JqlFunction => ({
    name: 'startOfYear',
    args: offset ? [offset] : undefined,
  }),
  endOfYear: (offset?: string): JqlFunction => ({
    name: 'endOfYear',
    args: offset ? [offset] : undefined,
  }),
  openSprints: (): JqlFunction => ({ name: 'openSprints' }),
  closedSprints: (): JqlFunction => ({ name: 'closedSprints' }),
  futureSprints: (): JqlFunction => ({ name: 'futureSprints' }),
  membersOf: (group: string): JqlFunction => ({ name: 'membersOf', args: [group] }),
  projectsLeadByUser: (user?: string): JqlFunction => ({
    name: 'projectsLeadByUser',
    args: user ? [user] : undefined,
  }),
  projectsWhereUserHasPermission: (permission: string): JqlFunction => ({
    name: 'projectsWhereUserHasPermission',
    args: [permission],
  }),
  componentsLeadByUser: (user?: string): JqlFunction => ({
    name: 'componentsLeadByUser',
    args: user ? [user] : undefined,
  }),
  issueHistory: (): JqlFunction => ({ name: 'issueHistory' }),
  linkedIssues: (issueKey?: string, linkType?: string): JqlFunction => ({
    name: 'linkedIssues',
    args: issueKey ? [issueKey, ...(linkType ? [linkType] : [])] : undefined,
  }),
  votedIssues: (): JqlFunction => ({ name: 'votedIssues' }),
  watchedIssues: (): JqlFunction => ({ name: 'watchedIssues' }),
};

// ============================================================================
// JQL Builder Class
// ============================================================================

/**
 * Fluent JQL query builder
 */
export class JqlBuilder {
  private conditions: string[] = [];
  private orderByFields: { field: JqlField; direction: JqlOrderDirection }[] = [];

  /**
   * Add a condition with equals operator
   */
  equals(field: JqlField, value: JqlValue): this {
    this.conditions.push(this.buildCondition(field, '=', value));
    return this;
  }

  /**
   * Add a condition with not equals operator
   */
  notEquals(field: JqlField, value: JqlValue): this {
    this.conditions.push(this.buildCondition(field, '!=', value));
    return this;
  }

  /**
   * Add a condition with IN operator
   */
  in(field: JqlField, values: JqlValue[] | JqlFunction): this {
    this.conditions.push(this.buildCondition(field, 'in', values as JqlValue));
    return this;
  }

  /**
   * Add a condition with NOT IN operator
   */
  notIn(field: JqlField, values: JqlValue[] | JqlFunction): this {
    this.conditions.push(this.buildCondition(field, 'not in', values as JqlValue));
    return this;
  }

  /**
   * Add a condition with IS operator (for EMPTY/NULL checks)
   */
  is(field: JqlField, value: 'EMPTY' | 'NULL'): this {
    this.conditions.push(`${this.escapeField(field)} is ${value}`);
    return this;
  }

  /**
   * Add a condition with IS NOT operator
   */
  isNot(field: JqlField, value: 'EMPTY' | 'NULL'): this {
    this.conditions.push(`${this.escapeField(field)} is not ${value}`);
    return this;
  }

  /**
   * Add a contains condition (text search)
   */
  contains(field: JqlField, text: string): this {
    this.conditions.push(this.buildCondition(field, '~', text));
    return this;
  }

  /**
   * Add a does not contain condition
   */
  notContains(field: JqlField, text: string): this {
    this.conditions.push(this.buildCondition(field, '!~', text));
    return this;
  }

  /**
   * Add a greater than condition
   */
  greaterThan(field: JqlField, value: JqlValue): this {
    this.conditions.push(this.buildCondition(field, '>', value));
    return this;
  }

  /**
   * Add a greater than or equal condition
   */
  greaterThanOrEqual(field: JqlField, value: JqlValue): this {
    this.conditions.push(this.buildCondition(field, '>=', value));
    return this;
  }

  /**
   * Add a less than condition
   */
  lessThan(field: JqlField, value: JqlValue): this {
    this.conditions.push(this.buildCondition(field, '<', value));
    return this;
  }

  /**
   * Add a less than or equal condition
   */
  lessThanOrEqual(field: JqlField, value: JqlValue): this {
    this.conditions.push(this.buildCondition(field, '<=', value));
    return this;
  }

  /**
   * Add a WAS condition (historical)
   */
  was(field: JqlField, value: JqlValue): this {
    this.conditions.push(this.buildCondition(field, 'was', value));
    return this;
  }

  /**
   * Add a CHANGED condition
   */
  changed(field: JqlField): this {
    this.conditions.push(`${this.escapeField(field)} changed`);
    return this;
  }

  /**
   * Add raw JQL condition
   */
  raw(condition: string): this {
    this.conditions.push(`(${condition})`);
    return this;
  }

  /**
   * Add OR condition group
   */
  or(builder: (b: JqlBuilder) => JqlBuilder): this {
    const subBuilder = new JqlBuilder();
    builder(subBuilder);
    const subQuery = subBuilder.toQueryString();
    if (subQuery) {
      this.conditions.push(`(${subQuery})`);
    }
    return this;
  }

  /**
   * Add AND condition group
   */
  and(builder: (b: JqlBuilder) => JqlBuilder): this {
    const subBuilder = new JqlBuilder();
    builder(subBuilder);
    const subQuery = subBuilder.toQueryString();
    if (subQuery) {
      this.conditions.push(`(${subQuery})`);
    }
    return this;
  }

  /**
   * Add ORDER BY clause
   */
  orderBy(field: JqlField, direction: JqlOrderDirection = 'ASC'): this {
    this.orderByFields.push({ field, direction });
    return this;
  }

  /**
   * Build and return the JQL query string
   */
  build(): string {
    return this.toString();
  }

  /**
   * Alias for build()
   */
  toString(): string {
    let query = this.conditions.join(' AND ');

    if (this.orderByFields.length > 0) {
      const orderBy = this.orderByFields
        .map(o => `${this.escapeField(o.field)} ${o.direction}`)
        .join(', ');
      query += ` ORDER BY ${orderBy}`;
    }

    return query;
  }

  /**
   * Get only the conditions part (without ORDER BY)
   */
  toQueryString(): string {
    return this.conditions.join(' AND ');
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private buildCondition(field: JqlField, operator: JqlOperator, value: JqlValue): string {
    const escapedField = this.escapeField(field);
    const escapedValue = this.escapeValue(value);
    return `${escapedField} ${operator} ${escapedValue}`;
  }

  private escapeField(field: JqlField): string {
    // Custom fields and reserved words need quoting
    if (field.startsWith('cf[') || field.includes(' ') || this.isReservedWord(field)) {
      return `"${field}"`;
    }
    return field;
  }

  private escapeValue(value: JqlValue): string {
    if (value === null) {
      return 'NULL';
    }

    if (typeof value === 'boolean') {
      return value.toString();
    }

    if (typeof value === 'number') {
      return value.toString();
    }

    if (Array.isArray(value)) {
      const escaped = value.map(v => this.escapeValue(v));
      return `(${escaped.join(', ')})`;
    }

    if (this.isJqlFunction(value)) {
      return this.formatFunction(value);
    }

    // String value
    if (this.needsQuoting(value)) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }

    return value;
  }

  private isJqlFunction(value: unknown): value is JqlFunction {
    return typeof value === 'object' && value !== null && 'name' in value;
  }

  private formatFunction(func: JqlFunction): string {
    if (func.args && func.args.length > 0) {
      const args = func.args.map(arg =>
        typeof arg === 'string' ? `"${arg}"` : arg.toString()
      );
      return `${func.name}(${args.join(', ')})`;
    }
    return `${func.name}()`;
  }

  private needsQuoting(value: string): boolean {
    // Quote strings with special characters or spaces
    return /[\s,'"()[\]{}+\-*/\\^~?!@#$%&|]/.test(value) || this.isReservedWord(value);
  }

  private isReservedWord(word: string): boolean {
    const reserved = [
      'and', 'or', 'not', 'empty', 'null', 'order', 'by', 'asc', 'desc',
      'was', 'changed', 'before', 'after', 'from', 'to', 'on', 'during',
      'is', 'in', 'cf',
    ];
    return reserved.includes(word.toLowerCase());
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new JQL builder
 */
export function jql(): JqlBuilder {
  return new JqlBuilder();
}

// ============================================================================
// Prebuilt Query Helpers
// ============================================================================

/**
 * Common JQL query templates
 */
export const JqlTemplates = {
  /**
   * My open issues
   */
  myOpenIssues: (project?: string): string => {
    const builder = jql()
      .equals('assignee', JqlFunctions.currentUser())
      .notEquals('status', 'Done')
      .notEquals('status', 'Closed');

    if (project) {
      builder.equals('project', project);
    }

    return builder.orderBy('updated', 'DESC').build();
  },

  /**
   * Issues updated recently
   */
  recentlyUpdated: (days: number = 7, project?: string): string => {
    const builder = jql()
      .greaterThanOrEqual('updated', `-${days}d`);

    if (project) {
      builder.equals('project', project);
    }

    return builder.orderBy('updated', 'DESC').build();
  },

  /**
   * Open bugs by priority
   */
  openBugs: (project: string, priorities?: string[]): string => {
    const builder = jql()
      .equals('project', project)
      .equals('issuetype', 'Bug')
      .notEquals('status', 'Done')
      .notEquals('status', 'Closed');

    if (priorities?.length) {
      builder.in('priority', priorities);
    }

    return builder.orderBy('priority', 'DESC').orderBy('created', 'ASC').build();
  },

  /**
   * Sprint backlog
   */
  sprintBacklog: (sprintId: number | string): string => {
    return jql()
      .in('sprint', JqlFunctions.openSprints())
      .notEquals('status', 'Done')
      .orderBy('rank', 'ASC')
      .build();
  },

  /**
   * Unassigned issues
   */
  unassigned: (project: string): string => {
    return jql()
      .equals('project', project)
      .is('assignee', 'EMPTY')
      .notEquals('status', 'Done')
      .orderBy('priority', 'DESC')
      .build();
  },

  /**
   * Issues due soon
   */
  dueSoon: (days: number = 7, project?: string): string => {
    const builder = jql()
      .lessThanOrEqual('due', `${days}d`)
      .greaterThanOrEqual('due', '0d')
      .notEquals('status', 'Done');

    if (project) {
      builder.equals('project', project);
    }

    return builder.orderBy('due', 'ASC').build();
  },

  /**
   * Overdue issues
   */
  overdue: (project?: string): string => {
    const builder = jql()
      .lessThan('due', '0d')
      .notEquals('status', 'Done')
      .notEquals('status', 'Closed');

    if (project) {
      builder.equals('project', project);
    }

    return builder.orderBy('due', 'ASC').build();
  },

  /**
   * Issues by label
   */
  byLabel: (label: string, project?: string): string => {
    const builder = jql().equals('labels', label);

    if (project) {
      builder.equals('project', project);
    }

    return builder.orderBy('updated', 'DESC').build();
  },

  /**
   * Created today
   */
  createdToday: (project?: string): string => {
    const builder = jql()
      .greaterThanOrEqual('created', JqlFunctions.startOfDay());

    if (project) {
      builder.equals('project', project);
    }

    return builder.orderBy('created', 'DESC').build();
  },

  /**
   * Issues in current sprint
   */
  currentSprint: (project?: string): string => {
    const builder = jql()
      .in('sprint', JqlFunctions.openSprints());

    if (project) {
      builder.equals('project', project);
    }

    return builder.orderBy('rank', 'ASC').build();
  },

  /**
   * Blocked issues (has blockedBy link or blocked label)
   */
  blocked: (project?: string): string => {
    const builder = jql()
      .raw('labels = blocked OR issueFunction in linkedIssuesOf("type = *", "is blocked by")')
      .notEquals('status', 'Done');

    if (project) {
      builder.equals('project', project);
    }

    return builder.build();
  },
};
