import { JqlBuilder, jql, JqlFunctions, JqlTemplates } from '../jql-builder';

describe('JqlBuilder', () => {
  describe('equals', () => {
    it('builds a simple equality condition', () => {
      const result = jql().equals('project', 'PROJ').build();
      expect(result).toBe('project = PROJ');
    });

    it('quotes string values with special characters', () => {
      const result = jql().equals('summary', 'fix the bug').build();
      expect(result).toBe('summary = "fix the bug"');
    });

    it('handles numeric values', () => {
      const result = jql().equals('id', 12345).build();
      expect(result).toBe('id = 12345');
    });

    it('handles null values', () => {
      const result = jql().equals('assignee', null).build();
      expect(result).toBe('assignee = NULL');
    });

    it('handles boolean values', () => {
      const result = jql().equals('issuetype', true).build();
      expect(result).toBe('issuetype = true');
    });
  });

  describe('notEquals', () => {
    it('builds a not-equals condition', () => {
      const result = jql().notEquals('status', 'Done').build();
      expect(result).toBe('status != Done');
    });
  });

  describe('in', () => {
    it('builds an IN condition with array values', () => {
      const result = jql().in('status', ['Open', 'In Progress']).build();
      expect(result).toBe('status in (Open, "In Progress")');
    });

    it('builds an IN condition with a JQL function', () => {
      const result = jql().in('sprint', JqlFunctions.openSprints()).build();
      expect(result).toBe('sprint in openSprints()');
    });
  });

  describe('notIn', () => {
    it('builds a NOT IN condition', () => {
      const result = jql().notIn('status', ['Done', 'Closed']).build();
      expect(result).toBe('status not in (Done, Closed)');
    });
  });

  describe('contains', () => {
    it('builds a contains (text search) condition', () => {
      const result = jql().contains('summary', 'login').build();
      expect(result).toBe('summary ~ login');
    });
  });

  describe('notContains', () => {
    it('builds a not-contains condition', () => {
      const result = jql().notContains('summary', 'test').build();
      expect(result).toBe('summary !~ test');
    });
  });

  describe('greaterThan', () => {
    it('builds a greater-than condition', () => {
      const result = jql().greaterThan('created', '-7d').build();
      expect(result).toBe('created > "-7d"');
    });
  });

  describe('greaterThanOrEqual', () => {
    it('builds a >= condition', () => {
      const result = jql().greaterThanOrEqual('updated', '-1d').build();
      expect(result).toBe('updated >= "-1d"');
    });
  });

  describe('lessThan / lessThanOrEqual', () => {
    it('builds less-than conditions', () => {
      expect(jql().lessThan('due', '0d').build()).toBe('due < 0d');
      expect(jql().lessThanOrEqual('due', '7d').build()).toBe('due <= 7d');
    });
  });

  describe('is / isNot', () => {
    it('builds IS EMPTY condition', () => {
      const result = jql().is('assignee', 'EMPTY').build();
      expect(result).toBe('assignee is EMPTY');
    });

    it('builds IS NOT EMPTY condition', () => {
      const result = jql().isNot('assignee', 'EMPTY').build();
      expect(result).toBe('assignee is not EMPTY');
    });
  });

  describe('was', () => {
    it('builds a WAS condition', () => {
      const result = jql().was('status', 'Open').build();
      expect(result).toBe('status was Open');
    });
  });

  describe('changed', () => {
    it('builds a CHANGED condition', () => {
      const result = jql().changed('status').build();
      expect(result).toBe('status changed');
    });
  });

  describe('raw', () => {
    it('wraps raw JQL in parentheses', () => {
      const result = jql().raw('labels = blocked OR status = Blocked').build();
      expect(result).toBe('(labels = blocked OR status = Blocked)');
    });
  });

  describe('chaining conditions', () => {
    it('joins multiple conditions with AND', () => {
      const result = jql()
        .equals('project', 'PROJ')
        .equals('status', 'Open')
        .build();
      expect(result).toBe('project = PROJ AND status = Open');
    });

    it('supports complex chains', () => {
      const result = jql()
        .equals('project', 'PROJ')
        .notEquals('status', 'Done')
        .equals('assignee', JqlFunctions.currentUser())
        .build();
      expect(result).toBe('project = PROJ AND status != Done AND assignee = currentUser()');
    });
  });

  describe('orderBy', () => {
    it('adds ORDER BY clause with default ASC', () => {
      const result = jql()
        .equals('project', 'PROJ')
        .orderBy('created')
        .build();
      expect(result).toBe('project = PROJ ORDER BY created ASC');
    });

    it('adds ORDER BY clause with DESC', () => {
      const result = jql()
        .equals('project', 'PROJ')
        .orderBy('updated', 'DESC')
        .build();
      expect(result).toBe('project = PROJ ORDER BY updated DESC');
    });

    it('supports multiple orderBy fields', () => {
      const result = jql()
        .equals('project', 'PROJ')
        .orderBy('priority', 'DESC')
        .orderBy('created', 'ASC')
        .build();
      expect(result).toBe('project = PROJ ORDER BY priority DESC, created ASC');
    });
  });

  describe('or / and subquery', () => {
    it('builds OR subquery', () => {
      const result = jql()
        .equals('project', 'PROJ')
        .or(b => b.equals('status', 'Open').equals('status', 'Reopened'))
        .build();
      expect(result).toBe('project = PROJ AND (status = Open AND status = Reopened)');
    });
  });

  describe('field escaping', () => {
    it('quotes custom fields', () => {
      const result = jql().equals('cf[10001]', 'value').build();
      expect(result).toBe('"cf[10001]" = value');
    });

    it('quotes reserved words used as fields', () => {
      const result = jql().equals('order', 'something').build();
      expect(result).toBe('"order" = something');
    });
  });

  describe('toQueryString', () => {
    it('returns conditions without ORDER BY', () => {
      const builder = jql()
        .equals('project', 'PROJ')
        .orderBy('created', 'DESC');
      expect(builder.toQueryString()).toBe('project = PROJ');
    });
  });

  describe('toString', () => {
    it('is an alias for build', () => {
      const builder = jql().equals('project', 'PROJ');
      expect(builder.toString()).toBe(builder.build());
    });
  });
});

