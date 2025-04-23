import * as vscode from 'vscode';
interface PRQuickPickItem {
  label: string;
  pr?: any;
  loadMore?: boolean;
}
import { getPullRequests, getPullRequestDiff, getRepositoryReadme } from './github';
import { generateMarpFromPR } from './openai';

async function generateSlideFrom(pr: any, context: vscode.ExtensionContext) {
  const token = await getSecret(context, 'pr2slide.githubToken');
  if (!token) {
    vscode.window.showErrorMessage('GitHub token is missing.');
    return;
  }

  let openaiToken = await getSecret(context, 'pr2slide.openaiToken');
  if (!openaiToken) {
    const input = await vscode.window.showInputBox({
      prompt: 'Enter your OpenAI API Key',
      ignoreFocusOut: true,
      password: true,
    });
    if (input) {
      await context.secrets.store('pr2slide.openaiToken', input);
      vscode.window.showInformationMessage('OpenAI token saved securely.');
      openaiToken = input;
    } else {
      vscode.window.showWarningMessage('OpenAI token is required to generate slides.');
      return;
    }
  }

  const repo = await detectRepo();
  if (!repo) {return;}

  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Window,
    title: "Generating Slides",
    cancellable: false
  }, async (progress) => {
    progress.report({ message: "Fetching pull request diff..." });
    const diff = await getPullRequestDiff(repo, pr.number, token);
    progress.report({ message: "Fetching repository README..." });
    const readme = await getRepositoryReadme(repo, token);
    progress.report({ message: "Generating slides..." });
    const markdown = await generateMarpFromPR(pr, diff, readme, openaiToken);

    const doc = await vscode.workspace.openTextDocument({ language: 'markdown', content: markdown });
    await vscode.window.showTextDocument(doc);
    await vscode.commands.executeCommand('markdown.showPreviewToSide');
  });
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('prListView', new PRListProvider(context))
  );

  const generateCommand = vscode.commands.registerCommand('pr2slide.generateSlide', async () => {
    const token = await getSecret(context, 'pr2slide.githubToken');
    const openaiToken = await getSecret(context, 'pr2slide.openaiToken');

    if (!token || !openaiToken) {
      vscode.window.showErrorMessage('Missing GitHub or OpenAI token in SecretStorage.');
      return;
    }

    const repo = await detectRepo();
    if (!repo) {
      vscode.window.showErrorMessage('Could not detect GitHub repository.');
      return;
    }

    let prs: any[] = [];
    let page = 1;
    let hasMore = true;

    const quickPick = vscode.window.createQuickPick();
    quickPick.placeholder = 'Select a pull request to generate slides';
    quickPick.onDidChangeSelection(async (selection) => {
      if (selection[0]) {
        const selected = selection[0];
        if ('loadMore' in selected && selected.loadMore) {
          const lastActiveItem = quickPick.activeItems[0];
          quickPick.busy = true;
          page++;
          await loadPRs();
          quickPick.activeItems = [lastActiveItem];
          quickPick.busy = false;
        } else if ('pr' in selected) {
          await generateSlideFrom(selected.pr, context);
          quickPick.hide();
        }
      }
    });

    const loadPRs = async () => {
      const fetchedPrs = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Window,
        title: "Fetching Pull Requests",
        cancellable: false
      }, async (progress) => {
        progress.report({ message: "Fetching pull requests..." });
        return await getPullRequests(repo, token, page);
      });

      prs = prs.concat(fetchedPrs);
      hasMore = fetchedPrs.length > 0;

      const newItems = fetchedPrs.map((pr) => ({ label: `#${pr.number}: ${pr.title}`, pr } as PRQuickPickItem));
      const currentItems = (quickPick.items as PRQuickPickItem[]).filter(item => !item.loadMore);
      quickPick.items = [
        ...currentItems,
        ...newItems,
        ...(hasMore ? [{ label: 'Load more...', loadMore: true } as PRQuickPickItem] : [])
      ];
    };

    await loadPRs();
    quickPick.show();
  });

  const setGithubTokenCommand = vscode.commands.registerCommand('pr2slide.setGitHubToken', async () => {
    const githubToken = await vscode.window.showInputBox({
      prompt: 'Enter your GitHub Personal Access Token',
      ignoreFocusOut: true,
      password: true,
    });
    if (githubToken) {
      await context.secrets.store('pr2slide.githubToken', githubToken);
      vscode.window.showInformationMessage('GitHub token saved securely.');
    }
  });

  const setOpenaiTokenCommand = vscode.commands.registerCommand('pr2slide.setOpenAIApiKey', async () => {
    const openaiToken = await vscode.window.showInputBox({
      prompt: 'Enter your OpenAI API Key',
      ignoreFocusOut: true,
      password: true,
    });
    if (openaiToken) {
      await context.secrets.store('pr2slide.openaiToken', openaiToken);
      vscode.window.showInformationMessage('OpenAI token saved securely.');
    }
  });

  const generateSlideFromPR = vscode.commands.registerCommand('pr2slide.generateSlideFromPR', async (pr: any) => {
    await generateSlideFrom(pr, context);
  });

  context.subscriptions.push(generateCommand, setGithubTokenCommand, setOpenaiTokenCommand, generateSlideFromPR);
}

async function detectRepo(): Promise<string | undefined> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return undefined;
  }

  const uri = folders[0].uri;
  const gitExtension = vscode.extensions.getExtension('vscode.git');
  await gitExtension?.activate(); // Ensure activation

  const api = gitExtension?.exports?.getAPI(1);
  const repo = api?.repositories?.[0]?.state?.remotes?.[0]?.fetchUrl;
  if (!repo) {
    return undefined;
  }

  const match = repo.match(/github.com[/:](.+?)(\.git)?$/);
  return match?.[1];
}

async function getSecret(context: vscode.ExtensionContext, key: string): Promise<string | undefined> {
  return await context.secrets.get(key);
}

class PRListProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData: vscode.Event<void> = this._onDidChangeTreeData.event;

  constructor(private context?: vscode.ExtensionContext) {}

  async getTreeItem(element: vscode.TreeItem): Promise<vscode.TreeItem> {
    return element;
  }

  async getChildren(): Promise<vscode.TreeItem[]> {
    if (!this.context) {
      return [];
    }

    let token = await getSecret(this.context, 'pr2slide.githubToken');
    if (!token) {
      const input = await vscode.window.showInputBox({
        prompt: 'Enter your GitHub Personal Access Token',
        ignoreFocusOut: true,
        password: true,
      });
      if (input) {
        await this.context.secrets.store('pr2slide.githubToken', input);
        vscode.window.showInformationMessage('GitHub token saved securely.');
        token = input;
      } else {
        vscode.window.showWarningMessage('GitHub token is required to load PRs.');
        return [];
      }
    }

    const repo = await detectRepo();
    if (!repo) {
      vscode.window.showWarningMessage('Could not detect GitHub repository.');
      return [];
    }

    const prs = await getPullRequests(repo, token, 1);

    return prs.map((pr: any) => {
      const item = new vscode.TreeItem(`#${pr.number}: ${pr.title}`, vscode.TreeItemCollapsibleState.None);
      item.command = {
        command: 'pr2slide.generateSlideFromPR',
        title: 'Generate Slide',
        arguments: [pr],
      };
      return item;
    });
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
}
