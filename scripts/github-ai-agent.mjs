#!/usr/bin/env node
/**
 * GitHub AI Agent - Advanced repository management, CI/CD, and development automation
 * Using OpenAI GPT-4o with GitHub APIs for intelligent code management
 */

import { AIAgent } from '../lib/ai-agent.mjs';
import { Octokit } from '@octokit/rest';
import 'dotenv/config';

class GitHubAIAgent extends AIAgent {
  constructor() {
    // GitHub-specific tools
    const githubTools = [
      {
        name: 'repo_analysis',
        aliases: ['analyze-repo', 'repository-stats', 'repo-health'],
        description: 'Analyze repository health, activity, and statistics',
        execute: async () => this.analyzeRepository()
      },
      {
        name: 'pull_request_management',
        aliases: ['pr-management', 'pull-requests', 'prs'],
        description: 'Manage pull requests, reviews, and merge strategies',
        execute: async (params) => this.managePullRequests(params)
      },
      {
        name: 'issue_management',
        aliases: ['issues', 'bug-tracking', 'issue-analysis'],
        description: 'Manage issues, bugs, and feature requests',
        execute: async (params) => this.manageIssues(params)
      },
      {
        name: 'code_quality_analysis',
        aliases: ['code-quality', 'quality-check', 'code-analysis'],
        description: 'Analyze code quality, security, and best practices',
        execute: async () => this.analyzeCodeQuality()
      },
      {
        name: 'deployment_management',
        aliases: ['deployments', 'releases', 'deployment-status'],
        description: 'Manage deployments, releases, and environments',
        execute: async (params) => this.manageDeployments(params)
      },
      {
        name: 'workflow_automation',
        aliases: ['workflows', 'actions', 'ci-cd'],
        description: 'Manage GitHub Actions workflows and CI/CD',
        execute: async (params) => this.manageWorkflows(params)
      },
      {
        name: 'security_analysis',
        aliases: ['security', 'vulnerabilities', 'security-alerts'],
        description: 'Analyze security vulnerabilities and alerts',
        execute: async () => this.analyzeSecurity()
      },
      {
        name: 'branch_management',
        aliases: ['branches', 'branch-protection', 'git-branches'],
        description: 'Manage branches, protection rules, and merge policies',
        execute: async (params) => this.manageBranches(params)
      },
      {
        name: 'contributor_analysis',
        aliases: ['contributors', 'team-activity', 'developer-stats'],
        description: 'Analyze contributor activity and team performance',
        execute: async () => this.analyzeContributors()
      },
      {
        name: 'project_management',
        aliases: ['projects', 'project-boards', 'kanban'],
        description: 'Manage GitHub Projects and Kanban boards',
        execute: async (params) => this.manageProjects(params)
      },
      {
        name: 'release_management',
        aliases: ['releases', 'versioning', 'changelog'],
        description: 'Manage releases, tags, and version control',
        execute: async (params) => this.manageReleases(params)
      },
      {
        name: 'webhook_management',
        aliases: ['webhooks', 'integrations', 'api-hooks'],
        description: 'Manage webhooks and repository integrations',
        execute: async (params) => this.manageWebhooks(params)
      }
    ];

    super('GitHub AI Agent', 'repository management and development automation', githubTools);
    
    // Initialize GitHub client with both token types after super()
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN_CLASSIC // Primary token
    });
    
    this.octokitFineGrained = new Octokit({
      auth: process.env.GITHUB_TOKEN_FINE_GRAINED // Fine-grained token for specific operations
    });
    
    this.owner = process.env.GITHUB_OWNER || 'DisMurr';
    this.repo = process.env.GITHUB_REPO || 'HormoneGroup';
  }

  // GitHub Tools Implementation

  async analyzeRepository() {
    try {
      const [repo, contributors, languages, commits, issues, prs] = await Promise.all([
        this.octokit.rest.repos.get({ owner: this.owner, repo: this.repo }),
        this.octokit.rest.repos.listContributors({ owner: this.owner, repo: this.repo }),
        this.octokit.rest.repos.listLanguages({ owner: this.owner, repo: this.repo }),
        this.octokit.rest.repos.listCommits({ owner: this.owner, repo: this.repo, per_page: 10 }),
        this.octokit.rest.issues.listForRepo({ owner: this.owner, repo: this.repo, state: 'all', per_page: 10 }),
        this.octokit.rest.pulls.list({ owner: this.owner, repo: this.repo, state: 'all', per_page: 10 })
      ]);

      const analysis = {
        repository: {
          name: repo.data.full_name,
          description: repo.data.description,
          stars: repo.data.stargazers_count,
          forks: repo.data.forks_count,
          watchers: repo.data.subscribers_count,
          size: repo.data.size,
          defaultBranch: repo.data.default_branch,
          visibility: repo.data.visibility,
          createdAt: repo.data.created_at,
          updatedAt: repo.data.updated_at,
          hasIssues: repo.data.has_issues,
          hasProjects: repo.data.has_projects,
          hasWiki: repo.data.has_wiki
        },
        activity: {
          totalContributors: contributors.data.length,
          recentCommits: commits.data.length,
          openIssues: repo.data.open_issues_count,
          totalIssues: issues.data.length,
          totalPullRequests: prs.data.length,
          openPullRequests: prs.data.filter(pr => pr.state === 'open').length
        },
        languages: languages.data,
        health: {
          hasReadme: repo.data.has_readme,
          hasLicense: repo.data.license !== null,
          hasDescription: repo.data.description !== null,
          recentActivity: commits.data.length > 0,
          healthScore: this.calculateHealthScore(repo.data, contributors.data, commits.data)
        },
        recommendations: this.generateRepoRecommendations(repo.data, contributors.data, commits.data)
      };

      return analysis;
    } catch (error) {
      return { error: `Repository analysis failed: ${error.message}` };
    }
  }

  async managePullRequests(params = {}) {
    try {
      const { action = 'list', number, title, body, base = 'main', head } = params;

      switch (action) {
        case 'list':
          const prs = await this.octokit.rest.pulls.list({
            owner: this.owner,
            repo: this.repo,
            state: 'open',
            per_page: 20
          });

          return {
            pullRequests: prs.data.map(pr => ({
              number: pr.number,
              title: pr.title,
              author: pr.user.login,
              state: pr.state,
              createdAt: pr.created_at,
              updatedAt: pr.updated_at,
              mergeable: pr.mergeable,
              draft: pr.draft,
              reviewRequests: pr.requested_reviewers?.length || 0,
              comments: pr.comments,
              commits: pr.commits,
              additions: pr.additions,
              deletions: pr.deletions,
              changedFiles: pr.changed_files
            }))
          };

        case 'create':
          if (!head || !title) {
            throw new Error('Head branch and title are required for creating PR');
          }
          
          const newPR = await this.octokit.rest.pulls.create({
            owner: this.owner,
            repo: this.repo,
            title,
            body: body || `AI-generated pull request: ${title}`,
            head,
            base
          });

          return {
            created: true,
            pullRequest: {
              number: newPR.data.number,
              title: newPR.data.title,
              url: newPR.data.html_url
            }
          };

        case 'review':
          if (!number) {
            throw new Error('PR number is required for review');
          }

          const reviews = await this.octokit.rest.pulls.listReviews({
            owner: this.owner,
            repo: this.repo,
            pull_number: number
          });

          const files = await this.octokit.rest.pulls.listFiles({
            owner: this.owner,
            repo: this.repo,
            pull_number: number
          });

          return {
            prNumber: number,
            reviews: reviews.data.map(review => ({
              id: review.id,
              user: review.user.login,
              state: review.state,
              body: review.body,
              submittedAt: review.submitted_at
            })),
            files: files.data.map(file => ({
              filename: file.filename,
              status: file.status,
              additions: file.additions,
              deletions: file.deletions,
              changes: file.changes
            }))
          };

        default:
          return { error: `Unknown PR action: ${action}` };
      }
    } catch (error) {
      return { error: `Pull request management failed: ${error.message}` };
    }
  }

  async manageIssues(params = {}) {
    try {
      const { action = 'list', number, title, body, labels = [], assignees = [] } = params;

      switch (action) {
        case 'list':
          const issues = await this.octokit.rest.issues.listForRepo({
            owner: this.owner,
            repo: this.repo,
            state: 'open',
            per_page: 20
          });

          return {
            issues: issues.data
              .filter(issue => !issue.pull_request) // Filter out PRs
              .map(issue => ({
                number: issue.number,
                title: issue.title,
                author: issue.user.login,
                state: issue.state,
                labels: issue.labels.map(label => label.name),
                assignees: issue.assignees.map(assignee => assignee.login),
                createdAt: issue.created_at,
                updatedAt: issue.updated_at,
                comments: issue.comments
              }))
          };

        case 'create':
          if (!title) {
            throw new Error('Title is required for creating issue');
          }

          const newIssue = await this.octokit.rest.issues.create({
            owner: this.owner,
            repo: this.repo,
            title,
            body: body || `AI-generated issue: ${title}`,
            labels,
            assignees
          });

          return {
            created: true,
            issue: {
              number: newIssue.data.number,
              title: newIssue.data.title,
              url: newIssue.data.html_url
            }
          };

        case 'analyze':
          const allIssues = await this.octokit.rest.issues.listForRepo({
            owner: this.owner,
            repo: this.repo,
            state: 'all',
            per_page: 100
          });

          const issuesOnly = allIssues.data.filter(issue => !issue.pull_request);
          
          return {
            analysis: {
              total: issuesOnly.length,
              open: issuesOnly.filter(issue => issue.state === 'open').length,
              closed: issuesOnly.filter(issue => issue.state === 'closed').length,
              averageTimeToClose: this.calculateAverageTimeToClose(issuesOnly),
              topLabels: this.getTopLabels(issuesOnly),
              topAssignees: this.getTopAssignees(issuesOnly)
            }
          };

        default:
          return { error: `Unknown issue action: ${action}` };
      }
    } catch (error) {
      return { error: `Issue management failed: ${error.message}` };
    }
  }

  async analyzeCodeQuality() {
    try {
      // Get repository content and analyze
      const [contents, languages, commits] = await Promise.all([
        this.octokit.rest.repos.getContent({ owner: this.owner, repo: this.repo, path: '' }),
        this.octokit.rest.repos.listLanguages({ owner: this.owner, repo: this.repo }),
        this.octokit.rest.repos.listCommits({ owner: this.owner, repo: this.repo, per_page: 50 })
      ]);

      const analysis = {
        languages: languages.data,
        structure: {
          hasPackageJson: contents.data.some(item => item.name === 'package.json'),
          hasReadme: contents.data.some(item => item.name.toLowerCase().includes('readme')),
          hasGitignore: contents.data.some(item => item.name === '.gitignore'),
          hasLicense: contents.data.some(item => item.name.toLowerCase().includes('license')),
          hasDocumentation: contents.data.some(item => item.name.toLowerCase().includes('doc')),
          hasTests: contents.data.some(item => 
            item.name.toLowerCase().includes('test') || 
            item.name.toLowerCase().includes('spec')
          )
        },
        commitActivity: {
          recentCommits: commits.data.length,
          averageCommitsPerDay: this.calculateCommitsPerDay(commits.data),
          commitMessageQuality: this.analyzeCommitMessages(commits.data)
        },
        recommendations: [
          'Consider implementing automated testing',
          'Add comprehensive documentation',
          'Set up continuous integration',
          'Implement code linting and formatting',
          'Add security scanning'
        ]
      };

      return analysis;
    } catch (error) {
      return { error: `Code quality analysis failed: ${error.message}` };
    }
  }

  async manageDeployments(params = {}) {
    try {
      const deployments = await this.octokit.rest.repos.listDeployments({
        owner: this.owner,
        repo: this.repo,
        per_page: 10
      });

      const deploymentStats = await Promise.all(
        deployments.data.map(async deployment => {
          const statuses = await this.octokit.rest.repos.listDeploymentStatuses({
            owner: this.owner,
            repo: this.repo,
            deployment_id: deployment.id
          });

          return {
            id: deployment.id,
            environment: deployment.environment,
            ref: deployment.ref,
            sha: deployment.sha,
            createdAt: deployment.created_at,
            updatedAt: deployment.updated_at,
            status: statuses.data[0]?.state || 'unknown',
            description: statuses.data[0]?.description || ''
          };
        })
      );

      return {
        deployments: deploymentStats,
        summary: {
          total: deployments.data.length,
          environments: [...new Set(deployments.data.map(d => d.environment))],
          recentActivity: deployments.data.slice(0, 5)
        }
      };
    } catch (error) {
      return { error: `Deployment management failed: ${error.message}` };
    }
  }

  async manageWorkflows(params = {}) {
    try {
      const workflows = await this.octokit.rest.actions.listRepoWorkflows({
        owner: this.owner,
        repo: this.repo
      });

      const workflowRuns = await this.octokit.rest.actions.listWorkflowRunsForRepo({
        owner: this.owner,
        repo: this.repo,
        per_page: 20
      });

      return {
        workflows: workflows.data.workflows.map(workflow => ({
          id: workflow.id,
          name: workflow.name,
          path: workflow.path,
          state: workflow.state,
          createdAt: workflow.created_at,
          updatedAt: workflow.updated_at
        })),
        recentRuns: workflowRuns.data.workflow_runs.map(run => ({
          id: run.id,
          name: run.name,
          status: run.status,
          conclusion: run.conclusion,
          createdAt: run.created_at,
          updatedAt: run.updated_at,
          headBranch: run.head_branch,
          event: run.event
        })),
        summary: {
          totalWorkflows: workflows.data.total_count,
          activeWorkflows: workflows.data.workflows.filter(w => w.state === 'active').length,
          recentRunsCount: workflowRuns.data.total_count
        }
      };
    } catch (error) {
      return { error: `Workflow management failed: ${error.message}` };
    }
  }

  async analyzeSecurity() {
    try {
      // Note: Some security endpoints require specific permissions
      const analysis = {
        securityAdvisories: 'Requires elevated permissions',
        dependabotAlerts: 'Requires elevated permissions',
        codeScanning: 'Requires elevated permissions',
        secretScanning: 'Requires elevated permissions',
        recommendations: [
          'Enable Dependabot security updates',
          'Set up CodeQL code scanning',
          'Configure secret scanning',
          'Review repository permissions regularly',
          'Use signed commits',
          'Implement branch protection rules'
        ],
        bestPractices: {
          twoFactorAuth: 'Ensure all contributors use 2FA',
          accessReview: 'Regular access reviews and permission audits',
          secretManagement: 'Use environment variables for secrets',
          dependencyManagement: 'Keep dependencies up to date'
        }
      };

      return analysis;
    } catch (error) {
      return { error: `Security analysis failed: ${error.message}` };
    }
  }

  async manageBranches(params = {}) {
    try {
      const branches = await this.octokit.rest.repos.listBranches({
        owner: this.owner,
        repo: this.repo,
        per_page: 50
      });

      const branchAnalysis = branches.data.map(branch => ({
        name: branch.name,
        protected: branch.protected,
        lastCommit: {
          sha: branch.commit.sha,
          url: branch.commit.url
        }
      }));

      return {
        branches: branchAnalysis,
        summary: {
          total: branches.data.length,
          protected: branches.data.filter(b => b.protected).length,
          defaultBranch: branches.data.find(b => b.name === 'main' || b.name === 'master')?.name
        },
        recommendations: [
          'Implement branch protection rules for main branch',
          'Require pull request reviews before merging',
          'Enable status checks for critical branches',
          'Consider automated branch cleanup for stale branches'
        ]
      };
    } catch (error) {
      return { error: `Branch management failed: ${error.message}` };
    }
  }

  async analyzeContributors() {
    try {
      const [contributors, commits] = await Promise.all([
        this.octokit.rest.repos.listContributors({ owner: this.owner, repo: this.repo }),
        this.octokit.rest.repos.listCommits({ owner: this.owner, repo: this.repo, per_page: 100 })
      ]);

      const contributorAnalysis = contributors.data.map(contributor => {
        const userCommits = commits.data.filter(commit => 
          commit.author?.login === contributor.login
        );

        return {
          login: contributor.login,
          contributions: contributor.contributions,
          recentCommits: userCommits.length,
          avatarUrl: contributor.avatar_url,
          profileUrl: contributor.html_url,
          type: contributor.type
        };
      });

      return {
        contributors: contributorAnalysis,
        summary: {
          total: contributors.data.length,
          topContributor: contributorAnalysis[0]?.login,
          averageContributions: contributorAnalysis.reduce((acc, c) => acc + c.contributions, 0) / contributorAnalysis.length,
          teamHealth: contributorAnalysis.length > 1 ? 'Collaborative' : 'Single maintainer'
        }
      };
    } catch (error) {
      return { error: `Contributor analysis failed: ${error.message}` };
    }
  }

  async manageProjects(params = {}) {
    try {
      // GitHub Projects v2 requires different API endpoints
      return {
        message: 'GitHub Projects management coming soon',
        currentStatus: 'Projects API integration in development',
        recommendations: [
          'Use GitHub Projects for task management',
          'Create automated workflows between issues and project boards',
          'Set up project templates for consistent planning'
        ]
      };
    } catch (error) {
      return { error: `Project management failed: ${error.message}` };
    }
  }

  async manageReleases(params = {}) {
    try {
      const releases = await this.octokit.rest.repos.listReleases({
        owner: this.owner,
        repo: this.repo,
        per_page: 10
      });

      return {
        releases: releases.data.map(release => ({
          id: release.id,
          tagName: release.tag_name,
          name: release.name,
          draft: release.draft,
          prerelease: release.prerelease,
          createdAt: release.created_at,
          publishedAt: release.published_at,
          author: release.author.login,
          assetsCount: release.assets.length,
          downloadCount: release.assets.reduce((acc, asset) => acc + asset.download_count, 0)
        })),
        summary: {
          totalReleases: releases.data.length,
          latestRelease: releases.data[0]?.tag_name,
          totalDownloads: releases.data.reduce((acc, release) => 
            acc + release.assets.reduce((assetAcc, asset) => assetAcc + asset.download_count, 0), 0
          )
        }
      };
    } catch (error) {
      return { error: `Release management failed: ${error.message}` };
    }
  }

  async manageWebhooks(params = {}) {
    try {
      const webhooks = await this.octokit.rest.repos.listWebhooks({
        owner: this.owner,
        repo: this.repo
      });

      return {
        webhooks: webhooks.data.map(webhook => ({
          id: webhook.id,
          name: webhook.name,
          active: webhook.active,
          events: webhook.events,
          config: {
            url: webhook.config.url,
            contentType: webhook.config.content_type,
            insecureSsl: webhook.config.insecure_ssl
          },
          createdAt: webhook.created_at,
          updatedAt: webhook.updated_at
        })),
        summary: {
          total: webhooks.data.length,
          active: webhooks.data.filter(w => w.active).length,
          events: [...new Set(webhooks.data.flatMap(w => w.events))]
        }
      };
    } catch (error) {
      return { error: `Webhook management failed: ${error.message}` };
    }
  }

  // Helper methods
  calculateHealthScore(repo, contributors, commits) {
    let score = 0;
    if (repo.description) score += 10;
    if (repo.license) score += 15;
    if (contributors.length > 1) score += 20;
    if (commits.length > 5) score += 25;
    if (repo.has_issues) score += 10;
    if (repo.has_readme) score += 20;
    return Math.min(score, 100);
  }

  generateRepoRecommendations(repo, contributors, commits) {
    const recommendations = [];
    if (!repo.description) recommendations.push('Add a repository description');
    if (!repo.license) recommendations.push('Add a license file');
    if (contributors.length === 1) recommendations.push('Consider adding more contributors');
    if (commits.length < 5) recommendations.push('Increase development activity');
    if (!repo.has_issues) recommendations.push('Enable issue tracking');
    return recommendations;
  }

  calculateAverageTimeToClose(issues) {
    const closedIssues = issues.filter(issue => issue.state === 'closed' && issue.closed_at);
    if (closedIssues.length === 0) return 'N/A';
    
    const totalDays = closedIssues.reduce((acc, issue) => {
      const created = new Date(issue.created_at);
      const closed = new Date(issue.closed_at);
      return acc + (closed - created) / (1000 * 60 * 60 * 24);
    }, 0);
    
    return Math.round(totalDays / closedIssues.length);
  }

  getTopLabels(issues) {
    const labelCounts = {};
    issues.forEach(issue => {
      issue.labels.forEach(label => {
        labelCounts[label.name] = (labelCounts[label.name] || 0) + 1;
      });
    });
    
    return Object.entries(labelCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([label, count]) => ({ label, count }));
  }

  getTopAssignees(issues) {
    const assigneeCounts = {};
    issues.forEach(issue => {
      issue.assignees.forEach(assignee => {
        assigneeCounts[assignee.login] = (assigneeCounts[assignee.login] || 0) + 1;
      });
    });
    
    return Object.entries(assigneeCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([assignee, count]) => ({ assignee, count }));
  }

  calculateCommitsPerDay(commits) {
    if (commits.length === 0) return 0;
    const oldestCommit = new Date(commits[commits.length - 1].commit.author.date);
    const newestCommit = new Date(commits[0].commit.author.date);
    const daysDiff = (newestCommit - oldestCommit) / (1000 * 60 * 60 * 24);
    return daysDiff > 0 ? (commits.length / daysDiff).toFixed(2) : 0;
  }

  analyzeCommitMessages(commits) {
    const messages = commits.map(c => c.commit.message);
    return {
      averageLength: messages.reduce((acc, msg) => acc + msg.length, 0) / messages.length,
      conventional: messages.filter(msg => /^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?: .+/.test(msg)).length,
      conventionalPercentage: (messages.filter(msg => /^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?: .+/.test(msg)).length / messages.length * 100).toFixed(1)
    };
  }
}

// CLI Interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const agent = new GitHubAIAgent();
  const userInput = process.argv.slice(2).join(' ') || 'analyze repository health and provide insights';
  
  agent.processRequest(userInput).then(result => {
    console.log('\n=== GITHUB AI AGENT RESULT ===');
    console.log(JSON.stringify(result, null, 2));
  }).catch(error => {
    console.error('GitHub AI Agent failed:', error);
    process.exit(1);
  });
}

export default GitHubAIAgent;