describe('JqlFunctions', () => {
  it('creates currentUser function', () => {
    expect(JqlFunctions.currentUser()).toEqual({ name: 'currentUser' });
  });

  it('creates now function', () => {
    expect(JqlFunctions.now()).toEqual({ name: 'now' });
  });

  it('creates startOfDay with no offset', () => {
    expect(JqlFunctions.startOfDay()).toEqual({ name: 'startOfDay', args: undefined });
  });

  it('creates startOfDay with offset', () => {
    expect(JqlFunctions.startOfDay('-1d')).toEqual({ name: 'startOfDay', args: ['-1d'] });
  });

  it('creates openSprints function', () => {
    expect(JqlFunctions.openSprints()).toEqual({ name: 'openSprints' });
  });

  it('creates membersOf function with group arg', () => {
    expect(JqlFunctions.membersOf('developers')).toEqual({
      name: 'membersOf',
      args: ['developers'],
    });
  });

  it('creates linkedIssues with args', () => {
    expect(JqlFunctions.linkedIssues('PROJ-123', 'blocks')).toEqual({
      name: 'linkedIssues',
      args: ['PROJ-123', 'blocks'],
    });
  });

  it('creates linkedIssues without args', () => {
    expect(JqlFunctions.linkedIssues()).toEqual({
      name: 'linkedIssues',
      args: undefined,
    });
  });

  it('formats functions correctly in JQL output', () => {
    const result = jql()
      .equals('assignee', JqlFunctions.currentUser())
      .greaterThanOrEqual('created', JqlFunctions.startOfDay('-1d'))
      .build();
    expect(result).toBe('assignee = currentUser() AND created >= startOfDay("-1d")');
  });

  it('formats membersOf in JQL output', () => {
    const result = jql()
      .in('assignee', JqlFunctions.membersOf('team-alpha'))
      .build();
    expect(result).toBe('assignee in membersOf("team-alpha")');
  });
});

describe('JqlTemplates', () => {
  describe('myOpenIssues', () => {
    it('generates query for current user open issues', () => {
      const result = JqlTemplates.myOpenIssues();
      expect(result).toContain('assignee = currentUser()');
      expect(result).toContain('status != Done');
      expect(result).toContain('status != Closed');
      expect(result).toContain('ORDER BY updated DESC');
    });

    it('optionally filters by project', () => {
      const result = JqlTemplates.myOpenIssues('PROJ');
      expect(result).toContain('project = PROJ');
    });
  });

  describe('recentlyUpdated', () => {
    it('generates query for recently updated issues', () => {
      const result = JqlTemplates.recentlyUpdated(7);
      expect(result).toContain('updated >= "-7d"');
      expect(result).toContain('ORDER BY updated DESC');
    });

    it('uses default 7 days', () => {
      const result = JqlTemplates.recentlyUpdated();
      expect(result).toContain('updated >= "-7d"');
    });
  });

  describe('openBugs', () => {
    it('generates query for open bugs', () => {
      const result = JqlTemplates.openBugs('PROJ');
      expect(result).toContain('project = PROJ');
      expect(result).toContain('issuetype = Bug');
      expect(result).toContain('status != Done');
    });

    it('filters by priorities when provided', () => {
      const result = JqlTemplates.openBugs('PROJ', ['High', 'Critical']);
      expect(result).toContain('priority in (High, Critical)');
    });
  });

  describe('sprintBacklog', () => {
    it('generates sprint backlog query', () => {
      const result = JqlTemplates.sprintBacklog(42);
      expect(result).toContain('sprint in openSprints()');
      expect(result).toContain('status != Done');
      expect(result).toContain('ORDER BY rank ASC');
    });
  });

  describe('unassigned', () => {
    it('generates unassigned issues query', () => {
      const result = JqlTemplates.unassigned('PROJ');
      expect(result).toContain('project = PROJ');
      expect(result).toContain('assignee is EMPTY');
      expect(result).toContain('status != Done');
    });
  });

  describe('dueSoon', () => {
    it('generates due soon query', () => {
      const result = JqlTemplates.dueSoon(3, 'PROJ');
      expect(result).toContain('due <= 3d');
      expect(result).toContain('due >= 0d');
      expect(result).toContain('project = PROJ');
    });
  });

  describe('overdue', () => {
    it('generates overdue issues query', () => {
      const result = JqlTemplates.overdue('PROJ');
      expect(result).toContain('due < 0d');
      expect(result).toContain('status != Done');
      expect(result).toContain('project = PROJ');
    });
  });

  describe('createdToday', () => {
    it('generates created today query', () => {
      const result = JqlTemplates.createdToday();
      expect(result).toContain('created >= startOfDay()');
      expect(result).toContain('ORDER BY created DESC');
    });
  });

  describe('currentSprint', () => {
    it('generates current sprint query', () => {
      const result = JqlTemplates.currentSprint('PROJ');
      expect(result).toContain('sprint in openSprints()');
      expect(result).toContain('project = PROJ');
      expect(result).toContain('ORDER BY rank ASC');
    });
  });
});
